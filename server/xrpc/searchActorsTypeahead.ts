import { defineQuery } from "$hatk";
import { ActorSearch } from "../_actors.ts";
import { Blobs } from "../_atproto.ts";
import { live } from "../_live.ts";

export default defineQuery("net.ratat.actor.searchActorsTypeahead", async (ctx) => {
  const blobs = new Blobs(ctx.blobUrl);
  const page = await ActorSearch.parse(ctx.params).run(ctx.db, live.appview);
  return ctx.ok({ actors: page.views(blobs) });
});
