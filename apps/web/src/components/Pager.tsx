import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

import {
  pageSlots,
  type PagerPagination,
  type PagerSlot,
  usePaginationViewport,
} from "#/lib/pagination.tsx";
import { cn } from "#/lib/utils.ts";

/**
 * Ported from the old app's `src/components/Pager.tsx`: same markup and
 * classes, with `cva` folded into `cn` and Next's `Link` swapped for the
 * router's. The old app's `captureEvent` call is dropped — no observability
 * library here yet. Its settings cog is dropped because pager controls belong
 * with pagination, while content settings live in the masthead.
 */

/**
 * The current page renders as a span, so no link in the pager should ever read
 * as active. Without this the router treats `?page=` links as matching any
 * page — search params are matched by subset — and stamps a second
 * `aria-current` onto the nav.
 */
const ACTIVE_OPTIONS = { exact: true, includeSearch: true } as const;

function mobileSlots(pagination: PagerPagination): Array<PagerSlot | "gap"> {
  const wanted = new Set(
    pageSlots(pagination.current, pagination.totalPages ?? pagination.current, 1, 5),
  );
  return pagination.slots.filter((slot) => slot === "gap" || wanted.has(slot.page));
}

const pageLink = (
  variants: { current?: boolean; step?: boolean; disabled?: boolean } = {},
): string =>
  cn(
    "text-[15px] font-[600] text-mist px-[8px] py-[3px] whitespace-nowrap transition-[color,background] duration-[140ms] hover:text-paper hover:bg-ink-hi max-mobile:inline-flex max-mobile:min-h-[44px] max-mobile:min-w-[44px] max-mobile:items-center max-mobile:justify-center max-mobile:px-[10px]",
    variants.current &&
      "bg-primary !text-[var(--pager-active-ink)] hover:bg-primary hover:!text-[var(--pager-active-ink)]",
    variants.step && "text-primary hover:!text-[var(--pager-active-ink)] hover:bg-primary",
    variants.disabled && "text-faint cursor-not-allowed hover:text-faint hover:bg-transparent",
  );

function pageSlot(
  slot: PagerSlot | "gap",
  index: number,
  current: number,
  visualOnly: boolean,
): ReactNode {
  if (slot === "gap") {
    return (
      <span key={`gap-${index}`} className="text-faint text-[11px] px-0" aria-hidden="true">
        …
      </span>
    );
  }
  if (slot.page === current) {
    return (
      <span key={slot.page} className={pageLink({ current: true })} aria-current="page">
        {slot.page}
      </span>
    );
  }
  if (visualOnly) {
    return (
      <span key={slot.page} className={pageLink()}>
        {slot.page}
      </span>
    );
  }
  return (
    <Link key={slot.page} className={pageLink()} activeOptions={ACTIVE_OPTIONS} {...slot.link}>
      {slot.page}
    </Link>
  );
}

export function Pager({
  variant = "top",
  leading,
  pagination,
  visualOnly = false,
}: {
  variant?: "top" | "bottom" | "standalone";
  leading?: ReactNode;
  pagination?: PagerPagination;
  visualOnly?: boolean;
}) {
  const { isMobile } = usePaginationViewport();
  const displayedSlots = pagination && isMobile ? mobileSlots(pagination) : pagination?.slots;

  return (
    <div
      className={cn(
        "flex items-center gap-[8px]",
        variant !== "standalone" &&
          "bg-[color-mix(in_srgb,var(--color-ink-raised)_92%,transparent)] border border-line px-[10px] py-[4px] mb-[0.4rem] max-mobile:mb-0",
        variant === "top" && "max-mobile:hidden",
        variant === "bottom" && "mt-[0.4rem] mb-0 max-mobile:mt-0",
        variant === "standalone" && "justify-center mt-[1.5rem]",
      )}
    >
      {leading}
      {pagination && (pagination.slots.length > 1 || pagination.nextLink) && (
        <nav
          className={cn(
            "flex min-w-0 items-center gap-[3px] max-mobile:w-full max-mobile:justify-between",
            variant !== "standalone" && "ml-auto",
          )}
          aria-label="Pagination"
        >
          {pagination.prevLink &&
            (visualOnly ? (
              <span className={pageLink({ step: true })}>
                ‹ <span className="max-mobile:hidden">Prev</span>
              </span>
            ) : (
              <Link
                className={pageLink({ step: true })}
                activeOptions={ACTIVE_OPTIONS}
                {...pagination.prevLink}
              >
                ‹ <span className="max-mobile:hidden">Prev</span>
              </Link>
            ))}
          {!pagination.prevLink && (
            <span
              className={cn(pageLink({ disabled: true }), "hidden max-mobile:inline-flex")}
              aria-disabled="true"
            >
              ‹
            </span>
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center justify-center gap-[3px]">
              {displayedSlots?.map((slot, index) => (
                <div key={slot === "gap" ? `gap-${index}` : slot.page} className="flex-none">
                  {pageSlot(slot, index, pagination.current, visualOnly)}
                </div>
              ))}
            </div>
          </div>
          {pagination.nextLink ? (
            visualOnly ? (
              <span className={pageLink({ step: true })}>
                <span className="max-mobile:hidden">Next</span> ›
              </span>
            ) : (
              <Link
                className={pageLink({ step: true })}
                activeOptions={ACTIVE_OPTIONS}
                {...pagination.nextLink}
              >
                <span className="max-mobile:hidden">Next</span> ›
              </Link>
            )
          ) : (
            <span className={pageLink({ disabled: true })} aria-disabled="true">
              <span className="max-mobile:hidden">Next</span> ›
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
