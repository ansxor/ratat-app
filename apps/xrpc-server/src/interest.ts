import type { Database } from "@ratat/db/effect";
import { Effect } from "effect";

import { type ActorSnapshot, markInterested } from "./store.ts";

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
