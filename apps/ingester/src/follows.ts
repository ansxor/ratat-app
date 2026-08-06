/**
 * The Ratat graph.
 *
 * Two ways a follow reaches the index. The tail sees every
 * `net.ratat.graph.follow` written from now on (see `tail.ts`); this file
 * covers the other one — a repo that already held follows before we watched
 * for them, walked once when its owner first asks for their home feed.
 *
 * A follow is also the third way into the interested set: whoever is followed
 * gets indexed, which is what eventually fills the follower's timeline.
 */

import { Client, simpleFetchHandler } from "@atcute/client";
import type {} from "@atcute/atproto";
import type {} from "@atcute/bluesky";
import {
  CompositeDidDocumentResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  XrpcHandleResolver,
} from "@atcute/identity-resolver";
import type { ActorIdentifier, Did } from "@atcute/lexicons/syntax";
import { parseAtUri } from "@ratat/common";
import type { Database } from "@ratat/db/effect";
import { NetRatatCollection } from "@ratat/lexicon/collections";
import { Duration, Effect } from "effect";

import { IngesterSettings } from "./config.ts";
import {
  actorRow,
  claimFollowsBackfill,
  finishFollowsBackfill,
  markInterested,
  nextFollowsBackfillTarget,
  upsertRatatFollow,
} from "./store.ts";

export const FOLLOW_COLLECTION = NetRatatCollection.graphFollow;

class GraphError extends Error {
  override readonly name = "GraphError";
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

export interface FollowRecord {
  readonly subject: string;
  readonly createdAt: Date;
}

/** Undefined for anything that is not a follow we can act on. */
export const parseFollowRecord = (record: unknown): FollowRecord | undefined => {
  const fields = asRecord(record);
  const subject = fields?.["subject"];
  if (typeof subject !== "string" || !subject.startsWith("did:")) return undefined;
  const createdAt = new Date(
    typeof fields?.["createdAt"] === "string" ? (fields["createdAt"] as string) : Date.now(),
  );
  return { subject, createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt };
};

/**
 * Marks a followed DID interested, so the backfill worker picks up their
 * portfolio. The profile fetch only happens the first time we hear of them —
 * an actor row needs a handle, and a follow record carries only a DID.
 */
export const noteFollowedSubject = (
  did: string,
): Effect.Effect<void, never, IngesterSettings | Database> =>
  Effect.gen(function* () {
    const existing = yield* actorRow(did).pipe(Effect.orElseSucceed(() => undefined));
    if (existing?.interestedAt) return;

    const settings = yield* IngesterSettings;
    const client = new Client({ handler: simpleFetchHandler({ service: settings.appviewUrl }) });
    const res = yield* Effect.tryPromise(() =>
      client.get("app.bsky.actor.getProfile", { params: { actor: did as ActorIdentifier } }),
    ).pipe(Effect.orElseSucceed(() => undefined));

    // A handle we cannot read yet is still worth an interested row: the DID is
    // what the backfill works from, and the post tail refreshes the handle.
    const profile = res?.ok ? res.data : undefined;
    yield* markInterested({
      did,
      handle: profile?.handle ?? existing?.handle ?? did,
      ...(profile?.displayName ? { displayName: profile.displayName } : {}),
      ...(profile?.description ? { description: profile.description } : {}),
      ...(profile?.avatar ? { avatar: profile.avatar } : {}),
      ...(profile?.banner ? { banner: profile.banner } : {}),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`could not mark ${did} interested: ${String(error.cause)}`),
      ),
    );
  });

/** Writes one follow and marks its subject interested. */
export const indexFollow = (
  did: string,
  rkey: string,
  record: unknown,
): Effect.Effect<void, never, IngesterSettings | Database> =>
  Effect.gen(function* () {
    const parsed = parseFollowRecord(record);
    if (parsed === undefined) return;

    const uri = `at://${did}/${FOLLOW_COLLECTION}/${rkey}`;
    yield* upsertRatatFollow({
      uri,
      did,
      rkey,
      subject: parsed.subject,
      createdAt: parsed.createdAt,
    }).pipe(
      Effect.tap(() => Effect.logInfo(`ratat follow ${did} → ${parsed.subject}`)),
      Effect.catchAll((error) =>
        Effect.logWarning(`could not index ${uri}: ${String(error.cause)}`),
      ),
    );

    yield* noteFollowedSubject(parsed.subject);
  });

// ------------------------------------------------------------- graph backfill

const resolver = (settings: { appviewUrl: string; plcDirectoryUrl: string }) =>
  new LocalActorResolver({
    handleResolver: new XrpcHandleResolver({ serviceUrl: settings.appviewUrl }),
    didDocumentResolver: new CompositeDidDocumentResolver({
      methods: {
        plc: new PlcDidDocumentResolver({ apiUrl: settings.plcDirectoryUrl }),
        web: new WebDidDocumentResolver(),
      },
    }),
  });

/**
 * Walks one repo's follow records straight from its PDS. The appview does not
 * carry `net.ratat.graph.follow`, so this is the only place the records can be
 * read from in bulk.
 */
const walkFollows = (did: string): Effect.Effect<number, GraphError, IngesterSettings | Database> =>
  Effect.gen(function* () {
    const settings = yield* IngesterSettings;

    const actorInfo = yield* Effect.tryPromise({
      try: () => resolver(settings).resolve(did as Did),
      catch: (cause) => new GraphError(`could not resolve ${did}: ${String(cause)}`),
    });

    const client = new Client({ handler: simpleFetchHandler({ service: actorInfo.pds }) });
    let cursor: string | undefined;
    let stored = 0;

    for (;;) {
      const res = yield* Effect.tryPromise({
        try: () =>
          client.get("com.atproto.repo.listRecords", {
            params: {
              repo: did as ActorIdentifier,
              collection: FOLLOW_COLLECTION,
              limit: 100,
              ...(cursor ? { cursor } : {}),
            },
          }),
        catch: (cause) => new GraphError(`${actorInfo.pds} unreachable: ${String(cause)}`),
      });
      if (!res.ok) {
        return yield* Effect.fail(
          new GraphError(res.data.message ?? res.data.error ?? "the PDS refused listRecords"),
        );
      }

      for (const record of res.data.records) {
        const rkey = parseAtUri(record.uri)?.rkey;
        if (rkey === undefined) continue;
        yield* indexFollow(did, rkey, record.value);
        stored++;
      }

      cursor = res.data.cursor;
      if (cursor === undefined || res.data.records.length === 0) break;
      yield* Effect.sleep(Duration.millis(settings.backfillPageDelayMillis));
    }

    yield* Effect.logInfo(`graph backfill ${did}: ${stored} ratat follow(s)`);
    return stored;
  });

/**
 * One repo at a time, forever, for whoever has asked to see their home feed.
 * Runs alongside the post backfill rather than inside it: the two queues fill
 * from different triggers and a slow portfolio walk must not hold up a graph
 * the home page is waiting on.
 */
export const runFollowsBackfillWorker: Effect.Effect<never, never, IngesterSettings | Database> =
  Effect.gen(function* () {
    const settings = yield* IngesterSettings;
    yield* Effect.logInfo("graph backfill worker ready");

    const tick = Effect.gen(function* () {
      const retryAfter = new Date(Date.now() - settings.backfillRetryMinutes * 60_000);
      const target = yield* nextFollowsBackfillTarget(retryAfter).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`graph queue unreadable: ${String(error.cause)}`).pipe(
            Effect.as(undefined),
          ),
        ),
      );
      if (target === undefined) return false;

      yield* claimFollowsBackfill(target.did).pipe(Effect.ignore);
      yield* walkFollows(target.did).pipe(
        Effect.flatMap(() => finishFollowsBackfill(target.did).pipe(Effect.ignore)),
        Effect.catchAll((error) =>
          Effect.logWarning(`graph backfill ${target.did} failed: ${error.message}`),
        ),
      );
      return true;
    });

    return yield* Effect.forever(
      tick.pipe(
        Effect.flatMap((worked) =>
          worked ? Effect.void : Effect.sleep(Duration.seconds(settings.backfillPollSeconds)),
        ),
      ),
    );
  });
