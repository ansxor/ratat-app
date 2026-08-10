# Indexing: the interested set, backfill, and the live tail

Ratat is a gallery over Bluesky. It stores no content of its own: an artwork is
an `app.bsky.feed.post` in somebody's repo, and the images are on Bluesky's CDN.
What the local Postgres index answers is one narrow question — **which posts and
actors do we know about** — so that a page view does not turn into a walk over
the public appview.

Everything here is on-demand. Ratat does not classify the firehose, does not
mirror Bluesky, and stores no blobs.

## The interested set

An `actor` row with a non-null `interested_at` is _interested_. That is the only
membership test; nothing else gates ingest.

A DID becomes interested when:

| Trigger                                                   | Where                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Somebody opens their profile                              | `net.ratat.actor.getProfile`                                              |
| Somebody reads their feed, even before we know the handle | `net.ratat.feed.getAuthorFeed`, from the byline of the first post fetched |
| Somebody opens one of their artworks                      | `net.ratat.feed.getPost`                                                  |
| A user logs in                                            | falls out of the above — the masthead reads its own profile               |
| Somebody Ratat-follows them                               | `net.ratat.graph.follow` ingest — see _The Ratat graph_                   |

Marking is a background write on the read path (`noteInterestInBackground`). It
cannot fail a request: if Postgres is unreachable, the page still renders live
and the DID simply becomes interested the next time someone looks.

The same write refreshes the profile snapshot the index keeps — handle, display
name, avatar, banner, description. Optional fields `coalesce` over what is
already stored, so a byline-shaped snapshot (did/handle/avatar, all a feed read
knows) never erases the fuller one a profile visit wrote.

The set only grows. That is fine at v1 scale and is the first thing to revisit:
see _Limits_ below.

## Backfill

`apps/ingester` runs a worker that looks for the oldest interested DID with no
`backfilled_at`, and walks its whole Bluesky feed into the index:

```
getAuthorFeed(actor, filter=posts_with_media, includePins=false)
  → drop reposts and anything whose embed carries no media
  → upsert post rows, seeding like/reply/repost counts from the appview
  → next cursor, after a polite delay
  → when the cursor runs out, stamp backfilled_at
```

Choices worth knowing:

- **One DID at a time.** Parallel walks would multiply our load on a shared
  public appview to shave seconds off a wait nobody is watching.
- **`backfill_attempted_at` is stamped before the walk, not after.** A crash
  mid-backfill leaves the DID backed off by `BACKFILL_RETRY_MINUTES` instead of
  retried immediately on the next boot; a failure also records
  `backfill_error`.
- **No page cap by default.** `BACKFILL_MAX_PAGES` exists as a guard against a
  pathological account; when it fires, it logs that the rest of the portfolio is
  not indexed rather than quietly stopping.
- **Media is stored in view shape.** The `media` JSONB column holds exactly the
  `net.ratat.feed.defs#imageView` / `#videoView` objects the lexicon returns, so
  a read is a row fetch, not a re-render of blob refs.

## The Ratat graph

`net.ratat.graph.follow` is the one record Ratat writes, and it lives in the
follower's repo. The index mirrors it into `ratat_follow` because the home feed
is a join over it, and because being followed is what makes an artist worth
indexing at all.

Two ways a follow arrives:

- **The tail** (below) sees everything written from now on.
- **A one-off graph walk** covers what was written before. A repo is walked when
  somebody asks what it follows — `net.ratat.graph.getFollows` stamps
  `follows_wanted_at`, which is the queue the worker reads, and stamps
  `follows_backfilled_at` when done. The appview does not carry the collection,
  so the walk reads `com.atproto.repo.listRecords` from the actor's own PDS,
  found through their DID document.

Either way, indexing a follow marks its **subject** interested. The record
carries only a DID, so the first sighting of a subject fetches their profile
from the appview — an actor row needs a handle to render a byline.

`getFollows` reports `indexed: false` until the walk has happened. That is what
lets the web app fall back to reading the viewer's own repo, which is also the
only correct answer in the second after a follow is written.

Duplicate follows of the same subject are tolerated rather than constrained: a
repo may hold several, and the timeline join collapses them.

## The live tail

Three jetstream subscriptions, for three different reasons.

**`jetstream:posts`** is scoped by DID. Posts and profile edits live in the
author's own repo, so jetstream filters to the interested set for us
(`wantedDids`, re-read every `JETSTREAM_DID_REFRESH_SECONDS`). It handles:

- `app.bsky.feed.post` create/update → index if the record carries media;
  **delete the row if an edit stripped the media**, since a post without media
  is not an artwork.
- `app.bsky.feed.post` delete → drop the row. Takedowns matter here: we cache
  media _metadata_, and the images themselves stay on Bluesky's CDN, so a
  takedown there propagates on its own.
- `app.bsky.actor.profile` → refresh the byline snapshot. Records carry blob
  refs, not URLs, so the CDN URLs are rebuilt the way the appview builds them
  (`packages/common/src/blob.ts`) — a post indexed from the firehose and the
  same post indexed from a backfill agree.
- identity events → update the stored handle.

**`jetstream:likes`** cannot be scoped that way, and this is the expensive part
of the design. A like lives in the _liker's_ repo, and we do not know who will
like an artwork before they do — so this subscription is the whole
`app.bsky.feed.like` firehose. Filtering happens here:

1. The like's subject at-uri names the author. One string parse plus a set
   lookup against the interested DIDs drops nearly every event, without
   touching Postgres.
2. What survives goes to `applyLike`, which increments `post.like_count` only
   if we actually index that post, and only once.

Like **deletes** arrive with no record, and so no subject. That is why the
`post_like` table exists: it maps a like URI back to the post it was counted
against, for likes on our posts only. It is never read for display, and it is
loaded into memory at boot so a delete can be recognised without a query.

Set `JETSTREAM_LIKE_TAIL=false` to turn this half off; counts then stay at their
backfilled values.

**`jetstream:follows`** is unscoped for the same reason as the like tail — a
follow lives in the follower's repo — but costs nothing, because only Ratat
writes `net.ratat.graph.follow` and jetstream filters the collection upstream.
A create writes the row and marks the subject interested; a delete carries no
record, but the DID and rkey in the event name the row on their own.

Each subscription checkpoints its jetstream cursor to `ingestion_cursor` every
`JETSTREAM_CHECKPOINT_EVERY` events, and resumes from it on reconnect.

## Reads

`apps/xrpc-server` serves an actor from the index once `backfilled_at` is set,
and live from the public appview otherwise. The fallback is not only for the
first visit — **any** database failure falls back to live, including a server
started with no `DATABASE_URL` at all, which logs a warning and behaves exactly
as it did before this index existed.

What that buys, measured on `bsky.app` (168 indexed artworks, `limit=30`) against
a second server pointed at an unreachable database:

| Read   | Indexed | Live   |
| ------ | ------- | ------ |
| page 1 | 5.9 ms  | 351 ms |
| page 4 | 5.4 ms  | 560 ms |
| page 6 | 4.2 ms  | 240 ms |

The live column flatters itself: those requests ran in order against one process,
so pages 4 and 6 walked from a cursor page 1 had already cached. A cold jump to
page 4 pays one upstream request per page on the way.

Page numbers are offsets over `post_author_feed_idx (did, created_at desc, uri
desc)`, so a jump to page 40 costs the same as page 2. The cursor-walking path
and its memo (`cursor-cache.ts`) survive only for actors the index does not hold
yet.

Cursors handed out by the indexed path are a base64url keyset
(`createdAtMillis|uri`); one minted by the live path is upstream's opaque string.
The indexed path recognises the difference and refuses a cursor it did not mint,
falling back to live rather than paging from nonsense.

The home feed (`net.ratat.feed.getTimeline`) is the one read with **no live
fallback**: it is a join over a graph only we hold, so an unreachable index is
an error rather than a slower answer. It is paged the same way — offsets over
`post_timeline_idx (created_at desc, uri desc)` — and returns the total, so the
pager knows how many pages exist. An artist who is followed but not yet
backfilled contributes nothing until the worker reaches them.

### What is not indexed

- **Profiles.** `getProfile` is always live: followers, follows and post counts
  are Bluesky's numbers and would be stale the moment we stored them. The
  snapshot in `actor` exists only to render a byline next to an indexed post.
- **Viewer state.** Whether _you_ liked something is read through your own PDS
  (`apps/web/src/lib/likes.ts`), which proxies to an appview that knows.
- **Reply and repost counts.** Snapshots taken when the post was indexed. They
  are not maintained: replies and reposts would each need their own global
  firehose tail, which is not worth what those two numbers are worth.

## Limits, and what to watch

- **The interested set only grows**, and jetstream refuses to scope a
  subscription to more than 10,000 DIDs. Past that the tail logs an error and
  drops the overflow. An eviction or re-backfill policy is needed before then.
- **`post_like` grows with every like on an indexed post**, and the whole table
  is held in memory by the like tail so deletes can be attributed. Both are
  bounded by our own index rather than by Bluesky, but neither is bounded by
  anything else.
- **The like firehose is real bandwidth** — every like on the network, decoded
  and discarded. That is the price of a mirrored counter; `JETSTREAM_LIKE_TAIL`
  is the switch.
- **A backfill is a point-in-time walk.** Nothing re-walks an actor later, so a
  post that existed before the backfill but was missed (an appview hiccup mid
  walk) stays missing until somebody re-triggers it by hand.
- **The backfill queue is first-come, first-served.** A newly Ratat-followed
  artist waits behind everyone already in it, and one prolific account can hold
  the queue for minutes — a 26,000-artwork walk was measured at over two. A
  home feed that stays empty after an import is usually this.

## Configuration

| Variable                        | Default                                 | What it does                                                    |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                  | —                                       | Postgres. Absent in `xrpc-server` means live-only reads.        |
| `BSKY_APPVIEW_URL`              | `https://public.api.bsky.app`           | Where backfill and live reads go.                               |
| `JETSTREAM_URL`                 | `wss://jetstream1.us-east.bsky.network` | Jetstream instance. jetstream1, not jetstream2 (see config.ts). |
| `PLC_DIRECTORY_URL`             | `https://plc.directory`                 | DID documents, which is how a repo's PDS is found.              |
| `JETSTREAM_LIKE_TAIL`           | `true`                                  | Tail the global like firehose.                                  |
| `JETSTREAM_DID_REFRESH_SECONDS` | `30`                                    | How often the tail re-scopes to the interested set.             |
| `JETSTREAM_CHECKPOINT_EVERY`    | `50`                                    | Events between cursor writes.                                   |
| `BACKFILL_POLL_SECONDS`         | `5`                                     | Idle wait when the backfill queue is empty.                     |
| `BACKFILL_PAGE_SIZE`            | `100`                                   | Posts per upstream page.                                        |
| `BACKFILL_PAGE_DELAY_MS`        | `250`                                   | Politeness delay between pages.                                 |
| `BACKFILL_MAX_PAGES`            | `0` (no cap)                            | Guard against a pathological account.                           |
| `BACKFILL_RETRY_MINUTES`        | `30`                                    | Back-off after a failed backfill.                               |
