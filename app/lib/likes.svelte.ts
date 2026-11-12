import { type Mutations, rkeyFromUri } from "$lib/mutations.ts";
import { mutations as defaultMutations } from "$lib/records.ts";

export interface LikeSubject {
  readonly uri: string;
  readonly cid: string;
  readonly count: number;
  readonly viewerLike?: string;
}

export class LikeToggle {
  pending = $state(false);
  #override = $state<{
    forUri: string;
    count: number;
    likeUri: string | undefined;
  } | null>(null);
  #optimisticActive = $state<boolean | undefined>(undefined);
  #animState = $state<{
    forUri: string;
    key: number;
    kind: "bounce" | "shrink";
  } | null>(null);

  private readonly readSubject: () => LikeSubject;
  private readonly runner: Mutations;

  constructor(readSubject: () => LikeSubject, runner: Mutations = defaultMutations) {
    this.readSubject = readSubject;
    this.runner = runner;
  }

  private get currentOverride() {
    const subject = this.readSubject();
    return this.#override?.forUri === subject.uri ? this.#override : null;
  }

  get count(): number {
    const current = this.currentOverride;
    return current ? current.count : this.readSubject().count;
  }

  get likeUri(): string | undefined {
    const current = this.currentOverride;
    return current ? current.likeUri : this.readSubject().viewerLike;
  }

  get active(): boolean {
    return this.#optimisticActive ?? Boolean(this.likeUri);
  }

  get animationKey(): number {
    const subject = this.readSubject();
    return this.#animState?.forUri === subject.uri ? this.#animState.key : 0;
  }

  get starAnimation(): "bounce" | "shrink" | undefined {
    const subject = this.readSubject();
    return this.#animState?.forUri === subject.uri ? this.#animState.kind : undefined;
  }

  async toggle(viewerDid: string | null | undefined): Promise<void> {
    if (!viewerDid || this.pending) return;
    this.pending = true;

    const subject = this.readSubject();
    const targetUri = subject.uri;
    const targetCid = subject.cid;
    const previousLikeUri = this.likeUri;
    const wasActive = Boolean(previousLikeUri);
    const previousCount = this.count;
    const nextCount = wasActive ? Math.max(0, previousCount - 1) : previousCount + 1;
    const nextAnimKey = this.animationKey + 1;

    try {
      await this.runner.run<{ likeUri: string | undefined }>({
        label: "Favourite",
        apply: () => {
          this.#optimisticActive = !wasActive;
          this.#override = {
            forUri: targetUri,
            count: nextCount,
            likeUri: previousLikeUri,
          };
          this.#animState = {
            forUri: targetUri,
            key: nextAnimKey,
            kind: wasActive ? "shrink" : "bounce",
          };
        },
        write: async (records) => {
          if (previousLikeUri) {
            const rkey = rkeyFromUri(previousLikeUri);
            if (!rkey) throw new Error("That isn't a like URI.");
            await records.deleteLike(rkey);
            return { likeUri: undefined };
          }
          const res = await records.createLike(viewerDid, { uri: targetUri, cid: targetCid });
          return { likeUri: res.uri };
        },
        confirm: (result) => {
          this.#override = { forUri: targetUri, count: nextCount, likeUri: result.likeUri };
          this.#optimisticActive = undefined;
        },
        rollback: () => {
          this.#override = { forUri: targetUri, count: previousCount, likeUri: previousLikeUri };
          this.#optimisticActive = undefined;
        },
      });
    } finally {
      this.pending = false;
    }
  }
}
