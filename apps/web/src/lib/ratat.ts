import { Client, simpleFetchHandler } from "@atcute/client";
import type { ArtRatatActorDefs, ArtRatatFeedDefs } from "@ratat/lexicon";
import type {} from "@ratat/lexicon";

export type Profile = ArtRatatActorDefs.ProfileView;
export type Post = ArtRatatFeedDefs.PostView;
export type Media = Post["media"][number];

export interface Portfolio {
  posts: Post[];
  cursor?: string;
}

const APPVIEW_URL = import.meta.env.VITE_RATAT_APPVIEW_URL ?? "http://127.0.0.1:3001";

const client = new Client({ handler: simpleFetchHandler({ service: APPVIEW_URL }) });

export class AppviewError extends Error {
  readonly kind: string;

  constructor(kind: string, message: string | undefined) {
    super(message ?? kind);
    this.name = "AppviewError";
    this.kind = kind;
  }
}

export async function getProfile(actor: string, signal?: AbortSignal): Promise<Profile> {
  const res = await client.get("art.ratat.actor.getProfile", {
    params: { actor: actor as Profile["did"] },
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) throw new AppviewError(res.data.error, res.data.message);
  return res.data;
}

export async function getAuthorFeed(
  actor: string,
  options: { cursor?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<Portfolio> {
  const res = await client.get("art.ratat.feed.getAuthorFeed", {
    params: {
      actor: actor as Profile["did"],
      limit: options.limit ?? 30,
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok) throw new AppviewError(res.data.error, res.data.message);
  return { posts: res.data.feed, ...(res.data.cursor ? { cursor: res.data.cursor } : {}) };
}

export async function getPost(actor: string, rkey: string, signal?: AbortSignal): Promise<Post> {
  const res = await client.get("art.ratat.feed.getPost", {
    params: { actor: actor as Profile["did"], rkey },
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) throw new AppviewError(res.data.error, res.data.message);
  return res.data.post;
}

export function isVideo(media: Media): media is Extract<Media, { playlist: string }> {
  return "playlist" in media;
}

export function aspectRatio(media: Media): string | undefined {
  const ratio = media.aspectRatio;
  return ratio ? `${ratio.width} / ${ratio.height}` : undefined;
}
