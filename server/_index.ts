export interface Db {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
}

export interface Reads {
  readonly db: Db;
  readonly viewer: { readonly did: string; readonly handle?: string } | null;
  readonly labels: (uris: string[]) => Promise<Map<string, unknown[]>>;
}

export function mediaPostWhere(alias?: string): string {
  const col = alias ? `${alias}.embed` : "embed";
  return `(
    ${col} IS NOT NULL AND (
      (json_extract(${col}, '$.$type') = 'app.bsky.embed.images' AND json_array_length(${col}, '$.images') > 0)
      OR (json_extract(${col}, '$.$type') = 'app.bsky.embed.video' AND json_extract(${col}, '$.video') IS NOT NULL)
      OR (
        json_extract(${col}, '$.$type') = 'app.bsky.embed.recordWithMedia'
        AND (
          (json_extract(${col}, '$.media.$type') = 'app.bsky.embed.images' AND json_array_length(${col}, '$.media.images') > 0)
          OR (json_extract(${col}, '$.media.$type') = 'app.bsky.embed.video' AND json_extract(${col}, '$.media.video') IS NOT NULL)
        )
      )
    )
  )`;
}

export function placeholders(count: number, startIndex = 1): string {
  return Array.from({ length: count }, (_, i) => `$${startIndex + i}`).join(", ");
}

const tableExistsCache = new WeakMap<Db["query"], Map<string, Promise<boolean>>>();

export function tableExists(db: Db, table: string): Promise<boolean> {
  let byTable = tableExistsCache.get(db.query);
  if (!byTable) {
    byTable = new Map();
    tableExistsCache.set(db.query, byTable);
  }
  const cached = byTable.get(table);
  if (cached) return cached;

  const lookup = (
    db.query(`SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = $1 LIMIT 1`, [
      table,
    ]) as Promise<Array<{ found: number }>>
  ).then(
    (rows) => rows.length > 0,
    (err) => {
      byTable.delete(table);
      throw err;
    },
  );
  byTable.set(table, lookup);
  return lookup;
}

export async function isIndexed(db: Db, did: string): Promise<boolean> {
  try {
    const rows = (await db.query("SELECT status FROM _repos WHERE did = $1 LIMIT 1", [
      did,
    ])) as Array<{ status?: string }>;
    return rows[0]?.status === "active";
  } catch {
    return false;
  }
}

export async function likeCounts(db: Db, uris: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (uris.length === 0) return counts;

  const unique = [...new Set(uris)];
  const inList = placeholders(unique.length);
  const hasMirrored = await tableExists(db, "ratat_like_count");

  const indexedPromise = db.query(
    `SELECT subject_uri, CAST(COUNT(*) AS INTEGER) AS count
     FROM "app.bsky.feed.like"
     WHERE subject_uri IN (${inList})
     GROUP BY subject_uri`,
    unique,
  ) as Promise<Array<{ subject_uri: string; count: number }>>;

  const mirroredPromise = hasMirrored
    ? (db.query(
        `SELECT uri, count FROM ratat_like_count WHERE uri IN (${inList})`,
        unique,
      ) as Promise<Array<{ uri: string; count: number }>>)
    : Promise.resolve([]);

  const [indexedRows, mirroredRows] = await Promise.all([indexedPromise, mirroredPromise]);

  for (const row of indexedRows) {
    counts.set(row.subject_uri, Number(row.count) || 0);
  }
  for (const row of mirroredRows) {
    counts.set(row.uri, Math.max(counts.get(row.uri) ?? 0, Number(row.count) || 0));
  }

  return counts;
}

export async function countFollowers(db: Db, did: string): Promise<number> {
  const rows = (await db.query(
    `SELECT CAST(COUNT(DISTINCT did) AS INTEGER) AS count FROM "net.ratat.graph.follow" WHERE subject = $1`,
    [did],
  )) as Array<{ count?: number }>;
  return Number(rows[0]?.count ?? 0);
}

export async function countFollows(db: Db, did: string): Promise<number> {
  const rows = (await db.query(
    `SELECT CAST(COUNT(DISTINCT subject) AS INTEGER) AS count FROM "net.ratat.graph.follow" WHERE did = $1`,
    [did],
  )) as Array<{ count?: number }>;
  return Number(rows[0]?.count ?? 0);
}

export async function countArtworks(db: Db, did: string): Promise<number> {
  const rows = (await db.query(
    `SELECT CAST(COUNT(*) AS INTEGER) AS count FROM "app.bsky.feed.post" WHERE did = $1 AND ${mediaPostWhere()}`,
    [did],
  )) as Array<{ count?: number }>;
  return Number(rows[0]?.count ?? 0);
}
