import { useRef, useState } from "react";

import { SearchField } from "#/components/search/SearchField.tsx";
import { SearchIcon } from "#/components/ui/icons.tsx";
import { cn } from "#/lib/utils.ts";

const BUTTON =
  "size-[28px] flex-none inline-flex items-center justify-center cursor-pointer p-0 border-none bg-header-tint text-header-fg transition-colors duration-[140ms] hover:bg-header-tint-hi";

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

      <div
        aria-hidden={!open}
        className={cn(
          "absolute inset-y-0 right-0 z-10 flex items-center gap-[9px] overflow-hidden bg-header px-[var(--pad)] transition-[width,opacity] duration-[260ms] ease-out",
          open
            ? "w-full opacity-100 pointer-events-auto"
            : "w-[28px] opacity-0 pointer-events-none",
        )}
        onBlur={(event) => {
          if (open && !event.currentTarget.contains(event.relatedTarget)) dismiss(false);
        }}
      >
        <SearchField
          className="relative flex-1 min-w-0"
          autoFocus={open}
          onDismiss={() => dismiss(true)}
        />
        <button
          type="button"
          aria-label="Close search"
          tabIndex={open ? 0 : -1}
          className={BUTTON}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => dismiss(true)}
        >
          <span aria-hidden="true" className="text-[17px] leading-none">
            ×
          </span>
        </button>
      </div>
    </div>
  );
}
