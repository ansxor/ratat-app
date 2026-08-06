/**
 * Bluesky serves media from its own CDN, and the URLs are derivable from the
 * repo DID plus the blob CID. That matters because the appview hands us finished
 * URLs while jetstream hands us raw records holding blob refs — both paths have
 * to end at the same string.
 */

export const BSKY_CDN_URL = "https://cdn.bsky.app";

export const BSKY_VIDEO_URL = "https://video.bsky.app";

export type BlobPreset =
  | "avatar"
  | "avatar_thumbnail"
  | "banner"
  | "feed_thumbnail"
  | "feed_fullsize";

/**
 * The image CDN takes the DID raw and no format suffix; a `@jpeg` would still
 * resolve, but it opts out of WebP and costs about half again as many bytes.
 * The video host, unlike the image one, does percent-encode the DID — these two
 * really are spelled differently, and each here matches what the appview emits.
 */
export function bskyImageUrl(did: string, cid: string, preset: BlobPreset): string {
  return `${BSKY_CDN_URL}/img/${preset}/plain/${did}/${cid}`;
}

export function bskyVideoPlaylistUrl(did: string, cid: string): string {
  return `${BSKY_VIDEO_URL}/watch/${encodeURIComponent(did)}/${encodeURIComponent(cid)}/playlist.m3u8`;
}

export function bskyVideoThumbnailUrl(did: string, cid: string): string {
  return `${BSKY_VIDEO_URL}/watch/${encodeURIComponent(did)}/${encodeURIComponent(cid)}/thumbnail.jpg`;
}

/** The CID of a blob ref as it appears in a record read off the firehose. */
export function blobCid(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const ref = (value as { ref?: unknown }).ref;
  if (typeof ref === "object" && ref !== null) {
    const link = (ref as { $link?: unknown }).$link;
    if (typeof link === "string") return link;
    // @atcute decodes CIDs into objects that stringify back to the CID.
    if (typeof (ref as { toString?: unknown }).toString === "function") {
      const text = String(ref);
      if (text.startsWith("baf")) return text;
    }
  }
  return undefined;
}
