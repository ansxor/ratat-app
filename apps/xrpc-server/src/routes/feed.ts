import { json, type QueryContext } from "@atcute/xrpc-server";
import type {
  ArtRatatFeedDefs,
  ArtRatatFeedGetAuthorFeed,
  ArtRatatFeedGetPost,
} from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "../appview.ts";
import { nearestCursor, rememberCursor } from "../cursor-cache.ts";
import { postNotFound } from "../errors.ts";
import type { RouteEffect } from "../handler.ts";
import { artworkView, postView } from "../views.ts";

interface FeedPage {
  feed: ArtRatatFeedDefs.PostView[];
  cursor?: string | undefined;
}

const fetchPage = (
  actor: ArtRatatFeedGetAuthorFeed.$params["actor"],
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
        .filter((post): post is ArtRatatFeedDefs.PostView => post !== undefined),
      cursor: res.data.cursor,
    };
  });

const DEFAULT_LIMIT = 30;

export const feedGetAuthorFeed = (
  ctx: QueryContext<ArtRatatFeedGetAuthorFeed.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { actor, limit, cursor } = ctx.params;
    const page = ctx.params.page ?? 1;
    // Upstream pages by cursor only, so a page number is reached by walking
    // from the deepest cursor already known — page 1 when nothing is cached.
    const start =
      cursor === undefined ? nearestCursor(actor, limit ?? DEFAULT_LIMIT, page) : undefined;

    let current = start?.page ?? 1;
    let result = yield* fetchPage(actor, limit, cursor ?? start?.cursor, ctx.signal);

    // A feed that runs out before the requested page ends on its last page,
    // which is what a pager asking for a page past the end should show.
    while (cursor === undefined && current < page && result.cursor !== undefined) {
      const next = result.cursor;
      current++;
      rememberCursor(actor, limit ?? DEFAULT_LIMIT, current, next);
      result = yield* fetchPage(actor, limit, next, ctx.signal);
    }

    const output: ArtRatatFeedGetAuthorFeed.$output = {
      feed: result.feed,
      // Where the walk stopped, which a pager needs to tell "page 40" from
      // "the last page, because the feed ran out on the way to page 40".
      ...(cursor === undefined ? { page: current } : {}),
      ...(result.cursor ? { cursor: result.cursor } : {}),
    };
    return json(output);
  });

type Did = ArtRatatFeedDefs.PostView["author"]["did"];
type AtUri = ArtRatatFeedDefs.PostView["uri"];

/** `getPosts` only takes at-uris, so a handle has to become a DID first. */
const resolveDid = (
  actor: ArtRatatFeedGetPost.$params["actor"],
  signal: AbortSignal | undefined,
): RouteEffect<Did> =>
  Effect.gen(function* () {
    if (actor.startsWith("did:")) return actor as Did;
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
  ctx: QueryContext<ArtRatatFeedGetPost.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { actor, rkey } = ctx.params;
    const did = yield* resolveDid(actor, ctx.signal);
    const appview = yield* Appview;

    const res = yield* Effect.tryPromise({
      try: () =>
        appview.client.get("app.bsky.feed.getPosts", {
          params: { uris: [`at://${did}/app.bsky.feed.post/${rkey}` as AtUri] },
          signal: ctx.signal,
        }),
      catch: appviewUnreachable,
    });
    if (!res.ok) return yield* Effect.fail(actorRequestFailed(actor, res.data));

    const first = res.data.posts[0];
    const post = first === undefined ? undefined : artworkView(first);
    if (post === undefined) return yield* Effect.fail(postNotFound(actor, rkey));

    const output: ArtRatatFeedGetPost.$output = { post };
    return json(output);
  });
