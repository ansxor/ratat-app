import { Client } from "@atcute/client";
import type {} from "@atcute/atproto";
import type {} from "@atcute/bluesky";
import type { ActorIdentifier, Did, Nsid } from "@atcute/lexicons";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { parseAtUri } from "@ratat/common";
import { NetRatatCollection } from "@ratat/lexicon/collections";

/**
 * The Ratat graph, written straight to the viewer's own repo. Following an
 * artist here never touches their Bluesky graph — that is the whole point of
 * the record — so nothing in this file talks to Bluesky's own follow lexicon
 * except the import, which only reads it.
 */

const FOLLOW_COLLECTION = NetRatatCollection.graphFollow;

/** Batches at the ceiling applyWrites accepts, which is what an import needs. */
export const APPLY_WRITES_LIMIT = 200;

export interface Follow {
  uri: string;
  subject: string;
}

function fail(op: string, error: string | undefined): never {
  throw new Error(`${op} failed: ${error ?? "unknown"}`);
}

const followRecord = (subject: string) => ({
  $type: FOLLOW_COLLECTION,
  subject,
  createdAt: new Date().toISOString(),
});

/**
 * Every Ratat follow in the viewer's repo. The index is the fast answer, but
 * a repo that has not been walked yet — or one written to a second ago — is
 * only correct here, so this is what the button state is built from.
 */
export async function listOwnFollows(
  agent: OAuthUserAgent,
  signal?: AbortSignal,
): Promise<Follow[]> {
  const client = new Client({ handler: agent });
  const follows: Follow[] = [];
  let cursor: string | undefined;

  for (;;) {
    const res = await client.get("com.atproto.repo.listRecords", {
      params: {
        repo: agent.sub as ActorIdentifier,
        collection: FOLLOW_COLLECTION as Nsid,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) fail("listRecords", res.data.error);

    for (const record of res.data.records) {
      const subject = (record.value as { subject?: unknown }).subject;
      if (typeof subject === "string") follows.push({ uri: record.uri, subject });
    }

    cursor = res.data.cursor;
    if (cursor === undefined || res.data.records.length === 0) break;
  }

  return follows;
}

export async function createFollow(agent: OAuthUserAgent, subject: string): Promise<string> {
  const res = await new Client({ handler: agent }).post("com.atproto.repo.createRecord", {
    input: {
      repo: agent.sub as Did,
      collection: FOLLOW_COLLECTION as Nsid,
      record: followRecord(subject) as never,
    },
  });
  if (!res.ok) fail("createRecord", res.data.error);
  return res.data.uri;
}

export async function deleteFollow(agent: OAuthUserAgent, followUri: string): Promise<void> {
  const parsed = parseAtUri(followUri);
  if (!parsed || parsed.collection !== FOLLOW_COLLECTION) {
    throw new Error("That isn't a Ratat follow URI.");
  }
  const res = await new Client({ handler: agent }).post("com.atproto.repo.deleteRecord", {
    input: {
      repo: agent.sub as Did,
      collection: parsed.collection as Nsid,
      rkey: parsed.rkey,
    },
    as: null,
  });
  if (!res.ok) fail("deleteRecord", res.data.error);
}

/** Splits a list into runs of `size`, the last one short. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/**
 * Writes many follows at once, which is what turning a Bluesky follow graph
 * into a Ratat one amounts to. `applyWrites` is atomic per call and capped, so
 * a large graph lands as a handful of commits rather than one per artist.
 */
export async function importFollows(
  agent: OAuthUserAgent,
  subjects: readonly string[],
  onProgress?: (written: number) => void,
): Promise<number> {
  const client = new Client({ handler: agent });
  let written = 0;

  for (const batch of chunk(subjects, APPLY_WRITES_LIMIT)) {
    const res = await client.post("com.atproto.repo.applyWrites", {
      input: {
        repo: agent.sub as Did,
        writes: batch.map((subject) => ({
          $type: "com.atproto.repo.applyWrites#create" as const,
          collection: FOLLOW_COLLECTION as Nsid,
          value: followRecord(subject) as never,
        })),
      },
    });
    if (!res.ok) fail("applyWrites", res.data.error);
    written += batch.length;
    onProgress?.(written);
  }

  return written;
}

const IMPORT_DISMISSED_KEY = "ratat:follow-import-dismissed";

/** The import is offered once. Storage being unavailable counts as offered. */
export function hasDismissedFollowImport(): boolean {
  try {
    return window.localStorage.getItem(IMPORT_DISMISSED_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissFollowImport(): void {
  try {
    window.localStorage.setItem(IMPORT_DISMISSED_KEY, "1");
  } catch {
    /* a browser that refuses storage simply offers the import again */
  }
}

export interface BlueskyFollow {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/**
 * The viewer's Bluesky follows, read through their own PDS so the walk sees
 * exactly the graph they see. Offered as the starting point for a Ratat graph
 * once, at first login; there is no ongoing sync between the two.
 */
export async function listBlueskyFollows(
  agent: OAuthUserAgent,
  signal?: AbortSignal,
): Promise<BlueskyFollow[]> {
  const client = new Client({ handler: agent });
  const follows: BlueskyFollow[] = [];
  let cursor: string | undefined;

  for (;;) {
    const res = await client.get("app.bsky.graph.getFollows", {
      params: {
        actor: agent.sub as ActorIdentifier,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) fail("getFollows", res.data.error);

    for (const profile of res.data.follows) {
      follows.push({
        did: profile.did,
        handle: profile.handle,
        ...(profile.displayName ? { displayName: profile.displayName } : {}),
        ...(profile.avatar ? { avatar: profile.avatar } : {}),
      });
    }

    cursor = res.data.cursor;
    if (cursor === undefined || res.data.follows.length === 0) break;
  }

  return follows;
}
