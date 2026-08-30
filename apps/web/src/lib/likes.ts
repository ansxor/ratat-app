import { Client } from "@atcute/client";
import type {} from "@atcute/atproto";
import type {} from "@atcute/bluesky";
import type { Did, Nsid } from "@atcute/lexicons";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { parseAtUri } from "@ratat/common";
import { BskyCollection } from "@ratat/lexicon/collections";

export interface PostRef {
  uri: string;
  cid: string;
}

const LIKE_COLLECTION = BskyCollection.feedLike;

function fail(op: string, error: string | undefined): never {
  throw new Error(`${op} failed: ${error ?? "unknown"}`);
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
