import { defineQuery } from "$hatk";
import { Blobs } from "../_atproto.ts";
import { BskyFollowsRequest } from "../_follows.ts";
import { live } from "../_live.ts";

export default defineQuery("net.ratat.graph.listBskyFollows", async (ctx) => {
  const blobs = new Blobs(ctx.blobUrl);
  const source = await BskyFollowsRequest.parse(ctx.params, ctx.viewer).source(
    ctx.db,
    live.appview,
  );
  const page = await source.page(ctx.db, live);
  return ctx.ok({ follows: page.views(blobs), ...page.position });
});
