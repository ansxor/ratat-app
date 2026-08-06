/**
 * Reads and writes against the local Postgres index.
 *
 * Everything here fails with `DbError` rather than an XRPC error: a read path
 * that cannot reach Postgres is expected to fall back to the live appview, not
 * to fail the request.
 */

import { Database, type DbError } from "@ratat/db/effect";
import { actor, post, type ActorRow, type PostRow } from "@ratat/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

export type { ActorRow, PostRow };

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

    return { rows, page: served, hasMore: served * limit < total };
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

export const indexedPost = (uri: string): Effect.Effect<PostRow | undefined, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("indexedPost", (db) =>
      db.select().from(post).where(eq(post.uri, uri)).limit(1),
    );
    return rows[0];
  });

export interface FeedCursor {
  readonly createdAt: Date;
  readonly uri: string;
}

/**
 * The keyset the next page starts after. Encoded rather than exposed so the
 * shape stays ours — the lexicon promises callers nothing but an opaque string.
 */
export const encodeFeedCursor = (row: PostRow): string =>
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
