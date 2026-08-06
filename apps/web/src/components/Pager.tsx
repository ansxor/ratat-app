import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { SettingsIcon } from "#/components/ui/icons.tsx";
import { formatTotal, type PagerPagination } from "#/lib/pagination.ts";
import { cn } from "#/lib/utils.ts";

/**
 * Ported from the old app's `src/components/Pager.tsx`: same markup and
 * classes, with `cva` folded into `cn` and Next's `Link` swapped for the
 * router's. The old app's `captureEvent` call is dropped — no observability
 * library here yet.
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
    "text-[13px] font-[600] text-mist px-[8px] py-[3px] transition-[color,background] duration-[140ms] hover:text-paper hover:bg-ink-hi",
    variants.current && "bg-primary text-accent-ink hover:bg-primary hover:text-accent-ink",
    variants.step && "text-primary hover:text-accent-ink hover:bg-primary",
    variants.disabled && "text-faint cursor-not-allowed hover:text-faint hover:bg-transparent",
  );

export function Pager({
  variant = "top",
  leading,
  settings = variant === "top",
  pagination,
  countNoun = ["work", "works"],
}: {
  variant?: "top" | "bottom" | "standalone";
  leading?: ReactNode;
  settings?: boolean;
  pagination?: PagerPagination;
  countNoun?: readonly [string, string];
}) {
  const [open, setOpen] = useState(false);
  const [alwaysShow, setAlwaysShow] = useState(false);
  const cogRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle("show-details", alwaysShow);
    return () => document.body.classList.remove("show-details");
  }, [alwaysShow]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!(e.target instanceof Node)) return;
      if (
        open &&
        menuRef.current &&
        cogRef.current &&
        !menuRef.current.contains(e.target) &&
        !cogRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <div
      className={cn(
        "flex items-center gap-[8px]",
        variant !== "standalone" &&
          "bg-[color-mix(in_srgb,var(--color-ink-raised)_92%,transparent)] border border-line px-[10px] py-[4px] mb-[0.4rem]",
        variant === "bottom" && "mt-[0.4rem] mb-0",
        variant === "standalone" && "justify-center mt-[1.5rem]",
      )}
    >
      {variant === "top" && settings && (
        <div className="relative inline-flex">
          <button
            type="button"
            ref={cogRef}
            className="inline-flex items-center text-mist p-[3px] transition-colors duration-[140ms] hover:text-paper [&_svg]:size-[18px]"
            title="Settings"
            aria-label="Settings"
            aria-haspopup="true"
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <SettingsIcon />
          </button>
          {open && (
            <div
              ref={menuRef}
              className="absolute top-[calc(100%+6px)] left-0 bg-ink-raised border border-line p-[9px_11px] min-w-[206px] z-30 shadow-[0_12px_28px_-12px_var(--shadow-drop)] [&_.toggle+.toggle]:mt-[8px]"
            >
              <label className="toggle flex items-center gap-[9px] cursor-pointer text-[13px] font-[600] text-paper">
                <input
                  type="checkbox"
                  checked={alwaysShow}
                  className="appearance-none flex-none w-[34px] h-[18px] rounded-full relative cursor-pointer bg-ink-hi border border-line transition-[background,border-color] duration-[150ms] after:content-[''] after:absolute after:top-px after:left-px after:size-[14px] after:rounded-full after:bg-ink-raised after:shadow-[0_1px_2px_var(--shadow)] after:transition-transform after:duration-[150ms] checked:bg-primary checked:border-primary checked:after:translate-x-[16px]"
                  onChange={(e) => setAlwaysShow(e.target.checked)}
                />
                <span>Always show details</span>
              </label>
            </div>
          )}
        </div>
      )}
      {leading ??
        (pagination?.total !== undefined && (
          <span className="text-[12px] tracking-[0.04em] text-faint whitespace-nowrap">
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
              <span key={`gap-${i}`} className="text-faint px-[3px]" aria-hidden="true">
                …
              </span>
            ) : slot.page === pagination.current ? (
              <span key={slot.page} className={pageLink({ current: true })} aria-current="page">
                {slot.page}
              </span>
            ) : (
              <Link
                key={slot.page}
                className={pageLink()}
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
