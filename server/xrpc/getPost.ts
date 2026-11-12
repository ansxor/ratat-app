import { defineQuery } from "$hatk";
import { Blobs } from "../_atproto.ts";
import { PostNotFoundError } from "../_errors.ts";
import { live } from "../_live.ts";
import { PostTarget } from "../_posts.ts";

export default defineQuery("net.ratat.feed.getPost", async (ctx) => {
  const blobs = new Blobs(ctx.blobUrl);
  const target = await PostTarget.resolve(ctx.params, ctx, live.appview);
  const record = await target.find(ctx, live);
  const post = record?.view(blobs);
  if (!post) throw new PostNotFoundError(target.actor, target.rkey);
  return ctx.ok({ post });
});
