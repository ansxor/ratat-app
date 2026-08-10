import { XRPCRouter, type WebSocketAdapter } from "@atcute/xrpc-server";
import { cors } from "@atcute/xrpc-server/middlewares/cors";
import * as lex from "@ratat/lexicon";

import { runHandler } from "./handler.ts";
import { actorGetProfile, actorSearchActorsTypeahead } from "./routes/actor.ts";
import { feedGetAuthorFeed, feedGetPost, feedGetTimeline } from "./routes/feed.ts";
import { graphGetFollowers, graphGetFollows } from "./routes/graph.ts";
import type { AppRuntime } from "./runtime.ts";

export interface CreateRouterOptions {
  runtime: AppRuntime;
  websocket?: WebSocketAdapter;
}

export const createRouter = ({ runtime, websocket }: CreateRouterOptions): XRPCRouter => {
  const router = new XRPCRouter({
    middlewares: [cors()],
    handleHealthCheck: () => Response.json({ version: "0.1.0" }),
    websocket,
  });

  router.addQuery(lex.NetRatatActorGetProfile.mainSchema, {
    handler: (ctx) => runHandler(runtime, actorGetProfile(ctx)),
  });
  router.addQuery(lex.NetRatatActorSearchActorsTypeahead.mainSchema, {
    handler: (ctx) => runHandler(runtime, actorSearchActorsTypeahead(ctx)),
  });
  router.addQuery(lex.NetRatatFeedGetAuthorFeed.mainSchema, {
    handler: (ctx) => runHandler(runtime, feedGetAuthorFeed(ctx)),
  });
  router.addQuery(lex.NetRatatFeedGetPost.mainSchema, {
    handler: (ctx) => runHandler(runtime, feedGetPost(ctx)),
  });
  router.addQuery(lex.NetRatatFeedGetTimeline.mainSchema, {
    handler: (ctx) => runHandler(runtime, feedGetTimeline(ctx)),
  });
  router.addQuery(lex.NetRatatGraphGetFollows.mainSchema, {
    handler: (ctx) => runHandler(runtime, graphGetFollows(ctx)),
  });
  router.addQuery(lex.NetRatatGraphGetFollowers.mainSchema, {
    handler: (ctx) => runHandler(runtime, graphGetFollowers(ctx)),
  });

  return router;
};
