import { defineQuery } from "$hatk";
import { ActorRef, ProfileCounts } from "../_actors.ts";
import { Blobs } from "../_atproto.ts";
import { live } from "../_live.ts";

export default defineQuery("net.ratat.actor.getProfile", async (ctx) => {
  const blobs = new Blobs(ctx.blobUrl);
  const profile = await ActorRef.parse(ctx.params.actor).profile(ctx, live);
  live.backfill.note(profile.did);
  const counts = await ProfileCounts.read(profile.did, ctx.db);
  return ctx.ok(profile.view(blobs, counts));
});
