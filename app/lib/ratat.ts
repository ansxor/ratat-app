import { callXrpc, parseViewer, type XrpcSchema } from "$hatk/client";

export type Viewer = NonNullable<Awaited<ReturnType<typeof parseViewer>>>;

export type Profile = XrpcSchema["net.ratat.actor.getProfile"]["output"];
export type ProfileBasic =
  XrpcSchema["net.ratat.actor.searchActorsTypeahead"]["output"]["actors"][number];
export type Post = XrpcSchema["net.ratat.feed.getPost"]["output"]["post"];
export type Media = Post["media"][number];
export type FollowActor = XrpcSchema["net.ratat.graph.getFollows"]["output"]["follows"][number];

export interface Portfolio {
  posts: Post[];
  cursor?: string;
  page?: number;
  total?: number;
}

export interface Timeline {
  posts: Post[];
  page: number;
  total: number;
}

export interface IndexedFollows {
  follows: Array<{ uri: string; subject: string }>;
  indexed: boolean;
}

export interface FollowListResult {
  actors: FollowActor[];
  total?: number;
  page?: number;
}

export interface ReadOptions {
  signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
}

export class AppviewError extends Error {
  readonly kind: string;

  constructor(kind: string, message: string | undefined) {
    super(message ?? kind);
    this.name = "AppviewError";
    this.kind = kind;
  }
}

export function readFailureMessage(cause: unknown, notFound: string): string {
  if (cause instanceof AppviewError) {
    if (cause.kind === "ProfileNotFound" || cause.kind === "PostNotFound") return notFound;
    if (cause.kind === "UpstreamFailure") {
      return "Bluesky didn't answer just now. Try again in a moment.";
    }
  }
  if (cause && typeof cause === "object") {
    const record = cause as { errorName?: unknown; error?: unknown; status?: unknown };
    const kind =
      typeof record.errorName === "string"
        ? record.errorName
        : typeof record.error === "string"
          ? record.error
          : "";
    if (kind === "ProfileNotFound" || kind === "PostNotFound" || record.status === 404) {
      return notFound;
    }
    if (kind === "UpstreamFailure" || record.status === 502) {
      return "Bluesky didn't answer just now. Try again in a moment.";
    }
  }
  if (cause instanceof Error) {
    if (
      cause.message.includes("ProfileNotFound") ||
      cause.message.includes("PostNotFound") ||
      cause.message.includes(": 404")
    ) {
      return notFound;
    }
    if (cause.message.includes("UpstreamFailure") || cause.message.includes(": 502")) {
      return "Bluesky didn't answer just now. Try again in a moment.";
    }
  }
  return "Ratat couldn't load this. Try again in a moment.";
}

function fetchWithSignal(
  customFetch: typeof globalThis.fetch | undefined,
  signal: AbortSignal | undefined,
): typeof globalThis.fetch | undefined {
  if (!signal) return customFetch;
  if (typeof window === "undefined" && !customFetch) return undefined;
  const base = customFetch ?? globalThis.fetch;
  return (input, init) => base(input, { ...init, signal });
}

export async function getProfile(actor: string, options: ReadOptions = {}): Promise<Profile> {
  return callXrpc(
    "net.ratat.actor.getProfile",
    { actor },
    fetchWithSignal(options.fetch, options.signal),
  );
}

export async function searchActorsTypeahead(
  q: string,
  options: ReadOptions & { limit?: number } = {},
): Promise<ProfileBasic[]> {
  const res = await callXrpc(
    "net.ratat.actor.searchActorsTypeahead",
    { q, ...(options.limit ? { limit: options.limit } : {}) },
    fetchWithSignal(options.fetch, options.signal),
  );
  return res.actors;
}

export async function getAuthorFeed(
  actor: string,
  options: ReadOptions & {
    cursor?: string;
    page?: number;
    limit?: number;
    sample?: boolean;
  } = {},
): Promise<Portfolio> {
  const res = await callXrpc(
    "net.ratat.feed.getAuthorFeed",
    {
      actor,
      limit: options.limit ?? 30,
      ...(options.sample ? { sample: true } : {}),
      ...(options.page && options.page > 1 ? { page: options.page } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
    fetchWithSignal(options.fetch, options.signal),
  );
  return {
    posts: res.feed,
    ...(res.cursor ? { cursor: res.cursor } : {}),
    ...(res.page === undefined ? {} : { page: res.page }),
    ...(res.total === undefined ? {} : { total: res.total }),
  };
}

export async function getTimeline(
  viewer: string,
  options: ReadOptions & { page?: number; limit?: number } = {},
): Promise<Timeline> {
  const res = await callXrpc(
    "net.ratat.feed.getTimeline",
    {
      viewer,
      limit: options.limit ?? 30,
      ...(options.page && options.page > 1 ? { page: options.page } : {}),
    },
    fetchWithSignal(options.fetch, options.signal),
  );
  return { posts: res.feed, page: res.page, total: res.total };
}

function toFollowListResult(
  rows: readonly FollowActor[],
  total?: number,
  page?: number,
): FollowListResult {
  return {
    actors: rows.map((row: FollowActor) => ({
      uri: row.uri,
      subject: row.subject,
      createdAt: row.createdAt,
      ...(row.handle ? { handle: row.handle } : {}),
      ...(row.displayName ? { displayName: row.displayName } : {}),
      ...(row.avatar ? { avatar: row.avatar } : {}),
    })),
    ...(total === undefined ? {} : { total }),
    ...(page === undefined ? {} : { page }),
  };
}

export async function getFollowList(
  kind: "followers" | "following",
  actor: string,
  options: ReadOptions & { page?: number; limit?: number } = {},
): Promise<FollowListResult> {
  const customFetch = fetchWithSignal(options.fetch, options.signal);
  const params = {
    actor,
    limit: options.limit ?? 100,
    ...(options.page && options.page > 1 ? { page: options.page } : {}),
  };

  if (kind === "following") {
    const data = await callXrpc("net.ratat.graph.getFollows", params, customFetch);
    return toFollowListResult(data.follows, data.total, data.page);
  }

  const data = await callXrpc("net.ratat.graph.getFollowers", params, customFetch);
  return toFollowListResult(data.followers, data.total, data.page);
}

export async function hasRatatFollows(actor: string, options: ReadOptions = {}): Promise<boolean> {
  const res = await getFollowList("following", actor, { ...options, limit: 1 });
  return (res.total ?? res.actors.length) > 0;
}

export async function listBskyFollows(
  actor: string,
  options: ReadOptions = {},
): Promise<ProfileBasic[]> {
  const customFetch = fetchWithSignal(options.fetch, options.signal);
  const candidates: ProfileBasic[] = [];
  let cursor: string | undefined;
  try {
    for (;;) {
      const res = await callXrpc(
        "net.ratat.graph.listBskyFollows",
        { actor, limit: 100, ...(cursor ? { cursor } : {}) },
        customFetch,
      );
      if (res.follows) candidates.push(...res.follows);
      if (!res.cursor || !res.follows || res.follows.length === 0) break;
      cursor = res.cursor;
    }
  } catch {}
  return candidates;
}

export async function getRatatFollows(
  actor: string,
  options: ReadOptions = {},
): Promise<IndexedFollows> {
  const customFetch = fetchWithSignal(options.fetch, options.signal);
  const follows: IndexedFollows["follows"] = [];
  let indexed = false;
  let cursor: string | undefined;

  for (;;) {
    const data = await callXrpc(
      "net.ratat.graph.getFollows",
      {
        actor,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
      customFetch,
    );

    indexed = data.indexed;
    for (const follow of data.follows) {
      follows.push({ uri: follow.uri, subject: follow.subject });
    }

    cursor = data.cursor;
    if (cursor === undefined) break;
  }

  return { follows, indexed };
}

export async function getPost(
  actor: string,
  rkey: string,
  options: ReadOptions & { viewer?: string } = {},
): Promise<Post> {
  const res = await callXrpc(
    "net.ratat.feed.getPost",
    {
      actor,
      rkey,
      ...(options.viewer ? { viewer: options.viewer } : {}),
    },
    fetchWithSignal(options.fetch, options.signal),
  );
  return res.post;
}

export function isVideo(media: Media): media is Extract<Media, { playlist: string }> {
  return "playlist" in media;
}

export function aspectRatio(media: Media): string | undefined {
  const ratio = media.aspectRatio;
  return ratio ? `${ratio.width} / ${ratio.height}` : undefined;
}
