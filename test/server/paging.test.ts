import { describe, expect, it } from "vitest";
import { Blobs } from "../../server/_atproto.ts";
import {
  Bounds,
  FeedCursor,
  Page,
  authorFeedWindow,
  clampLimit,
  clampPage,
  graphWindow,
  timelineWindow,
} from "../../server/_paging.ts";

describe("FeedCursor", () => {
  it("encodes and decodes Date, ISO string, and epoch ms values", () => {
    const uri = "at://did:plc:artist1/app.bsky.feed.post/3k1";
    const createdAt = new Date("2026-05-01T12:00:00.000Z");

    const fromDate = FeedCursor.decode(FeedCursor.encode(createdAt, uri));
    expect(fromDate?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(fromDate?.uri).toBe(uri);

    const fromIso = FeedCursor.decode(FeedCursor.encode(createdAt.toISOString(), uri));
    expect(fromIso?.createdAt.getTime()).toBe(createdAt.getTime());

    const fromMs = FeedCursor.decode(FeedCursor.encode(createdAt.getTime(), uri));
    expect(fromMs?.createdAt.getTime()).toBe(createdAt.getTime());
    expect(fromMs?.uri).toBe(uri);
  });

  it("rejects malformed cursors", () => {
    expect(FeedCursor.decode("")).toBeUndefined();
    expect(FeedCursor.decode("not-base64-cursor")).toBeUndefined();
    expect(
      FeedCursor.decode(Buffer.from("no-separator", "utf8").toString("base64url")),
    ).toBeUndefined();
    expect(
      FeedCursor.decode(Buffer.from("abc|at://did:plc:a/b/c", "utf8").toString("base64url")),
    ).toBeUndefined();
    expect(
      FeedCursor.decode(
        Buffer.from("1700000000000|https://example.com", "utf8").toString("base64url"),
      ),
    ).toBeUndefined();
  });
});

describe("Bounds & clamping", () => {
  it("clamps requested page and computes offset and hasMore", () => {
    expect(Bounds.of(95, 30, 1)).toEqual({
      total: 95,
      limit: 30,
      page: 1,
      offset: 0,
      hasMore: true,
    });

    expect(Bounds.of(95, 30, 10)).toEqual({
      total: 95,
      limit: 30,
      page: 4,
      offset: 90,
      hasMore: false,
    });

    expect(Bounds.of(0, 30, 5)).toEqual({
      total: 0,
      limit: 30,
      page: 1,
      offset: 0,
      hasMore: false,
    });

    expect(Bounds.of(25, 0, -3)).toEqual({
      total: 25,
      limit: 1,
      page: 1,
      offset: 0,
      hasMore: true,
    });
  });

  it("clamps limits and pages to valid bounds", () => {
    expect(clampLimit(undefined)).toBe(30);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(500)).toBe(100);
    expect(clampLimit("not-a-number", 25, 50)).toBe(25);

    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(200, 100)).toBe(100);
    expect(clampPage("7", 10)).toBe(7);
  });
});

describe("window parsers", () => {
  it("builds authorFeedWindow for sample, keyset, and page modes", () => {
    expect(authorFeedWindow({ sample: true, limit: 200 })).toEqual({
      kind: "sample",
      limit: 100,
    });
    expect(authorFeedWindow({ sample: "true", limit: 0 })).toEqual({
      kind: "sample",
      limit: 30,
    });
    expect(authorFeedWindow({ sample: "true", limit: -5 })).toEqual({
      kind: "sample",
      limit: 1,
    });

    const cursor = FeedCursor.encode("2026-05-01T00:00:00.000Z", "at://did:plc:a/b/c");
    const validKeyset = authorFeedWindow({ cursor, limit: 20 });
    expect(validKeyset.kind).toBe("keyset");
    if (validKeyset.kind === "keyset") {
      expect(validKeyset.limit).toBe(20);
      expect(validKeyset.cursor).toBe(cursor);
      expect(validKeyset.after?.uri).toBe("at://did:plc:a/b/c");
    }

    const badKeyset = authorFeedWindow({ cursor: "opaque-live-cursor", limit: 15 });
    expect(badKeyset).toEqual({
      kind: "keyset",
      limit: 15,
      cursor: "opaque-live-cursor",
      after: undefined,
    });

    expect(authorFeedWindow({ page: 500, limit: 25 })).toEqual({
      kind: "page",
      limit: 25,
      page: 100,
    });
  });

  it("builds timelineWindow with clamped limit and page", () => {
    expect(timelineWindow({})).toEqual({ kind: "page", limit: 30, page: 1 });
    expect(timelineWindow({ limit: 500, page: -4 })).toEqual({ kind: "page", limit: 100, page: 1 });
    expect(timelineWindow({ limit: 15, page: 4 })).toEqual({ kind: "page", limit: 15, page: 4 });
  });

  it("builds graphWindow for page and keyset modes", () => {
    expect(graphWindow({ page: 3, limit: 50 })).toEqual({ kind: "page", limit: 50, page: 3 });

    const cursor = FeedCursor.encode(1700000000000, "at://did:plc:a/net.ratat.graph.follow/1");
    const keyset = graphWindow({ cursor, limit: 40 });
    expect(keyset.kind).toBe("keyset");
    if (keyset.kind === "keyset") {
      expect(keyset.limit).toBe(40);
      expect(keyset.cursor).toBe(cursor);
      expect(keyset.after?.uri).toBe("at://did:plc:a/net.ratat.graph.follow/1");
    }

    expect(graphWindow({ cursor: "bad" })).toEqual({
      kind: "keyset",
      limit: 30,
      cursor: "bad",
      after: undefined,
    });
    expect(graphWindow({})).toEqual({ kind: "keyset", limit: 30 });
  });
});

describe("Page", () => {
  it("filters out items whose view returns undefined", () => {
    const blobs = new Blobs();
    const page = new Page<string, { page: number; total: number }>(
      [{ view: () => "first" }, { view: () => undefined }, { view: () => "second" }],
      { page: 1, total: 3 },
    );

    expect(page.views(blobs)).toEqual(["first", "second"]);
    expect(page.position).toEqual({ page: 1, total: 3 });
  });
});
