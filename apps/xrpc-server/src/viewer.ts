/**
 * Reads about somebody's own Ratat graph — their follows, their home feed —
 * name them by handle or DID like every other read does. Getting from that to
 * a DID is also the moment we learn a viewer exists: their repo may hold
 * follows written before we ever tailed the collection, so asking marks them
 * for the ingester's one-off graph walk.
 */

import type { ArtRatatGraphGetFollows } from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "./appview.ts";
import type { RouteEffect } from "./handler.ts";
import { noteInterest } from "./interest.ts";
import { type ActorRow, actorByDid, actorByHandle, wantFollowsBackfill } from "./store.ts";

export interface Viewer {
  readonly did: string;
  /** The index row, when the index already held one. */
  readonly row: ActorRow | undefined;
}

/**
 * The actor's DID, from the index when it holds them and from Bluesky when it
 * does not — in which case the profile it answers with is what the actor row is
 * built from, since a row cannot exist without a handle.
 */
export const resolveViewer = (
  actor: ArtRatatGraphGetFollows.$params["actor"],
  signal: AbortSignal | undefined,
): RouteEffect<Viewer> =>
  Effect.gen(function* () {
    const row = yield* (actor.startsWith("did:") ? actorByDid(actor) : actorByHandle(actor)).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`index lookup for ${actor} failed: ${String(error.cause)}`).pipe(
          Effect.as(undefined),
        ),
      ),
    );

    if (row === undefined) {
      const appview = yield* Appview;
      const res = yield* Effect.tryPromise({
        try: () =>
          appview.client.get("app.bsky.actor.getProfile", {
            params: { actor },
            ...(signal ? { signal } : {}),
          }),
        catch: appviewUnreachable,
      });
      if (!res.ok) return yield* Effect.fail(actorRequestFailed(actor, res.data));

      const profile = res.data;
      yield* noteInterest({
        did: profile.did,
        handle: profile.handle,
        ...(profile.displayName ? { displayName: profile.displayName } : {}),
        ...(profile.description ? { description: profile.description } : {}),
        ...(profile.avatar ? { avatar: profile.avatar } : {}),
        ...(profile.banner ? { banner: profile.banner } : {}),
      });
      yield* wantFollowsBackfill(profile.did).pipe(Effect.ignore);
      return { did: profile.did, row: undefined };
    }

    yield* wantFollowsBackfill(row.did).pipe(Effect.ignore);
    return { did: row.did, row };
  });
