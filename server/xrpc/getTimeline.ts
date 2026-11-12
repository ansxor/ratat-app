import { defineQuery } from "$hatk";
import { ActorRef } from "../_actors.ts";
import { Blobs } from "../_atproto.ts";
import { live } from "../_live.ts";
import { timelineWindow } from "../_paging.ts";
import { IndexedPost } from "../_posts.ts";

export default defineQuery("net.ratat.feed.getTimeline", async (ctx) => {
  const blobs = new Blobs(ctx.blobUrl);
  const window = timelineWindow(ctx.params);
  const viewerDid = await ActorRef.parse(ctx.params.viewer).resolve(ctx.db, live.appview);
  live.backfill.note(viewerDid);
  const page = await IndexedPost.timeline(viewerDid, window, ctx);
  return ctx.ok({ feed: page.views(blobs), ...page.position });
});
