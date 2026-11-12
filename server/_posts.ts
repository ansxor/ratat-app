import {
  AtUri,
  type Blobs,
  type MediaView,
  bskyPostUrl,
  labelValues,
  mediaFromEmbedView,
  mediaFromRecordEmbed,
  storedLabels,
  toIsoString,
  withHatkLabels,
} from "./_atproto.ts";
import {
  type Db,
  type Reads,
  isIndexed,
  likeCounts,
  mediaPostWhere,
  placeholders,
} from "./_index.ts";
import type {
  Appview,
  BskyAuthorFeedResponse,
  BskyFeedViewPost,
  BskyGetPostsResponse,
  BskyPostView,
  Live,
} from "./_live.ts";
import {
  Bounds,
  FeedCursor,
  type FeedWindow,
  Page,
  type PageWindow,
  type Viewable,
  authorFeedWindow,
} from "./_paging.ts";
import {
  ActorRef,
  IndexedActor,
  LiveActor,
  type LocalActorData,
  type ProfileViewBasic,
} from "./_actors.ts";

const SAMPLE_POOL_LIMIT = 100;

export interface PostView {
  uri: string;
  cid: string;
  author: ProfileViewBasic;
  text?: string;
  media: MediaView[];
  labels: string[];
  viewerLike?: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  bskyUrl: string;
  createdAt: string;
  indexedAt?: string;
}

export interface LocalPostData {
  readonly uri: string;
  readonly cid: string;
  readonly did: string;
  readonly text?: string | null;
  readonly embed?: unknown;
  readonly media?: readonly MediaView[];
  readonly labels?: unknown;
  readonly likeCount?: number | null;
  readonly like_count?: number | null;
  readonly replyCount?: number | null;
  readonly reply_count?: number | null;
  readonly repostCount?: number | null;
  readonly repost_count?: number | null;
  readonly createdAt?: string | Date | null;
  readonly created_at?: string | Date | null;
  readonly indexedAt?: string | Date | null;
  readonly indexed_at?: string | Date | null;
}

interface PostSqlRow {
  uri: string;
  cid: string;
  did: string;
  indexed_at: string;
  text: string | null;
  embed: string | null;
  labels: string | null;
  created_at: string;
}

interface TimelineRow extends PostSqlRow {
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar: string | null;
}

function postRecordMeta(record: unknown): { text?: string; createdAt?: string } {
  if (typeof record !== "object" || record === null) return {};
  const candidate = record as { $type?: unknown; text?: unknown; createdAt?: unknown };
  if (candidate.$type !== undefined && candidate.$type !== "app.bsky.feed.post") return {};
  return {
    ...(typeof candidate.text === "string" && candidate.text.length > 0
      ? { text: candidate.text }
      : {}),
    ...(typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
      ? { createdAt: candidate.createdAt }
      : {}),
  };
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export class PostMeta {
  readonly likeCounts: ReadonlyMap<string, number>;
  readonly viewerLikes: ReadonlyMap<string, string>;
  readonly labels: ReadonlyMap<string, string[]>;

  constructor(
    likeCounts: ReadonlyMap<string, number>,
    viewerLikes: ReadonlyMap<string, string>,
    labels: ReadonlyMap<string, string[]>,
  ) {
    this.likeCounts = likeCounts;
    this.viewerLikes = viewerLikes;
    this.labels = labels;
  }

  static async read(
    uris: readonly string[],
    reads: Reads,
    viewerDid: string | undefined = reads.viewer?.did,
  ): Promise<PostMeta> {
    const viewerLikes = new Map<string, string>();
    const labelMap = new Map<string, string[]>();

    if (uris.length === 0) {
      return new PostMeta(new Map<string, number>(), viewerLikes, labelMap);
    }

    const unique = [...new Set(uris)];
    const viewerPromise = viewerDid
      ? (reads.db.query(
          `SELECT subject_uri, uri
           FROM "app.bsky.feed.like"
           WHERE did = $1 AND subject_uri IN (${placeholders(unique.length, 2)})`,
          [viewerDid, ...unique],
        ) as Promise<Array<{ subject_uri: string; uri: string }>>)
      : Promise.resolve([]);

    const [resolvedLikeCounts, viewerRows, rawLabels] = await Promise.all([
      likeCounts(reads.db, unique),
      viewerPromise,
      reads.labels(unique),
    ]);

    for (const row of viewerRows) {
      viewerLikes.set(row.subject_uri, row.uri);
    }

    for (const [uri, entries] of rawLabels) {
      const vals: string[] = [];
      for (const entry of entries as Array<{ val?: string; neg?: boolean }>) {
        if (entry.val && !entry.neg && !vals.includes(entry.val)) {
          vals.push(entry.val);
        }
      }
      if (vals.length > 0) labelMap.set(uri, vals);
    }

    return new PostMeta(resolvedLikeCounts, viewerLikes, labelMap);
  }
}

export class IndexedPost implements Viewable<PostView> {
  private readonly row: LocalPostData;
  private readonly author: LocalActorData;
  private readonly viewerLike?: string;
  private readonly likeCount?: number;
  private readonly extraLabels?: readonly string[];

  constructor(
    row: LocalPostData,
    author: LocalActorData,
    opts?: { viewerLike?: string; likeCount?: number; extraLabels?: readonly string[] },
  ) {
    this.row = row;
    this.author = author;
    this.viewerLike = opts?.viewerLike;
    this.likeCount = opts?.likeCount;
    this.extraLabels = opts?.extraLabels;
  }

  static fromRows(
    rows: readonly LocalPostData[],
    authorFor: (row: LocalPostData) => LocalActorData,
    meta: PostMeta,
  ): IndexedPost[] {
    return rows.map(
      (row) =>
        new IndexedPost(row, authorFor(row), {
          viewerLike: meta.viewerLikes.get(row.uri),
          likeCount: meta.likeCounts.get(row.uri),
          extraLabels: meta.labels.get(row.uri),
        }),
    );
  }

  static async timeline(
    viewerDid: string,
    window: PageWindow,
    reads: Reads,
  ): Promise<Page<PostView, { page: number; total: number }>> {
    const countRows = (await reads.db.query(
      `SELECT CAST(COUNT(*) AS INTEGER) AS total
       FROM "app.bsky.feed.post" p
       WHERE p.did IN (
         SELECT DISTINCT f.subject
         FROM "net.ratat.graph.follow" f
         WHERE f.did = $1
       )
       AND NOT EXISTS (SELECT 1 FROM _repos r WHERE r.did = p.did AND r.status = 'takendown')
       AND ${mediaPostWhere("p")}`,
      [viewerDid],
    )) as Array<{ total: number }>;

    const total = Number(countRows[0]?.total ?? 0);
    const bounds = Bounds.of(total, window.limit, window.page);

    const rows = (await reads.db.query(
      `SELECT p.uri, p.cid, p.did, p.indexed_at, p.text, p.embed, p.labels, p.created_at,
              r.handle AS author_handle,
              (SELECT ap.display_name FROM "app.bsky.actor.profile" ap WHERE ap.did = p.did ORDER BY ap.indexed_at DESC LIMIT 1) AS author_display_name,
              (SELECT ap.avatar FROM "app.bsky.actor.profile" ap WHERE ap.did = p.did ORDER BY ap.indexed_at DESC LIMIT 1) AS author_avatar
       FROM "app.bsky.feed.post" p
       LEFT JOIN _repos r ON r.did = p.did
       WHERE p.did IN (
         SELECT DISTINCT f.subject
         FROM "net.ratat.graph.follow" f
         WHERE f.did = $1
       )
       AND (r.status IS NULL OR r.status != 'takendown')
       AND ${mediaPostWhere("p")}
       ORDER BY p.created_at DESC, p.uri DESC
       LIMIT $2 OFFSET $3`,
      [viewerDid, bounds.limit, bounds.offset],
    )) as TimelineRow[];

    const meta = await PostMeta.read(
      rows.map((r) => r.uri),
      reads,
      viewerDid,
    );

    const items = IndexedPost.fromRows(
      rows,
      (row) => {
        const timelineRow = row as TimelineRow;
        return {
          did: timelineRow.did,
          handle:
            timelineRow.author_handle && !timelineRow.author_handle.startsWith("did:")
              ? timelineRow.author_handle
              : timelineRow.did,
          ...(timelineRow.author_display_name
            ? { displayName: timelineRow.author_display_name }
            : {}),
          ...(timelineRow.author_avatar ? { avatar: timelineRow.author_avatar } : {}),
        };
      },
      meta,
    );

    return new Page(items, { page: bounds.page, total: bounds.total });
  }

  view(blobs: Blobs): PostView | undefined {
    const media = Array.isArray(this.row.media)
      ? [...this.row.media]
      : mediaFromRecordEmbed(this.row.did, this.row.embed, blobs);
    if (media.length === 0) return undefined;

    const bskyUrl = bskyPostUrl(this.row.did, this.row.uri);
    if (!bskyUrl) return undefined;

    const indexedAt = toIsoString(this.row.indexedAt ?? this.row.indexed_at);
    const createdAt =
      toIsoString(this.row.createdAt ?? this.row.created_at) ??
      indexedAt ??
      new Date().toISOString();
    const resolvedLikes = this.likeCount ?? this.row.likeCount ?? this.row.like_count ?? 0;
    const replyCount = this.row.replyCount ?? this.row.reply_count;
    const repostCount = this.row.repostCount ?? this.row.repost_count;
    const baseLabels = storedLabels(this.row.labels);
    const labels =
      this.extraLabels && this.extraLabels.length > 0
        ? withHatkLabels(
            baseLabels,
            this.extraLabels.map((val) => ({ val })),
          )
        : baseLabels;

    return {
      uri: this.row.uri,
      cid: this.row.cid,
      author: new IndexedActor(this.author).view(blobs),
      ...(this.row.text ? { text: this.row.text } : {}),
      media,
      labels,
      ...(this.viewerLike ? { viewerLike: this.viewerLike } : {}),
      likeCount: resolvedLikes,
      ...(replyCount === undefined || replyCount === null ? {} : { replyCount }),
      ...(repostCount === undefined || repostCount === null ? {} : { repostCount }),
      bskyUrl,
      createdAt,
      ...(indexedAt ? { indexedAt } : {}),
    };
  }
}

export class LivePost implements Viewable<PostView> {
  readonly authorDid: string;
  private readonly post: BskyPostView;
  private readonly viewerLike?: string;

  private constructor(post: BskyPostView, viewerLike?: string) {
    this.authorDid = post.author.did;
    this.post = post;
    this.viewerLike = viewerLike;
  }

  static of(post: BskyPostView, viewerLike?: string): LivePost | undefined {
    if (mediaFromEmbedView(post.embed).length === 0) return undefined;
    if (!bskyPostUrl(post.author.did, post.uri)) return undefined;
    return new LivePost(post, viewerLike);
  }

  static fromFeed(item: BskyFeedViewPost): LivePost | undefined {
    if (item.reason?.$type === "app.bsky.feed.defs#reasonRepost") return undefined;
    return LivePost.of(item.post);
  }

  view(_blobs?: Blobs): PostView | undefined {
    const media = mediaFromEmbedView(this.post.embed);
    if (media.length === 0) return undefined;

    const meta = postRecordMeta(this.post.record);
    const createdAt = meta.createdAt ?? this.post.indexedAt;
    const bskyUrl = bskyPostUrl(this.post.author.did, this.post.uri);
    if (!bskyUrl) return undefined;

    return {
      uri: this.post.uri,
      cid: this.post.cid,
      author: new LiveActor(this.post.author).view(),
      ...(meta.text ? { text: meta.text } : {}),
      media,
      labels: labelValues(this.post.labels),
      ...(this.viewerLike ? { viewerLike: this.viewerLike } : {}),
      ...(this.post.likeCount === undefined ? {} : { likeCount: this.post.likeCount }),
      ...(this.post.replyCount === undefined ? {} : { replyCount: this.post.replyCount }),
      ...(this.post.repostCount === undefined ? {} : { repostCount: this.post.repostCount }),
      bskyUrl,
      createdAt,
      indexedAt: this.post.indexedAt,
    };
  }
}

export type PostRecord = IndexedPost | LivePost;

export interface AuthorFeed {
  page(window: FeedWindow, reads: Reads): Promise<Page<PostView>>;
}

export class IndexedFeed implements AuthorFeed {
  readonly did: string;

  constructor(did: string) {
    this.did = did;
  }

  async page(window: FeedWindow, reads: Reads): Promise<Page<PostView>> {
    if (window.kind === "sample") {
      const rows = (await reads.db.query(
        `SELECT uri, cid, did, indexed_at, text, embed, labels, created_at
         FROM "app.bsky.feed.post"
         WHERE did = $1 AND ${mediaPostWhere()}
         ORDER BY random()
         LIMIT $2`,
        [this.did, window.limit],
      )) as PostSqlRow[];

      const [author, meta] = await Promise.all([
        IndexedActor.readAuthor(reads.db, this.did),
        PostMeta.read(
          rows.map((r) => r.uri),
          reads,
        ),
      ]);
      return new Page(
        IndexedPost.fromRows(rows, () => author, meta),
        {},
      );
    }

    if (window.kind === "keyset" && window.after) {
      const afterIso = window.after.createdAt.toISOString();
      const [author, rows] = await Promise.all([
        IndexedActor.readAuthor(reads.db, this.did),
        reads.db.query(
          `SELECT uri, cid, did, indexed_at, text, embed, labels, created_at
           FROM "app.bsky.feed.post"
           WHERE did = $1 AND ${mediaPostWhere()}
             AND (created_at < $2 OR (created_at = $2 AND uri < $3))
           ORDER BY created_at DESC, uri DESC
           LIMIT $4`,
          [this.did, afterIso, window.after.uri, window.limit + 1],
        ) as Promise<PostSqlRow[]>,
      ]);

      const hasMore = rows.length > window.limit;
      const pageRows = hasMore ? rows.slice(0, window.limit) : rows;
      const meta = await PostMeta.read(
        pageRows.map((r) => r.uri),
        reads,
      );
      const items = IndexedPost.fromRows(pageRows, () => author, meta);
      const last = pageRows[pageRows.length - 1];
      const nextCursor = hasMore && last ? FeedCursor.encode(last.created_at, last.uri) : undefined;
      return new Page(items, nextCursor ? { cursor: nextCursor } : {});
    }

    const requestedPage = window.kind === "page" ? window.page : 1;
    const [author, countRows] = await Promise.all([
      IndexedActor.readAuthor(reads.db, this.did),
      reads.db.query(
        `SELECT CAST(COUNT(*) AS INTEGER) AS total
         FROM "app.bsky.feed.post"
         WHERE did = $1 AND ${mediaPostWhere()}`,
        [this.did],
      ) as Promise<Array<{ total: number }>>,
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const bounds = Bounds.of(total, window.limit, requestedPage);

    const rows = (await reads.db.query(
      `SELECT uri, cid, did, indexed_at, text, embed, labels, created_at
       FROM "app.bsky.feed.post"
       WHERE did = $1 AND ${mediaPostWhere()}
       ORDER BY created_at DESC, uri DESC
       LIMIT $2 OFFSET $3`,
      [this.did, bounds.limit, bounds.offset],
    )) as PostSqlRow[];

    const meta = await PostMeta.read(
      rows.map((r) => r.uri),
      reads,
    );
    const items = IndexedPost.fromRows(rows, () => author, meta);
    const last = rows[rows.length - 1];
    const nextCursor =
      bounds.hasMore && last ? FeedCursor.encode(last.created_at, last.uri) : undefined;

    return new Page(items, {
      page: bounds.page,
      total: bounds.total,
      ...(nextCursor ? { cursor: nextCursor } : {}),
    });
  }
}

export class LiveFeed implements AuthorFeed {
  readonly actor: string;
  readonly actorDid?: string;
  private readonly live: Live;

  constructor(actor: string, actorDid: string | undefined, live: Live) {
    this.actor = actor;
    this.actorDid = actorDid;
    this.live = live;
  }

  private async fetchPage(
    limit: number,
    cursor: string | undefined,
  ): Promise<{ items: LivePost[]; cursor?: string }> {
    const res = await this.live.appview.get<BskyAuthorFeedResponse>("app.bsky.feed.getAuthorFeed", {
      actor: this.actor,
      limit,
      filter: "posts_with_media",
      includePins: false,
      ...(cursor ? { cursor } : {}),
    });

    const items: LivePost[] = [];
    for (const entry of res.feed ?? []) {
      const post = LivePost.fromFeed(entry);
      if (post) items.push(post);
    }
    return { items, ...(res.cursor ? { cursor: res.cursor } : {}) };
  }

  async page(window: FeedWindow, _reads?: Reads): Promise<Page<PostView>> {
    if (window.kind === "sample") {
      const result = await this.fetchPage(SAMPLE_POOL_LIMIT, undefined);
      const seenDid = this.actorDid ?? result.items[0]?.authorDid;
      if (seenDid) this.live.backfill.note(seenDid);
      return new Page(shuffle(result.items).slice(0, window.limit), {});
    }

    const cursor = window.kind === "keyset" ? window.cursor : undefined;
    const targetPage = window.kind === "page" ? window.page : 1;
    const start =
      cursor === undefined
        ? this.live.cursors.nearest(this.actor, window.limit, targetPage)
        : undefined;
    let current = start?.page ?? 1;
    let result = await this.fetchPage(window.limit, cursor ?? start?.cursor);

    const seenDid = this.actorDid ?? result.items[0]?.authorDid;
    if (seenDid) this.live.backfill.note(seenDid);

    while (cursor === undefined && current < targetPage && result.cursor !== undefined) {
      const next = result.cursor;
      current++;
      this.live.cursors.remember(this.actor, window.limit, current, next);
      result = await this.fetchPage(window.limit, next);
    }

    return new Page(result.items, {
      ...(cursor === undefined ? { page: current } : {}),
      ...(result.cursor ? { cursor: result.cursor } : {}),
    });
  }
}

export class FeedRequest {
  readonly actor: ActorRef;
  readonly window: FeedWindow;

  private constructor(actor: ActorRef, window: FeedWindow) {
    this.actor = actor;
    this.window = window;
  }

  static parse(params: {
    actor: string;
    limit?: unknown;
    page?: unknown;
    cursor?: string;
    sample?: unknown;
  }): FeedRequest {
    return new FeedRequest(ActorRef.parse(params.actor), authorFeedWindow(params));
  }

  async source(db: Db, live: Live): Promise<AuthorFeed> {
    let actorDid: string | undefined;
    let active = false;
    try {
      actorDid = await this.actor.resolve(db, live.appview);
      active = await isIndexed(db, actorDid);
    } catch {}

    const canServeIndexed =
      active &&
      actorDid !== undefined &&
      (this.window.kind !== "keyset" ||
        this.window.cursor === undefined ||
        this.window.after !== undefined);

    if (canServeIndexed && actorDid) {
      return new IndexedFeed(actorDid);
    }
    return new LiveFeed(this.actor.raw, actorDid, live);
  }
}

export class PostTarget {
  readonly actor: string;
  readonly rkey: string;
  readonly did: string;
  readonly uri: string;
  readonly viewerDid?: string;

  private constructor(
    actor: string,
    rkey: string,
    did: string,
    uri: string,
    viewerDid: string | undefined,
  ) {
    this.actor = actor;
    this.rkey = rkey;
    this.did = did;
    this.uri = uri;
    this.viewerDid = viewerDid;
  }

  static async resolve(
    params: { actor: string; rkey: string; viewer?: string },
    reads: Reads,
    appview: Appview,
  ): Promise<PostTarget> {
    const actor = params.actor.trim();
    const rkey = params.rkey.trim();
    const did = await ActorRef.parse(actor).resolve(reads.db, appview);
    const uri = AtUri.post(did, rkey);
    const viewerActor = params.viewer?.trim();
    const viewerDid = viewerActor
      ? await ActorRef.parse(viewerActor).resolve(reads.db, appview)
      : reads.viewer?.did;
    return new PostTarget(actor, rkey, did, uri, viewerDid);
  }

  async find(reads: Reads, live: Live): Promise<PostRecord | undefined> {
    let viewerLike: string | undefined;
    if (this.viewerDid) {
      const likeRows = (await reads.db.query(
        `SELECT uri FROM "app.bsky.feed.like" WHERE did = $1 AND subject_uri = $2 LIMIT 1`,
        [this.viewerDid, this.uri],
      )) as Array<{ uri: string }>;
      viewerLike = likeRows[0]?.uri;
    }

    const postRows = (await reads.db.query(
      `SELECT uri, cid, did, indexed_at, text, embed, labels, created_at
       FROM "app.bsky.feed.post"
       WHERE uri = $1
       LIMIT 1`,
      [this.uri],
    )) as PostSqlRow[];

    const row = postRows[0];
    if (row) {
      const [author, likeCountsMap, rawLabels] = await Promise.all([
        IndexedActor.readAuthor(reads.db, this.did),
        likeCounts(reads.db, [this.uri]),
        reads.labels([this.uri]),
      ]);

      const rawEntries = (rawLabels.get(this.uri) ?? []) as Array<{ val?: string; neg?: boolean }>;
      const extraLabels = rawEntries
        .filter((entry) => entry.val && !entry.neg)
        .map((entry) => entry.val as string);

      return new IndexedPost(row, author, {
        viewerLike,
        likeCount: likeCountsMap.get(this.uri) ?? 0,
        ...(extraLabels.length > 0 ? { extraLabels } : {}),
      });
    }

    const res = await live.appview.get<BskyGetPostsResponse>("app.bsky.feed.getPosts", {
      uris: [this.uri],
    });
    const first = res.posts[0];
    const post = first ? LivePost.of(first, viewerLike) : undefined;
    if (post) {
      live.backfill.note(post.authorDid);
    }
    return post;
  }
}
