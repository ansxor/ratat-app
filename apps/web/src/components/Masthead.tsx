import { Link } from "@tanstack/react-router";
import { AuthControl } from "#/components/AuthControl.tsx";
import { BrandMark } from "#/components/BrandMark.tsx";
import { MastheadNav } from "#/components/MastheadNav.tsx";
import { MobileSearch } from "#/components/search/MobileSearch.tsx";
import { SearchBar } from "#/components/search/SearchBar.tsx";
import { QuickSettingsMenu } from "#/components/QuickSettingsMenu.tsx";

export function Masthead() {
  return (
    <header className="masthead z-50 bg-header border-b-2 border-header-edge">
      <div className="masthead-row wrap flex items-center gap-[18px] h-[42px] max-[880px]:px-[12px] max-[880px]:gap-[8px]">
        <div className="masthead-leading flex flex-1 basis-0 items-center gap-[18px] min-w-0 max-[880px]:flex-none">
          <Link className="brand masthead-action" to="/" aria-label="Ratat home">
            <BrandMark className="text-header-fg" compact />
          </Link>

          <MastheadNav />
        </div>

        <div className="masthead-search-slot flex items-center gap-[9px] max-[520px]:gap-[8px] max-[880px]:flex-1 max-[880px]:min-w-0">
          <div className="max-[880px]:hidden">
            <SearchBar />
          </div>
          <MobileSearch />
        </div>

        <div className="masthead-actions flex flex-1 basis-0 items-center justify-end gap-[9px] max-[520px]:gap-[8px] max-[880px]:flex-none">
          <QuickSettingsMenu />
          <AuthControl />
        </div>
      </div>
    </header>
  );
}
