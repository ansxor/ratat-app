import {
  DEFAULT_FILTERS,
  type FilterCategory,
  type FilterState,
  filterLabelled,
  sanitizeFilters,
  type VeilMode,
  veilMode,
} from "./content-filter.ts";
import { DEFAULT_THEME, isThemeChoice, THEME_STORAGE_KEY, type ThemeChoice } from "./theme.ts";

const FILTERS_KEY = "ratat:content-filter";

function readStorage(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

let filters = $state<FilterState>(DEFAULT_FILTERS);
let theme = $state<ThemeChoice>(DEFAULT_THEME);
let hydrated = $state(false);

export function hydrateSettings(): void {
  if (hydrated) return;
  filters = sanitizeFilters(readStorage(FILTERS_KEY));
  const stored = readStorage(THEME_STORAGE_KEY);
  if (isThemeChoice(stored)) theme = stored;
  hydrated = true;
}

export function applyThemeEffect(): void {
  if (!hydrated || typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export const settings = {
  get filters(): FilterState {
    return filters;
  },
  get theme(): ThemeChoice {
    return theme;
  },
  get hydrated(): boolean {
    return hydrated;
  },
  setFilterMode(category: FilterCategory, mode: VeilMode): void {
    if (filters[category] === mode) return;
    filters = { ...filters, [category]: mode };
    writeStorage(FILTERS_KEY, filters);
  },
  setTheme(next: ThemeChoice): void {
    theme = next;
    writeStorage(THEME_STORAGE_KEY, next);
  },
};

export function useVisible<T extends { labels?: readonly string[] | undefined }>(
  listInput: readonly T[] | (() => readonly T[]),
): { readonly items: readonly T[] } {
  const getList = typeof listInput === "function" ? listInput : () => listInput;
  const items = $derived(filterLabelled(getList(), filters));
  return {
    get items() {
      return items;
    },
  };
}

export interface ContentVeil {
  readonly hidden: boolean;
  readonly veil: "black" | "blur" | null;
  readonly peeked: boolean;
  readonly animated: boolean;
  reveal: () => void;
  unreveal: () => void;
}

export function useContentVeil(
  labelsInput: (readonly string[] | undefined) | (() => readonly string[] | undefined),
): ContentVeil {
  const getLabels = typeof labelsInput === "function" ? labelsInput : () => labelsInput;
  let peek = $state<"none" | "peeking" | "released">("none");
  let seenMode = $state<VeilMode>(veilMode(getLabels(), filters));

  const mode = $derived(veilMode(getLabels(), filters));

  $effect(() => {
    if (seenMode !== mode) {
      seenMode = mode;
      peek = "none";
    }
  });

  const current = $derived(seenMode !== mode ? "none" : peek);

  return {
    get hidden() {
      return mode === "hide";
    },
    get veil() {
      return mode === "black" || mode === "blur" ? mode : null;
    },
    get peeked() {
      return current === "peeking";
    },
    get animated() {
      return current !== "none";
    },
    reveal() {
      peek = "peeking";
    },
    unreveal() {
      if (peek === "peeking") peek = "released";
    },
  };
}
