import type { Blobs } from "./_atproto.ts";

export interface Viewable<V> {
  view(blobs: Blobs): V | undefined;
}

export interface Position {
  readonly page?: number;
  readonly total?: number;
  readonly cursor?: string;
}

export class Page<V, P extends Position = Position> {
  readonly items: readonly Viewable<V>[];
  readonly position: P;

  constructor(items: readonly Viewable<V>[], position: P) {
    this.items = items;
    this.position = position;
  }

  views(blobs: Blobs): V[] {
    const out: V[] = [];
    for (const item of this.items) {
      const view = item.view(blobs);
      if (view !== undefined) out.push(view);
    }
    return out;
  }
}

export class FeedCursor {
  readonly createdAt: Date;
  readonly uri: string;

  constructor(createdAt: Date, uri: string) {
    this.createdAt = createdAt;
    this.uri = uri;
  }

  static decode(raw: string): FeedCursor | undefined {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const separator = decoded.indexOf("|");
    if (separator <= 0) return undefined;
    const ms = Number(decoded.slice(0, separator));
    const uri = decoded.slice(separator + 1);
    if (!Number.isFinite(ms) || !uri.startsWith("at://")) return undefined;
    return new FeedCursor(new Date(ms), uri);
  }

  static encode(createdAt: Date | string | number, uri: string): string {
    const ms =
      createdAt instanceof Date
        ? createdAt.getTime()
        : typeof createdAt === "number"
          ? createdAt
          : Date.parse(createdAt);
    return Buffer.from(`${ms}|${uri}`, "utf8").toString("base64url");
  }
}

export class Bounds {
  readonly total: number;
  readonly limit: number;
  readonly page: number;
  readonly offset: number;
  readonly hasMore: boolean;

  private constructor(
    total: number,
    limit: number,
    page: number,
    offset: number,
    hasMore: boolean,
  ) {
    this.total = total;
    this.limit = limit;
    this.page = page;
    this.offset = offset;
    this.hasMore = hasMore;
  }

  static of(total: number, limit: number, requestedPage: number): Bounds {
    const safeLimit = Math.max(1, Math.floor(limit));
    const safePage = Math.max(1, Math.floor(requestedPage));
    const lastPage = Math.max(1, Math.ceil(total / safeLimit));
    const served = Math.min(safePage, lastPage);
    return new Bounds(
      total,
      safeLimit,
      served,
      (served - 1) * safeLimit,
      served * safeLimit < total,
    );
  }
}

export type PageWindow = { readonly kind: "page"; readonly limit: number; readonly page: number };
export type KeysetWindow = {
  readonly kind: "keyset";
  readonly limit: number;
  readonly cursor?: string;
  readonly after?: FeedCursor;
};
export type SampleWindow = { readonly kind: "sample"; readonly limit: number };
export type FeedWindow = PageWindow | KeysetWindow | SampleWindow;
export type GraphWindow = PageWindow | KeysetWindow;

export function clampLimit(raw: unknown, fallback = 30, max = 100): number {
  return Math.min(max, Math.max(1, Number(raw ?? fallback) || fallback));
}

export function clampPage(raw: unknown, max?: number): number {
  const page = Math.max(1, Number(raw ?? 1) || 1);
  return max !== undefined ? Math.min(max, page) : page;
}

export function authorFeedWindow(params: {
  limit?: unknown;
  page?: unknown;
  cursor?: string;
  sample?: unknown;
}): FeedWindow {
  const limit = clampLimit(params.limit, 30, 100);
  const page = clampPage(params.page, 100);
  if (params.sample === true || params.sample === "true") {
    return { kind: "sample", limit };
  }
  if (params.cursor !== undefined) {
    return {
      kind: "keyset",
      limit,
      cursor: params.cursor,
      after: FeedCursor.decode(params.cursor),
    };
  }
  return { kind: "page", limit, page };
}

export function timelineWindow(params: { limit?: unknown; page?: unknown }): PageWindow {
  return {
    kind: "page",
    limit: clampLimit(params.limit, 30, 100),
    page: clampPage(params.page),
  };
}

export function graphWindow(params: {
  limit?: unknown;
  page?: unknown;
  cursor?: string;
}): GraphWindow {
  const limit = clampLimit(params.limit, 30, 100);
  if (params.page !== undefined) {
    return { kind: "page", limit, page: clampPage(params.page) };
  }
  return {
    kind: "keyset",
    limit,
    ...(params.cursor !== undefined
      ? { cursor: params.cursor, after: FeedCursor.decode(params.cursor) }
      : {}),
  };
}
