import { Link } from "@tanstack/react-router";

import { AuthControl } from "#/components/AuthControl.tsx";
import { BrandMark } from "#/components/BrandMark.tsx";
import { HandleSearch } from "#/components/HandleSearch.tsx";
import { MastheadNav } from "#/components/MastheadNav.tsx";

export function Masthead() {
  return (
    <header className="sticky top-0 z-50 bg-header border-b-2 border-header-edge">
      <div className="wrap flex items-center gap-[18px] h-[42px]">
        <Link className="brand" to="/" aria-label="Ratat home">
          <BrandMark className="text-header-fg" />
        </Link>

        <MastheadNav />

        <div className="flex items-center gap-[9px] ml-auto mr-auto max-[520px]:gap-[8px]">
          <HandleSearch />
        </div>

        <div className="flex items-center gap-[9px] ml-auto max-[520px]:gap-[8px]">
          <AuthControl />
        </div>
      </div>
    </header>
  );
}
