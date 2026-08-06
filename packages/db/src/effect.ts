import { Context, Effect, Layer, Schema } from "effect";

export type Drizzle = typeof import("./client.ts").db;

export class DbError extends Schema.TaggedError<DbError>()("DbError", {
  op: Schema.String,
  cause: Schema.Unknown,
}) {}

export interface DatabaseService {
  readonly db: Drizzle;
  /** Wraps one drizzle call, naming it so a failure says which query broke. */
  readonly run: <A>(op: string, f: (db: Drizzle) => Promise<A>) => Effect.Effect<A, DbError>;
}

export class Database extends Context.Tag("@ratat/db/Database")<Database, DatabaseService>() {}

const make = (db: Drizzle): DatabaseService => ({
  db,
  run: (op, f) =>
    Effect.tryPromise({
      try: () => f(db),
      catch: (cause) => new DbError({ op, cause }),
    }),
});

/**
 * The client is imported lazily so that building the layer — not merely
 * importing this module — is what demands DATABASE_URL, and so that a missing
 * one is an ordinary failure a caller can decide about rather than a defect.
 *
 * Building the layer does not open a connection: Postgres being down is a
 * per-query `DbError`, which lets a read fall back and recover by itself.
 */
export const DatabaseLive: Layer.Layer<Database, DbError> = Layer.scoped(
  Database,
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const { db } = await import("./client.ts");
        return make(db);
      },
      catch: (cause) => new DbError({ op: "connect", cause }),
    }),
    () =>
      Effect.promise(async () => {
        const { sql } = await import("./client.ts");
        await sql.close();
      }),
  ),
);
