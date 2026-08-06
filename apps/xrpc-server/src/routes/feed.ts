import { json, type QueryContext } from "@atcute/xrpc-server";
import type {
  ArtRatatFeedDefs,
  ArtRatatFeedGetAuthorFeed,
  ArtRatatFeedGetPost,
} from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "../appview.ts";
import { postNotFound } from "../errors.ts";
import type { RouteEffect } from "../handler.ts";
import { artworkView, postView } from "../views.ts";

export const feedGetAuthorFeed = (
  ctx: QueryContext<ArtRatatFeedGetAuthorFeed.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const { actor, limit, cursor } = ctx.params;
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
          signal: ctx.signal,
        }),
      catch: appviewUnreachable,
    });
    if (!res.ok) return yield* Effect.fail(actorRequestFailed(actor, res.data));

    const feed = res.data.feed
      .map(postView)
      .filter((post): post is ArtRatatFeedDefs.PostView => post !== undefined);

    const output: ArtRatatFeedGetAuthorFeed.$output = {
      feed,
      ...(res.data.cursor ? { cursor: res.data.cursor } : {}),
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
