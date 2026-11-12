import { AppviewError, ProfileNotFoundError, actorRequestFailed } from "./_errors.ts";
import {
  type Blobs,
  applyHatkLabels,
  bskyProfileUrl,
  selfLabelValues,
  storedLabels,
  toIsoString,
} from "./_atproto.ts";
import {
  type Db,
  type Reads,
  countArtworks,
  countFollowers,
  countFollows,
  isIndexed,
  placeholders,
} from "./_index.ts";
import type {
  Appview,
  BskyProfileViewBasic,
  BskyProfileViewDetailed,
  BskyTypeaheadResponse,
  Live,
} from "./_live.ts";
import { Page, type Viewable, clampLimit } from "./_paging.ts";

export interface ProfileViewBasic {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface ProfileView {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  labels: string[];
  bskyUrl: string;
  indexedAt?: string;
}

export interface ProfileCountsData {
  readonly followers?: number;
  readonly follows?: number;
  readonly posts?: number;
}

export const ProfileCounts = {
  async read(did: string, db: Db): Promise<ProfileCountsData> {
    const [followers, follows, active] = await Promise.all([
      countFollowers(db, did),
      countFollows(db, did),
      isIndexed(db, did),
    ]);
    if (!active) {
      return { followers, follows };
    }
    const posts = await countArtworks(db, did);
    return { followers, follows, posts };
  },
};

export interface ProfileRecord {
  readonly did: string;
  view(blobs: Blobs, counts?: ProfileCountsData): ProfileView;
}

export interface LocalActorData {
  readonly did: string;
  readonly handle?: string | null;
  readonly displayName?: string | null;
  readonly display_name?: string | null;
  readonly description?: string | null;
  readonly avatar?: unknown;
  readonly banner?: unknown;
  readonly followersCount?: number;
  readonly followsCount?: number;
  readonly postsCount?: number;
  readonly labels?: unknown;
  readonly indexedAt?: string | Date | null;
  readonly indexed_at?: string | Date | null;
}

interface RepoRow {
  did: string;
  handle: string | null;
  status: string;
}

interface ProfileRow {
  uri: string;
  did: string;
  display_name: string | null;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  labels: string | null;
  indexed_at: string;
}

interface LocalActorRow {
  did: string;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
}

function readDisplayName(actor: {
  displayName?: string | null;
  display_name?: string | null;
}): string | undefined {
  const name = actor.displayName ?? actor.display_name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

function buildProfileView(
  profile: BskyProfileViewDetailed | LocalActorData,
  counts: ProfileCountsData | undefined,
  blobs: Blobs,
): ProfileView {
  const handle = profile.handle && profile.handle.length > 0 ? profile.handle : profile.did;
  const displayName = readDisplayName(profile);
  const description =
    typeof profile.description === "string" && profile.description.length > 0
      ? profile.description
      : undefined;
  const avatar = blobs.stored(profile.did, profile.avatar, "avatar");
  const banner = blobs.stored(profile.did, profile.banner, "banner");
  const followersCount = counts?.followers ?? profile.followersCount;
  const followsCount = counts?.follows ?? profile.followsCount;
  const postsCount = counts?.posts ?? profile.postsCount;
  const labels = storedLabels(profile.labels);
  const indexedAt = toIsoString(
    profile.indexedAt ?? ("indexed_at" in profile ? profile.indexed_at : undefined),
  );

  return {
    did: profile.did,
    handle,
    ...(displayName ? { displayName } : {}),
    ...(description ? { description } : {}),
    ...(avatar ? { avatar } : {}),
    ...(banner ? { banner } : {}),
    ...(followersCount === undefined ? {} : { followersCount }),
    ...(followsCount === undefined ? {} : { followsCount }),
    ...(postsCount === undefined ? {} : { postsCount }),
    labels,
    bskyUrl: bskyProfileUrl(handle),
    ...(indexedAt ? { indexedAt } : {}),
  };
}

export class IndexedProfile implements ProfileRecord {
  readonly did: string;
  private readonly data: LocalActorData;

  constructor(data: LocalActorData) {
    this.did = data.did;
    this.data = data;
  }

  view(blobs: Blobs, counts?: ProfileCountsData): ProfileView {
    return buildProfileView(this.data, counts, blobs);
  }
}

export class LiveProfile implements ProfileRecord {
  readonly did: string;
  private readonly raw: BskyProfileViewDetailed;

  constructor(raw: BskyProfileViewDetailed) {
    this.did = raw.did;
    this.raw = raw;
  }

  view(blobs: Blobs, counts?: ProfileCountsData): ProfileView {
    return buildProfileView(this.raw, counts, blobs);
  }
}

export class IndexedActor implements Viewable<ProfileViewBasic> {
  readonly did: string;
  private readonly data: LocalActorData;

  constructor(data: LocalActorData) {
    this.did = data.did;
    this.data = data;
  }

  static placeholder(did: string): IndexedActor {
    return new IndexedActor({ did, handle: did });
  }

  static async readAuthor(db: Db, did: string): Promise<LocalActorData> {
    const [repos, profiles] = await Promise.all([
      db.query(`SELECT handle FROM _repos WHERE did = $1 LIMIT 1`, [did]) as Promise<
        Array<{ handle: string | null }>
      >,
      db.query(
        `SELECT display_name, avatar FROM "app.bsky.actor.profile" WHERE did = $1 ORDER BY indexed_at DESC LIMIT 1`,
        [did],
      ) as Promise<Array<{ display_name: string | null; avatar: string | null }>>,
    ]);

    const handle = repos[0]?.handle;
    const profile = profiles[0];

    return {
      did,
      handle: handle && !handle.startsWith("did:") ? handle : did,
      ...(profile?.display_name ? { displayName: profile.display_name } : {}),
      ...(profile?.avatar ? { avatar: profile.avatar } : {}),
    };
  }

  static async readMany(db: Db, dids: readonly string[]): Promise<Map<string, IndexedActor>> {
    const result = new Map<string, IndexedActor>();
    if (dids.length === 0) return result;

    const unique = [...new Set(dids)];
    const inList = placeholders(unique.length);

    const localRows = (await db.query(
      `SELECT r.did, r.handle,
              (SELECT ap.display_name FROM "app.bsky.actor.profile" ap WHERE ap.did = r.did ORDER BY ap.indexed_at DESC LIMIT 1) AS display_name,
              (SELECT ap.avatar FROM "app.bsky.actor.profile" ap WHERE ap.did = r.did ORDER BY ap.indexed_at DESC LIMIT 1) AS avatar
       FROM _repos r
       WHERE r.did IN (${inList})`,
      unique,
    )) as LocalActorRow[];

    for (const row of localRows) {
      if (!row.handle || row.handle.startsWith("did:")) continue;
      result.set(
        row.did,
        new IndexedActor({
          did: row.did,
          handle: row.handle,
          ...(row.display_name ? { displayName: row.display_name } : {}),
          ...(row.avatar ? { avatar: row.avatar } : {}),
        }),
      );
    }

    return result;
  }

  view(blobs: Blobs): ProfileViewBasic {
    const handle =
      this.data.handle && this.data.handle.length > 0 ? this.data.handle : this.data.did;
    const displayName = readDisplayName(this.data);
    const avatar = blobs.stored(this.data.did, this.data.avatar, "avatar");
    return {
      did: this.data.did,
      handle,
      ...(displayName ? { displayName } : {}),
      ...(avatar ? { avatar } : {}),
    };
  }
}

export class LiveActor implements Viewable<ProfileViewBasic> {
  readonly did: string;
  private readonly raw: BskyProfileViewBasic;

  constructor(raw: BskyProfileViewBasic) {
    this.did = raw.did;
    this.raw = raw;
  }

  view(_blobs?: Blobs): ProfileViewBasic {
    return {
      did: this.raw.did,
      handle: this.raw.handle,
      ...(this.raw.displayName ? { displayName: this.raw.displayName } : {}),
      ...(this.raw.avatar ? { avatar: this.raw.avatar } : {}),
    };
  }
}

export type ActorRecord = IndexedActor | LiveActor;

async function findRepoByActor(db: Db, actor: string): Promise<{ did: string } | undefined> {
  try {
    const rows = (
      actor.startsWith("did:")
        ? await db.query("SELECT did FROM _repos WHERE did = $1 LIMIT 1", [actor])
        : await db.query("SELECT did FROM _repos WHERE LOWER(handle) = LOWER($1) LIMIT 1", [actor])
    ) as Array<{ did: string }>;
    return rows[0];
  } catch {
    return undefined;
  }
}

async function loadLocalActor(
  db: Db,
  actor: string,
): Promise<{ repo: RepoRow; profile?: ProfileRow } | undefined> {
  const byDid = actor.startsWith("did:");
  const repoRows = (await db.query(
    byDid
      ? `SELECT did, handle, status FROM _repos WHERE did = $1 LIMIT 1`
      : `SELECT did, handle, status FROM _repos WHERE lower(handle) = lower($1) LIMIT 1`,
    [actor],
  )) as RepoRow[];

  const repo = repoRows[0];
  if (!repo) return undefined;

  const profileRows = (await db.query(
    `SELECT uri, did, display_name, description, avatar, banner, labels, indexed_at
     FROM "app.bsky.actor.profile"
     WHERE did = $1
     ORDER BY indexed_at DESC
     LIMIT 1`,
    [repo.did],
  )) as ProfileRow[];

  return { repo, profile: profileRows[0] };
}

export class ActorRef {
  readonly raw: string;

  private constructor(raw: string) {
    this.raw = raw;
  }

  static parse(raw: string): ActorRef {
    return new ActorRef(raw.trim());
  }

  async resolve(db: Db, appview: Appview, signal?: AbortSignal): Promise<string> {
    if (!this.raw) throw new ProfileNotFoundError(this.raw);
    if (this.raw.startsWith("did:")) return this.raw;

    const repo = await findRepoByActor(db, this.raw);
    if (repo?.did) return repo.did;

    try {
      const profile = await appview.get<{ did: string }>(
        "app.bsky.actor.getProfile",
        { actor: this.raw },
        signal,
      );
      return profile.did;
    } catch (err) {
      if (err instanceof AppviewError) {
        throw actorRequestFailed(this.raw, { error: err.errorCode, message: err.message });
      }
      throw err;
    }
  }

  async profile(reads: Reads, live: Live): Promise<ProfileRecord> {
    if (!this.raw) throw new ProfileNotFoundError(this.raw);

    let remote: BskyProfileViewDetailed | undefined;
    let upstreamError: unknown;

    const localFirst = this.raw.endsWith(".test")
      ? await loadLocalActor(reads.db, this.raw)
      : undefined;

    if (!localFirst) {
      try {
        remote = await live.appview.get<BskyProfileViewDetailed>("app.bsky.actor.getProfile", {
          actor: this.raw,
        });
      } catch (err) {
        upstreamError = err;
      }
    }

    if (remote) {
      return new LiveProfile(remote);
    }

    const local = localFirst ?? (await loadLocalActor(reads.db, this.raw));
    if (!local) {
      if (upstreamError) throw upstreamError;
      throw new ProfileNotFoundError(this.raw);
    }

    const { repo, profile } = local;
    const handle = repo.handle && !repo.handle.startsWith("did:") ? repo.handle : repo.did;

    let parsedLabels: unknown;
    if (profile?.labels) {
      try {
        parsedLabels = JSON.parse(profile.labels);
      } catch {
        parsedLabels = undefined;
      }
    }
    const selfLabels = selfLabelValues({ labels: parsedLabels });
    const recordLabelsMap = profile?.uri
      ? await reads.labels([profile.uri, repo.did])
      : await reads.labels([repo.did]);
    const extraLabels = [
      ...(profile?.uri ? (recordLabelsMap.get(profile.uri) ?? []) : []),
      ...(recordLabelsMap.get(repo.did) ?? []),
    ];
    const mergedLabels = applyHatkLabels(selfLabels, extraLabels);

    return new IndexedProfile({
      did: repo.did,
      handle,
      ...(profile?.display_name ? { displayName: profile.display_name } : {}),
      ...(profile?.description ? { description: profile.description } : {}),
      ...(profile?.avatar ? { avatar: profile.avatar } : {}),
      ...(profile?.banner ? { banner: profile.banner } : {}),
      labels: mergedLabels,
      ...(profile?.indexed_at ? { indexedAt: profile.indexed_at } : {}),
    });
  }
}

export class ActorSearch {
  readonly query: string;
  readonly limit: number;

  private constructor(query: string, limit: number) {
    this.query = query;
    this.limit = limit;
  }

  static parse(params: { q: string; limit?: unknown }): ActorSearch {
    return new ActorSearch(params.q.trim(), clampLimit(params.limit, 8, 25));
  }

  async run(db: Db, appview: Appview): Promise<Page<ProfileViewBasic, Record<string, never>>> {
    if (this.query.length === 0) {
      return new Page([], {});
    }

    const escaped = this.query.replace(/[\\%_]/g, "\\$&");
    const containsPattern = `%${escaped}%`;
    const prefixPattern = `${escaped}%`;

    const localRows = (await db.query(
      `SELECT r.did, r.handle, p.display_name, p.avatar
       FROM _repos r
       LEFT JOIN "app.bsky.actor.profile" p ON p.did = r.did
       WHERE (r.status IS NULL OR r.status != 'takendown')
         AND r.handle IS NOT NULL
         AND (
           lower(r.handle) LIKE lower($1) ESCAPE '\\'
           OR lower(COALESCE(p.display_name, '')) LIKE lower($1) ESCAPE '\\'
         )
       ORDER BY
         CASE
           WHEN lower(r.handle) LIKE lower($2) ESCAPE '\\' THEN 0
           WHEN lower(COALESCE(p.display_name, '')) LIKE lower($2) ESCAPE '\\' THEN 1
           ELSE 2
         END,
         r.handle ASC
       LIMIT $3`,
      [containsPattern, prefixPattern, this.limit],
    )) as LocalActorRow[];

    const actors: ActorRecord[] = [];
    const seenDids = new Set<string>();

    for (const row of localRows) {
      if (!row.did || seenDids.has(row.did)) continue;
      seenDids.add(row.did);
      actors.push(
        new IndexedActor({
          did: row.did,
          handle: row.handle ?? row.did,
          ...(row.display_name ? { displayName: row.display_name } : {}),
          ...(row.avatar ? { avatar: row.avatar } : {}),
        }),
      );
    }

    if (actors.length < this.limit) {
      try {
        const upstream = await appview.get<BskyTypeaheadResponse>(
          "app.bsky.actor.searchActorsTypeahead",
          { q: this.query, limit: this.limit },
        );
        for (const candidate of upstream.actors ?? []) {
          if (!candidate.did || seenDids.has(candidate.did)) continue;
          seenDids.add(candidate.did);
          actors.push(new LiveActor(candidate));
          if (actors.length >= this.limit) break;
        }
      } catch {}
    }

    return new Page(actors.slice(0, this.limit), {});
  }
}
