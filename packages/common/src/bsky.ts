export const PUBLIC_BSKY_APPVIEW_URL = "https://public.api.bsky.app";

export const BSKY_WEB_URL = "https://bsky.app";

export interface ParsedAtUri {
  readonly repo: string;
  readonly collection: string;
  readonly rkey: string;
}

export function parseAtUri(uri: string): ParsedAtUri | undefined {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) return undefined;
  const [, repo, collection, rkey] = match;
  if (!repo || !collection || !rkey) return undefined;
  return { repo, collection, rkey };
}

export function bskyProfileUrl(actor: string): string {
  return `${BSKY_WEB_URL}/profile/${actor}`;
}

export function bskyPostUrl(authorDid: string, postUri: string): string | undefined {
  const parsed = parseAtUri(postUri);
  if (!parsed) return undefined;
  return `${BSKY_WEB_URL}/profile/${authorDid}/post/${parsed.rkey}`;
}
