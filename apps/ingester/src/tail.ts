/**
 * The live tail.
 *
 * Two jetstream subscriptions, for two different reasons:
 *
 * - **posts** is scoped by DID. Posts and profile edits live in the author's
 *   own repo, so jetstream can filter to the interested set for us and we
 *   receive almost nothing we do not want.
 * - **likes** cannot be scoped that way. A like lives in the *liker's* repo,
 *   and we do not know who likes an artwork before they do — so this one is the
 *   whole like firehose, filtered here down to subjects we index. It is the
 *   expensive half of the ingester and can be switched off with
 *   `JETSTREAM_LIKE_TAIL=false`.
 */

import { JetstreamSubscription, type JetstreamEvent } from "@atcute/jetstream";
import { type Did, isDid } from "@atcute/lexicons/syntax";
import { bskyImageUrl, parseAtUri } from "@ratat/common";
import { blobCid } from "@ratat/common";
import { mediaFromPostRecord } from "@ratat/common/media";
import type { Database } from "@ratat/db/effect";
import { Duration, Effect, Ref, Schedule, Stream } from "effect";

import { IngesterSettings } from "./config.ts";
import {
  applyLike,
  deletePost,
  interestedDids,
  likedUris,
  readCursor,
  removeLike,
  updateActorHandle,
  updateActorProfile,
  upsertPosts,
  writeCursor,
} from "./store.ts";

type TailServices = IngesterSettings | Database;

const POST_COLLECTION = "app.bsky.feed.post";
const PROFILE_COLLECTION = "app.bsky.actor.profile";
const LIKE_COLLECTION = "app.bsky.feed.like";

/** Jetstream refuses to scope a subscription to more DIDs than this. */
const WANTED_DIDS_LIMIT = 10_000;

class TailError extends Error {
  override readonly name = "TailError";
}

const reconnect = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.union(Schedule.spaced("30 seconds")),
);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const uriOf = (did: string, collection: string, rkey: string): string =>
  `at://${did}/${collection}/${rkey}`;

// ------------------------------------------------------------- interested set

interface Interested {
  readonly dids: Ref.Ref<ReadonlySet<string>>;
  readonly refresh: Effect.Effect<ReadonlySet<string>, never, Database>;
}

const makeInterested = Effect.gen(function* () {
  const dids = yield* Ref.make<ReadonlySet<string>>(new Set());
  const refresh = interestedDids().pipe(
    Effect.map((list) => new Set(list) as ReadonlySet<string>),
    Effect.catchAll((error) =>
      Effect.logWarning(
        `interested set unreadable, keeping the last one: ${String(error.cause)}`,
      ).pipe(Effect.zipRight(Ref.get(dids))),
    ),
    Effect.tap((set) => Ref.set(dids, set)),
  );
  yield* refresh;
  return { dids, refresh } satisfies Interested;
});

const wantedDidsOf = (set: ReadonlySet<string>): Effect.Effect<Did[]> =>
  Effect.gen(function* () {
    const dids = [...set].filter((did): did is Did => isDid(did));
    if (dids.length > WANTED_DIDS_LIMIT) {
      yield* Effect.logError(
        `the interested set holds ${dids.length} DIDs, past jetstream's ${WANTED_DIDS_LIMIT} ` +
          `cap — events from the overflow are being dropped`,
      );
    }
    return dids;
  });

// ------------------------------------------------------------------ post tail

const indexPostCommit = (
  did: string,
  rkey: string,
  cid: string,
  record: unknown,
): Effect.Effect<void, never, Database> =>
  Effect.gen(function* () {
    const uri = uriOf(did, POST_COLLECTION, rkey);
    const media = mediaFromPostRecord(did, record);
    // A post that carries no media is not an artwork and never enters the
    // index; if an edit stripped the media, the row it had has to go.
    if (media.length === 0) return yield* deletePost(uri).pipe(Effect.ignore);

    const post = asRecord(record);
    const createdAt = new Date(asText(post?.["createdAt"]) ?? Date.now());

    yield* upsertPosts(
      [
        {
          uri,
          cid,
          did,
          rkey,
          ...(asText(post?.["text"]) ? { text: asText(post?.["text"]) } : {}),
          media,
          createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        },
      ],
      // A firehose post has no counts of its own; the like tail owns that column.
      { seedCounts: false },
    ).pipe(
      Effect.tap(() => Effect.logInfo(`indexed ${uri}`)),
      Effect.catchAll((error) =>
        Effect.logWarning(`could not index ${uri}: ${String(error.cause)}`),
      ),
    );
  });

const indexProfileCommit = (did: string, record: unknown): Effect.Effect<void, never, Database> => {
  const profile = asRecord(record);
  const avatarCid = blobCid(profile?.["avatar"]);
  const bannerCid = blobCid(profile?.["banner"]);
  return updateActorProfile(did, {
    displayName: asText(profile?.["displayName"]),
    description: asText(profile?.["description"]),
    avatar: avatarCid ? bskyImageUrl(did, avatarCid, "avatar") : undefined,
    banner: bannerCid ? bskyImageUrl(did, bannerCid, "banner") : undefined,
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logWarning(`could not refresh the profile of ${did}: ${String(error.cause)}`),
    ),
  );
};

const handlePostEvent = (
  event: JetstreamEvent,
  interested: ReadonlySet<string>,
): Effect.Effect<void, never, Database> => {
  if (event.kind === "identity") {
    if (!interested.has(event.did)) return Effect.void;
    return updateActorHandle(event.did, event.identity.handle).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`could not update the handle of ${event.did}: ${String(error.cause)}`),
      ),
    );
  }
  if (event.kind !== "commit") return Effect.void;
  // Jetstream scopes by DID for us, but the set can lag a re-scope.
  if (!interested.has(event.did)) return Effect.void;

  const commit = event.commit;
  if (commit.collection === PROFILE_COLLECTION) {
    return commit.operation === "delete"
      ? Effect.void
      : indexProfileCommit(event.did, commit.record);
  }
  if (commit.collection !== POST_COLLECTION) return Effect.void;

  return commit.operation === "delete"
    ? deletePost(uriOf(event.did, POST_COLLECTION, commit.rkey)).pipe(Effect.ignore)
    : indexPostCommit(event.did, commit.rkey, commit.cid, commit.record);
};

// ------------------------------------------------------------------ like tail

/**
 * Like URIs already counted, so a delete — which carries no record, and so no
 * subject — can be told from the overwhelming majority of like deletes, which
 * are for posts we do not index. Loaded from `post_like` at boot, so a restart
 * does not lose the ability to decrement.
 */
const makeCountedLikes = Effect.gen(function* () {
  const uris = yield* likedUris().pipe(
    Effect.catchAll((error) =>
      Effect.logWarning(`could not load counted likes: ${String(error.cause)}`).pipe(
        Effect.as([] as string[]),
      ),
    ),
  );
  yield* Effect.logInfo(`like tail: ${uris.length} counted like(s) loaded`);
  return new Set(uris);
});

const handleLikeEvent = (
  event: JetstreamEvent,
  interested: ReadonlySet<string>,
  counted: Set<string>,
): Effect.Effect<void, never, Database> => {
  if (event.kind !== "commit" || event.commit.collection !== LIKE_COLLECTION) return Effect.void;
  const commit = event.commit;
  const uri = uriOf(event.did, LIKE_COLLECTION, commit.rkey);

  if (commit.operation === "delete") {
    if (!counted.has(uri)) return Effect.void;
    counted.delete(uri);
    return removeLike(uri).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`could not uncount ${uri}: ${String(error.cause)}`),
      ),
    );
  }

  const subject = asText(asRecord(asRecord(commit.record)?.["subject"])?.["uri"]);
  if (subject === undefined) return Effect.void;
  // The subject's at-uri names the author, and only interested authors have
  // posts in the index — one string parse drops nearly the whole firehose.
  const author = parseAtUri(subject)?.repo;
  if (author === undefined || !interested.has(author)) return Effect.void;

  counted.add(uri);
  return applyLike(uri, subject).pipe(
    Effect.catchAll((error) => Effect.logWarning(`could not count ${uri}: ${String(error.cause)}`)),
  );
};

// ---------------------------------------------------------------- subscription

interface SubscriptionSpec {
  readonly source: string;
  readonly collections: string[];
  /** undefined means "every repo" — only the like tail wants that. */
  readonly scoped: boolean;
  readonly validateEvents: boolean;
  readonly handle: (
    event: JetstreamEvent,
    interested: ReadonlySet<string>,
  ) => Effect.Effect<void, never, Database>;
}

const runSubscription = (
  spec: SubscriptionSpec,
  interested: Interested,
): Effect.Effect<never, never, TailServices> =>
  Effect.gen(function* () {
    const settings = yield* IngesterSettings;
    const seen = yield* Ref.make(0);

    const connect = Effect.gen(function* () {
      const cursor = yield* readCursor(spec.source).pipe(Effect.orElseSucceed(() => undefined));
      const scope = spec.scoped ? yield* wantedDidsOf(yield* Ref.get(interested.dids)) : undefined;

      const subscription = new JetstreamSubscription({
        url: settings.jetstreamUrl,
        wantedCollections: spec.collections,
        ...(scope !== undefined ? { wantedDids: scope } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
        validateEvents: spec.validateEvents,
      });

      yield* Effect.logInfo(
        `[${spec.source}] subscribing collections=${spec.collections.join(",")} ` +
          `dids=${scope ? scope.length : "all"} cursor=${cursor ?? "live"}`,
      );

      if (spec.scoped) {
        yield* Effect.forkScoped(
          Effect.gen(function* () {
            const before = yield* Ref.get(interested.dids);
            const after = yield* interested.refresh;
            if (before.size === after.size && [...after].every((did) => before.has(did))) return;
            const next = yield* wantedDidsOf(after);
            yield* Effect.sync(() => subscription.updateOptions({ wantedDids: next }));
            yield* Effect.logInfo(`[${spec.source}] re-scoped to ${next.length} did(s)`);
          }).pipe(Effect.repeat(Schedule.spaced(Duration.seconds(settings.didRefreshSeconds)))),
        );
      }

      yield* Stream.fromAsyncIterable(
        subscription,
        (cause) => new TailError(`[${spec.source}] subscription failed: ${String(cause)}`),
      ).pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            const set = yield* Ref.get(interested.dids);
            yield* spec.handle(event, set);

            const count = yield* Ref.updateAndGet(seen, (n) => n + 1);
            if (count % settings.checkpointEvery === 0) {
              yield* writeCursor(spec.source, event.time_us).pipe(Effect.ignore);
            }
          }),
        ),
      );
    }).pipe(Effect.scoped);

    // The schedule never gives up, so the retry cannot actually surface an
    // error; `orDie` is how that is said in the type.
    return yield* Effect.retry(
      connect,
      reconnect.pipe(
        Schedule.tapInput((error: TailError) =>
          Effect.logWarning(`${error.message} — reconnecting`),
        ),
      ),
    ).pipe(Effect.orDie, Effect.zipRight(Effect.never));
  });

export const runTail: Effect.Effect<never, never, TailServices> = Effect.gen(function* () {
  const settings = yield* IngesterSettings;
  const interested = yield* makeInterested;

  const posts = runSubscription(
    {
      source: "jetstream:posts",
      collections: [POST_COLLECTION, PROFILE_COLLECTION],
      scoped: true,
      validateEvents: true,
      handle: handlePostEvent,
    },
    interested,
  );

  if (!settings.likeTail) {
    yield* Effect.logInfo("like tail disabled; like counts stay at their backfilled values");
    return yield* posts;
  }

  const counted = yield* makeCountedLikes;
  const likes = runSubscription(
    {
      source: "jetstream:likes",
      collections: [LIKE_COLLECTION],
      scoped: false,
      // The whole like firehose passes through here; schema validation on every
      // event would cost more than the defensive parse the handler does anyway.
      validateEvents: false,
      handle: (event, set) => handleLikeEvent(event, set, counted),
    },
    interested,
  );

  return yield* Effect.all([posts, likes], { concurrency: "unbounded" }).pipe(
    Effect.zipRight(Effect.never),
  );
});
