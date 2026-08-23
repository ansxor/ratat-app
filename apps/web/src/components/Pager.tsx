import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { formatTotal, type PagerPagination, type PagerSlot } from "#/lib/pagination.ts";
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

function useVisibleSlots(slots: Array<PagerSlot | "gap">): {
  areaRef: RefObject<HTMLDivElement | null>;
  probeRef: RefObject<HTMLDivElement | null>;
  visibleCount: number;
} {
  const areaRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [mobile, setMobile] = useState(false);

  useLayoutEffect(() => {
    const query = window.matchMedia("(max-width: 880px)");
    const updateMobile = () => setMobile(query.matches);
    query.addEventListener("change", updateMobile);
    updateMobile();
    return () => query.removeEventListener("change", updateMobile);
  }, []);

  useLayoutEffect(() => {
    if (!mobile) {
      setVisibleCount(slots.length);
      return;
    }

    setVisibleCount(0);

    const area = areaRef.current;
    const probe = probeRef.current;
    if (!area || !probe) return;

    let disposed = false;
    const update = () => {
      if (disposed) return;
      const available = area.getBoundingClientRect().width;
      const start = probe.getBoundingClientRect().left;
      let count = 0;
      for (const child of probe.children) {
        if (child.getBoundingClientRect().right - start > available) break;
        count += 1;
      }
      setVisibleCount(count);
    };

    const observer = new ResizeObserver(update);
    observer.observe(area);
    observer.observe(probe);
    document.fonts?.ready.then(update);
    update();
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [mobile, slots]);

  return { areaRef, probeRef, visibleCount };
}

const pageLink = (
  variants: { current?: boolean; step?: boolean; disabled?: boolean } = {},
): string =>
  cn(
    "text-[13px] font-[600] text-mist px-[8px] py-[3px] whitespace-nowrap transition-[color,background] duration-[140ms] hover:text-paper hover:bg-ink-hi max-[880px]:inline-flex max-[880px]:min-h-[48px] max-[880px]:min-w-[52px] max-[880px]:items-center max-[880px]:justify-center max-[880px]:px-[16px] max-[880px]:text-[17px] max-[880px]:font-[700]",
    variants.current &&
      "bg-[var(--pager-active)] text-[var(--pager-active-ink)] hover:bg-[var(--pager-active)] hover:text-[var(--pager-active-ink)] max-[880px]:size-[52px] max-[880px]:min-h-0 max-[880px]:rounded-full max-[880px]:p-0",
    variants.step && "text-primary hover:text-accent-ink hover:bg-primary max-[880px]:min-w-[56px]",
    variants.disabled && "text-faint cursor-not-allowed hover:text-faint hover:bg-transparent",
  );

function pageSlot(slot: PagerSlot | "gap", index: number, current: number): ReactNode {
  if (slot === "gap") {
    return (
      <span key={`gap-${index}`} className="text-faint px-[3px]" aria-hidden="true">
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
  return (
    <Link key={slot.page} className={pageLink()} activeOptions={ACTIVE_OPTIONS} {...slot.link}>
      {slot.page}
    </Link>
  );
}

function slotProbe(slot: PagerSlot | "gap", current: number): ReactNode {
  if (slot === "gap") return <span className="text-faint px-[3px]">…</span>;
  return <span className={pageLink({ current: slot.page === current })}>{slot.page}</span>;
}

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
  const slots = pagination?.slots ?? [];
  const { areaRef, probeRef, visibleCount } = useVisibleSlots(slots);
  const hasControls = Boolean(pagination && (pagination.slots.length > 1 || pagination.nextLink));
  const mobileDocked = variant !== "top";

  return (
    <>
      {/* Reserve space so the last row stays above the fixed mobile controls. */}
      {mobileDocked && hasControls && <div className="hidden h-[112px] max-[880px]:block" aria-hidden="true" />}
      <div
        className={cn(
          "flex items-center gap-[8px]",
          variant !== "standalone" &&
            "bg-[color-mix(in_srgb,var(--color-ink-raised)_92%,transparent)] border border-line px-[10px] py-[4px] mb-[0.4rem] max-[880px]:mb-0",
          variant === "bottom" && "mt-[0.4rem] mb-0 max-[880px]:mt-0",
          variant === "standalone" && "justify-center mt-[1.5rem]",
          variant === "top" && "max-[880px]:hidden",
          mobileDocked &&
            "max-[880px]:fixed max-[880px]:bottom-[calc(12px+env(safe-area-inset-bottom))] max-[880px]:left-1/2 max-[880px]:z-30 max-[880px]:w-[calc(100%-24px)] max-[880px]:-translate-x-1/2 max-[880px]:justify-center max-[880px]:rounded-[var(--r-md)] max-[880px]:border max-[880px]:border-line max-[880px]:bg-[color-mix(in_srgb,var(--color-ink-raised)_96%,transparent)] max-[880px]:px-[8px] max-[880px]:py-[4px] max-[880px]:shadow-[0_8px_24px_color-mix(in_srgb,var(--color-backdrop)_70%,transparent)] max-[880px]:backdrop-blur",
          !hasControls && "max-[880px]:hidden",
        )}
      >
        {leading ??
          (pagination?.total !== undefined && (
            <span className="text-[12px] tracking-[0.04em] text-faint whitespace-nowrap max-[880px]:hidden">
              {formatTotal(pagination.total, pagination.totalCapped)}{" "}
              {pagination.total === 1 ? countNoun[0] : countNoun[1]}
            </span>
          ))}
        {hasControls && pagination && (
          <nav
            className={cn(
              "flex min-w-0 items-center gap-[3px] max-[880px]:flex-1",
              variant !== "standalone" && "ml-auto",
            )}
            aria-label="Pagination"
          >
            {pagination.prevLink && (
              <Link
                className={pageLink({ step: true })}
                activeOptions={ACTIVE_OPTIONS}
                {...pagination.prevLink}
                aria-label="Previous page"
              >
                <ChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
              </Link>
            )}
            <div ref={areaRef} className="min-w-0 flex-1">
              <div className="flex items-center gap-[3px]">
                {pagination.slots.map((slot, index) => (
                  <div
                    key={slot === "gap" ? `gap-${index}` : slot.page}
                    className={cn("flex-none", index >= visibleCount && "hidden")}
                  >
                    {pageSlot(slot, index, pagination.current)}
                  </div>
                ))}
              </div>
            </div>
            <div ref={probeRef} className="absolute invisible flex w-max items-center gap-[3px]">
              {pagination.slots.map((slot, index) => (
                <div
                  key={slot === "gap" ? `probe-gap-${index}` : `probe-${slot.page}`}
                  className="flex-none"
                >
                  {slotProbe(slot, pagination.current)}
                </div>
              ))}
            </div>
            {pagination.nextLink ? (
              <Link
                className={pageLink({ step: true })}
                activeOptions={ACTIVE_OPTIONS}
                {...pagination.nextLink}
                aria-label="Next page"
              >
                <ChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
              </Link>
            ) : (
              <span className={pageLink({ step: true, disabled: true })} aria-disabled="true" aria-label="No next page">
                <ChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
              </span>
            )}
            {pagination.lastLink && (
              <Link
                className={pageLink({ step: true })}
                activeOptions={ACTIVE_OPTIONS}
                {...pagination.lastLink}
                aria-label={`Last page (${pagination.totalPages})`}
              >
                <ChevronsRight aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
