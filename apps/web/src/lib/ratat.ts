import { Client, simpleFetchHandler } from "@atcute/client";
import type { ArtRatatActorDefs, ArtRatatFeedDefs } from "@ratat/lexicon";
import type {} from "@ratat/lexicon";

export type Profile = ArtRatatActorDefs.ProfileView;
export type ProfileBasic = ArtRatatActorDefs.ProfileViewBasic;
export type Post = ArtRatatFeedDefs.PostView;
export type Media = Post["media"][number];

export interface Portfolio {
  posts: Post[];
  cursor?: string;
  /** The page the appview served, which is the last one when the feed ran out first. */
  page?: number;
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

/**
 * What to put on the page when a read failed. The appview's own error names
 * are the only thing worth branching on: everything else — Postgres down, the
 * appview process gone, a network that dropped — reaches the browser the same
 * way and deserves the same "try again" rather than a stack trace.
 */
export function readFailureMessage(cause: unknown, notFound: string): string {
  if (cause instanceof AppviewError) {
    if (cause.kind === "ProfileNotFound" || cause.kind === "PostNotFound") return notFound;
    if (cause.kind === "UpstreamFailure") {
      return "Bluesky didn't answer just now. Try again in a moment.";
    }
  }
  return "Ratat couldn't load this. Try again in a moment.";
}

export async function getProfile(actor: string, signal?: AbortSignal): Promise<Profile> {
  const res = await client.get("art.ratat.actor.getProfile", {
    params: { actor: actor as Profile["did"] },
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) throw new AppviewError(res.data.error, res.data.message);
  return res.data;
}

/**
 * As-you-type suggestions. The appview proxies these to Bluesky, so an artist
 * Ratat has never indexed is still findable — the first visit to their page is
 * what puts them in the index.
 */
export async function searchActorsTypeahead(
  q: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<ProfileBasic[]> {
  const res = await client.get("art.ratat.actor.searchActorsTypeahead", {
    params: { q, ...(options.limit ? { limit: options.limit } : {}) },
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok) throw new AppviewError(res.data.error, res.data.message);
  return res.data.actors;
}

export async function getAuthorFeed(
  actor: string,
  options: { cursor?: string; page?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<Portfolio> {
  const res = await client.get("art.ratat.feed.getAuthorFeed", {
    params: {
      actor: actor as Profile["did"],
      limit: options.limit ?? 30,
      ...(options.page && options.page > 1 ? { page: options.page } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok) throw new AppviewError(res.data.error, res.data.message);
  return {
    posts: res.data.feed,
    ...(res.data.cursor ? { cursor: res.data.cursor } : {}),
    ...(res.data.page === undefined ? {} : { page: res.data.page }),
  };
}

export interface Timeline {
  posts: Post[];
  /** The page the index served, which is the last one when the timeline is shorter. */
  page: number;
  total: number;
}

export async function getTimeline(
  viewer: string,
  options: { page?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<Timeline> {
  const res = await client.get("art.ratat.feed.getTimeline", {
    params: {
      viewer: viewer as Profile["did"],
      limit: options.limit ?? 30,
      ...(options.page && options.page > 1 ? { page: options.page } : {}),
    },
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!res.ok) throw new AppviewError(res.data.error, res.data.message);
  return { posts: res.data.feed, page: res.data.page, total: res.data.total };
}

export interface IndexedFollows {
  follows: Array<{ uri: string; subject: string }>;
  /** False while the index has yet to walk this repo, so the list may be short. */
  indexed: boolean;
}

export async function getRatatFollows(
  actor: string,
  signal?: AbortSignal,
): Promise<IndexedFollows> {
  const follows: IndexedFollows["follows"] = [];
  let indexed = false;
  let cursor: string | undefined;

  for (;;) {
    const res = await client.get("art.ratat.graph.getFollows", {
      params: {
        actor: actor as Profile["did"],
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) throw new AppviewError(res.data.error, res.data.message);

    indexed = res.data.indexed;
    for (const follow of res.data.follows) {
      follows.push({ uri: follow.uri, subject: follow.subject });
    }

    cursor = res.data.cursor;
    if (cursor === undefined) break;
  }

  return { follows, indexed };
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
