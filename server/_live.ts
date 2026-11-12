import { AppviewError, UpstreamFailureError } from "./_errors.ts";

export const PUBLIC_BSKY_APPVIEW_URL = "https://public.api.bsky.app";
export const BSKY_APPVIEW_URL = (process.env.BSKY_APPVIEW_URL || PUBLIC_BSKY_APPVIEW_URL).replace(
  /\/$/,
  "",
);

export interface BskyLabel {
  src?: string;
  uri?: string;
  cid?: string;
  val: string;
  neg?: boolean;
  cts?: string;
}

export interface BskyProfileViewBasic {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  labels?: BskyLabel[];
}

export interface BskyProfileViewDetailed {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  labels?: BskyLabel[];
  indexedAt?: string;
}

export interface BskyEmbedView {
  $type: string;
  images?: Array<{
    thumb: string;
    fullsize: string;
    alt?: string;
    aspectRatio?: { width: number; height: number };
  }>;
  playlist?: string;
  thumbnail?: string;
  alt?: string;
  aspectRatio?: { width: number; height: number };
  media?: BskyEmbedView;
}

export interface BskyPostView {
  uri: string;
  cid: string;
  author: BskyProfileViewBasic;
  record: unknown;
  embed?: BskyEmbedView;
  labels?: BskyLabel[];
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  indexedAt: string;
}

export interface BskyFeedViewPost {
  post: BskyPostView;
  reason?: { $type?: string };
}

export interface BskyAuthorFeedResponse {
  feed: BskyFeedViewPost[];
  cursor?: string;
}

export interface BskyGetPostsResponse {
  posts: BskyPostView[];
}

export interface BskyTypeaheadResponse {
  actors: BskyProfileViewBasic[];
}

export interface BskyGetProfilesResponse {
  profiles: BskyProfileViewDetailed[];
}

export type AppviewParams = Record<
  string,
  string | number | boolean | readonly string[] | undefined
>;

export interface Appview {
  get<T = unknown>(nsid: string, params?: AppviewParams, signal?: AbortSignal): Promise<T>;
}

export class PublicAppview implements Appview {
  async get<T = unknown>(nsid: string, params?: AppviewParams, signal?: AbortSignal): Promise<T> {
    const baseUrl = (process.env.BSKY_APPVIEW_URL || BSKY_APPVIEW_URL).replace(/\/$/, "");
    const url = new URL(`/xrpc/${nsid}`, baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            url.searchParams.append(key, String(item));
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        ...(signal ? { signal } : {}),
      });
    } catch {
      throw new UpstreamFailureError("could not reach the Bluesky appview");
    }

    if (!res.ok) {
      let payload: { error?: string; message?: string } = {};
      try {
        payload = (await res.json()) as { error?: string; message?: string };
      } catch {
        payload = {};
      }
      const errorCode = payload.error || (res.status >= 500 ? "UpstreamFailure" : "InvalidRequest");
      const message = payload.message || payload.error || `appview HTTP ${res.status}`;
      const status = res.status >= 500 ? 502 : res.status;
      throw new AppviewError(status, errorCode, message);
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new UpstreamFailureError("invalid JSON from the Bluesky appview");
    }
  }
}

export interface RepoTracker {
  status(did: string): Promise<string | undefined>;
  add(did: string): Promise<void>;
}

export class HatkRepoTracker implements RepoTracker {
  private baseUrl(): string {
    const port = process.env.PORT || "3000";
    return `http://127.0.0.1:${port}`;
  }

  async status(did: string): Promise<string | undefined> {
    const info = await fetch(`${this.baseUrl()}/info/${encodeURIComponent(did)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!info.ok) return undefined;
    const data = (await info.json()) as { status?: string };
    return data.status;
  }

  async add(did: string): Promise<void> {
    await fetch(`${this.baseUrl()}/repos/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dids: [did] }),
      signal: AbortSignal.timeout(5000),
    });
  }
}

export class Backfill {
  private readonly seen = new Set<string>();
  private readonly tracker: RepoTracker;

  constructor(tracker: RepoTracker) {
    this.tracker = tracker;
  }

  note(did: string): void {
    if (!did || !did.startsWith("did:") || this.seen.has(did)) return;
    this.seen.add(did);

    void (async () => {
      try {
        const status = await this.tracker.status(did);
        if (status === "active" || status === "pending") return;
        await this.tracker.add(did);
      } catch {
        this.seen.delete(did);
      }
    })();
  }
}

const DEFAULT_CURSOR_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_CURSORS = 5000;

export class CursorMemo {
  private readonly entries = new Map<string, { cursor: string; expiresAt: number }>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(
    now: () => number = Date.now,
    ttlMs: number = DEFAULT_CURSOR_TTL_MS,
    maxEntries: number = DEFAULT_MAX_CURSORS,
  ) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  remember(actor: string, limit: number, page: number, cursor: string): void {
    this.entries.set(`${actor}|${limit}|${page}`, {
      cursor,
      expiresAt: this.now() + this.ttlMs,
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  nearest(
    actor: string,
    limit: number,
    page: number,
  ): { page: number; cursor: string } | undefined {
    const current = this.now();
    for (let candidate = page; candidate > 1; candidate--) {
      const key = `${actor}|${limit}|${candidate}`;
      const entry = this.entries.get(key);
      if (entry === undefined) continue;
      if (entry.expiresAt <= current) {
        this.entries.delete(key);
        continue;
      }
      return { page: candidate, cursor: entry.cursor };
    }
    return undefined;
  }
}

export interface Live {
  readonly appview: Appview;
  readonly backfill: Backfill;
  readonly cursors: CursorMemo;
}

export const live: Live = {
  appview: new PublicAppview(),
  backfill: new Backfill(new HatkRepoTracker()),
  cursors: new CursorMemo(),
};
