import { json, type QueryContext } from "@atcute/xrpc-server";
import type { ArtRatatActorGetProfile } from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "../appview.ts";
import type { RouteEffect } from "../handler.ts";
import { noteInterestInBackground } from "../interest.ts";
import { profileView } from "../views.ts";

/**
 * Profiles stay live: followers, follows and post counts are Bluesky's numbers
 * and would be stale the moment we stored them. The visit is what marks the DID
 * interested, which is how a profile page ends up backfilled for next time —
 * and, since the masthead reads its own avatar this way, how logging in does.
 */
export const actorGetProfile = (
  ctx: QueryContext<ArtRatatActorGetProfile.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const actor = ctx.params.actor;
    const appview = yield* Appview;

    const res = yield* Effect.tryPromise({
      try: () =>
        appview.client.get("app.bsky.actor.getProfile", { params: { actor }, signal: ctx.signal }),
      catch: appviewUnreachable,
    });
    if (!res.ok) return yield* Effect.fail(actorRequestFailed(actor, res.data));

    const output: ArtRatatActorGetProfile.$output = profileView(res.data);
    yield* noteInterestInBackground(output);

    return json(output);
  });
