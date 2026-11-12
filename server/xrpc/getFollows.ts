import { defineQuery } from "$hatk";
import { ActorRef } from "../_actors.ts";
import { Blobs } from "../_atproto.ts";
import { FollowGraph } from "../_follows.ts";
import { isIndexed } from "../_index.ts";
import { live } from "../_live.ts";
import { graphWindow } from "../_paging.ts";

export default defineQuery("net.ratat.graph.getFollows", async (ctx) => {
  const blobs = new Blobs(ctx.blobUrl);
  const window = graphWindow(ctx.params);
  const actorDid = await ActorRef.parse(ctx.params.actor).resolve(ctx.db, live.appview);
  const indexed = await isIndexed(ctx.db, actorDid);
  if (!indexed) live.backfill.note(actorDid);
  const page = await FollowGraph.follows(actorDid).page(window, ctx.db);
  return ctx.ok({ follows: page.views(blobs), ...page.position, indexed });
});
