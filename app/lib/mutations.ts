export const FOLLOW_COLLECTION = "net.ratat.graph.follow" as const;
export const LIKE_COLLECTION = "app.bsky.feed.like" as const;
export const APPLY_WRITES_LIMIT = 200;

export interface RecordWriter {
  createFollow(repo: string, subject: string): Promise<{ uri?: string }>;
  deleteFollow(rkey: string): Promise<void>;
  createFollows(subjects: readonly string[], createdAt: string): Promise<void>;
  createLike(repo: string, subject: { uri: string; cid: string }): Promise<{ uri?: string }>;
  deleteLike(rkey: string): Promise<void>;
}

export interface OptimisticChange<T> {
  readonly label: string;
  apply(): void;
  write(records: RecordWriter): Promise<T>;
  confirm(result: T): void;
  rollback(): void;
}

export class Mutations {
  readonly records: RecordWriter;
  private readonly notifyError: (message: string) => void;

  constructor(records: RecordWriter, notifyError: (message: string) => void) {
    this.records = records;
    this.notifyError = notifyError;
  }

  async run<T>(change: OptimisticChange<T>): Promise<boolean> {
    change.apply();
    try {
      const res = await change.write(this.records);
      change.confirm(res);
      return true;
    } catch (cause) {
      change.rollback();
      const detail = cause instanceof Error ? cause.message : "That didn't work.";
      this.notifyError(`${change.label} failed: ${detail}`);
      return false;
    }
  }
}

export function rkeyFromUri(uri: string): string | undefined {
  const rkey = uri.split("/").pop();
  return rkey ? rkey : undefined;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
