import type { LinkProps } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

interface PaginationViewport {
  isMobile: boolean;
}

const PaginationViewportContext = createContext(false);

export function PaginationViewportProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 880px)");
    const update = () => setIsMobile(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <PaginationViewportContext.Provider value={isMobile}>
      {children}
    </PaginationViewportContext.Provider>
  );
}

export function useMobileInfinitePagination(): boolean {
  return useContext(PaginationViewportContext);
}

export function usePaginationViewport(): PaginationViewport {
  return { isMobile: useContext(PaginationViewportContext) };
}

export function useScrollToPaginationMode(
  anchorRef: RefObject<HTMLElement | null>,
  ready = true,
): void {
  const { isMobile } = usePaginationViewport();
  const previousMode = useRef(isMobile);
  const pendingMode = useRef<boolean | null>(null);

  useEffect(() => {
    if (previousMode.current === isMobile) return;
    previousMode.current = isMobile;
    pendingMode.current = isMobile;
  }, [isMobile]);

  useEffect(() => {
    if (pendingMode.current === null || !ready) return;
    pendingMode.current = null;
    const frame = requestAnimationFrame(() => {
      anchorRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchorRef, ready]);
}

export interface InfinitePaginationState<Item, Page = unknown> {
  enabled: boolean;
  pages: Page[];
  lastPage: Page;
  lastPageStart: number;
  items: Item[];
  hasNextPage: boolean;
  isLoading: boolean;
  error: unknown;
  sentinelRef: RefObject<HTMLDivElement | null>;
  loadNext: () => Promise<void>;
}

export function useInfinitePagination<Page, Item>(opts: {
  enabled: boolean;
  resetKey: string;
  initialPage: Page;
  pageNumber: (page: Page) => number;
  getItems: (page: Page) => readonly Item[];
  hasNextPage: (page: Page) => boolean;
  loadPage: (page: number) => Promise<Page>;
}): InfinitePaginationState<Item, Page> {
  const {
    enabled,
    resetKey,
    initialPage,
    pageNumber,
    getItems,
    hasNextPage: pageHasNext,
    loadPage,
  } = opts;
  const [loaded, setLoaded] = useState<{ key: string; pages: Page[] }>(() => ({
    key: resetKey,
    pages: [initialPage],
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pages = loaded.key === resetKey ? loaded.pages : [initialPage];
  const lastPage = pages[pages.length - 1] ?? initialPage;
  const lastPageStart = pages
    .slice(0, -1)
    .reduce((count, page) => count + getItems(page).length, 0);
  const hasNextPage = enabled && pageHasNext(lastPage);

  useEffect(() => {
    requestRef.current += 1;
    setLoaded({ key: resetKey, pages: [initialPage] });
    setIsLoading(false);
    setError(null);
  }, [initialPage, resetKey]);

  const loadNext = useCallback(async () => {
    if (!enabled || !hasNextPage || isLoading) return;

    const request = ++requestRef.current;
    const nextPage = pageNumber(lastPage) + 1;
    setIsLoading(true);
    setError(null);
    try {
      const page = await loadPage(nextPage);
      if (request !== requestRef.current) return;
      setLoaded((current) =>
        current.key === resetKey ? { key: resetKey, pages: [...current.pages, page] } : current,
      );
    } catch (cause: unknown) {
      if (request === requestRef.current) setError(cause);
    } finally {
      if (request === requestRef.current) setIsLoading(false);
    }
  }, [enabled, hasNextPage, isLoading, lastPage, loadPage, pageNumber, resetKey]);

  useEffect(() => {
    if (
      !enabled ||
      !hasNextPage ||
      isLoading ||
      error ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadNext();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, error, hasNextPage, isLoading, loadNext]);

  return {
    enabled,
    pages,
    lastPage,
    lastPageStart,
    items: pages.flatMap(getItems),
    hasNextPage,
    isLoading,
    error,
    sentinelRef,
    loadNext,
  };
}

export function MobileInfinitePagination<Item, Page>({
  pagination,
}: {
  pagination: InfinitePaginationState<Item, Page>;
}) {
  if (!pagination.enabled) return null;
  return (
    <div
      ref={pagination.sentinelRef}
      className="flex min-h-[34px] items-center justify-center py-[12px] text-[12px] text-faint"
      aria-live="polite"
    >
      {pagination.isLoading ? (
        "Loading…"
      ) : pagination.error ? (
        <button
          type="button"
          className="text-primary underline"
          onClick={() => void pagination.loadNext()}
        >
          Couldn&apos;t load more — try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Ported from the old app's `src/lib/pagination.ts`. The one change: a page
 * slot carries TanStack `LinkProps` instead of a serialized href string, since
 * this router builds links from route + search rather than from a path.
 */

const MAX_SLOTS = 9;

const RADIUS = 2;

export function paginationSearch(search: Record<string, unknown>): { page?: number } {
  const page = Math.trunc(Number(search.page));
  return Number.isFinite(page) && page >= 1 ? { page } : {};
}

export interface PagerSlot {
  page: number;
  link: LinkProps;
}

export interface PagerPagination {
  current: number;
  totalPages?: number;
  total?: number;
  totalCapped: boolean;
  slots: Array<PagerSlot | "gap">;
  prevLink?: LinkProps;
  nextLink?: LinkProps;
}

export function pageCount(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, limit)));
}

export function clampPage(page: number, total: number | undefined, limit: number): number {
  const requested = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  return total === undefined ? requested : Math.min(requested, pageCount(total, limit));
}

export function pageSlots(
  current: number,
  totalPages: number,
  radius = RADIUS,
  maxSlots = MAX_SLOTS,
): Array<number | "gap"> {
  if (totalPages <= 1) return [1];
  if (totalPages <= maxSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (current <= 2) {
    return [...Array.from({ length: Math.min(4, totalPages) }, (_, i) => i + 1), "gap", totalPages];
  }
  if (current >= totalPages - 1) {
    return [1, "gap", ...Array.from({ length: 4 }, (_, i) => totalPages - 3 + i)];
  }

  const wanted = new Set<number>([1, totalPages]);
  for (let p = current - radius; p <= current + radius; p++) {
    if (p >= 1 && p <= totalPages) wanted.add(p);
  }

  const ordered = [...wanted].sort((a, b) => a - b);
  for (let p = 2; ordered.length < maxSlots && p < totalPages; p++) {
    if (!wanted.has(p)) {
      wanted.add(p);
      ordered.splice(
        ordered.findIndex((n) => n > p),
        0,
        p,
      );
    }
  }

  const slots: Array<number | "gap"> = [];
  let previous = 0;
  for (const page of ordered) {
    if (previous && page - previous > 1) slots.push("gap");
    slots.push(page);
    previous = page;
  }
  return slots;
}

export function pagerLinks(opts: {
  page: number;
  limit: number;
  total?: number | undefined;
  totalCapped?: boolean | undefined;
  itemCount: number;
  link: (page: number) => LinkProps;
}): PagerPagination {
  const { page, limit, total, link } = opts;
  const totalCapped = opts.totalCapped ?? false;

  if (total === undefined) {
    const current = Math.max(1, Math.trunc(page));
    return {
      current,
      totalCapped,
      slots: [{ page: current, link: link(current) }],
      ...(current > 1 ? { prevLink: link(current - 1) } : {}),
      ...(opts.itemCount >= limit ? { nextLink: link(current + 1) } : {}),
    };
  }

  const totalPages = pageCount(total, limit);
  const current = clampPage(page, total, limit);
  return {
    current,
    totalPages,
    total,
    totalCapped,
    slots: pageSlots(current, totalPages).map((slot) =>
      slot === "gap" ? slot : { page: slot, link: link(slot) },
    ),
    ...(current > 1 ? { prevLink: link(current - 1) } : {}),
    ...(current < totalPages ? { nextLink: link(current + 1) } : {}),
  };
}

export function formatTotal(total: number, capped = false): string {
  return `${total.toLocaleString()}${capped ? "+" : ""}`;
}
