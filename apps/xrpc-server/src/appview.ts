import { Client, simpleFetchHandler, type XRPCErrorPayload } from "@atcute/client";
import type {} from "@atcute/bluesky";
import { PUBLIC_BSKY_APPVIEW_URL } from "@ratat/common";
import { Config, type ConfigError, Context, Effect, Layer } from "effect";

import { profileNotFound, upstreamFailure } from "./errors.ts";

export interface AppviewService {
  readonly client: Client;
}

export class Appview extends Context.Tag("@ratat/xrpc-server/Appview")<Appview, AppviewService>() {}

export const AppviewLive: Layer.Layer<Appview, ConfigError.ConfigError> = Layer.effect(
  Appview,
  Effect.gen(function* () {
    const service = yield* Config.string("BSKY_APPVIEW_URL").pipe(
      Config.withDefault(PUBLIC_BSKY_APPVIEW_URL),
    );
    return Appview.of({ client: new Client({ handler: simpleFetchHandler({ service }) }) });
  }),
);

const UNRESOLVABLE_ACTOR = new Set(["InvalidRequest", "AccountDeactivated", "AccountTakedown"]);

export const actorRequestFailed = (actor: string, payload: XRPCErrorPayload) =>
  UNRESOLVABLE_ACTOR.has(payload.error)
    ? profileNotFound(actor)
    : upstreamFailure(payload.message ?? payload.error);

export const appviewUnreachable = () => upstreamFailure("could not reach the Bluesky appview");
