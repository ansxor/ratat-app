import { createBunWebSocket } from "@atcute/xrpc-server-bun";
import { Config, Effect, Fiber, ManagedRuntime } from "effect";

import { createRouter } from "./router.ts";
import { AppLive } from "./runtime.ts";

const serve = Effect.gen(function* () {
  const port = yield* Config.integer("PORT").pipe(Config.withDefault(3001));
  const hostname = yield* Config.string("HOST").pipe(Config.withDefault("127.0.0.1"));

  const runtime = yield* Effect.acquireRelease(
    Effect.sync(() => ManagedRuntime.make(AppLive)),
    (rt) => Effect.promise(() => rt.dispose()),
  );

  const ws = createBunWebSocket();
  const handler = ws.wrap(createRouter({ runtime, websocket: ws.adapter }));

  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({ port, hostname, fetch: handler.fetch, websocket: handler.websocket }),
    ),
    (server) => Effect.promise(() => server.stop(true)),
  );

  yield* Effect.logInfo(`ratat xrpc-server listening on ${server.url.href}`);
  yield* Effect.never;
});

const fiber = Effect.runFork(Effect.scoped(serve));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    Effect.runFork(Fiber.interrupt(fiber));
  });
}
