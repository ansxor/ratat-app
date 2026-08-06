import type { MediaView } from "@ratat/common/media";
import { desc, sql } from "drizzle-orm";
import { bigint, customType, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/**
 * Drizzle's own `jsonb` stringifies before handing the value over, and bun-sql
 * then encodes that string as JSON in turn — the column ends up holding a JSON
 * *string* rather than the array, which reads back correctly but is opaque to
 * every jsonb operator. Passing the value through untouched stores it as the
 * array it is. Reads still parse a string, so rows written the old way keep
 * working.
 */
const mediaColumn = customType<{ data: MediaView[]; driverData: unknown }>({
  dataType: () => "jsonb",
  toDriver: (value) => value,
  fromDriver: (value) => (typeof value === "string" ? JSON.parse(value) : value) as MediaView[],
});

/**
 * Every DID Ratat has heard of. `interestedAt` is what puts a DID in the
 * interested set — the set the backfill worker and the jetstream tail both work
 * from. The profile columns are a snapshot for rendering bylines next to
 * indexed posts; the profile page itself still hydrates live from Bluesky.
 */
export const actor = pgTable(
  "actor",
  {
    did: text("did").primaryKey(),
    handle: text("handle").notNull(),
    displayName: text("display_name"),
    description: text("description"),
    avatar: text("avatar"),
    banner: text("banner"),
    /** Non-null once this DID entered the interested set. */
    interestedAt: stamp("interested_at"),
    /** Non-null once the backfill worker walked the whole author feed. */
    backfilledAt: stamp("backfilled_at"),
    /** When the worker last tried, so a failing DID backs off instead of spinning. */
    backfillAttemptedAt: stamp("backfill_attempted_at"),
    backfillError: text("backfill_error"),
    indexedAt: stamp("indexed_at").notNull().defaultNow(),
  },
  (table) => [
    index("actor_handle_idx").on(table.handle),
    index("actor_backfill_queue_idx").on(table.interestedAt, table.backfillAttemptedAt),
  ],
);

/**
 * One artwork: an `app.bsky.feed.post` carrying media, by an interested actor.
 * Reposts and text-only posts are never stored. `media` holds the same view
 * objects the lexicon returns, so a read is a row fetch and not a re-render of
 * blob refs.
 */
export const post = pgTable(
  "post",
  {
    uri: text("uri").primaryKey(),
    cid: text("cid").notNull(),
    did: text("did").notNull(),
    rkey: text("rkey").notNull(),
    text: text("text"),
    media: mediaColumn("media").notNull(),
    /** Mirrored counter: seeded at backfill, maintained by the like tail. */
    likeCount: integer("like_count").notNull().default(0),
    /** Snapshots taken when the post was indexed; not maintained live. */
    replyCount: integer("reply_count").notNull().default(0),
    repostCount: integer("repost_count").notNull().default(0),
    createdAt: stamp("created_at").notNull(),
    indexedAt: stamp("indexed_at").notNull().defaultNow(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // The author-feed read: newest first, tie-broken by uri so offset paging is
    // stable across two posts sharing a createdAt.
    index("post_author_feed_idx").on(table.did, desc(table.createdAt), desc(table.uri)),
  ],
);

/**
 * A like on a post we index. Stored only so a like *delete* — which arrives
 * from jetstream carrying no record, and so no subject — can still be
 * attributed to the post it was counted against. Never read for display.
 */
export const postLike = pgTable(
  "post_like",
  {
    uri: text("uri").primaryKey(),
    subjectUri: text("subject_uri").notNull(),
    indexedAt: stamp("indexed_at").notNull().defaultNow(),
  },
  (table) => [index("post_like_subject_idx").on(table.subjectUri)],
);

/** Resume point per jetstream subscription, in microseconds since the epoch. */
export const ingestionCursor = pgTable("ingestion_cursor", {
  source: text("source").primaryKey(),
  cursor: bigint("cursor", { mode: "number" }).notNull(),
  updatedAt: stamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

export type ActorRow = typeof actor.$inferSelect;
export type ActorInsert = typeof actor.$inferInsert;
export type PostRow = typeof post.$inferSelect;
export type PostInsert = typeof post.$inferInsert;
