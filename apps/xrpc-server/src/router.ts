import { XRPCRouter, type WebSocketAdapter } from "@atcute/xrpc-server";
import { cors } from "@atcute/xrpc-server/middlewares/cors";
import * as lex from "@ratat/lexicon";

import { runHandler } from "./handler.ts";
import { actorGetProfile } from "./routes/actor.ts";
import { feedGetAuthorFeed, feedGetPost } from "./routes/feed.ts";
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

  router.addQuery(lex.ArtRatatActorGetProfile.mainSchema, {
    handler: (ctx) => runHandler(runtime, actorGetProfile(ctx)),
  });
  router.addQuery(lex.ArtRatatFeedGetAuthorFeed.mainSchema, {
    handler: (ctx) => runHandler(runtime, feedGetAuthorFeed(ctx)),
  });
  router.addQuery(lex.ArtRatatFeedGetPost.mainSchema, {
    handler: (ctx) => runHandler(runtime, feedGetPost(ctx)),
  });

  return router;
};
