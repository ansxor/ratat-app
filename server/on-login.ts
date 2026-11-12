import { defineHook } from "$hatk";

export default defineHook("on-login", async (ctx) => {
  await ctx.ensureRepo(ctx.did);
});
