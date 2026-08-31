/**
 * Reads and writes against the local Postgres index.
 *
 * Everything here fails with `DbError` rather than an XRPC error: a read path
 * that cannot reach Postgres is expected to fall back to the live appview, not
 * to fail the request.
 */

import { Database, type DbError, type Drizzle } from "@ratat/db/effect";
import {
  actor,
  post,
  postLike,
  ratatFollow,
  type ActorRow,
  type PostRow,
  type RatatFollowRow,
} from "@ratat/db/schema";
import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";
import { Effect } from "effect";

export type { ActorRow, PostRow, RatatFollowRow };

export interface ActorSnapshot {
  readonly did: string;
  readonly handle: string;
  readonly displayName?: string | undefined;
  readonly description?: string | undefined;
  readonly avatar?: string | undefined;
  readonly banner?: string | undefined;
}

export const actorByDid = (did: string): Effect.Effect<ActorRow | undefined, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("actorByDid", (db) =>
      db.select().from(actor).where(eq(actor.did, did)).limit(1),
    );
    return rows[0];
  });

/**
 * Handles move between accounts, so the index can briefly hold the same handle
 * on two DIDs — the old owner's row until something refreshes it, and the new
 * one. The most recently confirmed row is the better guess.
 */
export const actorByHandle = (
  handle: string,
): Effect.Effect<ActorRow | undefined, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("actorByHandle", (db) =>
      db
        .select()
        .from(actor)
        .where(eq(actor.handle, handle))
        .orderBy(desc(actor.indexedAt))
        .limit(1),
    );
    return rows[0];
  });

/**
 * Puts a DID in the interested set, or refreshes the profile snapshot of one
 * already in it. `interested_at` is only ever set once, so the backfill worker
 * can tell a first sighting from a revisit; optional profile fields fall back
 * to what is already stored, because a byline-shaped snapshot must not erase a
 * fuller one.
 */
export const markInterested = (snapshot: ActorSnapshot): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const now = new Date();
    yield* database.run("markInterested", (db) =>
      db
        .insert(actor)
        .values({
          did: snapshot.did,
          handle: snapshot.handle,
          displayName: snapshot.displayName ?? null,
          description: snapshot.description ?? null,
          avatar: snapshot.avatar ?? null,
          banner: snapshot.banner ?? null,
          interestedAt: now,
          indexedAt: now,
        })
        .onConflictDoUpdate({
          target: actor.did,
          set: {
            handle: sql`excluded.handle`,
            displayName: sql`coalesce(excluded.display_name, ${actor.displayName})`,
            description: sql`coalesce(excluded.description, ${actor.description})`,
            avatar: sql`coalesce(excluded.avatar, ${actor.avatar})`,
            banner: sql`coalesce(excluded.banner, ${actor.banner})`,
            interestedAt: sql`coalesce(${actor.interestedAt}, excluded.interested_at)`,
            indexedAt: now,
          },
        }),
    );
  });

export interface IndexedFeedPage {
  readonly rows: PostRow[];
  /** The page actually served, clamped to the last page that holds posts. */
  readonly page: number;
  readonly hasMore: boolean;
  /** Total artworks indexed for this actor; set only by page-numbered reads. */
  readonly total?: number;
}

/** Total artworks indexed for this actor, which is what bounds the pager. */
export const indexedPostCount = (did: string): Effect.Effect<number, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("indexedPostCount", (db) =>
      db.select({ total: count() }).from(post).where(eq(post.did, did)),
    );
    return rows[0]?.total ?? 0;
  });

/**
 * One page of an indexed portfolio by page number. The index is ordered, so a
 * page is an offset — no cursor walking, and a jump to page 40 costs the same
 * as page 2.
 */
export const indexedFeedPage = (
  did: string,
  limit: number,
  page: number,
): Effect.Effect<IndexedFeedPage, DbError, Database> =>
  Effect.gen(function* () {
    const total = yield* indexedPostCount(did);
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const served = Math.min(page, lastPage);

    const database = yield* Database;
    const rows = yield* database.run("indexedFeedPage", (db) =>
      db
        .select()
        .from(post)
        .where(eq(post.did, did))
        .orderBy(desc(post.createdAt), desc(post.uri))
        .limit(limit)
        .offset((served - 1) * limit),
    );

    return { rows, page: served, hasMore: served * limit < total, total };
  });

/** One page of an indexed portfolio continued from an opaque cursor. */
export const indexedFeedAfter = (
  did: string,
  limit: number,
  after: FeedCursor,
): Effect.Effect<IndexedFeedPage, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("indexedFeedAfter", (db) =>
      db
        .select()
        .from(post)
        .where(
          and(
            eq(post.did, did),
            sql`(${post.createdAt}, ${post.uri}) < (${after.createdAt}, ${after.uri})`,
          ),
        )
        .orderBy(desc(post.createdAt), desc(post.uri))
        .limit(limit + 1),
    );

    const hasMore = rows.length > limit;
    return { rows: hasMore ? rows.slice(0, limit) : rows, page: 0, hasMore };
  });

/**
 * A random sample of an actor's indexed artworks. `order by random()` walks
 * every row the actor has, which is fine at portfolio scale — thousands of
 * posts, not millions.
 */
export const indexedFeedSample = (
  did: string,
  limit: number,
): Effect.Effect<PostRow[], DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    return yield* database.run("indexedFeedSample", (db) =>
      db
        .select()
        .from(post)
        .where(eq(post.did, did))
        .orderBy(sql`random()`)
        .limit(limit),
    );
  });

export const indexedPost = (uri: string): Effect.Effect<PostRow | undefined, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("indexedPost", (db) =>
      db.select().from(post).where(eq(post.uri, uri)).limit(1),
    );
    return rows[0];
  });

// ----------------------------------------------------------------- the graph

/**
 * Stamps an actor as one whose own Ratat follows somebody wants to read, which
 * is what queues the ingester's one-off walk of their repo. Only ever set once:
 * after the walk, jetstream keeps the graph current.
 */
export const wantFollowsBackfill = (did: string): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("wantFollowsBackfill", (db) =>
      db
        .update(actor)
        .set({ followsWantedAt: new Date() })
        .where(and(eq(actor.did, did), sql`${actor.followsWantedAt} is null`)),
    );
  });

export interface FollowsPage {
  readonly rows: GraphRow[];
  readonly hasMore: boolean;
}

/** A follow row with the followed account's index snapshot, for rendering a row. */
export interface GraphRow {
  readonly follow: RatatFollowRow;
  readonly actor: ActorRow | null;
}

/**
 * One page's worth of follows, joined to the account the row is *about* — the
 * followed account in a following list, the follower in a followers list.
 */
const followSelect = (db: Drizzle, joinOn: "followed" | "follower") =>
  db
    .select({ follow: ratatFollow, actor })
    .from(ratatFollow)
    .leftJoin(actor, eq(actor.did, joinOn === "follower" ? ratatFollow.did : ratatFollow.subject));

/**
 * The newest follow record per account — one row per followed account for a
 * follow list, one per follower for a follower list. Duplicate records exist:
 * the import writes one per Bluesky follow, the follow button one per click,
 * and the pre-rename `art.ratat.*` records still sit beside their `net.ratat.*`
 * successors — so counting records would count the same person twice.
 */
const latestFollows = (db: Drizzle, by: "did" | "subject", value: string) => {
  const distinctOn = by === "did" ? ratatFollow.subject : ratatFollow.did;
  return db
    .selectDistinctOn([distinctOn], { uri: ratatFollow.uri })
    .from(ratatFollow)
    .where(by === "did" ? eq(ratatFollow.did, value) : eq(ratatFollow.subject, value))
    .orderBy(distinctOn, desc(ratatFollow.createdAt), desc(ratatFollow.uri))
    .as("latest_follows");
};

/** One page of an actor's Ratat follows, newest first. */
export const followsPage = (
  did: string,
  limit: number,
  after: FeedCursor | undefined,
): Effect.Effect<FollowsPage, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("followsPage", (db) => {
      const latest = latestFollows(db, "did", did);
      return followSelect(db, "followed")
        .innerJoin(latest, eq(ratatFollow.uri, latest.uri))
        .where(
          and(
            eq(ratatFollow.did, did),
            after === undefined
              ? undefined
              : or(
                  lt(ratatFollow.createdAt, after.createdAt),
                  and(eq(ratatFollow.createdAt, after.createdAt), lt(ratatFollow.uri, after.uri)),
                ),
          ),
        )
        .orderBy(desc(ratatFollow.createdAt), desc(ratatFollow.uri))
        .limit(limit + 1);
    });

    const hasMore = rows.length > limit;
    return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
  });

/** One page of an actor's Ratat followers, newest first. */
export const followersPage = (
  did: string,
  limit: number,
  after: FeedCursor | undefined,
): Effect.Effect<FollowsPage, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("followersPage", (db) => {
      const latest = latestFollows(db, "subject", did);
      return followSelect(db, "follower")
        .innerJoin(latest, eq(ratatFollow.uri, latest.uri))
        .where(
          and(
            eq(ratatFollow.subject, did),
            after === undefined
              ? undefined
              : or(
                  lt(ratatFollow.createdAt, after.createdAt),
                  and(eq(ratatFollow.createdAt, after.createdAt), lt(ratatFollow.uri, after.uri)),
                ),
          ),
        )
        .orderBy(desc(ratatFollow.createdAt), desc(ratatFollow.uri))
        .limit(limit + 1);
    });

    const hasMore = rows.length > limit;
    return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
  });

export interface FollowsPageByNumber {
  readonly rows: GraphRow[];
  /** The page actually served, clamped to the last page that holds follows. */
  readonly page: number;
  readonly total: number;
}

/** How many accounts are in the list, which is what bounds the numbered pager. */
const latestFollowsTotal = (
  by: "did" | "subject",
  value: string,
): Effect.Effect<number, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("latestFollowsTotal", (db) =>
      db.select({ total: count() }).from(latestFollows(db, by, value)),
    );
    return rows[0]?.total ?? 0;
  });

/**
 * One page of an actor's Ratat follows by page number, for the numbered pager
 * the web's follow list is ported from. The index is ordered, so a page is an
 * offset — no cursor walking, and a deep page costs what a shallow one does.
 */
export const followsPageByNumber = (
  did: string,
  limit: number,
  page: number,
): Effect.Effect<FollowsPageByNumber, DbError, Database> =>
  Effect.gen(function* () {
    const total = yield* latestFollowsTotal("did", did);
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const served = Math.min(page, lastPage);

    const database = yield* Database;
    const rows = yield* database.run("followsPageByNumber", (db) => {
      const latest = latestFollows(db, "did", did);
      return followSelect(db, "followed")
        .innerJoin(latest, eq(ratatFollow.uri, latest.uri))
        .where(eq(ratatFollow.did, did))
        .orderBy(desc(ratatFollow.createdAt), desc(ratatFollow.uri))
        .limit(limit)
        .offset((served - 1) * limit);
    });

    return { rows, page: served, total };
  });

/** One page of an actor's Ratat followers by page number. */
export const followersPageByNumber = (
  did: string,
  limit: number,
  page: number,
): Effect.Effect<FollowsPageByNumber, DbError, Database> =>
  Effect.gen(function* () {
    const total = yield* latestFollowsTotal("subject", did);
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const served = Math.min(page, lastPage);

    const database = yield* Database;
    const rows = yield* database.run("followersPageByNumber", (db) => {
      const latest = latestFollows(db, "subject", did);
      return followSelect(db, "follower")
        .innerJoin(latest, eq(ratatFollow.uri, latest.uri))
        .where(eq(ratatFollow.subject, did))
        .orderBy(desc(ratatFollow.createdAt), desc(ratatFollow.uri))
        .limit(limit)
        .offset((served - 1) * limit);
    });

    return { rows, page: served, total };
  });

/** The profile header's graph counts: follows held and follows received. */
export const graphCounts = (
  did: string,
): Effect.Effect<{ followers: number; follows: number }, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const [followersRows, followsRows] = yield* Effect.all([
      database.run("followersCount", (db) =>
        db.select({ total: count() }).from(latestFollows(db, "subject", did)),
      ),
      database.run("followsCount", (db) =>
        db.select({ total: count() }).from(latestFollows(db, "did", did)),
      ),
    ]);
    return {
      followers: followersRows[0]?.total ?? 0,
      follows: followsRows[0]?.total ?? 0,
    };
  });

export const viewerLikeForPost = (
  viewer: string,
  subjectUri: string,
): Effect.Effect<string | undefined, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("viewerLikeForPost", (db) =>
      db
        .select({ uri: postLike.uri })
        .from(postLike)
        .where(and(eq(postLike.did, viewer), eq(postLike.subjectUri, subjectUri)))
        .limit(1),
    );
    return rows[0]?.uri;
  });

// --------------------------------------------------------------- the timeline

export interface TimelineItem {
  readonly post: PostRow;
  readonly author: ActorRow;
  /** The viewer's indexed like record for this artwork, when one exists. */
  readonly viewerLike?: string | undefined;
}

export interface TimelinePage {
  readonly items: TimelineItem[];
  /** The page actually served, clamped to the last page that holds artworks. */
  readonly page: number;
  readonly total: number;
}

/** Restricts posts to their authors being Ratat-followed by the viewer. */
const byFollowedAuthor = (viewer: string) =>
  sql`${post.did} in (select ${ratatFollow.subject} from ${ratatFollow} where ${ratatFollow.did} = ${viewer})`;

/**
 * One page of the home gallery: every indexed artwork by somebody the viewer
 * follows, newest first. Pages are offsets over an ordered index, so a deep
 * page costs what a shallow one does.
 */
export const timelinePage = (
  viewer: string,
  limit: number,
  page: number,
): Effect.Effect<TimelinePage, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const totals = yield* database.run("timelineCount", (db) =>
      db.select({ total: count() }).from(post).where(byFollowedAuthor(viewer)),
    );
    const total = totals[0]?.total ?? 0;

    const lastPage = Math.max(1, Math.ceil(total / limit));
    const served = Math.min(page, lastPage);

    const rows = yield* database.run("timelinePage", (db) =>
      db
        .select({ post, author: actor, viewerLike: postLike.uri })
        .from(post)
        .innerJoin(actor, eq(actor.did, post.did))
        .leftJoin(postLike, and(eq(postLike.subjectUri, post.uri), eq(postLike.did, viewer)))
        .where(byFollowedAuthor(viewer))
        .orderBy(desc(post.createdAt), desc(post.uri))
        .limit(limit)
        .offset((served - 1) * limit),
    );

    const items = rows.map(({ post: indexed, author, viewerLike }) => ({
      post: indexed,
      author,
      ...(viewerLike ? { viewerLike } : {}),
    }));
    return { items, page: served, total };
  });

export interface FeedCursor {
  readonly createdAt: Date;
  readonly uri: string;
}

/**
 * The keyset the next page starts after. Encoded rather than exposed so the
 * shape stays ours — the lexicon promises callers nothing but an opaque string.
 */
export const encodeFeedCursor = (row: FeedCursor): string =>
  Buffer.from(`${row.createdAt.getTime()}|${row.uri}`, "utf8").toString("base64url");

/**
 * Undefined for anything we did not mint — which is how a cursor handed out by
 * the live path, before this actor was backfilled, is recognised and refused.
 */
export const decodeFeedCursor = (cursor: string): FeedCursor | undefined => {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const separator = decoded.indexOf("|");
  if (separator <= 0) return undefined;
  const ms = Number(decoded.slice(0, separator));
  const uri = decoded.slice(separator + 1);
  if (!Number.isFinite(ms) || !uri.startsWith("at://")) return undefined;
  return { createdAt: new Date(ms), uri };
};
