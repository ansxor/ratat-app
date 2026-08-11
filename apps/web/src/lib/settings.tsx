import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_FILTERS,
  type FilterCategory,
  type FilterState,
  filterLabelled,
  sanitizeFilters,
  type VeilMode,
  veilMode,
} from "#/lib/content-filter.ts";
import { DEFAULT_THEME, isThemeChoice, THEME_STORAGE_KEY, type ThemeChoice } from "#/lib/theme.ts";

/**
 * Quick settings: what this device wants to see, held for the whole app.
 *
 * Device-local by design — "I'm on my work laptop" is not something to write
 * to somebody's repo — so this is `localStorage` and nothing else. There is no
 * account setting to reconcile with.
 *
 * The server has no storage, so the stored value can only be read after mount.
 * Until then every reader sees the defaults, which is why the adult default is
 * `blur` rather than `show`: the pre-hydration render is the one nobody chose,
 * and it should be the covered one.
 */

const FILTERS_KEY = "ratat:content-filter";
const DETAILS_KEY = "ratat:gallery-details";

interface SettingsState {
  filters: FilterState;
  theme: ThemeChoice;
  /** Pins each card's byline and action bar open instead of revealing on hover. */
  alwaysShowDetails: boolean;
  /** False until the stored values have been read, which cannot happen on the server. */
  hydrated: boolean;
  setFilterMode: (category: FilterCategory, mode: VeilMode) => void;
  setTheme: (theme: ThemeChoice) => void;
  setAlwaysShowDetails: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsState>({
  filters: DEFAULT_FILTERS,
  theme: DEFAULT_THEME,
  alwaysShowDetails: false,
  hydrated: false,
  setFilterMode: () => {},
  setTheme: () => {},
  setAlwaysShowDetails: () => {},
});

const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A device with storage blocked still gets the setting for this session.
  }
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [theme, setThemeState] = useState<ThemeChoice>(DEFAULT_THEME);
  const [alwaysShowDetails, setDetailsState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFilters(sanitizeFilters(read(FILTERS_KEY)));
    const stored = read(THEME_STORAGE_KEY);
    if (isThemeChoice(stored)) setThemeState(stored);
    setDetailsState(read(DETAILS_KEY) === true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.body.classList.toggle("show-details", alwaysShowDetails);
  }, [alwaysShowDetails, hydrated]);

  const setFilterMode = useCallback((category: FilterCategory, mode: VeilMode) => {
    setFilters((current) => {
      if (current[category] === mode) return current;
      const next = { ...current, [category]: mode };
      write(FILTERS_KEY, next);
      return next;
    });
  }, []);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    write(THEME_STORAGE_KEY, next);
  }, []);

  const setAlwaysShowDetails = useCallback((enabled: boolean) => {
    setDetailsState(enabled);
    write(DETAILS_KEY, enabled);
  }, []);

  const value = useMemo<SettingsState>(
    () => ({
      filters,
      theme,
      alwaysShowDetails,
      hydrated,
      setFilterMode,
      setTheme,
      setAlwaysShowDetails,
    }),
    [filters, theme, alwaysShowDetails, hydrated, setFilterMode, setTheme, setAlwaysShowDetails],
  );

  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings(): SettingsState {
  return use(SettingsContext);
}

export function useContentFilters(): FilterState {
  return use(SettingsContext).filters;
}

/** A list with everything this device has set to `hide` taken out of it. */
export function useVisible<T extends { labels?: readonly string[] | undefined }>(
  list: readonly T[],
): readonly T[] {
  const filters = useContentFilters();
  return useMemo(() => filterLabelled(list, filters), [list, filters]);
}

export interface ContentVeil {
  hidden: boolean;
  veil: "black" | "blur" | null;
  peeked: boolean;
  animated: boolean;
  reveal: () => void;
  unreveal: () => void;
}

/**
 * Uncovering a card is a peek, not a setting: it lives here and is forgotten
 * the moment the mode behind it changes. On grid tiles the peek also ends
 * when the pointer leaves, re-censoring the card.
 */
export function useContentVeil(labels: readonly string[] | undefined): ContentVeil {
  const filters = useContentFilters();
  const mode = veilMode(labels, filters);

  const [peek, setPeek] = useState<"none" | "peeking" | "released">("none");
  const [seenMode, setSeenMode] = useState<VeilMode>(mode);

  const staleMode = seenMode !== mode;
  if (staleMode) {
    setSeenMode(mode);
    setPeek("none");
  }
  const current = staleMode ? "none" : peek;

  const reveal = useCallback(() => setPeek("peeking"), []);
  const unreveal = useCallback(
    () => setPeek((state) => (state === "peeking" ? "released" : state)),
    [],
  );

  return {
    hidden: mode === "hide",
    veil: mode === "black" || mode === "blur" ? mode : null,
    peeked: current === "peeking",
    animated: current !== "none",
    reveal,
    unreveal,
  };
}
