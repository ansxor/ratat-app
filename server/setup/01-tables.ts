import { defineSetup } from "$hatk";
import { LikeMirror, startLikeTail } from "../_like-tail.ts";

export default defineSetup(async (ctx) => {
  await LikeMirror.createTables(ctx.db);
  startLikeTail(ctx.db);
});
