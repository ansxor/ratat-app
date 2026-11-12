import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestContext, type TestContext } from "@hatk/hatk/test";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.loadFixtures();
});

afterAll(async () => {
  await ctx?.close();
});

describe("net.ratat.actor.getProfile", () => {
  test("returns profile and Ratat graph/media counts by handle", async () => {
    const handler = ctx.loadXrpc("net.ratat.actor.getProfile");
    const profile = await handler.handler({ params: { actor: "alice.test" } });

    expect(profile.did).toBe("did:plc:alice");
    expect(profile.handle).toBe("alice.test");
    expect(profile.displayName).toBe("Alice");
    expect(profile.description).toContain("warm color palettes");
    expect(typeof profile.bskyUrl).toBe("string");
    expect(profile.followersCount).toBe(2);
    expect(profile.followsCount).toBe(1);
    expect(profile.postsCount).toBe(5);
  });

  test("returns profile by DID", async () => {
    const handler = ctx.loadXrpc("net.ratat.actor.getProfile");
    const profile = await handler.handler({ params: { actor: "did:plc:bob" } });

    expect(profile.did).toBe("did:plc:bob");
    expect(profile.handle).toBe("bob.test");
    expect(profile.displayName).toBe("Bob");
    expect(profile.followersCount).toBe(2);
    expect(profile.followsCount).toBe(1);
    expect(profile.postsCount).toBe(35);
  });

  test("returns zero counts for account with no posts or followers", async () => {
    const handler = ctx.loadXrpc("net.ratat.actor.getProfile");
    const profile = await handler.handler({ params: { actor: "carol.test" } });

    expect(profile.did).toBe("did:plc:carol");
    expect(profile.followersCount).toBe(0);
    expect(profile.followsCount).toBe(2);
    expect(profile.postsCount).toBe(0);
  });

  test("rejects when actor parameter is missing", async () => {
    const handler = ctx.loadXrpc("net.ratat.actor.getProfile");
    await expect(handler.handler({ params: {} })).rejects.toThrow();
  });
});
