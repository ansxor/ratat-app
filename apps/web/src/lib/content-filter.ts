/**
 * The pure half of content filtering: no React, no storage, so a server render
 * and a client render reach the same answer from the same labels.
 *
 * Ratat runs no labeler. Everything here is a reading of the label values the
 * Bluesky appview already put on a post — the poster's own rating and whatever
 * the labelers the appview applies added — turned into what this device wants
 * to see.
 */

export const VEIL_MODES = ["hide", "black", "blur", "show"] as const;
export type VeilMode = (typeof VEIL_MODES)[number];

export type FilterCategory = "adult" | "graphic";
export const FILTER_CATEGORIES: readonly FilterCategory[] = ["adult", "graphic"];

export type FilterState = Readonly<Record<FilterCategory, VeilMode>>;

/**
 * Blur rather than hide, because Ratat is a gallery for artists whose work is
 * routinely rated: hiding by default would empty half the site for somebody
 * who never opened the settings.
 */
export const DEFAULT_FILTERS: FilterState = { adult: "blur", graphic: "blur" };

export const MODE_META: Record<VeilMode, { label: string; hint: string; rank: number }> = {
  hide: { label: "Hide", hint: "removed from feeds", rank: 3 },
  black: { label: "Black out", hint: "solid cover, click to reveal", rank: 2 },
  blur: { label: "Blur", hint: "heavily blurred preview", rank: 1 },
  show: { label: "Show", hint: "no filtering", rank: 0 },
};

export const CATEGORY_META: Record<FilterCategory, { label: string; values: readonly string[] }> = {
  adult: {
    label: "Adult",
    // Bluesky's three adult label values, plus the legacy ones its own client
    // still maps onto them.
    values: ["porn", "sexual", "sexual-figurative", "nudity", "nsfw", "suggestive"],
  },
  graphic: {
    label: "Graphic media",
    values: ["graphic-media", "gore", "self-harm", "torture", "corpse", "nsfl"],
  },
};

/**
 * Label values the Bluesky moderation service applies to a subject it has
 * acted on. They are not settings: `!hide` takes a post out of every feed and
 * `!warn` covers it, whatever this device asked for.
 */
const ALWAYS_HIDE = "!hide";
const ALWAYS_WARN = "!warn";

export function isVeilMode(value: unknown): value is VeilMode {
  return typeof value === "string" && (VEIL_MODES as readonly string[]).includes(value);
}

export function categoriesOf(labels: readonly string[] | undefined): FilterCategory[] {
  if (!labels || labels.length === 0) return [];
  return FILTER_CATEGORIES.filter((category) =>
    CATEGORY_META[category].values.some((value) => labels.includes(value)),
  );
}

const strictest = (a: VeilMode, b: VeilMode): VeilMode =>
  MODE_META[b].rank > MODE_META[a].rank ? b : a;

/** The strictest thing any label on this subject asks for. */
export function veilMode(labels: readonly string[] | undefined, filters: FilterState): VeilMode {
  if (!labels || labels.length === 0) return "show";
  if (labels.includes(ALWAYS_HIDE)) return "hide";

  let mode: VeilMode = labels.includes(ALWAYS_WARN) ? "blur" : "show";
  for (const category of categoriesOf(labels)) mode = strictest(mode, filters[category]);
  return mode;
}

export function isHidden(labels: readonly string[] | undefined, filters: FilterState): boolean {
  return veilMode(labels, filters) === "hide";
}

/**
 * Returns the same array when nothing was filtered, so a caller memoising off
 * the result does not churn a whole grid for no change.
 */
export function filterLabelled<T extends { labels?: readonly string[] | undefined }>(
  list: readonly T[],
  filters: FilterState,
): readonly T[] {
  const kept = list.filter((item) => !isHidden(item.labels, filters));
  return kept.length === list.length ? list : kept;
}

/** Storage is user-writable and outlives a deploy, so nothing read back is trusted. */
export function sanitizeFilters(value: unknown): FilterState {
  if (!value || typeof value !== "object") return DEFAULT_FILTERS;
  const raw = value as Record<string, unknown>;
  const out: Record<FilterCategory, VeilMode> = { ...DEFAULT_FILTERS };
  for (const category of FILTER_CATEGORIES) {
    const mode = raw[category];
    if (isVeilMode(mode)) out[category] = mode;
  }
  return out;
}

export function filterSummary(filters: FilterState): string {
  const filtered = FILTER_CATEGORIES.filter((category) => filters[category] !== "show");
  if (filtered.length === 0) return "Nothing filtered";
  return `${filtered.map((category) => CATEGORY_META[category].label).join(" and ")} filtered in feeds`;
}
