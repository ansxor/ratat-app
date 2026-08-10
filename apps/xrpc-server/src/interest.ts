import type { Database } from "@ratat/db/effect";
import { Effect } from "effect";

import { type ActorSnapshot, markInterested, wantFollowsBackfill } from "./store.ts";

/**
 * Puts a DID in the interested set as a side effect of somebody looking at it.
 * Never fails the read that triggered it: an index that cannot be written is a
 * backfill that happens later, not a page that fails to render.
 */
export const noteInterest = (snapshot: ActorSnapshot): Effect.Effect<void, never, Database> =>
  markInterested(snapshot).pipe(
    Effect.catchAll((error) =>
      Effect.logWarning(`could not mark ${snapshot.did} interested: ${String(error.cause)}`),
    ),
  );

/** Marks interest without making the caller wait for the write. */
export const noteInterestInBackground = (
  snapshot: ActorSnapshot,
): Effect.Effect<void, never, Database> =>
  Effect.forkDaemon(noteInterest(snapshot)).pipe(Effect.asVoid);

/**
 * Marks interest, then queues the one-off walk of the account's own follows.
 * The profile page's following count depends on the walk, and the walk's
 * UPDATE only lands once the interest write above has created the row — which
 * is why they run in this order in one effect.
 */
export const noteInterestAndWantFollows = (
  snapshot: ActorSnapshot,
): Effect.Effect<void, never, Database> =>
  noteInterest(snapshot).pipe(
    Effect.flatMap(() => wantFollowsBackfill(snapshot.did).pipe(Effect.ignore)),
  );

/** The same, without making the caller wait for either write. */
export const noteInterestAndWantFollowsInBackground = (
  snapshot: ActorSnapshot,
): Effect.Effect<void, never, Database> =>
  Effect.forkDaemon(noteInterestAndWantFollows(snapshot)).pipe(Effect.asVoid);
