# Content filtering

Ratat runs no labeler and stores no rating of its own. Every filtering
decision starts from the label values Bluesky already put on a post or an
account, and ends at a preference held on one device.

## Where labels come from

The appview hydrates a post through `app.bsky.feed.getPosts` or
`getAuthorFeed`, and the labels on that view are the poster's self-labels plus
whatever the labelers the Bluesky appview applies have added. `labelValues()`
in `@ratat/common/labels` flattens them to bare strings and applies negations,
because value is the only part the web app reads — the labeler DID, the
signature and the timestamps would otherwise travel through the index and the
lexicon for nobody.

`net.ratat.feed.defs#postView` and `net.ratat.actor.defs#profileView` both
carry a `labels: string[]`.

The index stores them on the post row. A **hydrated** write — the backfill,
built from an appview view — owns that column; a post arriving on jetstream
carries only the author's self-labels and must not erase what a labeler added,
which is the same rule the mirrored like count follows.

## Device preference, not identity

The filter is a device preference — "I'm on my work laptop" — not something to
write to the user's repo. It lives in `localStorage` and applies whether or not
anyone is signed in. There is deliberately no account-level setting to
reconcile with.

`lib/content-filter.ts` is the pure half: no React, no storage, so a server
render and a client render reach the same answer from the same labels.
`lib/settings.tsx` is the store for the filters and theme, because quick
settings is one popover and both are device state.

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

## Hydration, and why the default is blur

The server has no storage, so the stored value can only be read after mount.
Until that effect runs every reader sees `DEFAULT_FILTERS`. That makes the
pre-hydration render the one nobody chose, so it has to be the covered one —
which is why the adult default is `blur` and not `show`.

It is `blur` rather than `hide` because Ratat is a gallery for artists whose
work is routinely rated: hiding by default would empty half the site for
somebody who never opened the settings.

## Reveal is not a setting

Uncovering a card is a peek. It lives in `useContentVeil` and is forgotten the
moment the mode behind it changes, so it is never written anywhere.

The artwork page is the exception worth naming: a `hide` there does not take
the page away, because a link to a work is a link somebody followed on purpose.
`ArtworkGate` says what covered it and offers the reveal instead.

## Where the settings are

`QuickSettingsMenu` sits in the masthead so content filters remain available
even when they hide every artwork. The Pager only renders where there are works
to page through.
