import type { JetstreamEvent } from "@atcute/jetstream";
import { Database, type DatabaseService, type Drizzle } from "@ratat/db/effect";
import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";

import { IngesterSettings } from "./config.ts";
import { handleFollowEvent } from "./tail.ts";

/**
 * The follow tail cannot be exercised against a live jetstream in a test — no
 * event arrives on demand — so the handler is fed the events instead, and the
 * index is a layer that records which queries it was asked for rather than one
 * that runs them.
 */
const recordingDatabase = (ops: string[]): Layer.Layer<Database> =>
  Layer.succeed(
    Database,
    Database.of({
      get db(): Drizzle {
        throw new Error("the query itself is never run in this test");
      },
      // Every query answers with no rows, which is what makes a follow's
      // subject look like a DID the index has never heard of.
      run: ((op: string) => {
        ops.push(op);
        return Effect.succeed([]);
      }) as DatabaseService["run"],
    }),
  );

const settings = Layer.succeed(
  IngesterSettings,
  IngesterSettings.of({
    appviewUrl: "https://appview.invalid",
    plcDirectoryUrl: "https://plc.invalid",
    jetstreamUrl: "wss://jetstream.invalid",
    didRefreshSeconds: 30,
    checkpointEvery: 50,
    likeTail: false,
    backfillPollSeconds: 5,
    backfillPageSize: 100,
    backfillPageDelayMillis: 0,
    backfillMaxPages: 0,
    backfillRetryMinutes: 30,
  }),
);

const commit = (
  collection: string,
  operation: "create" | "delete",
  record?: unknown,
): JetstreamEvent =>
  ({
    kind: "commit",
    did: "did:plc:follower",
    time_us: 1,
    commit: {
      rev: "rev",
      operation,
      collection,
      rkey: "3kzz",
      ...(operation === "delete" ? {} : { cid: "bafycid", record }),
    },
  }) as unknown as JetstreamEvent;

const followRecord = {
  $type: "art.ratat.graph.follow",
  subject: "did:plc:artist",
  createdAt: "2026-08-06T00:00:00.000Z",
};

const opsFor = async (event: JetstreamEvent): Promise<string[]> => {
  const ops: string[] = [];
  await Effect.runPromise(
    handleFollowEvent(event).pipe(Effect.provide(Layer.merge(recordingDatabase(ops), settings))),
  );
  return ops;
};

describe("handleFollowEvent", () => {
  test("a follow is written, and a subject we do not know is marked interested", async () => {
    const ops = await opsFor(commit("art.ratat.graph.follow", "create", followRecord));
    expect(ops).toEqual(["upsertRatatFollow", "actorRow", "markInterested"]);
  });

  test("an unfollow removes the record it names", async () => {
    expect(await opsFor(commit("art.ratat.graph.follow", "delete"))).toEqual(["deleteRatatFollow"]);
  });

  test("a record without a subject is not a follow and is ignored", async () => {
    const ops = await opsFor(
      commit("art.ratat.graph.follow", "create", { $type: "art.ratat.graph.follow" }),
    );
    expect(ops).toEqual([]);
  });

  test("another collection on the same subscription is ignored", async () => {
    expect(await opsFor(commit("app.bsky.feed.like", "create", followRecord))).toEqual([]);
  });

  test("an identity event carries no commit and is ignored", async () => {
    const identity = {
      kind: "identity",
      did: "did:plc:follower",
      time_us: 1,
      identity: { did: "did:plc:follower", handle: "artist.example", seq: 1, time: "" },
    } as unknown as JetstreamEvent;
    expect(await opsFor(identity)).toEqual([]);
  });
});
