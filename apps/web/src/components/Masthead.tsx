import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";

import { AuthControl } from "#/components/AuthControl.tsx";
import { BrandMark } from "#/components/BrandMark.tsx";
import { MastheadNav } from "#/components/MastheadNav.tsx";
import { QuickSettingsMenu } from "#/components/QuickSettingsMenu.tsx";
import { SearchBar } from "#/components/search/SearchBar.tsx";

const SEARCH_TRANSITION_MS = 320;

export function Masthead() {
  const [searchOverlay, setSearchOverlay] = useState<{ left: number; right: number }>();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const collapseTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(collapseTimer.current);
    },
    [],
  );

  const openSearchOverlay = (event: FocusEvent<HTMLDivElement>) => {
    if (!window.matchMedia("(max-width: 880px)").matches || searchOverlay) return;

    const slot = event.currentTarget;
    const row = slot.closest(".masthead-row");
    if (!row) return;

    const slotBox = slot.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    setSearchOverlay({
      left: slotBox.left - rowBox.left,
      right: rowBox.right - slotBox.right,
    });
    setSearchExpanded(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setSearchExpanded(true)));
  };

  const closeSearchOverlay = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget) || !searchOverlay) return;

    setSearchExpanded(false);
    window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(
      () => setSearchOverlay(undefined),
      SEARCH_TRANSITION_MS,
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-header border-b-2 border-header-edge">
      <div className="masthead-row wrap flex items-center gap-[18px] h-[42px] max-[880px]:px-[12px] max-[880px]:gap-[8px]">
        <div className="masthead-leading flex flex-1 basis-0 items-center gap-[18px] min-w-0 max-[880px]:flex-none">
          <Link className="brand" to="/" aria-label="Ratat home">
            <BrandMark className="text-header-fg" compact />
          </Link>

          <MastheadNav />
        </div>

        <div
          className="masthead-search-slot flex items-center gap-[9px] max-[520px]:gap-[8px] max-[880px]:flex-1 max-[880px]:min-w-0"
          onFocusCapture={openSearchOverlay}
          onBlurCapture={closeSearchOverlay}
        >
          <div
            className={`masthead-search ${searchOverlay ? "masthead-search--overlay" : ""} ${searchExpanded ? "masthead-search--expanded" : ""}`}
            style={
              searchOverlay
                ? ({
                    "--masthead-search-start": `${searchOverlay.left}px`,
                    "--masthead-search-end": `${searchOverlay.right}px`,
                  } as CSSProperties)
                : undefined
            }
          >
            <SearchBar />
          </div>
        </div>

        <div className="masthead-actions flex flex-1 basis-0 items-center justify-end gap-[9px] max-[520px]:gap-[8px] max-[880px]:flex-none">
          <QuickSettingsMenu />
          <AuthControl />
        </div>
      </div>
    </header>
  );
}
