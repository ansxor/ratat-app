import { defineQuery } from "$hatk";
import { Blobs } from "../_atproto.ts";
import { live } from "../_live.ts";
import { FeedRequest } from "../_posts.ts";

export default defineQuery("net.ratat.feed.getAuthorFeed", async (ctx) => {
  const blobs = new Blobs(ctx.blobUrl);
  const request = FeedRequest.parse(ctx.params);
  const feed = await request.source(ctx.db, live);
  const page = await feed.page(request.window, ctx);
  return ctx.ok({ feed: page.views(blobs), ...page.position });
});
