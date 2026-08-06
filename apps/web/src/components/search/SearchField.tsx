import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";

import { SearchDropdown, type SearchRow } from "#/components/search/SearchDropdown.tsx";
import { SearchIcon } from "#/components/ui/icons.tsx";
import { type ProfileBasic, searchActorsTypeahead } from "#/lib/ratat.ts";
import { TYPEAHEAD_DEBOUNCE_MS, useDebouncedValue } from "#/lib/use-debounced-value.ts";
import { cn } from "#/lib/utils.ts";

const SUGGESTION_LIMIT = 8;

const needleOf = (typed: string): string => typed.trim().replace(/^@/, "");

/**
 * The search box and its typeahead dropdown, ported from the old app's
 * `SearchBar` with the tag and operator halves left out — Ratat v1 searches
 * actors and nothing else.
 *
 * Enter on the first row still goes to the handle as typed, which is what this
 * box did before it had suggestions: an artist whose handle somebody knows
 * should not depend on the typeahead having heard of them.
 *
 * The layout is left to the caller: `SearchBar` gives it a fixed width in the
 * masthead, `MobileSearch` stretches it across the row. `onDismiss` fires when
 * the visitor is done with the field — Escape on a closed dropdown, or a
 * navigation — so the mobile overlay knows to collapse.
 */
export function SearchField({
  className,
  openClassName,
  autoFocus = false,
  onDismiss,
}: {
  className?: string;
  openClassName?: string;
  autoFocus?: boolean;
  onDismiss?: () => void;
}) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [actors, setActors] = useState<ProfileBasic[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const settled = useDebouncedValue(input.trim(), TYPEAHEAD_DEBOUNCE_MS);
  const needle = needleOf(settled);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!open || needle.length === 0) {
      setActors([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    searchActorsTypeahead(needle, { limit: SUGGESTION_LIMIT, signal: controller.signal })
      .then((found) => {
        if (controller.signal.aborted) return;
        setActors(found);
        setLoading(false);
      })
      .catch(() => {
        // A search that fails leaves the typed handle, which still works.
        if (!controller.signal.aborted) {
          setActors([]);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [needle, open]);

  const rows: SearchRow[] = [
    { kind: "handle" },
    ...actors.map((actor): SearchRow => ({ kind: "actor", actor })),
  ];

  const close = () => {
    setOpen(false);
    setActiveIndex(0);
  };

  const go = (handle: string) => {
    if (!handle) return;
    close();
    setInput("");
    inputRef.current?.blur();
    onDismiss?.();
    void navigate({ to: "/profile/$handle", params: { handle } });
  };

  const activate = (index: number) => {
    const row = rows[index];
    if (!row || row.kind === "handle") {
      go(needleOf(input));
      return;
    }
    go(row.actor.handle);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      activate(activeIndex);
      return;
    }
    if (event.key === "Escape") {
      // Escape backs out one step at a time: the suggestions first, the field
      // itself only once they are gone.
      if (open) close();
      else onDismiss?.();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + delta + rows.length) % rows.length);
      setOpen(true);
    }
  };

  return (
    <div
      className={cn(className, open && openClassName)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <div className="flex items-center flex-nowrap gap-[5px] bg-search-bg border border-search-line rounded-none py-[5px] pl-3 pr-2 text-faint transition-shadow duration-[180ms] focus-within:shadow-[0_0_0_2px_var(--color-primary)] [&>svg]:w-[15px] [&>svg]:h-[15px] [&>svg]:flex-none">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          className="bg-transparent border-none outline-none text-paper font-body text-[13.5px] flex-1 min-w-[40px] w-full placeholder:text-faint"
          value={input}
          placeholder="Find an artist…"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label="Find an artist"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeIndex > 0 ? `${listboxId}-row-${activeIndex}` : undefined
          }
          onChange={(event) => {
            setInput(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {input.length > 0 && (
          <button
            type="button"
            className="flex-none inline-flex items-center justify-center w-[18px] h-[18px] p-0 border-none bg-transparent text-faint text-[15px] leading-none cursor-pointer hover:text-paper"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setInput("");
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && input.trim().length > 0 && (
        <SearchDropdown
          id={listboxId}
          rows={rows}
          activeIndex={activeIndex}
          term={input}
          loading={loading}
          onActivate={activate}
          onHover={setActiveIndex}
        />
      )}
    </div>
  );
}
