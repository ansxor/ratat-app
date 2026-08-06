import { Client } from "@atcute/client";
import type {} from "@atcute/atproto";
import type {} from "@atcute/bluesky";
import type { Did, Nsid, ResourceUri } from "@atcute/lexicons";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { parseAtUri } from "@ratat/common";
import { BskyCollection } from "@ratat/lexicon/collections";

export interface LikeState {
  likeCount: number;
  likeUri?: string;
}

export interface PostRef {
  uri: string;
  cid: string;
}

const LIKE_COLLECTION = BskyCollection.feedLike;

function fail(op: string, error: string | undefined): never {
  throw new Error(`${op} failed: ${error ?? "unknown"}`);
}

/**
 * Reads through the user's PDS, which proxies app.bsky.* to its appview and so
 * answers with viewer state the public appview cannot give us.
 */
export async function getLikeState(
  agent: OAuthUserAgent,
  uri: string,
  signal?: AbortSignal,
): Promise<LikeState | undefined> {
  const res = await new Client({ handler: agent }).get("app.bsky.feed.getPosts", {
    params: { uris: [uri as ResourceUri] },
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) return undefined;
  const post = res.data.posts[0];
  if (!post) return undefined;
  return {
    likeCount: post.likeCount ?? 0,
    ...(post.viewer?.like ? { likeUri: post.viewer.like } : {}),
  };
}

export async function createLike(agent: OAuthUserAgent, subject: PostRef): Promise<string> {
  const res = await new Client({ handler: agent }).post("com.atproto.repo.createRecord", {
    input: {
      repo: agent.sub as Did,
      collection: LIKE_COLLECTION as Nsid,
      record: {
        $type: LIKE_COLLECTION,
        subject: { uri: subject.uri, cid: subject.cid },
        createdAt: new Date().toISOString(),
      } as never,
    },
  });
  if (!res.ok) fail("createRecord", res.data.error);
  return res.data.uri;
}

export async function deleteLike(agent: OAuthUserAgent, likeUri: string): Promise<void> {
  const parsed = parseAtUri(likeUri);
  if (!parsed || parsed.collection !== LIKE_COLLECTION) {
    throw new Error("That isn't a like URI.");
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

const FIRST_LIKE_KEY = "ratat:first-like-acknowledged";

export function hasAcknowledgedFirstLike(): boolean {
  try {
    return window.localStorage.getItem(FIRST_LIKE_KEY) === "1";
  } catch {
    return true;
  }
}

export function acknowledgeFirstLike(): void {
  try {
    window.localStorage.setItem(FIRST_LIKE_KEY, "1");
  } catch {
    /* a browser that refuses storage simply shows the notice again */
  }
}
