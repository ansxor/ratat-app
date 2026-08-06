import { Effect, Fiber } from "effect";

const main = Effect.gen(function* () {
  yield* Effect.logInfo("ratat xrpc-server ready");
  yield* Effect.never;
});

const fiber = Effect.runFork(main);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    Effect.runFork(Fiber.interrupt(fiber));
  });
}
