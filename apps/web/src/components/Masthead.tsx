import { Link } from "@tanstack/react-router";

import { AuthControl } from "#/components/AuthControl.tsx";
import { BrandMark } from "#/components/BrandMark.tsx";
import { MastheadNav } from "#/components/MastheadNav.tsx";
import { QuickSettingsMenu } from "#/components/QuickSettingsMenu.tsx";
import { MobileSearch } from "#/components/search/MobileSearch.tsx";
import { SearchBar } from "#/components/search/SearchBar.tsx";

export function Masthead() {
  return (
    <header className="sticky top-0 z-50 bg-header border-b-2 border-header-edge">
      <div className="wrap flex items-center gap-[18px] h-[42px]">
        <div className="flex flex-1 basis-0 items-center gap-[18px] min-w-0">
          <Link className="brand" to="/" aria-label="Ratat home">
            <BrandMark className="text-header-fg" compact />
          </Link>

          <MastheadNav />
        </div>

        <div className="flex items-center gap-[9px] max-[520px]:gap-[8px]">
          <SearchBar />
          <MobileSearch />
        </div>

        <div className="flex flex-1 basis-0 items-center justify-end gap-[9px] max-[520px]:gap-[8px]">
          <QuickSettingsMenu />
          <AuthControl />
        </div>
      </div>
    </header>
  );
}
