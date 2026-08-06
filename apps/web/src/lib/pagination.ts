import type { LinkProps } from "@tanstack/react-router";

/**
 * Ported from the old app's `src/lib/pagination.ts`. The one change: a page
 * slot carries TanStack `LinkProps` instead of a serialized href string, since
 * this router builds links from route + search rather than from a path.
 */

const MAX_SLOTS = 9;

const RADIUS = 2;

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
  lastLink?: LinkProps;
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
    ...(current < totalPages ? { lastLink: link(totalPages) } : {}),
  };
}

export function formatTotal(total: number, capped = false): string {
  return `${total.toLocaleString()}${capped ? "+" : ""}`;
}
