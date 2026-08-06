/**
 * Lazy per-DID backfill.
 *
 * A DID enters the interested set when somebody looks at it. This worker turns
 * that interest into rows: it walks the actor's Bluesky feed once, filtered to
 * posts carrying media, and stamps `backfilled_at` when it reaches the end.
 * From then on the actor's page is served from Postgres and the jetstream tail
 * keeps it current.
 */

import { Client, simpleFetchHandler } from "@atcute/client";
import type {} from "@atcute/bluesky";
import type * as AppBskyFeedDefs from "@atcute/bluesky/types/app/feed/defs";
import type * as AppBskyFeedPost from "@atcute/bluesky/types/app/feed/post";
import type { ActorIdentifier } from "@atcute/lexicons/syntax";
import { parseAtUri } from "@ratat/common";
import { mediaFromEmbedView } from "@ratat/common/media";
import type { Database } from "@ratat/db/effect";
import { Duration, Effect } from "effect";

import { IngesterSettings } from "./config.ts";
import {
  claimBackfill,
  failBackfill,
  finishBackfill,
  nextBackfillTarget,
  upsertPosts,
  type PostInsert,
} from "./store.ts";

class BackfillError extends Error {
  override readonly name = "BackfillError";
}

const postRecord = (record: unknown): AppBskyFeedPost.Main | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const candidate = record as { $type?: unknown };
  return candidate.$type === "app.bsky.feed.post" ? (record as AppBskyFeedPost.Main) : undefined;
};

const validDate = (value: string | undefined, fallback: string): Date => {
  const parsed = new Date(value ?? fallback);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
};

/**
 * An artwork row, or undefined for everything that is not one: a repost, or a
 * post whose embed carries no media.
 */
const rowOf = (item: AppBskyFeedDefs.FeedViewPost): PostInsert | undefined => {
  if (item.reason?.$type === "app.bsky.feed.defs#reasonRepost") return undefined;

  const view = item.post;
  const media = mediaFromEmbedView(view.embed);
  if (media.length === 0) return undefined;

  const parsed = parseAtUri(view.uri);
  if (!parsed) return undefined;

  const record = postRecord(view.record);
  return {
    uri: view.uri,
    cid: view.cid,
    did: view.author.did,
    rkey: parsed.rkey,
    ...(record?.text ? { text: record.text } : {}),
    media,
    likeCount: view.likeCount ?? 0,
    replyCount: view.replyCount ?? 0,
    repostCount: view.repostCount ?? 0,
    createdAt: validDate(record?.createdAt, view.indexedAt),
  };
};

/** Walks one actor's whole media feed, page by page, into the index. */
const walk = (did: string): Effect.Effect<number, BackfillError, IngesterSettings | Database> =>
  Effect.gen(function* () {
    const settings = yield* IngesterSettings;
    const client = new Client({ handler: simpleFetchHandler({ service: settings.appviewUrl }) });

    let cursor: string | undefined;
    let pages = 0;
    let stored = 0;

    for (;;) {
      const res = yield* Effect.tryPromise({
        try: () =>
          client.get("app.bsky.feed.getAuthorFeed", {
            params: {
              actor: did as ActorIdentifier,
              limit: settings.backfillPageSize,
              filter: "posts_with_media",
              includePins: false,
              ...(cursor ? { cursor } : {}),
            },
          }),
        catch: (cause) => new BackfillError(`appview unreachable: ${String(cause)}`),
      });
      if (!res.ok) {
        return yield* Effect.fail(
          new BackfillError(res.data.message ?? res.data.error ?? "appview refused the feed"),
        );
      }

      const rows = res.data.feed.map(rowOf).filter((row): row is PostInsert => row !== undefined);
      stored += yield* upsertPosts(rows, { seedCounts: true }).pipe(
        Effect.mapError((error) => new BackfillError(`index write failed: ${String(error.cause)}`)),
      );

      pages++;
      cursor = res.data.cursor;
      if (cursor === undefined) break;

      if (settings.backfillMaxPages > 0 && pages >= settings.backfillMaxPages) {
        yield* Effect.logWarning(
          `backfill ${did} stopped at the ${settings.backfillMaxPages}-page cap with the feed ` +
            `still going; the rest of this portfolio is not indexed`,
        );
        break;
      }

      // The public appview is a shared resource and this is a bulk read.
      yield* Effect.sleep(Duration.millis(settings.backfillPageDelayMillis));
    }

    yield* Effect.logInfo(`backfill ${did}: ${stored} artworks across ${pages} page(s)`);
    return stored;
  });

const backfillOne = (did: string): Effect.Effect<void, never, IngesterSettings | Database> =>
  Effect.gen(function* () {
    yield* claimBackfill(did).pipe(Effect.ignore);
    yield* walk(did).pipe(
      Effect.flatMap(() => finishBackfill(did).pipe(Effect.ignore)),
      Effect.catchAll((error) =>
        Effect.logWarning(`backfill ${did} failed: ${error.message}`).pipe(
          Effect.zipRight(failBackfill(did, error.message).pipe(Effect.ignore)),
        ),
      ),
    );
  });

/**
 * One DID at a time, forever. Serial on purpose: parallel walks would multiply
 * our load on the public appview for no gain a visitor can perceive.
 */
export const runBackfillWorker: Effect.Effect<never, never, IngesterSettings | Database> =
  Effect.gen(function* () {
    const settings = yield* IngesterSettings;
    yield* Effect.logInfo("backfill worker ready");

    const tick = Effect.gen(function* () {
      const retryAfter = new Date(Date.now() - settings.backfillRetryMinutes * 60_000);
      const target = yield* nextBackfillTarget(retryAfter).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`backfill queue unreadable: ${String(error.cause)}`).pipe(
            Effect.as(undefined),
          ),
        ),
      );
      if (target === undefined) return false;
      yield* backfillOne(target.did);
      return true;
    });

    // Idle only when the queue came back empty, so a burst of new interest is
    // worked through without waiting out a poll interval per DID.
    return yield* Effect.forever(
      tick.pipe(
        Effect.flatMap((worked) =>
          worked ? Effect.void : Effect.sleep(Duration.seconds(settings.backfillPollSeconds)),
        ),
      ),
    );
  });
