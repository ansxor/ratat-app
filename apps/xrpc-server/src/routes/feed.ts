import { json, type QueryContext } from "@atcute/xrpc-server";
import type { ArtRatatFeedDefs, ArtRatatFeedGetAuthorFeed } from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "../appview.ts";
import type { RouteEffect } from "../handler.ts";
import { postView } from "../views.ts";

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
