import { describe, expect, it, vi } from "vitest";
import {
  Mutations,
  type OptimisticChange,
  type RecordWriter,
  chunk,
  rkeyFromUri,
} from "./mutations.ts";

const makeWriter = (overrides: Partial<RecordWriter> = {}): RecordWriter => ({
  createFollow: vi.fn(async () => ({ uri: "at://did:plc:viewer/net.ratat.graph.follow/r1" })),
  deleteFollow: vi.fn(async () => {}),
  createFollows: vi.fn(async () => {}),
  createLike: vi.fn(async () => ({ uri: "at://did:plc:viewer/app.bsky.feed.like/l1" })),
  deleteLike: vi.fn(async () => {}),
  ...overrides,
});

describe("rkeyFromUri & chunk", () => {
  it("extracts record keys from AT URIs", () => {
    expect(rkeyFromUri("at://did:plc:a/net.ratat.graph.follow/3k1")).toBe("3k1");
    expect(rkeyFromUri("at://did:plc:a/net.ratat.graph.follow/")).toBeUndefined();
    expect(rkeyFromUri("")).toBeUndefined();
  });

  it("splits arrays into fixed-size chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk(["a", "b"], 5)).toEqual([["a", "b"]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("Mutations", () => {
  it("runs apply -> write -> confirm and returns true on success", async () => {
    const events: string[] = [];
    const writer = makeWriter({
      createFollow: vi.fn(async () => {
        events.push("write");
        return { uri: "at://did:plc:viewer/net.ratat.graph.follow/new-rkey" };
      }),
    });
    const notifyError = vi.fn();
    const mutations = new Mutations(writer, notifyError);

    let state = "idle";
    const change: OptimisticChange<{ uri?: string }> = {
      label: "Follow",
      apply() {
        events.push("apply");
        state = "optimistic";
      },
      write(records) {
        return records.createFollow("did:plc:viewer", "did:plc:artist");
      },
      confirm(res) {
        events.push("confirm");
        state = res.uri ?? "confirmed";
      },
      rollback() {
        events.push("rollback");
        state = "rolled-back";
      },
    };

    const ok = await mutations.run(change);
    expect(ok).toBe(true);
    expect(events).toEqual(["apply", "write", "confirm"]);
    expect(state).toBe("at://did:plc:viewer/net.ratat.graph.follow/new-rkey");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("runs apply -> write -> rollback and notifies on Error failure", async () => {
    const events: string[] = [];
    const writer = makeWriter({
      deleteLike: vi.fn(async () => {
        events.push("write");
        throw new Error("PDS unavailable");
      }),
    });
    const notifyError = vi.fn();
    const mutations = new Mutations(writer, notifyError);

    let liked = true;
    const change: OptimisticChange<void> = {
      label: "Unlike",
      apply() {
        events.push("apply");
        liked = false;
      },
      write(records) {
        return records.deleteLike("l1");
      },
      confirm() {
        events.push("confirm");
      },
      rollback() {
        events.push("rollback");
        liked = true;
      },
    };

    const ok = await mutations.run(change);
    expect(ok).toBe(false);
    expect(events).toEqual(["apply", "write", "rollback"]);
    expect(liked).toBe(true);
    expect(notifyError).toHaveBeenCalledWith("Unlike failed: PDS unavailable");
  });

  it("uses default detail when a non-Error value is thrown", async () => {
    const writer = makeWriter({
      createLike: vi.fn(async () => {
        throw "unexpected";
      }),
    });
    const notifyError = vi.fn();
    const mutations = new Mutations(writer, notifyError);

    const ok = await mutations.run({
      label: "Favourite",
      apply() {},
      write(records) {
        return records.createLike("did:plc:viewer", { uri: "at://1", cid: "bafy1" });
      },
      confirm() {},
      rollback() {},
    });

    expect(ok).toBe(false);
    expect(notifyError).toHaveBeenCalledWith("Favourite failed: That didn't work.");
  });
});
