/**
 * Every query the ingester makes against the local index.
 */

import { Database, type DbError } from "@ratat/db/effect";
import {
  actor,
  ingestionCursor,
  post,
  postLike,
  type ActorRow,
  type PostInsert,
} from "@ratat/db/schema";
import { and, asc, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { Effect } from "effect";

export type { ActorRow, PostInsert };

export const interestedDids = (): Effect.Effect<string[], DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("interestedDids", (db) =>
      db.select({ did: actor.did }).from(actor).where(isNotNull(actor.interestedAt)),
    );
    return rows.map((row) => row.did);
  });

/**
 * The oldest interested DID still waiting for a backfill. A DID whose last
 * attempt failed comes back only after `retryAfter`, so one dead account cannot
 * keep the worker busy.
 */
export const nextBackfillTarget = (
  retryAfter: Date,
): Effect.Effect<ActorRow | undefined, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("nextBackfillTarget", (db) =>
      db
        .select()
        .from(actor)
        .where(
          and(
            isNotNull(actor.interestedAt),
            isNull(actor.backfilledAt),
            or(isNull(actor.backfillAttemptedAt), lt(actor.backfillAttemptedAt, retryAfter)),
          ),
        )
        .orderBy(asc(actor.interestedAt))
        .limit(1),
    );
    return rows[0];
  });

/**
 * Stamps the attempt before the walk starts, so a crash mid-backfill leaves the
 * DID backed off rather than retried immediately on the next boot.
 */
export const claimBackfill = (did: string): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("claimBackfill", (db) =>
      db
        .update(actor)
        .set({ backfillAttemptedAt: new Date(), backfillError: null })
        .where(sql`${actor.did} = ${did}`),
    );
  });

export const finishBackfill = (did: string): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("finishBackfill", (db) =>
      db
        .update(actor)
        .set({ backfilledAt: new Date(), backfillError: null })
        .where(sql`${actor.did} = ${did}`),
    );
  });

export const failBackfill = (
  did: string,
  message: string,
): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("failBackfill", (db) =>
      db
        .update(actor)
        .set({ backfillError: message.slice(0, 500) })
        .where(sql`${actor.did} = ${did}`),
    );
  });

/**
 * Writes posts, refreshing the ones we already hold. The counts are only
 * overwritten when they carry information: the backfill seeds them from the
 * appview, whereas a post arriving from the firehose has no counts at all and
 * must not reset a counter the like tail has been maintaining.
 */
export const upsertPosts = (
  rows: PostInsert[],
  options: { readonly seedCounts: boolean },
): Effect.Effect<number, DbError, Database> =>
  Effect.gen(function* () {
    if (rows.length === 0) return 0;
    const database = yield* Database;
    const counts = options.seedCounts
      ? {
          likeCount: sql`excluded.like_count`,
          replyCount: sql`excluded.reply_count`,
          repostCount: sql`excluded.repost_count`,
        }
      : {};

    yield* database.run("upsertPosts", (db) =>
      db
        .insert(post)
        .values(rows)
        .onConflictDoUpdate({
          target: post.uri,
          set: {
            cid: sql`excluded.cid`,
            text: sql`excluded.text`,
            media: sql`excluded.media`,
            createdAt: sql`excluded.created_at`,
            updatedAt: new Date(),
            ...counts,
          },
        }),
    );
    return rows.length;
  });

export const deletePost = (uri: string): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("deletePost", (db) =>
      db.execute(sql`delete from ${post} where ${post.uri} = ${uri}`),
    );
  });

export interface ProfilePatch {
  readonly displayName?: string | undefined;
  readonly description?: string | undefined;
  readonly avatar?: string | undefined;
  readonly banner?: string | undefined;
}

/** Refreshes the byline snapshot from an `app.bsky.actor.profile` commit. */
export const updateActorProfile = (
  did: string,
  patch: ProfilePatch,
): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("updateActorProfile", (db) =>
      db
        .update(actor)
        .set({
          displayName: patch.displayName ?? null,
          description: patch.description ?? null,
          avatar: patch.avatar ?? null,
          banner: patch.banner ?? null,
          indexedAt: new Date(),
        })
        .where(sql`${actor.did} = ${did}`),
    );
  });

export const updateActorHandle = (
  did: string,
  handle: string,
): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("updateActorHandle", (db) =>
      db
        .update(actor)
        .set({ handle, indexedAt: new Date() })
        .where(sql`${actor.did} = ${did}`),
    );
  });

/**
 * Counts a like, but only against a post we actually index, and only once.
 * The like row exists solely so the matching delete — which arrives with no
 * record, and so no subject — can find the post to decrement.
 */
export const applyLike = (
  uri: string,
  subjectUri: string,
): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("applyLike", (db) =>
      db.execute(sql`
        with inserted as (
          insert into post_like (uri, subject_uri)
          select ${uri}, ${subjectUri}
          where exists (select 1 from post where uri = ${subjectUri})
          on conflict (uri) do nothing
          returning subject_uri
        )
        update post set like_count = like_count + 1, updated_at = now()
        where uri in (select subject_uri from inserted)
      `),
    );
  });

/** Every like the index has already counted, so a restart can still uncount. */
export const likedUris = (): Effect.Effect<string[], DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("likedUris", (db) =>
      db.select({ uri: postLike.uri }).from(postLike),
    );
    return rows.map((row) => row.uri);
  });

export const removeLike = (uri: string): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("removeLike", (db) =>
      db.execute(sql`
        with removed as (
          delete from post_like where uri = ${uri} returning subject_uri
        )
        update post set like_count = greatest(like_count - 1, 0), updated_at = now()
        where uri in (select subject_uri from removed)
      `),
    );
  });

export const readCursor = (source: string): Effect.Effect<number | undefined, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.run("readCursor", (db) =>
      db
        .select({ cursor: ingestionCursor.cursor })
        .from(ingestionCursor)
        .where(sql`${ingestionCursor.source} = ${source}`)
        .limit(1),
    );
    return rows[0]?.cursor;
  });

export const writeCursor = (
  source: string,
  cursor: number,
): Effect.Effect<void, DbError, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.run("writeCursor", (db) =>
      db
        .insert(ingestionCursor)
        .values({ source, cursor, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: ingestionCursor.source,
          set: { cursor, updatedAt: new Date() },
        }),
    );
  });
