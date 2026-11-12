import { afterEach, describe, expect, it, vi } from "vitest";
import { Blobs } from "../../server/_atproto.ts";
import { AppviewError, UpstreamFailureError } from "../../server/_errors.ts";
import {
  type Appview,
  Backfill,
  CursorMemo,
  type Live,
  PublicAppview,
  type RepoTracker,
} from "../../server/_live.ts";
import { LiveFeed } from "../../server/_posts.ts";

const flushAsync = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
  }
};

describe("CursorMemo", () => {
  it("returns exact and earlier-page hits, respecting TTL and FIFO eviction", () => {
    let clock = 1000;
    const memo = new CursorMemo(() => clock, 500, 2);

    memo.remember("did:plc:a", 30, 2, "c2");
    memo.remember("did:plc:a", 30, 3, "c3");

    expect(memo.nearest("did:plc:a", 30, 3)).toEqual({ page: 3, cursor: "c3" });
    expect(memo.nearest("did:plc:a", 30, 5)).toEqual({ page: 3, cursor: "c3" });
    expect(memo.nearest("did:plc:a", 30, 1)).toBeUndefined();

    clock = 1200;
    memo.remember("did:plc:a", 30, 4, "c4");
    expect(memo.nearest("did:plc:a", 30, 2)).toBeUndefined();
    expect(memo.nearest("did:plc:a", 30, 4)).toEqual({ page: 4, cursor: "c4" });

    clock = 1550;
    expect(memo.nearest("did:plc:a", 30, 3)).toBeUndefined();
    expect(memo.nearest("did:plc:a", 30, 4)).toEqual({ page: 4, cursor: "c4" });

    clock = 1750;
    expect(memo.nearest("did:plc:a", 30, 4)).toBeUndefined();
  });
});

describe("Backfill", () => {
  it("deduplicates repeated notes and skips active/pending repos", async () => {
    const status = vi.fn(async (did: string) =>
      did === "did:plc:active" ? "active" : did === "did:plc:pending" ? "pending" : undefined,
    );
    const add = vi.fn(async () => {});
    const tracker: RepoTracker = { status, add };
    const backfill = new Backfill(tracker);

    backfill.note("");
    backfill.note("alice.bsky.social");
    backfill.note("did:plc:active");
    backfill.note("did:plc:pending");
    backfill.note("did:plc:fresh");
    backfill.note("did:plc:fresh");

    await flushAsync();

    expect(status).toHaveBeenCalledTimes(3);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith("did:plc:fresh");
  });

  it("evicts seen DID when tracker fails so a subsequent note retries", async () => {
    let shouldFail = true;
    const status = vi.fn(async () => {
      if (shouldFail) throw new Error("connection refused");
      return undefined;
    });
    const add = vi.fn(async () => {});
    const backfill = new Backfill({ status, add });

    backfill.note("did:plc:retry");
    await flushAsync();
    expect(add).not.toHaveBeenCalled();

    shouldFail = false;
    backfill.note("did:plc:retry");
    await flushAsync();
    expect(status).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledWith("did:plc:retry");
  });
});

describe("PublicAppview", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("builds XRPC query URLs with scalar and array params", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof URL ? input : new URL(String(input));
      expect(url.pathname).toBe("/xrpc/app.bsky.feed.getPosts");
      expect(url.searchParams.get("actor")).toBe("alice.bsky.social");
      expect(url.searchParams.getAll("uris")).toEqual(["at://1", "at://2"]);
      expect(url.searchParams.has("empty")).toBe(false);
      return new Response(JSON.stringify({ posts: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const appview = new PublicAppview();
    const res = await appview.get<{ posts: unknown[] }>("app.bsky.feed.getPosts", {
      actor: "alice.bsky.social",
      uris: ["at://1", "at://2"],
      empty: undefined,
    });
    expect(res).toEqual({ posts: [] });
  });

  it("maps 4xx, 5xx, network errors, and invalid JSON", async () => {
    const appview = new PublicAppview();

    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "ProfileNotFound", message: "No such user" }), {
          status: 400,
        }),
    ) as typeof fetch;
    await expect(appview.get("app.bsky.actor.getProfile")).rejects.toMatchObject({
      status: 400,
      errorCode: "ProfileNotFound",
      message: "No such user",
    });

    globalThis.fetch = vi.fn(
      async () => new Response("bad gateway", { status: 503 }),
    ) as typeof fetch;
    const err503 = await appview.get("app.bsky.actor.getProfile").catch((e: unknown) => e);
    expect(err503).toBeInstanceOf(AppviewError);
    expect(err503).toMatchObject({ status: 502, errorCode: "UpstreamFailure" });

    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as typeof fetch;
    await expect(appview.get("app.bsky.actor.getProfile")).rejects.toBeInstanceOf(
      UpstreamFailureError,
    );

    globalThis.fetch = vi.fn(async () => new Response("not-json", { status: 200 })) as typeof fetch;
    await expect(appview.get("app.bsky.actor.getProfile")).rejects.toBeInstanceOf(
      UpstreamFailureError,
    );
  });
});

describe("LiveFeed", () => {
  const makeFeedItem = (rkey: string, repost = false) => ({
    post: {
      uri: `at://did:plc:artist/app.bsky.feed.post/${rkey}`,
      cid: `cid-${rkey}`,
      author: { did: "did:plc:artist", handle: "artist.bsky.social" },
      record: { $type: "app.bsky.feed.post", text: rkey, createdAt: "2026-01-01T00:00:00.000Z" },
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [{ thumb: `https://cdn/${rkey}-t.jpg`, fullsize: `https://cdn/${rkey}-f.jpg` }],
      },
      indexedAt: "2026-01-01T00:00:00.000Z",
    },
    ...(repost ? { reason: { $type: "app.bsky.feed.defs#reasonRepost" } } : {}),
  });

  it("walks pages using CursorMemo, filters reposts, and notes backfill", async () => {
    const cursors = new CursorMemo(() => 1000);
    const status = vi.fn(async () => "active");
    const add = vi.fn(async () => {});
    const backfill = new Backfill({ status, add });

    const get = vi.fn(async (_nsid: string, params?: Record<string, unknown>) => {
      if (!params?.cursor) {
        return { feed: [makeFeedItem("p1"), makeFeedItem("repost", true)], cursor: "cur-2" };
      }
      if (params.cursor === "cur-2") {
        return { feed: [makeFeedItem("p2")], cursor: "cur-3" };
      }
      return { feed: [makeFeedItem("p3")] };
    });

    const fakeLive: Live = {
      appview: { get } as Appview,
      backfill,
      cursors,
    };

    const feed = new LiveFeed("artist.bsky.social", undefined, fakeLive);
    const page2 = await feed.page({ kind: "page", limit: 1, page: 2 });
    const views2 = page2.views(new Blobs());

    expect(views2.map((p) => p.cid)).toEqual(["cid-p2"]);
    expect(page2.position).toEqual({ page: 2, cursor: "cur-3" });
    expect(cursors.nearest("artist.bsky.social", 1, 2)).toEqual({ page: 2, cursor: "cur-2" });

    await flushAsync();
    expect(status).toHaveBeenCalledWith("did:plc:artist");

    const page3 = await feed.page({ kind: "page", limit: 1, page: 3 });
    expect(page3.views(new Blobs()).map((p) => p.cid)).toEqual(["cid-p3"]);
    expect(get).toHaveBeenCalledTimes(4);
  });

  it("samples up to limit in sample mode", async () => {
    const fakeLive: Live = {
      appview: {
        get: vi.fn(async () => ({
          feed: [makeFeedItem("a"), makeFeedItem("b"), makeFeedItem("c")],
        })),
      } as Appview,
      backfill: new Backfill({ status: async () => "active", add: async () => {} }),
      cursors: new CursorMemo(),
    };

    const feed = new LiveFeed("artist.bsky.social", "did:plc:artist", fakeLive);
    const page = await feed.page({ kind: "sample", limit: 2 });
    expect(page.views(new Blobs())).toHaveLength(2);
    expect(page.position).toEqual({});
  });
});
