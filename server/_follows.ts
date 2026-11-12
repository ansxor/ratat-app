import { AuthenticationRequiredError, InvalidCursorError } from "./_errors.ts";
import { type Blobs, toIsoString } from "./_atproto.ts";
import { type Db, tableExists } from "./_index.ts";
import type { Appview, BskyGetProfilesResponse, BskyProfileViewBasic, Live } from "./_live.ts";
import {
  Bounds,
  FeedCursor,
  type GraphWindow,
  Page,
  type Viewable,
  clampLimit,
} from "./_paging.ts";
import {
  ActorRef,
  type ActorRecord,
  IndexedActor,
  LiveActor,
  type ProfileViewBasic,
} from "./_actors.ts";

export interface FollowView {
  uri: string;
  subject: string;
  createdAt: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

export interface FollowRow {
  readonly uri: string;
  readonly did: string;
  readonly subject: string;
  readonly created_at: string | Date | null;
  readonly handle: string | null;
  readonly display_name: string | null;
  readonly avatar: string | null;
}

export class IndexedFollow implements Viewable<FollowView> {
  private readonly row: FollowRow;
  private readonly targetDid: string;

  constructor(row: FollowRow, targetDid: string) {
    this.row = row;
    this.targetDid = targetDid;
  }

  view(blobs: Blobs): FollowView {
    const subject = this.targetDid;
    const createdAt = toIsoString(this.row.created_at) ?? new Date().toISOString();
    const handle =
      this.row.handle && !this.row.handle.startsWith("did:") ? this.row.handle : undefined;
    const displayName =
      this.row.display_name && this.row.display_name.length > 0 ? this.row.display_name : undefined;
    const avatar = blobs.stored(subject, this.row.avatar, "avatar");

    return {
      uri: this.row.uri,
      subject,
      createdAt,
      ...(handle ? { handle } : {}),
      ...(displayName ? { displayName } : {}),
      ...(avatar ? { avatar } : {}),
    };
  }
}

export class FollowGraph {
  readonly actorDid: string;
  readonly direction: "follows" | "followers";

  private constructor(actorDid: string, direction: "follows" | "followers") {
    this.actorDid = actorDid;
    this.direction = direction;
  }

  static follows(actorDid: string): FollowGraph {
    return new FollowGraph(actorDid, "follows");
  }

  static followers(actorDid: string): FollowGraph {
    return new FollowGraph(actorDid, "followers");
  }

  async page(window: GraphWindow, db: Db): Promise<Page<FollowView>> {
    const filterCol = this.direction === "follows" ? "did" : "subject";
    const targetCol = this.direction === "follows" ? "subject" : "did";
    const pickTarget = (row: FollowRow): string =>
      this.direction === "follows" ? row.subject : row.did;

    if (window.kind === "page") {
      const countRows = (await db.query(
        `SELECT CAST(COUNT(DISTINCT ${targetCol}) AS INTEGER) AS total
         FROM "net.ratat.graph.follow"
         WHERE ${filterCol} = $1`,
        [this.actorDid],
      )) as Array<{ total: number }>;
      const total = Number(countRows[0]?.total ?? 0);
      const bounds = Bounds.of(total, window.limit, window.page);

      const rows = (await db.query(
        `WITH latest AS (
           SELECT uri, did, subject, created_at,
                  ROW_NUMBER() OVER (PARTITION BY ${targetCol} ORDER BY created_at DESC, uri DESC) AS rn
           FROM "net.ratat.graph.follow"
           WHERE ${filterCol} = $1
         )
         SELECT l.uri, l.did, l.subject, l.created_at,
                r.handle,
                (SELECT ap.display_name FROM "app.bsky.actor.profile" ap WHERE ap.did = l.${targetCol} ORDER BY ap.indexed_at DESC LIMIT 1) AS display_name,
                (SELECT ap.avatar FROM "app.bsky.actor.profile" ap WHERE ap.did = l.${targetCol} ORDER BY ap.indexed_at DESC LIMIT 1) AS avatar
         FROM latest l
         LEFT JOIN _repos r ON r.did = l.${targetCol}
         WHERE l.rn = 1
         ORDER BY l.created_at DESC, l.uri DESC
         LIMIT $2 OFFSET $3`,
        [this.actorDid, bounds.limit, bounds.offset],
      )) as FollowRow[];

      const items = rows.map((row) => new IndexedFollow(row, pickTarget(row)));
      return new Page(items, { page: bounds.page, total: bounds.total });
    }

    let afterIso: string | undefined;
    let afterUri: string | undefined;
    if (window.cursor !== undefined) {
      if (!window.after) {
        throw new InvalidCursorError();
      }
      afterIso = window.after.createdAt.toISOString();
      afterUri = window.after.uri;
    }

    const rows = (await db.query(
      afterIso !== undefined && afterUri !== undefined
        ? `WITH latest AS (
             SELECT uri, did, subject, created_at,
                    ROW_NUMBER() OVER (PARTITION BY ${targetCol} ORDER BY created_at DESC, uri DESC) AS rn
             FROM "net.ratat.graph.follow"
             WHERE ${filterCol} = $1
           )
           SELECT l.uri, l.did, l.subject, l.created_at,
                  r.handle,
                  (SELECT ap.display_name FROM "app.bsky.actor.profile" ap WHERE ap.did = l.${targetCol} ORDER BY ap.indexed_at DESC LIMIT 1) AS display_name,
                  (SELECT ap.avatar FROM "app.bsky.actor.profile" ap WHERE ap.did = l.${targetCol} ORDER BY ap.indexed_at DESC LIMIT 1) AS avatar
           FROM latest l
           LEFT JOIN _repos r ON r.did = l.${targetCol}
           WHERE l.rn = 1
             AND (l.created_at < $2 OR (l.created_at = $2 AND l.uri < $3))
           ORDER BY l.created_at DESC, l.uri DESC
           LIMIT $4`
        : `WITH latest AS (
             SELECT uri, did, subject, created_at,
                    ROW_NUMBER() OVER (PARTITION BY ${targetCol} ORDER BY created_at DESC, uri DESC) AS rn
             FROM "net.ratat.graph.follow"
             WHERE ${filterCol} = $1
           )
           SELECT l.uri, l.did, l.subject, l.created_at,
                  r.handle,
                  (SELECT ap.display_name FROM "app.bsky.actor.profile" ap WHERE ap.did = l.${targetCol} ORDER BY ap.indexed_at DESC LIMIT 1) AS display_name,
                  (SELECT ap.avatar FROM "app.bsky.actor.profile" ap WHERE ap.did = l.${targetCol} ORDER BY ap.indexed_at DESC LIMIT 1) AS avatar
           FROM latest l
           LEFT JOIN _repos r ON r.did = l.${targetCol}
           WHERE l.rn = 1
           ORDER BY l.created_at DESC, l.uri DESC
           LIMIT $2`,
      afterIso !== undefined && afterUri !== undefined
        ? [this.actorDid, afterIso, afterUri, window.limit + 1]
        : [this.actorDid, window.limit + 1],
    )) as FollowRow[];

    const hasMore = rows.length > window.limit;
    const slice = hasMore ? rows.slice(0, window.limit) : rows;
    const items = slice.map((row) => new IndexedFollow(row, pickTarget(row)));
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last && last.created_at ? FeedCursor.encode(last.created_at, last.uri) : undefined;

    return new Page(items, nextCursor ? { cursor: nextCursor } : {});
  }
}

async function resolvePdsEndpoint(db: Db, did: string): Promise<string | undefined> {
  if (await tableExists(db, "_oauth_sessions")) {
    const rows = (await db.query(
      `SELECT pds_endpoint FROM _oauth_sessions WHERE did = $1 LIMIT 1`,
      [did],
    )) as Array<{ pds_endpoint: string | null }>;
    if (rows[0]?.pds_endpoint) return rows[0].pds_endpoint.replace(/\/$/, "");
  }

  try {
    let didDoc: { service?: Array<{ id?: string; serviceEndpoint?: string }> } | undefined;
    if (did.startsWith("did:web:")) {
      const domain = did.slice("did:web:".length);
      const res = await fetch(`https://${domain}/.well-known/did.json`);
      if (res.ok) didDoc = (await res.json()) as typeof didDoc;
    } else {
      const plcBase = (
        process.env.DID_PLC_URL ||
        (process.env.NODE_ENV === "production" ? "https://plc.directory" : "http://localhost:2582")
      ).replace(/\/$/, "");
      const res = await fetch(`${plcBase}/${encodeURIComponent(did)}`);
      if (res.ok) didDoc = (await res.json()) as typeof didDoc;
    }
    const endpoint = didDoc?.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint;
    if (endpoint) return endpoint.replace(/\/$/, "");
  } catch {}

  return undefined;
}

async function fetchPdsFollowSubjects(
  pdsEndpoint: string,
  did: string,
  limit: number,
  cursor: string | undefined,
): Promise<{ subjects: string[]; cursor?: string }> {
  const url = new URL(`${pdsEndpoint}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", "app.bsky.graph.follow");
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`com.atproto.repo.listRecords failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    records?: Array<{ value?: { subject?: string } }>;
    cursor?: string;
  };

  const subjects: string[] = [];
  for (const rec of data.records ?? []) {
    const subject = rec.value?.subject;
    if (typeof subject === "string" && subject.length > 0) {
      subjects.push(subject);
    }
  }
  return { subjects, ...(data.cursor ? { cursor: data.cursor } : {}) };
}

async function hydrateBskyFollows(
  db: Db,
  appview: Appview,
  dids: readonly string[],
): Promise<Map<string, ActorRecord>> {
  const result = new Map<string, ActorRecord>();
  if (dids.length === 0) return result;

  const unique = [...new Set(dids)];
  const indexed = await IndexedActor.readMany(db, unique);
  for (const [did, actor] of indexed) {
    result.set(did, actor);
  }

  const missing = unique.filter((d) => !result.has(d));
  for (let i = 0; i < missing.length; i += 25) {
    const batch = missing.slice(i, i + 25);
    try {
      const data = await appview.get<BskyGetProfilesResponse>("app.bsky.actor.getProfiles", {
        actors: batch,
      });
      for (const profile of data.profiles ?? []) {
        if (!profile.did) continue;
        result.set(profile.did, new LiveActor(profile));
      }
    } catch {}
  }

  for (const d of unique) {
    if (!result.has(d)) {
      result.set(d, IndexedActor.placeholder(d));
    }
  }

  return result;
}

export class BskyFollows {
  readonly targetDid: string;
  readonly limit: number;
  readonly cursor?: string;
  readonly pdsEndpoint?: string;

  constructor(
    targetDid: string,
    limit: number,
    cursor: string | undefined,
    pdsEndpoint: string | undefined,
  ) {
    this.targetDid = targetDid;
    this.limit = limit;
    this.cursor = cursor;
    this.pdsEndpoint = pdsEndpoint;
  }

  async page(db: Db, live: Live): Promise<Page<ProfileViewBasic, { cursor?: string }>> {
    if (this.pdsEndpoint) {
      try {
        const { subjects, cursor: nextCursor } = await fetchPdsFollowSubjects(
          this.pdsEndpoint,
          this.targetDid,
          this.limit,
          this.cursor,
        );
        const profiles = await hydrateBskyFollows(db, live.appview, subjects);
        const actors = subjects.map((did) => profiles.get(did) ?? IndexedActor.placeholder(did));
        return new Page(actors, nextCursor ? { cursor: nextCursor } : {});
      } catch {}
    }

    const res = await live.appview.get<{
      follows?: BskyProfileViewBasic[];
      cursor?: string;
    }>("app.bsky.graph.getFollows", {
      actor: this.targetDid,
      limit: this.limit,
      ...(this.cursor ? { cursor: this.cursor } : {}),
    });

    const actors = (res.follows ?? []).map((actor) => new LiveActor(actor));
    return new Page(actors, res.cursor ? { cursor: res.cursor } : {});
  }
}

export class BskyFollowsRequest {
  readonly target: ActorRef;
  readonly limit: number;
  readonly cursor?: string;

  private constructor(target: ActorRef, limit: number, cursor: string | undefined) {
    this.target = target;
    this.limit = limit;
    this.cursor = cursor;
  }

  static parse(
    params: { actor?: string; limit?: unknown; cursor?: string },
    viewer: { did: string } | null,
  ): BskyFollowsRequest {
    const actorParam = typeof params.actor === "string" ? params.actor.trim() : undefined;
    const target = actorParam || viewer?.did;
    if (!target) {
      throw new AuthenticationRequiredError();
    }
    return new BskyFollowsRequest(
      ActorRef.parse(target),
      clampLimit(params.limit, 100, 100),
      params.cursor,
    );
  }

  async source(db: Db, appview: Appview): Promise<BskyFollows> {
    const targetDid = await this.target.resolve(db, appview);
    const pdsEndpoint = await resolvePdsEndpoint(db, targetDid);
    return new BskyFollows(targetDid, this.limit, this.cursor, pdsEndpoint);
  }
}
