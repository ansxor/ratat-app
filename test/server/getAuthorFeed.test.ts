import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestContext, type TestContext } from "@hatk/hatk/test";

interface PostViewItem {
  uri: string;
  media: unknown[];
  labels?: string[];
  author: { did: string };
}

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.loadFixtures();
});

afterAll(async () => {
  await ctx?.close();
});

describe("net.ratat.feed.getAuthorFeed", () => {
  test("paginates indexed media posts newest-first and clamps past-the-end pages", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getAuthorFeed");

    const page1 = await handler.handler({
      params: { actor: "bob.test", limit: 15, page: 1 },
      limit: 15,
    });
    expect(page1.feed).toHaveLength(15);
    expect(page1.page).toBe(1);
    expect(page1.total).toBe(35);
    expect(typeof page1.cursor).toBe("string");
    expect(page1.feed[0].uri).toContain("/post-35");
    expect(page1.feed[0].media).toHaveLength(4);
    for (const item of page1.feed) {
      expect(item.media.length).toBeGreaterThan(0);
      expect(item.author.did).toBe("did:plc:bob");
      expect(item.uri).not.toContain("/text-01");
    }

    const page2 = await handler.handler({
      params: { actor: "bob.test", limit: 15, page: 2 },
      limit: 15,
    });
    expect(page2.feed).toHaveLength(15);
    expect(page2.page).toBe(2);
    expect(page2.total).toBe(35);

    const page3 = await handler.handler({
      params: { actor: "bob.test", limit: 15, page: 3 },
      limit: 15,
    });
    expect(page3.feed).toHaveLength(5);
    expect(page3.page).toBe(3);
    expect(page3.total).toBe(35);
    expect(page3.cursor).toBeUndefined();

    const seen = new Set([
      ...page1.feed.map((p: { uri: string }) => p.uri),
      ...page2.feed.map((p: { uri: string }) => p.uri),
      ...page3.feed.map((p: { uri: string }) => p.uri),
    ]);
    expect(seen.size).toBe(35);

    const clamped = await handler.handler({
      params: { actor: "bob.test", limit: 15, page: 99 },
      limit: 15,
    });
    expect(clamped.page).toBe(3);
    expect(clamped.feed).toHaveLength(5);
  });

  test("supports cursor-based pagination without page/total", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getAuthorFeed");

    const first = await handler.handler({
      params: { actor: "did:plc:bob", limit: 10 },
      limit: 10,
    });
    expect(first.feed).toHaveLength(10);
    expect(typeof first.cursor).toBe("string");

    const second = await handler.handler({
      params: { actor: "did:plc:bob", limit: 10, cursor: first.cursor },
      limit: 10,
      cursor: first.cursor,
    });
    expect(second.feed).toHaveLength(10);
    expect(second.page).toBeUndefined();
    expect(second.total).toBeUndefined();

    const firstUris = new Set(first.feed.map((p: { uri: string }) => p.uri));
    for (const post of second.feed) {
      expect(firstUris.has(post.uri)).toBe(false);
    }
  });

  test("preserves self-labels, carousels, and excludes text-only posts", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getAuthorFeed");
    const result = await handler.handler({
      params: { actor: "alice.test", limit: 30, page: 1 },
      limit: 30,
    });

    expect(result.feed).toHaveLength(5);
    expect(result.total).toBe(5);

    const byRkey = new Map<string, PostViewItem>(
      (result.feed as PostViewItem[]).map((p) => [p.uri.slice(p.uri.lastIndexOf("/") + 1), p]),
    );
    expect(byRkey.has("text-01")).toBe(false);
    expect(byRkey.get("art-02")?.media).toHaveLength(4);
    expect(byRkey.get("art-03")?.labels).toContain("porn");
    expect(byRkey.get("art-04")?.labels).toContain("graphic-media");
  });

  test("supports random sample mode without cursor or page", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getAuthorFeed");
    const result = await handler.handler({
      params: { actor: "bob.test", limit: 5, sample: true },
      limit: 5,
    });

    expect(result.feed).toHaveLength(5);
    expect(result.cursor).toBeUndefined();
    expect(result.page).toBeUndefined();
  });

  test("returns empty feed for active account with zero media posts", async () => {
    const handler = ctx.loadXrpc("net.ratat.feed.getAuthorFeed");
    const result = await handler.handler({
      params: { actor: "carol.test", limit: 30, page: 1 },
      limit: 30,
    });

    expect(result.feed).toEqual([]);
    expect(result.page).toBe(1);
    expect(result.total).toBe(0);
  });
});
