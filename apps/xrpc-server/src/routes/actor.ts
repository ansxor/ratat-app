import { json, type QueryContext } from "@atcute/xrpc-server";
import type { NetRatatActorGetProfile, NetRatatActorSearchActorsTypeahead } from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "../appview.ts";
import { upstreamFailure } from "../errors.ts";
import type { RouteEffect } from "../handler.ts";
import { noteInterestAndWantFollowsInBackground } from "../interest.ts";
import { graphCounts } from "../store.ts";
import { profileView, profileViewBasic } from "../views.ts";

/**
 * Profiles stay live: the bio and post count are Bluesky's numbers and would
 * be stale the moment we stored them. The graph counts are Ratat's own — the
 * visit is what marks the DID interested and queues the walk of their own
 * follows, so a profile page ends up backfilled for next time, and, since the
 * masthead reads its own avatar this way, how logging in does.
 */
export const actorGetProfile = (
  ctx: QueryContext<NetRatatActorGetProfile.mainSchema>,
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

    const output: NetRatatActorGetProfile.$output = profileView(res.data);
    yield* noteInterestAndWantFollowsInBackground(output);

    // The graph counts come from the index, never from Bluesky: following on
    // Ratat is a different graph, and showing Bluesky's numbers here would
    // promise a list this page's links cannot deliver. An index that cannot
    // answer keeps the Bluesky numbers rather than showing a wrong zero.
    const counts = yield* graphCounts(output.did).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`graph counts of ${output.did} unreadable: ${String(error.cause)}`).pipe(
          Effect.as(undefined),
        ),
      ),
    );
    if (counts) {
      output.followersCount = counts.followers;
      output.followsCount = counts.follows;
    }

    return json(output);
  });

const TYPEAHEAD_LIMIT = 8;

/**
 * A thin proxy. Ratat has no actor search of its own and should not grow one:
 * the interested set is a fraction of Bluesky, and an artist a visitor cannot
 * find is an artist Ratat never gets to index. Nothing here is stored — typing
 * a name is not interest in an account, and marking every suggestion
 * interested would queue a backfill per keystroke.
 */
export const actorSearchActorsTypeahead = (
  ctx: QueryContext<NetRatatActorSearchActorsTypeahead.mainSchema>,
): RouteEffect<Response> =>
  Effect.gen(function* () {
    const q = ctx.params.q.trim();
    if (q.length === 0) {
      const empty: NetRatatActorSearchActorsTypeahead.$output = { actors: [] };
      return json(empty);
    }

    const appview = yield* Appview;
    const res = yield* Effect.tryPromise({
      try: () =>
        appview.client.get("app.bsky.actor.searchActorsTypeahead", {
          params: { q, limit: ctx.params.limit ?? TYPEAHEAD_LIMIT },
          signal: ctx.signal,
        }),
      catch: appviewUnreachable,
    });
    if (!res.ok) {
      return yield* Effect.fail(upstreamFailure(res.data.message ?? res.data.error));
    }

    const output: NetRatatActorSearchActorsTypeahead.$output = {
      actors: res.data.actors.map(profileViewBasic),
    };
    return json(output);
  });
