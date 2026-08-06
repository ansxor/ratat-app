import { Database, DatabaseLive, DbError } from "@ratat/db/effect";
import { type ConfigError, Effect, Layer, type ManagedRuntime } from "effect";

import { Appview, AppviewLive } from "./appview.ts";

export type AppServices = Appview | Database;

/**
 * A Database that answers every query with a failure. Read paths already treat
 * a `DbError` as "serve live instead", so a server started without a usable
 * DATABASE_URL degrades to the pre-index behaviour rather than refusing to
 * answer at all.
 */
const indexUnavailable = (cause: unknown): Layer.Layer<Database> =>
  Layer.succeed(
    Database,
    Database.of({
      get db(): never {
        throw new Error("the local index is unavailable");
      },
      run: (op) => Effect.fail(new DbError({ op, cause })),
    }),
  );

const DatabaseOptional: Layer.Layer<Database> = DatabaseLive.pipe(
  Layer.catchAll((error) =>
    Layer.effectDiscard(
      Effect.logWarning(
        `no local index (${String(error.cause)}); every read will be served live from Bluesky`,
      ),
    ).pipe(Layer.merge(indexUnavailable(error.cause))),
  ),
);

export const AppLive = Layer.mergeAll(AppviewLive, DatabaseOptional);

export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, ConfigError.ConfigError>;

export { Appview, Database };
