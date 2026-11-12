import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type LikeSocket,
  type LikeStore,
  LikeTail,
  likeTailConfig,
  parseJetstreamEvent,
} from "../../server/_like-tail.ts";

class FakeSocket implements LikeSocket {
  private readonly listeners = new Map<string, Array<(event?: unknown) => void>>();
  closed = false;

  addEventListener(type: string, listener: (event?: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  emit(type: "open" | "close" | "error"): void;
  emit(type: "message", event: { data: unknown }): void;
  emit(type: string, event?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  close(): void {
    this.closed = true;
  }
}

class MemoryLikeStore implements LikeStore {
  tracked = new Set<string>(["did:plc:artist1"]);
  counted = new Set<string>();
  indexedPosts = new Set<string>(["at://did:plc:artist1/app.bsky.feed.post/p1"]);
  cursor: string | undefined;
  writtenCursors: number[] = [];
  countCalls: Array<{ likeUri: string; subjectUri: string }> = [];
  uncountCalls: string[] = [];

  async trackedDids(): Promise<Set<string>> {
    return new Set(this.tracked);
  }

  async countedLikes(): Promise<Set<string>> {
    return new Set(this.counted);
  }

  async readCursor(): Promise<string | undefined> {
    return this.cursor;
  }

  async writeCursor(timeUs: number): Promise<void> {
    this.writtenCursors.push(timeUs);
    this.cursor = String(timeUs);
  }

  async countLike(likeUri: string, subjectUri: string): Promise<boolean> {
    this.countCalls.push({ likeUri, subjectUri });
    if (!this.indexedPosts.has(subjectUri)) return false;
    this.counted.add(likeUri);
    return true;
  }

  async uncountLike(likeUri: string): Promise<void> {
    this.uncountCalls.push(likeUri);
    this.counted.delete(likeUri);
  }
}

const makeCommit = (overrides: Record<string, unknown>) =>
  JSON.stringify({
    did: "did:plc:fan1",
    time_us: 1700000000123,
    kind: "commit",
    ...overrides,
  });

describe("likeTailConfig & parseJetstreamEvent", () => {
  it("parses create, update, delete, tick, and invalid JSON", () => {
    expect(parseJetstreamEvent("{bad json")).toBeUndefined();

    expect(
      parseJetstreamEvent(
        makeCommit({
          commit: {
            operation: "create",
            collection: "app.bsky.feed.like",
            rkey: "l1",
            record: { subject: { uri: "at://did:plc:artist1/app.bsky.feed.post/p1" } },
          },
        }),
      ),
    ).toEqual({
      kind: "like",
      timeUs: 1700000000123,
      likeUri: "at://did:plc:fan1/app.bsky.feed.like/l1",
      subjectUri: "at://did:plc:artist1/app.bsky.feed.post/p1",
      subjectAuthor: "did:plc:artist1",
    });

    expect(
      parseJetstreamEvent(
        makeCommit({
          commit: {
            operation: "delete",
            collection: "app.bsky.feed.like",
            rkey: "l1",
          },
        }),
      ),
    ).toEqual({
      kind: "unlike",
      timeUs: 1700000000123,
      likeUri: "at://did:plc:fan1/app.bsky.feed.like/l1",
    });

    expect(
      parseJetstreamEvent(
        makeCommit({
          commit: {
            operation: "create",
            collection: "app.bsky.feed.post",
            rkey: "p1",
          },
        }),
      ),
    ).toEqual({ kind: "tick", timeUs: 1700000000123 });
  });

  it("reads config from environment and disables under VITEST", () => {
    expect(likeTailConfig({ VITEST: "true", JETSTREAM_URL: "wss://jet.test" })).toBeUndefined();
    expect(
      likeTailConfig({ JETSTREAM_URL: "wss://jet.test", JETSTREAM_LIKE_TAIL: "false" }),
    ).toBeUndefined();
    expect(
      likeTailConfig({
        JETSTREAM_URL: "wss://jet.test",
        JETSTREAM_DID_REFRESH_SECONDS: "10",
        JETSTREAM_CHECKPOINT_EVERY: "5",
      }),
    ).toEqual({
      url: "wss://jet.test",
      didRefreshMs: 10_000,
      checkpointEvery: 5,
    });
  });
});

describe("LikeTail", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("tracks likes for tracked authors, ignores untracked/unindexed, checkpoints, and deletes", async () => {
    vi.useFakeTimers();
    const store = new MemoryLikeStore();
    const socket = new FakeSocket();
    const tail = new LikeTail(
      store,
      { url: "wss://jet.test", didRefreshMs: 60_000, checkpointEvery: 2 },
      () => socket,
    );

    await tail.start();

    socket.emit("message", {
      data: makeCommit({
        time_us: 100,
        commit: {
          operation: "create",
          collection: "app.bsky.feed.like",
          rkey: "l-tracked",
          record: { subject: { uri: "at://did:plc:artist1/app.bsky.feed.post/p1" } },
        },
      }),
    });
    socket.emit("message", {
      data: makeCommit({
        time_us: 200,
        commit: {
          operation: "create",
          collection: "app.bsky.feed.like",
          rkey: "l-untracked",
          record: { subject: { uri: "at://did:plc:stranger/app.bsky.feed.post/p9" } },
        },
      }),
    });
    socket.emit("message", {
      data: makeCommit({
        time_us: 300,
        commit: {
          operation: "create",
          collection: "app.bsky.feed.like",
          rkey: "l-unindexed",
          record: { subject: { uri: "at://did:plc:artist1/app.bsky.feed.post/missing" } },
        },
      }),
    });
    await tail.flush();

    expect(store.countCalls).toHaveLength(2);
    expect(store.writtenCursors).toEqual([200]);

    store.indexedPosts.add("at://did:plc:artist1/app.bsky.feed.post/missing");
    socket.emit("message", {
      data: makeCommit({
        time_us: 400,
        commit: {
          operation: "create",
          collection: "app.bsky.feed.like",
          rkey: "l-unindexed",
          record: { subject: { uri: "at://did:plc:artist1/app.bsky.feed.post/missing" } },
        },
      }),
    });
    socket.emit("message", {
      data: makeCommit({
        time_us: 500,
        commit: {
          operation: "delete",
          collection: "app.bsky.feed.like",
          rkey: "l-tracked",
        },
      }),
    });
    await tail.flush();

    expect(store.counted.has("at://did:plc:fan1/app.bsky.feed.like/l-unindexed")).toBe(true);
    expect(store.uncountCalls).toEqual(["at://did:plc:fan1/app.bsky.feed.like/l-tracked"]);
    expect(store.writtenCursors).toEqual([200, 400]);

    socket.emit("close");
    await tail.flush();
    expect(store.writtenCursors).toEqual([200, 400, 500]);

    tail.stop();
    expect(socket.closed).toBe(false);
  });

  it("serializes store writes sequentially via the write queue", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const { promise: firstGate, resolve: releaseFirst } = Promise.withResolvers<void>();

    const base = new MemoryLikeStore();
    const store: LikeStore = {
      trackedDids: () => base.trackedDids(),
      countedLikes: () => base.countedLikes(),
      readCursor: () => base.readCursor(),
      writeCursor: (t) => base.writeCursor(t),
      uncountLike: (u) => base.uncountLike(u),
      countLike: async (likeUri) => {
        order.push(`start:${likeUri.split("/").pop()}`);
        if (likeUri.endsWith("/l1")) {
          await firstGate;
        }
        order.push(`end:${likeUri.split("/").pop()}`);
        return true;
      },
    };

    const socket = new FakeSocket();
    const tail = new LikeTail(
      store,
      { url: "wss://jet.test", didRefreshMs: 60_000, checkpointEvery: 50 },
      () => socket,
    );
    await tail.start();

    socket.emit("message", {
      data: makeCommit({
        time_us: 10,
        commit: {
          operation: "create",
          collection: "app.bsky.feed.like",
          rkey: "l1",
          record: { subject: { uri: "at://did:plc:artist1/app.bsky.feed.post/p1" } },
        },
      }),
    });
    socket.emit("message", {
      data: makeCommit({
        time_us: 20,
        commit: {
          operation: "create",
          collection: "app.bsky.feed.like",
          rkey: "l2",
          record: { subject: { uri: "at://did:plc:artist1/app.bsky.feed.post/p1" } },
        },
      }),
    });

    await Promise.resolve();
    expect(order).toEqual(["start:l1"]);

    releaseFirst();
    await tail.flush();
    expect(order).toEqual(["start:l1", "end:l1", "start:l2", "end:l2"]);

    tail.stop();
    expect(socket.closed).toBe(true);
  });

  it("reconnects with exponential backoff and resets attempt on open", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const store = new MemoryLikeStore();
    const sockets: FakeSocket[] = [];
    const openedUrls: string[] = [];

    const tail = new LikeTail(
      store,
      { url: "wss://jet.test", didRefreshMs: 60_000, checkpointEvery: 50 },
      (url) => {
        openedUrls.push(url);
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
    );

    await tail.start();
    expect(sockets).toHaveLength(1);

    sockets[0]!.emit("close");
    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);

    sockets[1]!.emit("close");
    await vi.advanceTimersByTimeAsync(1999);
    expect(sockets).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(3);

    sockets[2]!.emit("open");
    sockets[2]!.emit("close");
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(4);

    tail.stop();
  });
});
