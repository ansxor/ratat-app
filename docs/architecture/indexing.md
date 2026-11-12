# Indexing: the interested set, backfill, and the live tail

Ratat is a gallery over Bluesky built on Hatk. It stores no blobs of its own:
an artwork is an `app.bsky.feed.post` in somebody's repo, and images live on
Bluesky's CDN (or via Hatk's `/blob/{did}/{cid}` proxy when running against a
local dev PDS). What the local SQLite index (`data/hatk.db` locally,
`/data/hatk.db` in production) answers is one narrow question — **which posts
and actors do we know about** — so that a page view does not turn into a walk
over the public appview.

Hatk manages schema creation by convention from `lexicons/`: `"app.bsky.feed.post"`,
`"app.bsky.actor.profile"`, `"app.bsky.feed.like"`, and `"net.ratat.graph.follow"`
are created automatically alongside Hatk's internal metadata tables (`_repos`,
`_cursor`, `_labels`). Auxiliary like-counter tables are created by
`server/setup/01-tables.ts`.

Everything here is on-demand. Ratat does not backfill the whole network and
stores no blobs.

## The interested set (`_repos`)

A DID with a row in Hatk's `_repos` table is tracked (`pending` while waiting
for backfill, `active` once imported). Nothing else gates ingest.

A DID enters `_repos` when:

| Trigger                                                   | Where                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Somebody opens their profile                              | `server/xrpc/getProfile.ts` via `noteInterest(did)` (`POST /repos/add`)                 |
| Somebody reads their feed, even before we know the handle | `server/xrpc/getAuthorFeed.ts` via `noteInterest(did)` (`POST /repos/add`)              |
| Somebody opens one of their artworks                      | `server/xrpc/getPost.ts` via `noteInterest(did)` (`POST /repos/add`)                    |
| A user logs in via OAuth                                  | `server/on-login.ts` (`defineHook('on-login', ...)` calling `ctx.ensureRepo(ctx.did)`)  |
| Somebody Ratat-follows them                               | `hatk.config.ts` `backfill.references` on `net.ratat.graph.follow` (`field: 'subject'`) |

Read-path marking (`noteInterest` in `server/_interest.ts`) fires an
asynchronous `POST http://127.0.0.1:${PORT}/repos/add` request to the Hatk
server itself. **Invariant:** read-path interest marking must never fail a
request — network or server errors are swallowed so the page still renders from
the live fallback and the DID is queued on a later visit.

The set only grows. That is fine at v1 scale and is the first thing to revisit:
see _Limits_ below.

## Backfill via Hatk

Once a DID enters `_repos` in `pending` state, Hatk's built-in backfill worker
fetches the repository CAR archive directly from the actor's PDS via
`com.atproto.sync.getRepo` (locating the PDS through the DID document at
`DID_PLC_URL`), indexes records matching the configured collections, and marks
the repo `active`.

Choices worth knowing:

- **Signal scoping.** `hatk.config.ts` sets `backfill.signalCollections:
  ['net.ratat.graph.follow']` and `backfill.fullNetwork: false`. Listing
  `app.bsky.feed.post` as a signal collection would trigger full-network
  auto-backfills for every account on Bluesky; scoping to `net.ratat.graph.follow`
  keeps indexing limited to Ratat-followed artists and explicitly added DIDs.
- **Bounded concurrency.** `backfill.parallelism` (default `3`),
  `backfill.fetchTimeout`, and `backfill.maxRetries` control PDS load and
  back-off on failed repo imports.
- **Media extraction on read/view.** `server/_media.ts` extracts image and
  video metadata (`app.bsky.embed.images`, `app.bsky.embed.video`, and
  `app.bsky.embed.recordWithMedia`) into `net.ratat.feed.defs#imageView` and
  `#videoView` shapes, routing local dev blobs through `/blob/{did}/{cid}` when
  `isLocalRelay()` is true and Bluesky CDN URLs otherwise.

## The Ratat graph

`net.ratat.graph.follow` is the one custom record Ratat writes, and it lives in
the follower's repo. Hatk indexes it into `"net.ratat.graph.follow"` because
the home timeline is a SQL join over it, and because being followed is what
makes an artist worth indexing.

- **Real-time writes.** Hatk's stream consumer picks up `net.ratat.graph.follow`
  creates and deletes from the relay/PDS stream.
- **Reference backfill.** Because `hatk.config.ts` configures
  `backfill.references: [{ collection: 'net.ratat.graph.follow', field: 'subject' }]`,
  indexing a follow automatically enqueues the followed artist's repo into
  `_repos` so their artworks and profile are backfilled.
- **Followers and following queries.** `server/xrpc/getFollows.ts` and
  `server/xrpc/getFollowers.ts` query `"net.ratat.graph.follow"` joined with
  `_repos` and `"app.bsky.actor.profile"`, reporting `indexed: true` once the
  target repo is `active` in `_repos` (so the frontend knows when to fall back
  to the viewer's own PDS via `net.ratat.graph.listBskyFollows`).

Duplicate follows of the same subject are tolerated rather than constrained: a
repo may hold several, and the timeline join collapses them.

## Live sync and the like-count mirror

Hatk's built-in firehose consumer subscribes to the configured relay
(`ws://localhost:2583` in dev, `wss://bsky.network` in production) and keeps
indexed repos up to date as `app.bsky.feed.post`, `app.bsky.actor.profile`,
`app.bsky.feed.like`, and `net.ratat.graph.follow` commits arrive.

**The like-count mirror (`server/_like-tail.ts`):** a like (`app.bsky.feed.like`)
lives in the _liker's_ repo, not the artwork author's repo, so a repo-scoped
index of tracked artists would miss likes from arbitrary Bluesky accounts.

To maintain live like counts in production without indexing the entire network:

1. `server/setup/01-tables.ts` creates two auxiliary SQLite tables:
   `ratat_like_count (uri TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)`
   and `ratat_counted_like (uri TEXT PRIMARY KEY, subject_uri TEXT NOT NULL)`.
2. When `JETSTREAM_LIKE_TAIL !== 'false'` and `JETSTREAM_URL` is configured,
   `01-tables.ts` starts `server/_like-tail.ts`, which connects to Jetstream for
   `app.bsky.feed.like` events.
3. On a like create whose subject post belongs to a tracked DID in `_repos`,
   `_like-tail.ts` records the like URI in `ratat_counted_like` and increments
   `ratat_like_count` once.
4. Like **deletes** arrive with no record payload and therefore no subject URI.
   `_like-tail.ts` looks up the deleted like's URI in `ratat_counted_like`,
   removes it, and decrements `ratat_like_count`.

Set `JETSTREAM_LIKE_TAIL=false` (or leave `JETSTREAM_URL` unset in local dev) to
disable the global like tail; handlers also read `"app.bsky.feed.like"` counts
directly for locally indexed likes.

## Reads, live fallback, and cursors

Handlers read from SQLite once an actor's repo is `active` in `_repos`, and fall
back to the public Bluesky appview (`BSKY_APPVIEW_URL`, default
`https://public.api.bsky.app`) via `server/_bsky.ts` when an actor or post is
not yet indexed:

- **`net.ratat.actor.getProfile`** (`server/xrpc/getProfile.ts`): fetches the
  live Bluesky profile for fresh Bluesky follower/following counts, falling back
  to `"app.bsky.actor.profile"` + `_repos` when offline or querying local-only
  seeded accounts; overlays Ratat graph counts from `"net.ratat.graph.follow"`
  and media `postsCount` when active; triggers `noteInterest` asynchronously.
- **`net.ratat.feed.getAuthorFeed`** (`server/xrpc/getAuthorFeed.ts`): checks
  `isRepoActive(db, actorDid)`. If `active`, queries `"app.bsky.feed.post"`
  filtered to media embeds, supporting `sample: true`, 1-based `page` offsets
  with `total`, and keyset `cursor` (an active account with 0 media posts returns
  an empty page rather than falling back to live). If untracked or `pending`,
  falls back to live `app.bsky.feed.getAuthorFeed` and calls `noteInterest`.
- **`net.ratat.feed.getPost`** (`server/xrpc/getPost.ts`): looks up the post in
  `"app.bsky.feed.post"` first; if absent, fetches live via `app.bsky.feed.getPosts`
  and calls `noteInterest`.
- **`net.ratat.actor.searchActorsTypeahead`** (`server/xrpc/searchActorsTypeahead.ts`):
  queries local `_repos` / `"app.bsky.actor.profile"` rows and merges live
  results from `app.bsky.actor.searchActorsTypeahead`, deduplicating by DID so
  both seeded local accounts and live Bluesky artists appear.

**Cursors (`server/_cursor.ts`):**

- The indexed path mints base64url keyset cursors (`createdAtMillis|uri` via
  `encodeFeedCursor` / `decodeFeedCursor`).
- The live fallback path receives opaque upstream cursors from the public
  appview and caches page-to-cursor mappings in memory (`rememberCursor` /
  `nearestCursor`) so multi-page walks do not lose position.
- **Invariant:** the indexed path checks cursor format and refuses foreign
  (upstream/opaque) cursors rather than paging from nonsense.

**Timeline (`net.ratat.feed.getTimeline`, `server/xrpc/getTimeline.ts`):**
**No live fallback.** The home feed is a SQL join between `"app.bsky.feed.post"`
and `"net.ratat.graph.follow"` for the viewer's DID, paged by 1-based `page`
offset with `total`. Because the Ratat follow graph exists only in Ratat's
index, an unreachable index cannot fall back to Bluesky's appview. A followed
artist contributes posts as soon as Hatk finishes importing their repo.

### What is not indexed

- **Bluesky profile stats.** Bluesky follower, following, and post counts in
  `getProfile` come live from `BSKY_APPVIEW_URL` (falling back to local tables
  only when offline or for local dev accounts) so they do not go stale.
- **Viewer state.** Whether _you_ liked a post (`viewerLike`) is resolved from
  indexed `"app.bsky.feed.like"` records or the authenticated viewer's PDS/OAuth
  session rather than precomputed per viewer.
- **Maintained reply and repost counts.** Replies and reposts would each require
  their own global firehose tail and are not mirrored.

## Limits, and what to watch

- **`_repos` only grows.** Without an eviction policy, tracked repos accumulate
  over time; if scaling to >10,000 tracked DIDs with Jetstream pinning,
  Jetstream's 10,000-DID filter cap applies.
- **`ratat_counted_like` grows with every counted like** so deletes can be
  attributed back to `ratat_like_count`.
- **The global like tail consumes real bandwidth** — every `app.bsky.feed.like`
  on Bluesky is decoded and filtered against `_repos`. `JETSTREAM_LIKE_TAIL=false`
  disables it.
- **Backfill is a point-in-time CAR import.** A repo that finished importing
  gets subsequent updates from the stream, while large accounts wait in Hatk's
  `backfill.parallelism` queue behind earlier entries.

## Configuration

| Variable                 | Default                                                   | What it does                                                       |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------ |
| `PORT`                   | `3000`                                                    | HTTP port for the Hatk backend and SvelteKit frontend.             |
| `DATABASE`               | `data/hatk.db`                                            | SQLite database path (`/data/hatk.db` in production).              |
| `RELAY`                  | `ws://localhost:2583` (`wss://bsky.network` in prod)      | Firehose relay WebSocket URL consumed by Hatk.                     |
| `DID_PLC_URL`            | `http://localhost:2582` (`https://plc.directory` in prod) | PLC directory URL for DID and PDS resolution.                      |
| `BSKY_APPVIEW_URL`       | `https://public.api.bsky.app`                             | Public Bluesky AppView for live fallback reads and search.         |
| `JETSTREAM_URL`          | `wss://jetstream1.us-east.bsky.network`                   | Jetstream endpoint used by `server/_like-tail.ts`.                 |
| `JETSTREAM_LIKE_TAIL`    | `true`                                                    | Mirror global `app.bsky.feed.like` events into `ratat_like_count`. |
| `BACKFILL_PARALLELISM`   | `3`                                                       | Concurrent repo CAR backfills in Hatk.                             |
| `BACKFILL_FETCH_TIMEOUT` | `300`                                                     | Per-repo CAR fetch timeout in seconds.                             |
| `BACKFILL_MAX_RETRIES`   | `5`                                                       | Max retries for failed repo backfills.                             |
| `OAUTH_ISSUER`           | `http://127.0.0.1:{port}`                                 | Public OAuth issuer URL in production.                             |
