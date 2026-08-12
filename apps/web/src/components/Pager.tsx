import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { formatTotal, type PagerPagination } from "#/lib/pagination.ts";
import { cn } from "#/lib/utils.ts";

/**
 * Ported from the old app's `src/components/Pager.tsx`: same markup and
 * classes, with `cva` folded into `cn` and Next's `Link` swapped for the
 * router's. The old app's `captureEvent` call is dropped — no observability
 * library here yet. Its settings cog is dropped too: "always show details"
 * moved into the masthead's quick settings, where it is reachable from a page
 * with nothing to page through.
 */

/**
 * The current page renders as a span, so no link in the pager should ever read
 * as active. Without this the router treats `?page=` links as matching any
 * page — search params are matched by subset — and stamps a second
 * `aria-current` onto the nav.
 */
const ACTIVE_OPTIONS = { exact: true, includeSearch: true } as const;

const pageLink = (
  variants: { current?: boolean; step?: boolean; disabled?: boolean } = {},
): string =>
  cn(
    "text-[13px] font-[600] text-mist px-[8px] py-[3px] whitespace-nowrap transition-[color,background] duration-[140ms] hover:text-paper hover:bg-ink-hi",
    variants.current && "bg-primary text-accent-ink hover:bg-primary hover:text-accent-ink",
    variants.step && "text-primary hover:text-accent-ink hover:bg-primary",
    variants.disabled && "text-faint cursor-not-allowed hover:text-faint hover:bg-transparent",
  );

export function Pager({
  variant = "top",
  leading,
  pagination,
  countNoun = ["work", "works"],
}: {
  variant?: "top" | "bottom" | "standalone";
  leading?: ReactNode;
  pagination?: PagerPagination;
  countNoun?: readonly [string, string];
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-[8px]",
        variant !== "standalone" &&
          "bg-[color-mix(in_srgb,var(--color-ink-raised)_92%,transparent)] border border-line px-[10px] py-[4px] mb-[0.4rem] max-[880px]:mb-0",
        variant === "bottom" && "mt-[0.4rem] mb-0 max-[880px]:mt-0",
        variant === "standalone" && "justify-center mt-[1.5rem]",
      )}
    >
      {leading ??
        (pagination?.total !== undefined && (
          <span className="text-[12px] tracking-[0.04em] text-faint whitespace-nowrap max-[880px]:hidden">
            {formatTotal(pagination.total, pagination.totalCapped)}{" "}
            {pagination.total === 1 ? countNoun[0] : countNoun[1]}
          </span>
        ))}
      {pagination && (pagination.slots.length > 1 || pagination.nextLink) && (
        <nav
          className={cn("flex items-center gap-[3px]", variant !== "standalone" && "ml-auto")}
          aria-label="Pagination"
        >
          {pagination.prevLink && (
            <Link
              className={pageLink({ step: true })}
              activeOptions={ACTIVE_OPTIONS}
              {...pagination.prevLink}
            >
              ‹ Prev
            </Link>
          )}
          {pagination.slots.map((slot, i) =>
            slot === "gap" ? (
              <span
                key={`gap-${i}`}
                className="text-faint px-[3px] max-[880px]:hidden"
                aria-hidden="true"
              >
                …
              </span>
            ) : slot.page === pagination.current ? (
              <span key={slot.page} className={pageLink({ current: true })} aria-current="page">
                {slot.page}
              </span>
            ) : (
              <Link
                key={slot.page}
                className={cn(pageLink(), "max-[880px]:hidden")}
                activeOptions={ACTIVE_OPTIONS}
                {...slot.link}
              >
                {slot.page}
              </Link>
            ),
          )}
          {pagination.nextLink ? (
            <Link
              className={pageLink({ step: true })}
              activeOptions={ACTIVE_OPTIONS}
              {...pagination.nextLink}
            >
              Next ›
            </Link>
          ) : (
            <span className={pageLink({ disabled: true })} aria-disabled="true">
              Next ›
            </span>
          )}
          {pagination.lastLink && (
            <Link
              className={pageLink({ step: true })}
              activeOptions={ACTIVE_OPTIONS}
              {...pagination.lastLink}
              aria-label={`Last page (${pagination.totalPages})`}
            >
              Last »
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
