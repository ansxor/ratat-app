import { Link } from "@tanstack/react-router";

import { AuthControl } from "#/components/AuthControl.tsx";
import { BrandMark } from "#/components/BrandMark.tsx";
import { MastheadNav } from "#/components/MastheadNav.tsx";
import { MobileSearch } from "#/components/search/MobileSearch.tsx";
import { SearchBar } from "#/components/search/SearchBar.tsx";
import { QuickSettingsMenu } from "#/components/QuickSettingsMenu.tsx";

const HEADER = "z-50 bg-header border-header-edge box-border max-w-[100vw]";
const DESKTOP_ROW = "masthead-row wrap flex items-center gap-[18px] h-[42px]";
const MOBILE_ROW =
  "masthead-row wrap grid grid-cols-4 gap-1 h-[64px] p-[4px_8px] max-mobile:static";

function MastheadBar({ mobile = false }: { mobile?: boolean }) {
  const row = mobile ? MOBILE_ROW : DESKTOP_ROW;
  const header = mobile
    ? "masthead masthead--mobile hidden max-mobile:block relative order-2 flex-none w-full border-t-2"
    : "masthead masthead--desktop sticky top-0 border-b-2 max-mobile:hidden";

  return (
    <header className={`${header} ${HEADER}`} aria-label={mobile ? "Mobile navigation" : undefined}>
      <div className={row}>
        {mobile ? (
          <Link
            className="brand masthead-action min-w-0 w-full h-full min-h-[52px] inline-flex items-center justify-center bg-header-tint hover:bg-header-tint-hi"
            to="/"
            aria-label="Ratat home"
          >
            <BrandMark className="text-header-fg" compact />
          </Link>
        ) : (
          <div className="masthead-leading flex flex-1 basis-0 items-center gap-[18px] min-w-0">
            <Link className="brand" to="/" aria-label="Ratat home">
              <BrandMark className="text-header-fg" compact />
            </Link>
            <MastheadNav />
          </div>
        )}

        <div
          className={`masthead-search-slot flex items-center gap-[9px] ${mobile ? "min-w-0 w-full h-full" : ""}`}
        >
          {mobile ? <MobileSearch /> : <SearchBar />}
        </div>

        <div
          className={`masthead-actions items-center justify-end gap-[9px] ${mobile ? "contents" : "flex flex-1 basis-0"}`}
        >
          <QuickSettingsMenu />
          <AuthControl />
        </div>
      </div>
    </header>
  );
}

export function Masthead() {
  return (
    <>
      <MastheadBar />
      <MastheadBar mobile />
    </>
  );
}
