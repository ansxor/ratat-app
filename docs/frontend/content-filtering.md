# Content filtering

Ratat runs no labeler and stores no rating of its own. Every filtering
decision starts from the label values Bluesky already put on a post or an
account, and ends at a preference held on one device.

## Where labels come from

Posts carry self-labels in `app.bsky.feed.post` records and, when fetched via
Bluesky's appview (`app.bsky.feed.getPosts` or `getAuthorFeed`), hydrated labels
from Bluesky's configured labelers. `labelValues()` and `selfLabelValues()` in
`server/_media.ts` flatten label objects to bare strings and apply negations
(`neg: true`), because the label value is the only part the web app reads — the
labeler DID, signature, and timestamps would otherwise travel through the index
and the lexicon for nobody.

`net.ratat.feed.defs#postView` and `net.ratat.actor.defs#profileView` both
carry a `labels: string[]`.

## Device preference, not identity

The filter is a device preference — "I'm on my work laptop" — not something to
write to the user's repo. It lives in `localStorage` and applies whether or not
anyone is signed in. There is deliberately no account-level setting to
reconcile with.

- `app/lib/content-filter.ts` is the pure half: no Svelte runtime, no browser
  storage (`DEFAULT_FILTERS`, `categoriesOf`, `veilMode`, `isHidden`,
  `filterLabelled`, `sanitizeFilters`). Both SSR and the browser reach the same
  answer from the same labels and filter state.
- `app/lib/settings.svelte.ts` is the Svelte 5 runes store (`$state` / `$effect`)
  persisting both content filters and theme (`system` | `light` | `dark`) in
  `localStorage`, and exposing `useContentVeil(labels)`.

## Categories and modes

Two categories, grouped the way Bluesky's own moderation settings group them:

| Category  | Label values                                                                          |
| --------- | ------------------------------------------------------------------------------------- |
| `adult`   | `porn`, `sexual`, `sexual-figurative`, `nudity`, and the legacy `nsfw` / `suggestive` |
| `graphic` | `graphic-media`, and the legacy `gore`, `self-harm`, `torture`, `corpse`, `nsfl`      |

Four modes, strictest wins when a work carries labels from more than one
category: `hide` › `black` › `blur` › `show`.

Two label values are not settings. `!hide` from the Bluesky moderation service
hides the work whatever this device asked for, and `!warn` covers it at least
as far as `blur`.

## SSR, hydration, and why the default is blur

SvelteKit SSR has no access to `localStorage`, so server-rendered HTML and the
initial pre-hydration pass always evaluate against `DEFAULT_FILTERS`
(`adult: 'blur'`, `graphic: 'blur'`). `settings.svelte.ts` reads the stored
device preference only after mount in the browser.

That makes the pre-hydration render the one nobody chose, so it has to be the
covered one — which is why the defaults are `blur` rather than `show`. It is
`blur` rather than `hide` because Ratat is a gallery for artists whose work is
routinely rated: hiding by default would empty half the site for somebody who
never opened the settings.

## Reveal is not a setting

Uncovering a card is a peek. `useContentVeil(labels)` in
`app/lib/settings.svelte.ts` tracks `peeked` in component-local reactive state
and forgets it the moment the underlying filter mode changes or the user
navigates, so it is never written to `localStorage`.

- `app/lib/components/ArtworkVeil.svelte` overlays the `blur` or `black` cover
  on gallery cards and detail media frames with an uncensor button.
- `app/lib/components/ArtworkGate.svelte` handles `hide` on the artwork detail
  route (`app/routes/art/[handle]/[rkey]/+page.svelte`): unlike feed grids, a
  `hide` there does not take the page away, because a direct link to a work is
  a link somebody followed on purpose. `ArtworkGate` names the category that
  covered it and offers a `Reveal` button instead.

## Where the settings are

`app/lib/components/QuickSettingsMenu.svelte` sits in `Masthead.svelte` so
content filters remain available from any route, even when `hide` removes every
artwork from a grid. `Pager.svelte` only renders where there are works to page
through.
