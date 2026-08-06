/**
 * Page-number → cursor memo for the numbered pagers.
 *
 * The Bluesky appview only pages by cursor, so serving `?page=7` means walking
 * pages 1..7 upstream. Remembering the cursor that starts each page turns the
 * common moves — Next, Prev, jumping back to a page already seen — into a
 * single upstream request, and lets one deep walk pay for every page it passed
 * through. Entries expire because new posts at the top of a feed shift where
 * the page boundaries fall.
 */

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 5000;

interface Entry {
  cursor: string;
  expiresAt: number;
}

const entries = new Map<string, Entry>();

const keyFor = (actor: string, limit: number, page: number): string => `${actor}|${limit}|${page}`;

/** Records the cursor that starts `page` of this actor's feed. */
export const rememberCursor = (
  actor: string,
  limit: number,
  page: number,
  cursor: string,
): void => {
  entries.set(keyFor(actor, limit, page), { cursor, expiresAt: Date.now() + TTL_MS });
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
};

/** The deepest remembered page at or before `page`, to start the walk from. */
export const nearestCursor = (
  actor: string,
  limit: number,
  page: number,
): { page: number; cursor: string } | undefined => {
  const now = Date.now();
  for (let candidate = page; candidate > 1; candidate--) {
    const key = keyFor(actor, limit, candidate);
    const entry = entries.get(key);
    if (entry === undefined) continue;
    if (entry.expiresAt <= now) {
      entries.delete(key);
      continue;
    }
    return { page: candidate, cursor: entry.cursor };
  }
  return undefined;
};
