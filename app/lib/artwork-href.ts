import type { Post } from "./ratat.ts";

export function rkeyOf(uri: string): string {
  return uri.split("/").pop() ?? uri;
}

export function artworkParams(post: Post): { handle: string; rkey: string } {
  return { handle: post.author.handle, rkey: rkeyOf(post.uri) };
}

export function artworkHref(post: Post): string {
  const { handle, rkey } = artworkParams(post);
  return `/art/${encodeURIComponent(handle)}/${encodeURIComponent(rkey)}`;
}
