# Ratat v2 ("Ratat as a lens over Bluesky") — Migration & Architecture Plan

**Goal:** Rebuild Ratat in `~/Workspace/ratat-app` as a read-mostly art appview over
`app.bsky.*` data — no custom content lexicons, no uploads, no drafts, no posting —
with one custom repo record (a Ratat-scoped follow) and ambient, on-demand indexing.

**Source repo:** `~/Workspace/ratat` (Bun monorepo: `apps/frontend` Next.js,
`apps/xrpc-server`, `apps/jetstream-consumer`, `packages/{lexicon,db,common,dev-cdn,testnet}`).

**Tech stack (new):** Bun workspace · TanStack Start (frontend, replaces Next.js) ·
Effect on all backend services · Drizzle + Postgres · `@atcute/*` for ATProto ·
Jetstream for live ingest, on-demand PDS/appview backfill.

---

## Product definition

### What Ratat v2 is

A gallery-shaped appview over Bluesky. All content is `app.bsky.feed.post` records
with image (and later video) embeds, read from the network. Engagement (likes,
later comments) writes plain `app.bsky.*` records to the user's repo, so it is
inherently synced with Bluesky — no mirroring machinery.

### Decisions locked in

1. **Ambient indexing with "interested" accounts.** Any DID can be marked
   *interested* (visiting their Ratat profile page, being Ratat-followed, logging
   in). Interested accounts get dynamically backfilled (same lazy-backfill pattern
   the current repo uses) and then tracked live via Jetstream. No global firehose
   art classification.
2. **No discover feeds.** The home page is the following feed (Ratat-follow graph).
   Logged-out home = marketing/login or a simple recent-from-interested wall (open
   question below). Tags: minimal — render hashtags/facets from posts, allow tag
   filter within an artist's page; no trending/search-tags subsystem.
3. **No posting. None.** No composer, no upload, no drafts, no assets, no CDN.
   Comments (replies) are explicitly post-v1.
4. **NSFW allowed.** Moderation = Bluesky labeler subscriptions and label values
   (`porn`, `sexual`, `nudity`, `graphic-media`, …) mapped into the existing
   quick-settings UX (device-local filter, fail-open, hide/blur/show per category).
   No custom mod flow, no custom labeler in v1.
5. **One custom lexicon:** `art.ratat.graph.follow` — a record in the user's repo.
   Purpose: keep the home gallery curated to *art* accounts (follow someone's art
   without their memes polluting the feed) and keep Ratat usage from mutating the
   user's Bluesky graph. Portable by design.

### v1 feature cut

| In | Out (deleted from old repo) |
|---|---|
| OAuth login (ATProto) | Onboarding profile step (use bsky profile) |
| Home = following feed (masonry) | Discover/suggested feeds, trending tags |
| Artist profile = portfolio grid of image posts | Custom profiles, profile status |
| Artwork lightbox/detail view (images, alt text, like count, link out to Bluesky) | Artwork/thread lexicons, revision log |
| Like/unlike (`app.bsky.feed.like`) | Boosts, custom like lexicon |
| Ratat follow/unfollow (`art.ratat.graph.follow`) | Bluesky-graph mutation, FollowingRail complexity |
| Label-based content filtering + quick settings | Custom moderation flow |
| Lazy per-actor backfill ("interested" model) | Bidirectional mirroring, mirror banners/badges/chips |
| Basic actor search/typeahead (proxy `app.bsky.actor.searchActorsTypeahead`) | Artwork search, tag search |
| — | Drafts, uploads, asset rail, dev-cdn, collections, bookmarks, comments (post-v1), support dialog |

---

## Architecture

```
Jetstream ──▶ ingest service ──▶ Postgres index ◀── backfill worker (lazy, per-DID)
                                      │
                                      ▼
                              read API (Effect, XRPC-ish or plain HTTP)
                                      │
                                      ▼
                     TanStack Start app (SSR + client) ── OAuth ──▶ user PDS
                                                          (writes likes & ratat follows)
```

### Services (new workspace layout)

```
ratat-app/
  apps/
    web/            # TanStack Start — pure XRPC client + OAuth session handling
    xrpc-server/    # Effect: read API serving art.ratat.* query lexicons
    ingester/       # Effect: jetstream consumer + backfill worker
  packages/
    db/             # Drizzle schema (ported, heavily trimmed)
    common/         # shared ATProto helpers (ported subset)
    lexicon/        # art.ratat.graph.follow record + art.ratat.* query lexicons
    testnet/        # ported local ATProto testnet harness
```

### Data model (Postgres, trimmed)

- `actor` — did, handle, profile snapshot (avatar, display name, description),
  `interested_at`, `backfill_state` (none/pending/done/error), `indexed_at`.
- `post` — uri, cid, did, createdAt, text, facets/tags, embed summary, image
  blobs (cid, alt, aspect), label snapshot, has_images flag. Only posts **with
  media** from interested actors are stored (text-only posts skipped).
- `like_count` — denormalized counter mirrored in the local index (DECIDED
  2026-08-06): seeded from appview counts during backfill, then maintained by
  tailing `app.bsky.feed.like` creates/deletes on jetstream for posts we index.
  Live per-read hydration from the appview would be too expensive. Viewer-like
  state stays a live check (or client-side) — no per-liker records stored.
- `ratat_follow` — indexed from `art.ratat.graph.follow` records (subject did,
  actor did, rkey, createdAt).
- `label` — per-subject labels from subscribed labelers (or fetch via hydration).

Simplification lever: much per-post state (like counts, viewer likes, labels,
even profile data) can be hydrated at read time from the public Bluesky appview
(`public.api.bsky.app`) instead of indexed. **v1 rule: index the minimum needed
to answer "which post URIs go in this feed" (posts + ratat follows + actors);
hydrate everything else from Bluesky's appview.** This deletes enormous amounts
of consumer code.

### Ingest & backfill

- **Interested set:** DIDs become interested when (a) a logged-in user views their
  profile, (b) they are Ratat-followed by anyone, (c) they log in.
- **Lazy backfill:** on first interest, enqueue a backfill job: page
  `app.bsky.feed.getAuthorFeed` (filter `posts_with_media`) from the public
  appview → insert post rows. Reuse the current repo's dynamic-backfill pattern
  (`docs/architecture/bluesky-mirroring.md`, indexing docs) as reference.
- **Live tail:** Jetstream subscription on `app.bsky.feed.post` (+ deletes) and
  `art.ratat.graph.follow`; keep only events whose DID is in the interested set
  (or whose collection is the ratat follow). Also `app.bsky.actor.profile` for
  interested DIDs.
- Optionally subscribe to labeler streams later; v1 hydrates labels per request.

### Writes (from the web app, direct to user PDS via OAuth session)

- Like: `com.atproto.repo.createRecord` → `app.bsky.feed.like` (delete to unlike).
- Ratat follow: create/delete `art.ratat.graph.follow`.
- That's the entire write surface.

### Moderation / content filtering

- Port `docs/frontend/content-filtering.md` device-local filter and the
  QuickSettingsMenu UX.
- Categories map to Bluesky label values; defaults artist-friendly (blur adult,
  reveal on click); honor `!hide`/`!warn` from the Bluesky mod service always.
- Respect viewer's own mutes/blocks via hydrated viewer state when logged in.

---

## Migration strategy: what ports, what dies

**Port (with trimming):**
- OAuth flow (frontend `oauth/`, callback handling) → adapt to TanStack Start routes.
- `packages/db` scaffolding (Drizzle config, migration tooling) — schema rewritten.
- `packages/common` ATProto utilities actually used by the new surface.
- `packages/testnet` + `justfile`/`mise.toml`/`pitchfork.toml` dev-stack wiring
  (keep the port-offset conventions from AGENTS.md).
- Frontend building blocks: `ArtworkGrid`/`ArtworkCard` (masonry), lightbox pieces
  under `components/art`, `QuickSettingsMenu`, `settings`, `moderation`,
  `content` filtering, `Masthead`/`Sidebar`/`Footer`, `FollowButton`,
  `ActorHandleInput`, theming (`globals.css` `light-dark()` token system +
  `lint:colors` gate).
- Docs conventions: keep `docs/` layout habit; write fresh
  `docs/architecture/indexing.md` for the interested/backfill model.

**Delete (do not port):**
- `packages/lexicon` content record types except `art.ratat.graph.follow`;
  query/procedure lexicons are rewritten for the new, much smaller read surface.
- `apps/xrpc-server` is **kept as an app** but its method surface is rebuilt:
  all `art.ratat.*` methods serving artwork/drafts/collections/comments/boosts/
  bookmarks die; new query methods cover feeds, profiles, and follows only.
- All of jetstream-consumer's bidirectional mirroring, draft store, blob/CDN
  handling, `packages/dev-cdn`.
- Frontend: `upload/`, `collections/`, `onboarding/`, `search` (except actor
  typeahead), comments components, boosts, bookmarks, Bsky mirror
  banner/badge/chip, FollowingRail (replaced by simple following page),
  SupportDialog (decide separately).

**Repo mechanics:** start `ratat-app` as a fresh git repo; copy files over
deliberately (no history graft). Old repo stays as reference until parity.

---

## Phased build order

### Phase 0 — Skeleton
1. Bun workspace scaffold in `ratat-app` (`package.json` workspaces, tsconfig,
   biome/eslint + prettier config matching old repo's gates).
2. TanStack Start app boots (`apps/web`), Effect ingester stub (`apps/ingester`),
   `packages/db` with empty schema + migration runner, Postgres via compose.
3. Port testnet harness + mise/pitchfork wiring; `pitchfork start -l` boots stack.

### Phase 1 — Identity & reading Bluesky
4. OAuth login against testnet/real PDS in TanStack Start (session storage,
   server-side token handling).
5. Actor page: resolve handle → hydrate profile from public appview → render
   portfolio grid from `getAuthorFeed(posts_with_media)` **live** (no local index
   yet). This gives a demoable product almost immediately.
6. Lightbox/detail view; like/unlike writing to the user's PDS.

### Phase 2 — Index & interested model
7. `actor`/`post` schema; backfill worker; mark-interested on profile view/login.
8. Jetstream tail for interested DIDs (posts + deletes + profile updates).
9. Switch actor pages to read from local index (fallback to live fetch while
   backfill pending — the "dynamic backfill on visit" UX).

### Phase 3 — Ratat graph & home feed
10. `art.ratat.graph.follow` lexicon + codegen; FollowButton writes it.
11. Ingest ratat follows; home = reverse-chron media posts from
    followed DIDs (cursor pagination). Onboarding "import follows" step
    (Bluesky follow graph → offered ratat-follows).

### Phase 4 — Moderation & polish
12. Label hydration + device-local filter + quick settings port.
13. Actor typeahead search (proxy Bluesky), theming pass, empty states,
    logged-out home.
14. Quality gates: lint, typecheck, color-token gate, e2e smoke against testnet.

---

### Decisions locked in (round 2)

- **Home** = reverse-chron media posts from the viewer's ratat-follows. The old
  top-nav "Following" page/rail is obsolete and is not ported.
- **Boosts removed entirely.** The old "favourites" concept becomes the Bluesky
  like (`app.bsky.feed.like`) — one synced action, no custom like record.
- **Likes are count-only.** No "liked by" surfaces. Counts are mirrored into
  the local index (backfill seed + jetstream `app.bsky.feed.like` tail) rather
  than hydrated live per read — cheaper at scale (decided 2026-08-06).
- **Onboarding:** replace the old "import posts" step with an **import follows**
  step — offer the user's Bluesky follow graph as initial ratat-follows
  (one-time, initial stage only; no ongoing sync).
- **Profiles:** all media posts by the artist. No reposts anywhere.
- **Text-only posts:** completely invisible everywhere.
- **Liking from Ratat writes a real Bluesky like** — confirmed; add a one-time
  first-like notice.
- **Interested-set entry points:** profile visit, ratat-follow, login. Confirmed.
- **Search:** actor typeahead only (proxied to Bluesky).
- **Video embeds:** in scope for v1 alongside images.

## Risks / open questions

1. **Q1 — Logged-out home page:** RESOLVED — pure login page.
2. **Q2 — Where does the read API live?** RESOLVED — a dedicated XRPC server
   (`apps/xrpc-server`, Effect). Read methods are defined as `art.ratat.*`
   query lexicons in `packages/lexicon` (API-shape lexicons only — no custom
   content record types besides `art.ratat.graph.follow`). The TanStack Start
   app is a pure XRPC client.
3. **Rate limits on public appview hydration** (getPosts/getAuthorFeed bursts):
   add per-instance caching early; watch for 429s.
4. **Deletes/takedowns:** must process post deletes and account deactivations
   from Jetstream promptly since we cache media metadata; images themselves stay
   on Bluesky CDN (good — takedown propagates there automatically).
5. **Interested-set growth:** unbounded over time; fine for v1, but plan an
   eviction/re-backfill policy note in docs.
6. **`app.bsky.bookmark`:** check `@atcute` for status; if live, bookmarks come
   free later without custom lexicons.
