export const MAX_SLOTS = 9;
export const RADIUS = 2;

export function paginationSearch(search: Record<string, unknown> | URLSearchParams): {
  page?: number;
} {
  const raw = search instanceof URLSearchParams ? search.get("page") : search.page;
  if (raw === null || raw === undefined || raw === "") return {};
  const page = Math.trunc(Number(raw));
  return Number.isFinite(page) && page >= 1 ? { page } : {};
}

export interface PagerSlot {
  page: number;
  href: string;
}

export interface PagerPagination {
  current: number;
  totalPages?: number;
  total?: number;
  totalCapped: boolean;
  slots: Array<PagerSlot | "gap">;
  prevHref?: string;
  nextHref?: string;
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
  href: (page: number) => string;
}): PagerPagination {
  const { page, limit, total, href } = opts;
  const totalCapped = opts.totalCapped ?? false;

  if (total === undefined) {
    const current = Math.max(1, Math.trunc(page));
    return {
      current,
      totalCapped,
      slots: [{ page: current, href: href(current) }],
      ...(current > 1 ? { prevHref: href(current - 1) } : {}),
      ...(opts.itemCount >= limit ? { nextHref: href(current + 1) } : {}),
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
      slot === "gap" ? slot : { page: slot, href: href(slot) },
    ),
    ...(current > 1 ? { prevHref: href(current - 1) } : {}),
    ...(current < totalPages ? { nextHref: href(current + 1) } : {}),
  };
}

export function mobileSlots(pagination: PagerPagination): Array<PagerSlot | "gap"> {
  const wanted = new Set(
    pageSlots(pagination.current, pagination.totalPages ?? pagination.current, 1, 5),
  );
  return pagination.slots.filter((slot) => slot === "gap" || wanted.has(slot.page));
}

export function pageHref(basePath: string, target: number): string {
  return target > 1 ? `${basePath}?page=${target}` : basePath;
}

export function formatTotal(total: number, capped = false): string {
  return `${total.toLocaleString()}${capped ? "+" : ""}`;
}
