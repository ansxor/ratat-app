import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer, type TestServer } from "@hatk/hatk/test";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
  await server.loadFixtures();
});

afterAll(async () => {
  await server?.close();
});

function asObject(value: unknown, where: string): Record<string, unknown> {
  expect(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${where}: not an object`,
  ).toBe(true);
  return value as Record<string, unknown>;
}

function checkProfileBasic(value: unknown, where: string): { did: string; handle: string } {
  const actor = asObject(value, where);
  expect(typeof actor.did === "string", `${where}: missing did`).toBe(true);
  expect(typeof actor.handle === "string", `${where}: missing handle`).toBe(true);
  return { did: actor.did as string, handle: actor.handle as string };
}

function checkPostView(value: unknown, where: string): { uri: string } {
  const post = asObject(value, where);
  expect(typeof post.uri === "string", `${where}: missing uri`).toBe(true);
  expect(typeof post.cid === "string", `${where}: missing cid`).toBe(true);
  expect(typeof post.bskyUrl === "string", `${where}: missing bskyUrl`).toBe(true);
  expect(typeof post.createdAt === "string", `${where}: missing createdAt`).toBe(true);
  expect(Array.isArray(post.media), `${where}: media is not an array`).toBe(true);
  expect((post.media as unknown[]).length > 0, `${where}: a post view with no media`).toBe(true);
  expect(
    post.labels === undefined || Array.isArray(post.labels),
    `${where}: labels is not an array`,
  ).toBe(true);
  checkProfileBasic(post.author, `${where}.author`);
  return { uri: post.uri as string };
}

function checkFollowView(value: unknown, where: string): { uri: string; subject: string } {
  const row = asObject(value, where);
  expect(typeof row.uri === "string", `${where}: missing uri`).toBe(true);
  expect(typeof row.subject === "string", `${where}: missing subject`).toBe(true);
  expect(typeof row.createdAt === "string", `${where}: missing createdAt`).toBe(true);
  expect(
    row.handle === undefined || typeof row.handle === "string",
    `${where}: handle is not a string`,
  ).toBe(true);
  expect(
    row.displayName === undefined || typeof row.displayName === "string",
    `${where}: displayName is not a string`,
  ).toBe(true);
  return { uri: row.uri as string, subject: row.subject as string };
}

async function query(
  nsid: string,
  params: Record<string, string | number | boolean>,
): Promise<Record<string, unknown>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  const res = await server.fetch(`/xrpc/${nsid}?${search.toString()}`);
  const text = await res.text();
  expect(res.status, `${nsid}: expected 200, got ${res.status} — ${text}`).toBe(200);
  return asObject(JSON.parse(text) as unknown, nsid);
}

describe("net.ratat read API smoke", () => {
  test("health endpoint responds 200", async () => {
    const res = await server.fetch("/_health");
    expect(res.status).toBe(200);
  });

  test("full read-API discovery and shape flow", async () => {
    const typeahead = await query("net.ratat.actor.searchActorsTypeahead", {
      q: "bob",
      limit: 8,
    });
    expect(Array.isArray(typeahead.actors)).toBe(true);
    const candidates = (typeahead.actors as unknown[]).map((actor, index) =>
      checkProfileBasic(actor, `searchActorsTypeahead.actors[${index}]`),
    );
    expect(candidates.length).toBeGreaterThan(0);

    const first = candidates[0];
    const profile = await query("net.ratat.actor.getProfile", { actor: first.handle });
    const named = checkProfileBasic(profile, "getProfile");
    expect(named.did).toBe(first.did);
    expect(typeof profile.bskyUrl).toBe("string");
    for (const key of ["followersCount", "followsCount", "postsCount"] as const) {
      expect(profile[key] === undefined || typeof profile[key] === "number").toBe(true);
    }

    const feed = await query("net.ratat.feed.getAuthorFeed", { actor: first.did, limit: 5 });
    expect(Array.isArray(feed.feed)).toBe(true);
    const posts = (feed.feed as unknown[]).map((item, index) =>
      checkPostView(item, `getAuthorFeed.feed[${index}]`),
    );
    expect(posts.length).toBeGreaterThan(0);

    const paged1 = await query("net.ratat.feed.getAuthorFeed", {
      actor: first.did,
      page: 1,
      limit: 10,
    });
    expect(paged1.page).toBe(1);
    expect(typeof paged1.total).toBe("number");
    expect(typeof paged1.cursor).toBe("string");
    const paged1Posts = (paged1.feed as unknown[]).map((item, index) =>
      checkPostView(item, `getAuthorFeed.paged1[${index}]`),
    );

    const paged2 = await query("net.ratat.feed.getAuthorFeed", {
      actor: first.did,
      page: 2,
      limit: 10,
    });
    expect(paged2.page).toBe(2);
    const paged2Posts = (paged2.feed as unknown[]).map((item, index) =>
      checkPostView(item, `getAuthorFeed.paged2[${index}]`),
    );
    const page1Uris = new Set(paged1Posts.map((p) => p.uri));
    for (const p of paged2Posts) {
      expect(page1Uris.has(p.uri)).toBe(false);
    }

    const byCursor = await query("net.ratat.feed.getAuthorFeed", {
      actor: first.did,
      limit: 10,
      cursor: paged1.cursor as string,
    });
    expect(byCursor.page).toBeUndefined();
    const cursorPosts = (byCursor.feed as unknown[]).map((item, index) =>
      checkPostView(item, `getAuthorFeed.cursor[${index}]`),
    );
    expect(cursorPosts.length).toBeGreaterThan(0);
    for (const p of cursorPosts) {
      expect(page1Uris.has(p.uri)).toBe(false);
    }

    const sampled = await query("net.ratat.feed.getAuthorFeed", {
      actor: first.did,
      limit: 4,
      sample: true,
    });
    expect(Array.isArray(sampled.feed)).toBe(true);
    expect((sampled.feed as unknown[]).length).toBe(4);
    expect(sampled.cursor).toBeUndefined();
    expect(sampled.page).toBeUndefined();

    const targetUri = posts[0].uri;
    const rkey = targetUri.slice(targetUri.lastIndexOf("/") + 1);
    const postRes = await query("net.ratat.feed.getPost", {
      actor: first.handle,
      rkey,
      viewer: "did:plc:carol",
    });
    const view = checkPostView(postRes.post, "getPost.post");
    expect(view.uri).toBe(targetUri);

    const follows = await query("net.ratat.graph.getFollows", { actor: "did:plc:carol" });
    expect(Array.isArray(follows.follows)).toBe(true);
    expect(typeof follows.indexed).toBe("boolean");
    (follows.follows as unknown[]).forEach((row, index) =>
      checkFollowView(row, `getFollows.follows[${index}]`),
    );

    const followsCursor1 = await query("net.ratat.graph.getFollows", {
      actor: "did:plc:carol",
      limit: 1,
    });
    expect((followsCursor1.follows as unknown[]).length).toBe(1);
    expect(typeof followsCursor1.cursor).toBe("string");
    const followsCursor2 = await query("net.ratat.graph.getFollows", {
      actor: "did:plc:carol",
      limit: 1,
      cursor: followsCursor1.cursor as string,
    });
    expect((followsCursor2.follows as unknown[]).length).toBe(1);
    const f1 = checkFollowView((followsCursor1.follows as unknown[])[0], "followsCursor1");
    const f2 = checkFollowView((followsCursor2.follows as unknown[])[0], "followsCursor2");
    expect(f1.uri).not.toBe(f2.uri);

    const followersCursor1 = await query("net.ratat.graph.getFollowers", {
      actor: first.did,
      limit: 1,
    });
    expect((followersCursor1.followers as unknown[]).length).toBe(1);
    expect(typeof followersCursor1.cursor).toBe("string");
    const followersCursor2 = await query("net.ratat.graph.getFollowers", {
      actor: first.did,
      limit: 1,
      cursor: followersCursor1.cursor as string,
    });
    expect((followersCursor2.followers as unknown[]).length).toBe(1);

    for (const [nsid, key] of [
      ["net.ratat.graph.getFollows", "follows"],
      ["net.ratat.graph.getFollowers", "followers"],
    ] as const) {
      const paged = await query(nsid, { actor: first.did, page: 1, limit: 30 });
      const rows = paged[key];
      expect(Array.isArray(rows)).toBe(true);
      expect(typeof paged.total).toBe("number");
      expect(typeof paged.page).toBe("number");
      (rows as unknown[]).forEach((row, index) =>
        checkFollowView(row, `${nsid} paged.${key}[${index}]`),
      );
    }

    const timeline = await query("net.ratat.feed.getTimeline", {
      viewer: "did:plc:carol",
      limit: 10,
      page: 1,
    });
    expect(Array.isArray(timeline.feed)).toBe(true);
    expect(timeline.page).toBe(1);
    expect(timeline.total).toBe(40);
    (timeline.feed as unknown[]).forEach((item, index) =>
      checkPostView(item, `getTimeline.feed[${index}]`),
    );

    const emptyTimeline = await query("net.ratat.feed.getTimeline", {
      viewer: "did:plc:dave",
      limit: 5,
    });
    expect(emptyTimeline.feed).toEqual([]);
    expect(emptyTimeline.page).toBe(1);
    expect(emptyTimeline.total).toBe(0);
  });
});
