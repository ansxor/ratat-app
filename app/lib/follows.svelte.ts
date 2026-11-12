import { APPLY_WRITES_LIMIT, chunk, type Mutations, rkeyFromUri } from "$lib/mutations.ts";
import { hatkRecords, mutations as defaultMutations } from "$lib/records.ts";
import { getRatatFollows } from "$lib/ratat.ts";

const IMPORT_DISMISSED_KEY = "ratat:follow-import-dismissed";

export class FollowsStore {
  follows = $state<Map<string, string>>(new Map());
  loaded = $state(false);
  #baseline = $state<Set<string>>(new Set());
  #baselineLoaded = false;
  #loadedForDid: string | null = null;
  #pendingLoad: Promise<void> | null = null;
  private readonly runner: Mutations;

  constructor(runner: Mutations = defaultMutations) {
    this.runner = runner;
  }

  sync(viewerDid: string | null | undefined) {
    const nextDid = viewerDid ?? null;
    if (!nextDid) {
      if (
        this.#loadedForDid !== null ||
        this.loaded ||
        this.follows.size > 0 ||
        this.#baseline.size > 0 ||
        this.#baselineLoaded
      ) {
        this.#loadedForDid = null;
        this.follows = new Map();
        this.#baseline = new Set();
        this.#baselineLoaded = false;
        this.loaded = false;
        this.#pendingLoad = null;
      }
      return;
    }

    if (this.#loadedForDid === nextDid && (this.loaded || this.#pendingLoad)) {
      return;
    }

    this.#loadedForDid = nextDid;
    this.loaded = false;
    this.follows = new Map();
    this.#baseline = new Set();
    this.#baselineLoaded = false;
    const loadDid = nextDid;

    this.#pendingLoad = getRatatFollows(loadDid)
      .then((res) => {
        if (this.#loadedForDid !== loadDid) return;
        const next = new Map(res.follows.map((entry) => [entry.subject, entry.uri]));
        this.follows = next;
        this.#baseline = new Set(next.keys());
        this.#baselineLoaded = true;
        this.loaded = true;
      })
      .catch(() => {
        if (this.#loadedForDid !== loadDid) return;
        this.loaded = true;
      })
      .finally(() => {
        if (this.#loadedForDid === loadDid) {
          this.#pendingLoad = null;
        }
      });
  }

  reload(viewerDid: string | null | undefined) {
    this.#loadedForDid = null;
    this.#pendingLoad = null;
    this.sync(viewerDid);
  }

  seed(subjectDid: string, followUri: string) {
    if (!this.follows.has(subjectDid)) {
      const next = new Map(this.follows);
      next.set(subjectDid, followUri);
      this.follows = next;
    }
    if (!this.#baselineLoaded && !this.#baseline.has(subjectDid)) {
      const nextBaseline = new Set(this.#baseline);
      nextBaseline.add(subjectDid);
      this.#baseline = nextBaseline;
    }
    if (!this.loaded) {
      this.loaded = true;
    }
  }

  isFollowing(subjectDid: string): boolean {
    return this.follows.has(subjectDid);
  }

  delta(subjectDid: string): number {
    return (this.follows.has(subjectDid) ? 1 : 0) - (this.#baseline.has(subjectDid) ? 1 : 0);
  }

  async follow(viewerDid: string, subjectDid: string): Promise<void> {
    if (this.follows.has(subjectDid)) return;
    await this.runner.run({
      label: "Follow",
      apply: () => {
        const optimistic = new Map(this.follows);
        optimistic.set(subjectDid, `optimistic:${subjectDid}`);
        this.follows = optimistic;
      },
      write: (records) => records.createFollow(viewerDid, subjectDid),
      confirm: (res) => {
        if (res.uri) {
          const confirmed = new Map(this.follows);
          confirmed.set(subjectDid, res.uri);
          this.follows = confirmed;
        }
      },
      rollback: () => {
        const rollback = new Map(this.follows);
        rollback.delete(subjectDid);
        this.follows = rollback;
      },
    });
  }

  async unfollow(subjectDid: string): Promise<void> {
    const uri = this.follows.get(subjectDid);
    if (!uri || uri.startsWith("optimistic:")) return;

    const rkey = rkeyFromUri(uri);
    if (!rkey) return;

    await this.runner.run({
      label: "Unfollow",
      apply: () => {
        const optimistic = new Map(this.follows);
        optimistic.delete(subjectDid);
        this.follows = optimistic;
      },
      write: (records) => records.deleteFollow(rkey),
      confirm: () => {},
      rollback: () => {
        const rollback = new Map(this.follows);
        rollback.set(subjectDid, uri);
        this.follows = rollback;
      },
    });
  }

  async toggle(viewerDid: string, subjectDid: string): Promise<void> {
    if (this.isFollowing(subjectDid)) {
      await this.unfollow(subjectDid);
    } else {
      await this.follow(viewerDid, subjectDid);
    }
  }
}

export const followsStore = new FollowsStore();

export async function importFollows(subjects: readonly string[]): Promise<number> {
  let written = 0;
  const now = new Date().toISOString();

  for (const batch of chunk(subjects, APPLY_WRITES_LIMIT)) {
    await hatkRecords.createFollows(batch, now);
    written += batch.length;
  }

  return written;
}

export function hasDismissedFollowImport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(IMPORT_DISMISSED_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissFollowImport(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IMPORT_DISMISSED_KEY, "1");
  } catch {}
}
