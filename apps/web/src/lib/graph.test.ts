import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { describe, expect, test } from "bun:test";

import { APPLY_WRITES_LIMIT, chunk, deleteFollow, importFollows } from "./graph.ts";

interface Recorded {
  pathname: string;
  body: { repo: string; writes: Array<{ $type: string; collection: string; value: unknown }> };
}

/**
 * The PDS an agent talks to is a fetch handler, so a fake one is enough to see
 * exactly what an import would write without writing anything.
 */
function fakeAgent(): { agent: OAuthUserAgent; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const agent = {
    sub: "did:plc:viewer",
    handle: async (pathname: string, init: RequestInit) => {
      calls.push({ pathname, body: JSON.parse(String(init.body)) });
      return Response.json({});
    },
  } as unknown as OAuthUserAgent;
  return { agent, calls };
}

const subjects = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `did:plc:artist${i}`);

describe("chunk", () => {
  test("splits into full runs and a short last one", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("an exact multiple leaves no short run", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  test("nothing to split is no batches at all", () => {
    expect(chunk([], 200)).toEqual([]);
  });
});

describe("importFollows", () => {
  test("writes at most the applyWrites limit per call", async () => {
    const { agent, calls } = fakeAgent();
    const written = await importFollows(agent, subjects(450));

    expect(written).toBe(450);
    expect(calls.map((call) => call.body.writes.length)).toEqual([200, 200, 50]);
    expect(new Set(calls.map((call) => call.pathname.split("?")[0]))).toEqual(
      new Set(["/xrpc/com.atproto.repo.applyWrites"]),
    );
  });

  test("a graph inside one batch is one commit", async () => {
    const { agent, calls } = fakeAgent();
    await importFollows(agent, subjects(APPLY_WRITES_LIMIT));
    expect(calls).toHaveLength(1);
  });

  test("every write is a ratat follow record naming its subject", async () => {
    const { agent, calls } = fakeAgent();
    await importFollows(agent, ["did:plc:one", "did:plc:two"]);

    const writes = calls[0]?.body.writes ?? [];
    expect(writes.map((write) => write.$type)).toEqual([
      "com.atproto.repo.applyWrites#create",
      "com.atproto.repo.applyWrites#create",
    ]);
    expect(writes.map((write) => write.collection)).toEqual([
      "art.ratat.graph.follow",
      "art.ratat.graph.follow",
    ]);
    expect(writes.map((write) => (write.value as { subject: string }).subject)).toEqual([
      "did:plc:one",
      "did:plc:two",
    ]);
    expect(calls[0]?.body.repo).toBe("did:plc:viewer");
  });

  test("reports progress as each batch lands", async () => {
    const { agent } = fakeAgent();
    const seen: number[] = [];
    await importFollows(agent, subjects(250), (written) => seen.push(written));
    expect(seen).toEqual([200, 250]);
  });

  test("nothing selected writes nothing", async () => {
    const { agent, calls } = fakeAgent();
    expect(await importFollows(agent, [])).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("deleteFollow", () => {
  test("refuses a URI from another collection", async () => {
    const { agent, calls } = fakeAgent();
    const failure = await deleteFollow(agent, "at://did:plc:viewer/app.bsky.feed.like/abc").then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(String(failure)).toContain("That isn't a Ratat follow URI.");
    expect(calls).toHaveLength(0);
  });
});
