import { useRef, useState } from "react";

import { SearchField } from "#/components/search/SearchField.tsx";
import { SearchIcon } from "#/components/ui/icons.tsx";

const BUTTON =
  "size-[28px] flex-none inline-flex items-center justify-center cursor-pointer p-0 border-none bg-header-tint text-header-fg transition-colors duration-[140ms] hover:bg-header-tint-hi";

/**
 * Search below 880px, where `SearchBar` has no room to sit inline: a button in
 * the masthead that expands the same field across the whole row.
 *
 * The expanded field is absolutely positioned against `.wrap`, the masthead's
 * only positioned ancestor, so it covers the brand and the account controls for
 * as long as it is open rather than reflowing the row around it.
 */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const dismiss = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  return (
    <div className="hidden max-[880px]:flex items-center">
      <button
        ref={toggleRef}
        type="button"
        aria-label="Search"
        title="Search"
        aria-expanded={open}
        className={BUTTON}
        onClick={() => setOpen(true)}
      >
        <SearchIcon size={17} strokeWidth={1.9} />
      </button>

      {open && (
        <div
          className="absolute inset-0 z-10 flex items-center gap-[9px] bg-header px-[var(--pad)]"
          onBlur={(event) => {
            // Tapping the page outside the field closes it again; focus follows
            // the tap, so it must not be dragged back to the button.
            if (!event.currentTarget.contains(event.relatedTarget)) dismiss(false);
          }}
        >
          <SearchField
            className="relative flex-1 min-w-0"
            autoFocus
            onDismiss={() => dismiss(true)}
          />
          <button
            type="button"
            aria-label="Close search"
            className={BUTTON}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => dismiss(true)}
          >
            <span aria-hidden="true" className="text-[17px] leading-none">
              ×
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
