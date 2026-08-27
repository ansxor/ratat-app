import { useRef, useState } from "react";

import { SearchField } from "#/components/search/SearchField.tsx";
import { SearchIcon } from "#/components/ui/icons.tsx";

const BUTTON =
  "masthead-action size-full min-h-[52px] flex-1 inline-flex items-center justify-center cursor-pointer p-0 border-none bg-header-tint text-header-fg transition-colors duration-[140ms] hover:bg-header-tint-hi";

/**
 * Mobile search is a large action-bar button. Its field opens in a panel just
 * above the fixed mobile masthead so it never takes space from the gallery.
 */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const dismiss = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  return (
    <div className="masthead-mobile-search hidden max-[880px]:flex items-center">
      <button
        ref={toggleRef}
        type="button"
        aria-label="Search"
        title="Search"
        aria-expanded={open}
        className={BUTTON}
        onClick={() => setOpen(true)}
      >
        <SearchIcon size={22} strokeWidth={1.9} />
      </button>

      {open && (
        <div
          className="masthead-mobile-search-panel absolute bottom-full left-0 right-0 z-10 flex items-center gap-[9px] bg-header px-[12px] py-[8px] shadow-[0_-8px_20px_-16px_var(--shadow-drop)]"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) dismiss(false);
          }}
        >
          <SearchField
            className="masthead-mobile-search-field relative flex-1 min-w-0"
            autoFocus
            onDismiss={() => dismiss(true)}
          />
          <button
            type="button"
            aria-label="Close search"
            className={`${BUTTON} masthead-mobile-search-close`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => dismiss(true)}
          >
            <span aria-hidden="true" className="text-[22px] leading-none">
              ×
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
