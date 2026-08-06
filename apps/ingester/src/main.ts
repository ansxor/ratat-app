import { DatabaseLive } from "@ratat/db/effect";
import { Effect, Fiber, Layer, Logger, LogLevel } from "effect";

import { runBackfillWorker } from "./backfill.ts";
import { SettingsLive } from "./config.ts";
import { runTail } from "./tail.ts";

/**
 * Two jobs, one process: catch an interested actor up (backfill) and keep them
 * current (tail). They share the index and nothing else, so they simply run
 * side by side.
 */
const main = Effect.gen(function* () {
  yield* Effect.logInfo("ratat ingester starting");
  yield* Effect.all([runBackfillWorker, runTail], { concurrency: "unbounded" });
}).pipe(
  Effect.provide(Layer.mergeAll(SettingsLive, DatabaseLive)),
  Logger.withMinimumLogLevel(LogLevel.Info),
);

const fiber = Effect.runFork(Effect.scoped(main));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    Effect.runFork(Fiber.interrupt(fiber));
  });
}
