#!/usr/bin/env bun
/**
 * End-to-end smoke test for the read API.
 *
 * Every art.ratat.* query gets one real request against a running
 * xrpc-server — which this script starts itself unless one is already
 * listening — and the response is checked for the shape the lexicon promises.
 * Nothing is mocked: the point is to catch a serving path that broke between
 * the lexicon, the index and the Bluesky appview, which no unit test sees.
 *
 * The fixtures are discovered rather than hard-coded: the typeahead names an
 * actor, that actor names a feed, and that feed names a post. A smoke test
 * pinned to somebody's handle is a smoke test that fails the day they change
 * it.
 */

const BASE = process.env["RATAT_SMOKE_URL"] ?? "http://127.0.0.1:3001";
const QUERY = process.env["RATAT_SMOKE_QUERY"] ?? "bsky";
const BOOT_TIMEOUT_MS = 40_000;

class SmokeError extends Error {
  override readonly name = "SmokeError";
}

const fail = (message: string): never => {
  throw new SmokeError(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const expect = (condition: boolean, message: string): void => {
  if (!condition) fail(message);
};

async function query(nsid: string, params: Record<string, string | number>): Promise<unknown> {
  const url = new URL(`/xrpc/${nsid}`, BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const res = await fetch(url).catch((cause: unknown) => fail(`${nsid}: ${String(cause)}`));
  const body = await res.text();
  expect(res.status === 200, `${nsid}: expected 200, got ${res.status} — ${body.slice(0, 200)}`);

  try {
    return JSON.parse(body);
  } catch {
    return fail(`${nsid}: response was not JSON — ${body.slice(0, 200)}`);
  }
}

// -------------------------------------------------------------- shape checks

function checkProfileBasic(value: unknown, where: string): { did: string; handle: string } {
  expect(isRecord(value), `${where}: not an object`);
  const actor = value as Record<string, unknown>;
  expect(typeof actor["did"] === "string", `${where}: missing did`);
  expect(typeof actor["handle"] === "string", `${where}: missing handle`);
  return { did: actor["did"] as string, handle: actor["handle"] as string };
}

function checkPostView(value: unknown, where: string): { uri: string } {
  expect(isRecord(value), `${where}: not an object`);
  const post = value as Record<string, unknown>;
  expect(typeof post["uri"] === "string", `${where}: missing uri`);
  expect(typeof post["cid"] === "string", `${where}: missing cid`);
  expect(typeof post["bskyUrl"] === "string", `${where}: missing bskyUrl`);
  expect(typeof post["createdAt"] === "string", `${where}: missing createdAt`);
  expect(Array.isArray(post["media"]), `${where}: media is not an array`);
  expect((post["media"] as unknown[]).length > 0, `${where}: a post view with no media`);
  expect(
    post["labels"] === undefined || Array.isArray(post["labels"]),
    `${where}: labels is not an array`,
  );
  checkProfileBasic(post["author"], `${where}.author`);
  return { uri: post["uri"] as string };
}

const rkeyOf = (uri: string): string => uri.slice(uri.lastIndexOf("/") + 1);

// ------------------------------------------------------------------- the run

interface Check {
  readonly name: string;
  readonly detail: string;
}

async function run(): Promise<Check[]> {
  const done: Check[] = [];

  const health = await fetch(new URL("/xrpc/_health", BASE));
  expect(health.status === 200, `_health: expected 200, got ${health.status}`);
  done.push({ name: "_health", detail: await health.text() });

  const typeahead = await query("art.ratat.actor.searchActorsTypeahead", { q: QUERY, limit: 8 });
  expect(isRecord(typeahead), "searchActorsTypeahead: not an object");
  const actors = (typeahead as Record<string, unknown>)["actors"];
  expect(Array.isArray(actors), "searchActorsTypeahead: actors is not an array");
  expect((actors as unknown[]).length > 0, `searchActorsTypeahead: nothing matched "${QUERY}"`);
  const candidates = (actors as unknown[]).map((actor, index) =>
    checkProfileBasic(actor, `searchActorsTypeahead.actors[${index}]`),
  );
  done.push({
    name: "art.ratat.actor.searchActorsTypeahead",
    detail: `${candidates.length} actor(s) for "${QUERY}"`,
  });

  const first = candidates[0];
  if (first === undefined) return fail("searchActorsTypeahead: no candidate to follow up on");

  const profile = await query("art.ratat.actor.getProfile", { actor: first.handle });
  const named = checkProfileBasic(profile, "getProfile");
  expect(named.did === first.did, "getProfile: answered about a different DID");
  expect(
    typeof (profile as Record<string, unknown>)["bskyUrl"] === "string",
    "getProfile: missing bskyUrl",
  );
  done.push({ name: "art.ratat.actor.getProfile", detail: `@${named.handle}` });

  // The first candidate may post nothing with media, which is a legitimate
  // empty feed rather than a failure — so the post check moves down the list.
  let withArt: { actor: { did: string; handle: string }; uri: string } | undefined;

  for (const candidate of candidates.slice(0, 4)) {
    const feed = await query("art.ratat.feed.getAuthorFeed", { actor: candidate.did, limit: 5 });
    expect(isRecord(feed), "getAuthorFeed: not an object");
    const items = (feed as Record<string, unknown>)["feed"];
    expect(Array.isArray(items), "getAuthorFeed: feed is not an array");
    const posts = (items as unknown[]).map((item, index) =>
      checkPostView(item, `getAuthorFeed.feed[${index}]`),
    );
    if (withArt === undefined && posts[0]) {
      withArt = { actor: candidate, uri: posts[0].uri };
      done.push({
        name: "art.ratat.feed.getAuthorFeed",
        detail: `${posts.length} artwork(s) by @${candidate.handle}`,
      });
      break;
    }
  }

  if (withArt === undefined) {
    return fail(
      `getAuthorFeed: none of the first candidates for "${QUERY}" has posted media, so ` +
        `getPost cannot be checked — set RATAT_SMOKE_QUERY to a term that finds an artist`,
    );
  }

  const post = await query("art.ratat.feed.getPost", {
    actor: withArt.actor.handle,
    rkey: rkeyOf(withArt.uri),
  });
  expect(isRecord(post), "getPost: not an object");
  const view = checkPostView((post as Record<string, unknown>)["post"], "getPost.post");
  expect(view.uri === withArt.uri, `getPost: asked for ${withArt.uri}, got ${view.uri}`);
  done.push({ name: "art.ratat.feed.getPost", detail: rkeyOf(view.uri) });

  const follows = await query("art.ratat.graph.getFollows", { actor: withArt.actor.did });
  expect(isRecord(follows), "getFollows: not an object");
  expect(
    Array.isArray((follows as Record<string, unknown>)["follows"]),
    "getFollows: follows is not an array",
  );
  expect(
    typeof (follows as Record<string, unknown>)["indexed"] === "boolean",
    "getFollows: missing indexed",
  );
  done.push({
    name: "art.ratat.graph.getFollows",
    detail: `${((follows as Record<string, unknown>)["follows"] as unknown[]).length} follow(s)`,
  });

  // A timeline needs no follows to be well formed; an actor who follows nobody
  // is exactly the empty-but-valid case worth checking.
  const timeline = await query("art.ratat.feed.getTimeline", {
    viewer: withArt.actor.did,
    limit: 5,
  });
  expect(isRecord(timeline), "getTimeline: not an object");
  const line = timeline as Record<string, unknown>;
  expect(Array.isArray(line["feed"]), "getTimeline: feed is not an array");
  expect(typeof line["page"] === "number", "getTimeline: missing page");
  expect(typeof line["total"] === "number", "getTimeline: missing total");
  (line["feed"] as unknown[]).forEach((item, index) =>
    checkPostView(item, `getTimeline.feed[${index}]`),
  );
  done.push({
    name: "art.ratat.feed.getTimeline",
    detail: `${(line["feed"] as unknown[]).length} of ${String(line["total"])}`,
  });

  return done;
}

// ---------------------------------------------------------------- the server

const listening = async (): Promise<boolean> => {
  try {
    const res = await fetch(new URL("/xrpc/_health", BASE), {
      signal: AbortSignal.timeout(1_000),
    });
    return res.ok;
  } catch {
    return false;
  }
};

async function startServer(): Promise<() => void> {
  console.log(`· no server on ${BASE}, starting one`);
  const child = Bun.spawn(["bun", "apps/xrpc-server/src/main.ts"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      const err = await new Response(child.stderr).text();
      fail(`the xrpc-server exited before it listened:\n${err.slice(-2000)}`);
    }
    if (await listening()) return () => child.kill();
    await Bun.sleep(250);
  }

  child.kill();
  return fail(`the xrpc-server did not listen on ${BASE} within ${BOOT_TIMEOUT_MS / 1000}s`);
}

const stop = (await listening()) ? () => {} : await startServer();

try {
  const checks = await run();
  console.log(`\n✓ smoke passed against ${BASE}\n`);
  for (const check of checks) console.log(`  ${check.name}  —  ${check.detail}`);
  console.log();
} catch (error) {
  console.error(`\n✗ smoke failed against ${BASE}\n`);
  console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
  stop();
  process.exit(1);
}

stop();
