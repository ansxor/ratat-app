import { json, type QueryContext } from "@atcute/xrpc-server";
import type { Database } from "@ratat/db/effect";
import type {
  NetRatatFeedDefs,
  NetRatatFeedGetAuthorFeed,
  NetRatatFeedGetPost,
  NetRatatFeedGetTimeline,
} from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "../appview.ts";
import { nearestCursor, rememberCursor } from "../cursor-cache.ts";
import { postNotFound, upstreamFailure } from "../errors.ts";
import type { RouteEffect } from "../handler.ts";
import { noteInterestInBackground } from "../interest.ts";
import {
  type ActorRow,
  actorByDid,
  actorByHandle,
  decodeFeedCursor,
  encodeFeedCursor,
  indexedFeedAfter,
  indexedFeedPage,
  indexedFeedSample,
  indexedPost,
  timelinePage,
} from "../store.ts";
import { artworkView, postView, rowPostView } from "../views.ts";
import { resolveViewer } from "../viewer.ts";

const DEFAULT_LIMIT = 30;

type Did = NetRatatFeedDefs.PostView["author"]["did"];
type AtUri = NetRatatFeedDefs.PostView["uri"];

/**
 * The index row for an actor, or undefined when we have never heard of them —
 * or when Postgres is unreachable, in which case the caller serves live.
 */
const indexedActor = (actor: string): Effect.Effect<ActorRow | undefined, never, Database> =>
  (actor.startsWith("did:") ? actorByDid(actor) : actorByHandle(actor)).pipe(
    Effect.catchAll((error) =>
      Effect.logWarning(
        `index lookup for ${actor} failed, serving live: ${String(error.cause)}`,
      ).pipe(Effect.as(undefined)),
    ),
  );

// --------------------------------------------------------------- indexed reads

/**
 * A page of a backfilled portfolio out of Postgres. Pages are offsets over an
 * ordered index, so page 40 costs one query — the cursor walk further down only
 * exists for actors the index does not hold yet.
 *
 * Returns undefined when this read cannot be answered from the index after all,
 * which asks the caller to serve live instead.
 */
const indexedAuthorFeed = (
  row: ActorRow,
  limit: number,
  page: number,
  cursor: string | undefined,
): Effect.Effect<NetRatatFeedGetAuthorFeed.$output | undefined, never, Database> =>
  Effect.gen(function* () {
    const after = cursor === undefined ? undefined : decodeFeedCursor(cursor);
    // A cursor we did not mint came from the live path; it means nothing here.
    if (cursor !== undefined && after === undefined) return undefined;

    const result = yield* after === undefined
      ? indexedFeedPage(row.did, limit, page)
      : indexedFeedAfter(row.did, limit, after);

    const feed = result.rows
      .map((indexed) => rowPostView(indexed, row))
      .filter((view): view is NetRatatFeedDefs.PostView => view !== undefined);

    const last = result.rows[result.rows.length - 1];
    return {
      feed,
      ...(cursor === undefined ? { page: result.page } : {}),
      ...(cursor === undefined && result.total !== undefined ? { total: result.total } : {}),
      ...(result.hasMore && last ? { cursor: encodeFeedCursor(last) } : {}),
    };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logWarning(
        `indexed feed for ${row.did} failed, serving live: ${String(error.cause)}`,
      ).pipe(Effect.as(undefined)),
    ),
  );

// ------------------------------------------------------------------ live reads

interface FeedPage {
  feed: NetRatatFeedDefs.PostView[];
  cursor?: string | undefined;
}

const fetchPage = (
  actor: NetRatatFeedGetAuthorFeed.$params["actor"],
  limit: number | undefined,
  cursor: string | undefined,
  signal: AbortSignal | undefined,
): RouteEffect<FeedPage> =>
  Effect.gen(function* () {
    const appview = yield* Appview;

    const res = yield* Effect.tryPromise({
      try: () =>
        appview.client.get("app.bsky.feed.getAuthorFeed", {
          params: {
            actor,
            limit,
            filter: "posts_with_media",
            includePins: false,
            ...(cursor ? { cursor } : {}),
          },
          signal,
        }),
      catch: appviewUnreachable,
    });
    if (!res.ok) return yield* Effect.fail(actorRequestFailed(actor, res.data));

    return {
      feed: res.data.feed
        .map(postView)
        .filter((post): post is NetRatatFeedDefs.PostView => post !== undefined),
      cursor: res.data.cursor,
    };
  });

const liveAuthorFeed = (
  actor: NetRatatFeedGetAuthorFeed.$params["actor"],
  limit: number | undefined,
  page: number,
  cursor: string | undefined,
  signal: AbortSignal | undefined,
): RouteEffect<NetRatatFeedGetAuthorFeed.$output> =>
  Effect.gen(function* () {
    // Upstream pages by cursor only, so a page number is reached by walking
    // from the deepest cursor already known — page 1 when nothing is cached.
    const start =
      cursor === undefined ? nearestCursor(actor, limit ?? DEFAULT_LIMIT, page) : undefined;

    let current = start?.page ?? 1;
    let result = yield* fetchPage(actor, limit, cursor ?? start?.cursor, signal);

    // The byline of a post we just fetched is a free profile snapshot, so one
    // feed read is enough to enter the interested set and get backfilled.
    const seen = result.feed[0]?.author;
    if (seen) yield* noteInterestInBackground(seen);

    // A feed that runs out before the requested page ends on its last page,
    // which is what a pager asking for a page past the end should show.
    while (cursor === undefined && current < page && result.cursor !== undefined) {
      const next = result.cursor;
      current++;
      rememberCursor(actor, limit ?? DEFAULT_LIMIT, current, next);
      result = yield* fetchPage(actor, limit, next, signal);
    }

    return {
      feed: result.feed,
      // Where the walk stopped, which a pager needs to tell "page 40" from
      // "the last page, because the feed ran out on the way to page 40".
      ...(cursor === undefined ? { page: current } : {}),
      ...(result.cursor ? { cursor: result.cursor } : {}),
    };
  });

// ------------------------------------------------------------- random samples

/** Fisher–Yates; returns a new array without mutating the input. */
const shuffle = <T>(items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};

/** How much of a live feed one sample draws from — the first page only. */
const SAMPLE_POOL_LIMIT = 100;

/**
 * A random sample of an actor's works. The index samples the whole portfolio;
 * an actor not backfilled yet is sampled from their newest hundred instead,
 * which is as far back as one upstream read can see.
 */
const sampledAuthorFeed = (
  actor: NetRatatFeedGetAuthorFeed.$params["actor"],
  row: ActorRow | undefined,
  limit: number,
  signal: AbortSignal | undefined,
): RouteEffect<NetRatatFeedGetAuthorFeed.$output> =>
  Effect.gen(function* () {
    if (row?.backfilledAt) {
      const rows = yield* indexedFeedSample(row.did, limit).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(
            `indexed sample for ${row.did} failed, serving live: ${String(error.cause)}`,
          ).pipe(Effect.as(undefined)),
        ),
      );
      if (rows !== undefined) {
        yield* Effect.logDebug(`getAuthorFeed ${actor} sample served from index`);
        return {
          feed: rows
            .map((indexed) => rowPostView(indexed, row))
            .filter((view): view is NetRatatFeedDefs.PostView => view !== undefined),
        };
      }
    }

    const result = yield* fetchPage(actor, SAMPLE_POOL_LIMIT, undefined, signal);
    const seen = result.feed[0]?.author;
    if (seen) yield* noteInterestInBackground(seen);
    return { feed: shuffle(result.feed).slice(0, limit) };
  });

export const feedGetAuthorFeed = (
  ctx: QueryContext<NetRatatFeedGetAuthorFeed.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { actor, limit, cursor } = ctx.params;
    const page = ctx.params.page ?? 1;

    const row = yield* indexedActor(actor);

    if (ctx.params.sample) {
      return json(yield* sampledAuthorFeed(actor, row, limit ?? DEFAULT_LIMIT, ctx.signal));
    }

    if (row?.backfilledAt) {
      const indexed = yield* indexedAuthorFeed(row, limit ?? DEFAULT_LIMIT, page, cursor);
      if (indexed !== undefined) {
        yield* Effect.logDebug(`getAuthorFeed ${actor} served from index`);
        return json(indexed);
      }
    }

    return json(yield* liveAuthorFeed(actor, limit, page, cursor, ctx.signal));
  });

// -------------------------------------------------------------------- timeline

/**
 * The home gallery. Unlike an author feed this has no live fallback: a
 * timeline is a join over the Ratat graph, and only the index holds one. An
 * artist the viewer follows who has not been backfilled yet simply contributes
 * nothing until the worker reaches them.
 */
export const feedGetTimeline = (
  ctx: QueryContext<NetRatatFeedGetTimeline.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { limit } = ctx.params;
    const page = ctx.params.page ?? 1;

    const viewer = yield* resolveViewer(ctx.params.viewer, ctx.signal);
    const result = yield* timelinePage(viewer.did, limit ?? DEFAULT_LIMIT, page).pipe(
      Effect.mapError(() => upstreamFailure("the local index is unavailable")),
    );

    const output: NetRatatFeedGetTimeline.$output = {
      feed: result.items
        .map((item) => rowPostView(item.post, item.author))
        .filter((view): view is NetRatatFeedDefs.PostView => view !== undefined),
      page: result.page,
      total: result.total,
    };
    return json(output);
  });

// ----------------------------------------------------------------- single post

/** `getPosts` only takes at-uris, so a handle has to become a DID first. */
const resolveDid = (
  actor: NetRatatFeedGetPost.$params["actor"],
  known: ActorRow | undefined,
  signal: AbortSignal | undefined,
): RouteEffect<Did> =>
  Effect.gen(function* () {
    if (actor.startsWith("did:")) return actor as Did;
    if (known) return known.did as Did;

    const appview = yield* Appview;
    const res = yield* Effect.tryPromise({
      try: () =>
        appview.client.get("app.bsky.actor.getProfile", {
          params: { actor },
          ...(signal ? { signal } : {}),
        }),
      catch: appviewUnreachable,
    });
    if (!res.ok) return yield* Effect.fail(actorRequestFailed(actor, res.data));
    return res.data.did;
  });

export const feedGetPost = (
  ctx: QueryContext<NetRatatFeedGetPost.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { actor, rkey } = ctx.params;

    const known = yield* indexedActor(actor);
    const did = yield* resolveDid(actor, known, ctx.signal);
    const uri = `at://${did}/app.bsky.feed.post/${rkey}` as AtUri;

    const author = known?.did === did ? known : yield* indexedActor(did);
    if (author) {
      const row = yield* indexedPost(uri).pipe(Effect.orElseSucceed(() => undefined));
      const view = row ? rowPostView(row, author) : undefined;
      if (view) {
        yield* Effect.logDebug(`getPost ${uri} served from index`);
        const indexedOutput: NetRatatFeedGetPost.$output = { post: view };
        return json(indexedOutput);
      }
    }

    const appview = yield* Appview;
    const res = yield* Effect.tryPromise({
      try: () =>
        appview.client.get("app.bsky.feed.getPosts", {
          params: { uris: [uri] },
          signal: ctx.signal,
        }),
      catch: appviewUnreachable,
    });
    if (!res.ok) return yield* Effect.fail(actorRequestFailed(actor, res.data));

    const first = res.data.posts[0];
    const post = first === undefined ? undefined : artworkView(first);
    if (post === undefined) return yield* Effect.fail(postNotFound(actor, rkey));

    yield* noteInterestInBackground(post.author);

    const output: NetRatatFeedGetPost.$output = { post };
    return json(output);
  });
