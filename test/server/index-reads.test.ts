import { describe, expect, it, vi } from "vitest";
import { IndexedProfile, ProfileCounts } from "../../server/_actors.ts";
import { Blobs } from "../../server/_atproto.ts";
import { InvalidCursorError } from "../../server/_errors.ts";
import { FollowGraph } from "../../server/_follows.ts";
import {
  type Db,
  countArtworks,
  countFollowers,
  countFollows,
  isIndexed,
  likeCounts,
  mediaPostWhere,
  placeholders,
  tableExists,
} from "../../server/_index.ts";
import { FeedCursor } from "../../server/_paging.ts";

describe("mediaPostWhere & placeholders", () => {
  it("formats media predicates with and without table alias", () => {
    const bare = mediaPostWhere();
    expect(bare).toContain("embed IS NOT NULL");
    expect(bare).toContain("json_extract(embed, '$.$type') = 'app.bsky.embed.images'");
    expect(bare).toContain("json_extract(embed, '$.$type') = 'app.bsky.embed.video'");
    expect(bare).toContain("json_extract(embed, '$.$type') = 'app.bsky.embed.recordWithMedia'");

    const aliased = mediaPostWhere("p");
    expect(aliased).toContain("p.embed IS NOT NULL");
    expect(aliased).toContain("json_extract(p.embed, '$.$type')");
  });

  it("generates positional SQL placeholders", () => {
    expect(placeholders(3)).toBe("$1, $2, $3");
    expect(placeholders(2, 4)).toBe("$4, $5");
    expect(placeholders(0)).toBe("");
  });
});

describe("tableExists", () => {
  it("caches per-Db lookups and evicts failed queries so retries succeed", async () => {
    let fail = true;
    const query = vi.fn(async (_sql: string, params?: unknown[]) => {
      if (fail) throw new Error("transient failure");
      return params?.[0] === "ratat_like_count" ? [{ found: 1 }] : [];
    });
    const db: Db = { query };

    await expect(tableExists(db, "ratat_like_count")).rejects.toThrow("transient failure");

    fail = false;
    expect(await tableExists(db, "ratat_like_count")).toBe(true);
    expect(await tableExists(db, "ratat_like_count")).toBe(true);
    expect(await tableExists(db, "missing_table")).toBe(false);
    expect(query).toHaveBeenCalledTimes(3);
  });
});

describe("likeCounts", () => {
  it("returns empty map without querying when given no URIs", async () => {
    const query = vi.fn(async () => []);
    const counts = await likeCounts({ query }, []);
    expect(counts.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("queries indexed likes only when ratat_like_count table is absent", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("sqlite_master")) return [];
      if (sql.includes('"app.bsky.feed.like"')) {
        return [{ subject_uri: "at://did:plc:a/app.bsky.feed.post/1", count: 4 }];
      }
      return [];
    });

    const counts = await likeCounts({ query }, [
      "at://did:plc:a/app.bsky.feed.post/1",
      "at://did:plc:a/app.bsky.feed.post/1",
    ]);

    expect(counts.get("at://did:plc:a/app.bsky.feed.post/1")).toBe(4);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("takes max of indexed and mirrored like counts when mirror table exists", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("sqlite_master")) return [{ found: 1 }];
      if (sql.includes('"app.bsky.feed.like"')) {
        return [
          { subject_uri: "at://did:plc:a/app.bsky.feed.post/1", count: 3 },
          { subject_uri: "at://did:plc:a/app.bsky.feed.post/2", count: 8 },
        ];
      }
      if (sql.includes("ratat_like_count")) {
        return [
          { uri: "at://did:plc:a/app.bsky.feed.post/1", count: 7 },
          { uri: "at://did:plc:a/app.bsky.feed.post/2", count: 5 },
        ];
      }
      return [];
    });

    const counts = await likeCounts({ query }, [
      "at://did:plc:a/app.bsky.feed.post/1",
      "at://did:plc:a/app.bsky.feed.post/2",
    ]);

    expect(counts.get("at://did:plc:a/app.bsky.feed.post/1")).toBe(7);
    expect(counts.get("at://did:plc:a/app.bsky.feed.post/2")).toBe(8);
  });
});

describe("indexed repo helpers & FollowGraph", () => {
  it("checks repo status and reads follower, follow, and artwork counts", async () => {
    const db: Db = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM _repos")) {
          return params?.[0] === "did:plc:active" ? [{ status: "active" }] : [{ status: "idle" }];
        }
        if (sql.includes("WHERE subject = $1")) return [{ count: 12 }];
        if (sql.includes("WHERE did = $1") && sql.includes("net.ratat.graph.follow")) {
          return [{ count: 9 }];
        }
        if (sql.includes("app.bsky.feed.post")) return [{ count: 5 }];
        return [];
      }),
    };

    expect(await isIndexed(db, "did:plc:active")).toBe(true);
    expect(await isIndexed(db, "did:plc:other")).toBe(false);
    expect(await countFollowers(db, "did:plc:active")).toBe(12);
    expect(await countFollows(db, "did:plc:active")).toBe(9);
    expect(await countArtworks(db, "did:plc:active")).toBe(5);

    expect(await ProfileCounts.read("did:plc:active", db)).toEqual({
      followers: 12,
      follows: 9,
      posts: 5,
    });
    expect(await ProfileCounts.read("did:plc:other", db)).toEqual({
      followers: 12,
      follows: 9,
    });

    const failingDb: Db = {
      query: async () => {
        throw new Error("db unavailable");
      },
    };
    expect(await isIndexed(failingDb, "did:plc:active")).toBe(false);
  });

  it("paginates FollowGraph and rejects malformed keyset cursors", async () => {
    const db: Db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("COUNT(DISTINCT")) return [{ total: 2 }];
        return [
          {
            uri: "at://did:plc:viewer/net.ratat.graph.follow/2",
            did: "did:plc:viewer",
            subject: "did:plc:artist2",
            created_at: "2026-05-02T00:00:00.000Z",
            handle: "artist2.test",
            display_name: "Artist Two",
            avatar: null,
          },
          {
            uri: "at://did:plc:viewer/net.ratat.graph.follow/1",
            did: "did:plc:viewer",
            subject: "did:plc:artist1",
            created_at: "2026-05-01T00:00:00.000Z",
            handle: "artist1.test",
            display_name: null,
            avatar: null,
          },
        ];
      }),
    };

    const page = await FollowGraph.follows("did:plc:viewer").page(
      { kind: "page", limit: 10, page: 1 },
      db,
    );
    expect(page.position).toEqual({ page: 1, total: 2 });
    expect(page.views(new Blobs()).map((f) => f.subject)).toEqual([
      "did:plc:artist2",
      "did:plc:artist1",
    ]);

    const keyset = await FollowGraph.followers("did:plc:artist1").page(
      { kind: "keyset", limit: 1 },
      db,
    );
    expect(keyset.position.cursor).toBe(
      FeedCursor.encode("2026-05-02T00:00:00.000Z", "at://did:plc:viewer/net.ratat.graph.follow/2"),
    );

    await expect(
      FollowGraph.follows("did:plc:viewer").page(
        { kind: "keyset", limit: 10, cursor: "bad-cursor" },
        db,
      ),
    ).rejects.toBeInstanceOf(InvalidCursorError);

    const profileView = new IndexedProfile({
      did: "did:plc:artist1",
      handle: "artist1.test",
      displayName: "Artist One",
    }).view(new Blobs(), { followers: 10, follows: 2, posts: 3 });
    expect(profileView.followersCount).toBe(10);
    expect(profileView.postsCount).toBe(3);
  });
});
