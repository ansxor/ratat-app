import { AtUri } from "./_atproto.ts";

export interface LikeTailDb {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  run: (sql: string, params?: unknown[]) => Promise<void>;
}

export interface LikeTailConfig {
  readonly url: string;
  readonly didRefreshMs: number;
  readonly checkpointEvery: number;
}

export type LikeEvent =
  | {
      readonly kind: "like";
      readonly timeUs?: number;
      readonly likeUri: string;
      readonly subjectUri: string;
      readonly subjectAuthor: string;
    }
  | {
      readonly kind: "unlike";
      readonly timeUs?: number;
      readonly likeUri: string;
    }
  | {
      readonly kind: "tick";
      readonly timeUs?: number;
    };

export interface LikeStore {
  trackedDids(): Promise<Set<string>>;
  countedLikes(): Promise<Set<string>>;
  readCursor(): Promise<string | undefined>;
  writeCursor(timeUs: number): Promise<void>;
  countLike(likeUri: string, subjectUri: string): Promise<boolean>;
  uncountLike(likeUri: string): Promise<void>;
}

export interface LikeSocket {
  addEventListener(type: "open" | "close" | "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  close(): void;
}

export type LikeSocketFactory = (url: string) => LikeSocket;

interface JetstreamLikeEvent {
  did?: string;
  time_us?: number;
  kind?: string;
  commit?: {
    operation?: string;
    collection?: string;
    rkey?: string;
    record?: {
      subject?: {
        uri?: string;
      };
    };
  };
}

const LIKE_COLLECTION = "app.bsky.feed.like";
const CURSOR_KEY = "jetstream:likes";

export function likeTailConfig(env: NodeJS.ProcessEnv = process.env): LikeTailConfig | undefined {
  if (env.VITEST) return undefined;
  if (env.JETSTREAM_LIKE_TAIL === "false") return undefined;

  const url = env.JETSTREAM_URL?.trim();
  if (!url) return undefined;

  return {
    url,
    didRefreshMs: Math.max(5, Number(env.JETSTREAM_DID_REFRESH_SECONDS) || 30) * 1000,
    checkpointEvery: Math.max(1, Number(env.JETSTREAM_CHECKPOINT_EVERY) || 50),
  };
}

export function parseJetstreamEvent(raw: string): LikeEvent | undefined {
  let event: JetstreamLikeEvent;
  try {
    event = JSON.parse(raw) as JetstreamLikeEvent;
  } catch {
    return undefined;
  }

  const timeUs =
    typeof event.time_us === "number" && Number.isFinite(event.time_us) ? event.time_us : undefined;

  if (event.kind !== "commit" || !event.did || !event.commit) {
    return { kind: "tick", timeUs };
  }

  const commit = event.commit;
  if (commit.collection !== LIKE_COLLECTION || !commit.rkey) {
    return { kind: "tick", timeUs };
  }

  const likeUri = `at://${event.did}/${LIKE_COLLECTION}/${commit.rkey}`;

  if (commit.operation === "delete") {
    return { kind: "unlike", timeUs, likeUri };
  }

  if (commit.operation !== "create" && commit.operation !== "update") {
    return { kind: "tick", timeUs };
  }

  const subjectUri = commit.record?.subject?.uri;
  if (typeof subjectUri !== "string") {
    return { kind: "tick", timeUs };
  }

  const subjectAuthor = AtUri.parse(subjectUri)?.repo;
  if (!subjectAuthor) {
    return { kind: "tick", timeUs };
  }

  return { kind: "like", timeUs, likeUri, subjectUri, subjectAuthor };
}

export class LikeMirror implements LikeStore {
  private readonly db: LikeTailDb;

  constructor(db: LikeTailDb) {
    this.db = db;
  }

  static async createTables(db: {
    run: (sql: string, params?: unknown[]) => Promise<void>;
  }): Promise<void> {
    await db.run(`
      CREATE TABLE IF NOT EXISTS ratat_like_count (
        uri TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS ratat_counted_like (
        uri TEXT PRIMARY KEY,
        subject_uri TEXT NOT NULL
      )
    `);
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_ratat_counted_like_subject
      ON ratat_counted_like (subject_uri)
    `);
  }

  async trackedDids(): Promise<Set<string>> {
    const out = new Set<string>();
    const rows = (await this.db.query("SELECT did FROM _repos")) as Array<{ did?: string }>;
    for (const row of rows) {
      if (row.did) out.add(row.did);
    }
    return out;
  }

  async countedLikes(): Promise<Set<string>> {
    const out = new Set<string>();
    const rows = (await this.db.query("SELECT uri FROM ratat_counted_like")) as Array<{
      uri?: string;
    }>;
    for (const row of rows) {
      if (row.uri) out.add(row.uri);
    }
    return out;
  }

  async readCursor(): Promise<string | undefined> {
    try {
      const rows = (await this.db.query("SELECT value FROM _cursor WHERE key = $1 LIMIT 1", [
        CURSOR_KEY,
      ])) as Array<{ value?: string }>;
      const val = rows[0]?.value;
      return val && /^\d+$/.test(val) ? val : undefined;
    } catch {
      return undefined;
    }
  }

  async writeCursor(timeUs: number): Promise<void> {
    try {
      await this.db.run("INSERT OR REPLACE INTO _cursor (key, value) VALUES ($1, $2)", [
        CURSOR_KEY,
        String(timeUs),
      ]);
    } catch {}
  }

  async countLike(likeUri: string, subjectUri: string): Promise<boolean> {
    const existing = (await this.db.query(
      "SELECT 1 FROM ratat_counted_like WHERE uri = $1 LIMIT 1",
      [likeUri],
    )) as unknown[];
    if (existing.length > 0) return true;

    const postRows = (await this.db.query(
      'SELECT 1 FROM "app.bsky.feed.post" WHERE uri = $1 LIMIT 1',
      [subjectUri],
    )) as unknown[];
    if (postRows.length === 0) return false;

    await this.db.run(
      "INSERT OR IGNORE INTO ratat_counted_like (uri, subject_uri) VALUES ($1, $2)",
      [likeUri, subjectUri],
    );
    await this.db.run(
      "INSERT INTO ratat_like_count (uri, count) VALUES ($1, 1) ON CONFLICT(uri) DO UPDATE SET count = count + 1",
      [subjectUri],
    );
    return true;
  }

  async uncountLike(likeUri: string): Promise<void> {
    const rows = (await this.db.query(
      "SELECT subject_uri FROM ratat_counted_like WHERE uri = $1 LIMIT 1",
      [likeUri],
    )) as Array<{ subject_uri?: string }>;
    const subjectUri = rows[0]?.subject_uri;
    if (!subjectUri) return;
    await this.db.run("DELETE FROM ratat_counted_like WHERE uri = $1", [likeUri]);
    await this.db.run("UPDATE ratat_like_count SET count = MAX(count - 1, 0) WHERE uri = $1", [
      subjectUri,
    ]);
  }
}

export class LikeTail {
  private readonly store: LikeStore;
  private readonly config: LikeTailConfig;
  private readonly openSocket: LikeSocketFactory;

  private trackedDids = new Set<string>();
  private readonly counted = new Set<string>();
  private writeChain = Promise.resolve();
  private seen = 0;
  private lastTimeUs: number | null = null;
  private attempt = 0;
  private stopped = false;
  private socket: LikeSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    store: LikeStore,
    config: LikeTailConfig,
    openSocket: LikeSocketFactory = (url) => new WebSocket(url) as unknown as LikeSocket,
  ) {
    this.store = store;
    this.config = config;
    this.openSocket = openSocket;
  }

  private enqueue(task: () => Promise<void>): void {
    this.writeChain = this.writeChain.then(task).catch(() => {});
  }

  private async refreshTrackedDids(): Promise<void> {
    try {
      const dids = await this.store.trackedDids();
      this.trackedDids = dids;
    } catch {}
  }

  private async loadCountedLikes(): Promise<void> {
    try {
      const likes = await this.store.countedLikes();
      for (const uri of likes) {
        this.counted.add(uri);
      }
    } catch {}
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const baseDelay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempt, 5));
    const jitter = Math.floor(Math.random() * 500);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, baseDelay + jitter);
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const cursor =
      this.lastTimeUs !== null
        ? String(this.lastTimeUs)
        : await this.store.readCursor().catch(() => undefined);
    const url = new URL("/subscribe", this.config.url.replace(/\/$/, ""));
    url.searchParams.set("wantedCollections", LIKE_COLLECTION);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    let ws: LikeSocket;
    try {
      ws = this.openSocket(url.toString());
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket = ws;

    ws.addEventListener("open", () => {
      this.attempt = 0;
    });

    ws.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        this.handleRaw(event.data);
      }
    });

    ws.addEventListener("close", () => {
      if (this.socket === ws) this.socket = null;
      if (this.lastTimeUs !== null) {
        const snapshot = this.lastTimeUs;
        this.enqueue(() => this.store.writeCursor(snapshot));
      }
      this.scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {}
    });
  }

  async start(): Promise<void> {
    await Promise.all([this.refreshTrackedDids(), this.loadCountedLikes()]);
    if (this.stopped) return;
    this.refreshTimer = setInterval(() => {
      void this.refreshTrackedDids();
    }, this.config.didRefreshMs);
    await this.connect();
  }

  handleRaw(raw: string): void {
    const event = parseJetstreamEvent(raw);
    if (!event) return;

    if (event.timeUs !== undefined) {
      this.lastTimeUs = event.timeUs;
      this.seen++;
      if (this.seen % this.config.checkpointEvery === 0) {
        const snapshot = this.lastTimeUs;
        this.enqueue(() => this.store.writeCursor(snapshot));
      }
    }

    if (event.kind === "tick") return;

    if (event.kind === "unlike") {
      if (!this.counted.has(event.likeUri)) return;
      this.counted.delete(event.likeUri);
      this.enqueue(() => this.store.uncountLike(event.likeUri));
      return;
    }

    if (!this.trackedDids.has(event.subjectAuthor)) return;
    if (this.counted.has(event.likeUri)) return;

    this.counted.add(event.likeUri);
    this.enqueue(async () => {
      const ok = await this.store.countLike(event.likeUri, event.subjectUri);
      if (!ok) {
        this.counted.delete(event.likeUri);
      }
    });
  }

  flush(): Promise<void> {
    return this.writeChain;
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }
}

let activeTail: LikeTail | null = null;

export function startLikeTail(db: LikeTailDb): void {
  if (activeTail) return;
  const config = likeTailConfig();
  if (!config) return;
  activeTail = new LikeTail(new LikeMirror(db), config);
  void activeTail.start();
}
