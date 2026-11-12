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

describe("net.ratat.feed.getTimeline", () => {
  test("joins followed artists newest-first and paginates with total", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getTimeline");

    const page1 = await handler.handler({
      params: { viewer: "carol.test", limit: 20, page: 1 },
      limit: 20,
    });
    expect(page1.feed).toHaveLength(20);
    expect(page1.page).toBe(1);
    expect(page1.total).toBe(40);

    for (let i = 1; i < page1.feed.length; i++) {
      expect(page1.feed[i - 1].createdAt >= page1.feed[i].createdAt).toBe(true);
    }

    const page2 = await handler.handler({
      params: { viewer: "did:plc:carol", limit: 20, page: 2 },
      limit: 20,
    });
    expect(page2.feed).toHaveLength(20);
    expect(page2.page).toBe(2);
    expect(page2.total).toBe(40);

    const seen = new Set([
      ...page1.feed.map((p: { uri: string }) => p.uri),
      ...page2.feed.map((p: { uri: string }) => p.uri),
    ]);
    expect(seen.size).toBe(40);
    for (const uri of seen) {
      expect(uri).not.toContain("/text-01");
    }
  });

  test("clamps page past the end to the last page", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getTimeline");
    const result = await handler.handler({
      params: { viewer: "carol.test", limit: 30, page: 99 },
      limit: 30,
    });

    expect(result.page).toBe(2);
    expect(result.total).toBe(40);
    expect(result.feed).toHaveLength(10);
  });

  test("includes only artists followed by the viewer", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getTimeline");
    const result = await handler.handler({
      params: { viewer: "alice.test", limit: 50, page: 1 },
      limit: 50,
    });

    expect(result.total).toBe(35);
    expect(result.feed).toHaveLength(35);
    for (const item of result.feed) {
      expect(item.author.did).toBe("did:plc:bob");
    }
  });

  test("returns empty timeline when viewer follows nobody", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getTimeline");
    const result = await handler.handler({
      params: { viewer: "dave.test", limit: 30, page: 1 },
      limit: 30,
    });

    expect(result.feed).toEqual([]);
    expect(result.page).toBe(1);
    expect(result.total).toBe(0);
  });
});
