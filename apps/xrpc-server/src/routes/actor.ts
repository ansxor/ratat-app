import { json, type QueryContext } from "@atcute/xrpc-server";
import type { ArtRatatActorGetProfile } from "@ratat/lexicon";
import { Effect } from "effect";

import { actorRequestFailed, appviewUnreachable, Appview } from "../appview.ts";
import type { RouteEffect } from "../handler.ts";
import { profileView } from "../views.ts";

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
    return json(output);
  });
