import type { Post } from "./ratat.ts";

export function rkeyOf(uri: string): string {
  return uri.split("/").pop() ?? uri;
}

/** The old app addresses artwork by artist handle plus record key; so do we. */
export function artworkParams(post: Post): { handle: string; rkey: string } {
  return { handle: post.author.handle, rkey: rkeyOf(post.uri) };
}
