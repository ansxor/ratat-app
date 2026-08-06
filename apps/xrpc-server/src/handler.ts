import { XRPCError } from "@atcute/xrpc-server";
import { Cause, Effect, Exit } from "effect";

import type { AppRuntime, AppServices } from "./runtime.ts";

export type RouteEffect<A> = Effect.Effect<A, XRPCError, AppServices>;

export const runHandler = async <A>(runtime: AppRuntime, effect: RouteEffect<A>): Promise<A> => {
  const exit = await runtime.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) return exit.value;

  const failure = Cause.failureOption(exit.cause);
  if (failure._tag === "Some") throw failure.value;

  throw new XRPCError({
    status: 500,
    error: "InternalServerError",
    message: Cause.pretty(exit.cause),
  });
};
