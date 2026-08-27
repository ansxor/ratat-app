import { SearchField } from "#/components/search/SearchField.tsx";

/**
 * The inline masthead search used on desktop. Mobile uses `MobileSearch`,
 * which opens the same field in a panel above the bottom action bar.
 */
export function SearchBar() {
  return (
    <SearchField className="relative shrink-0 w-[340px] transition-[width] duration-[320ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] focus-within:w-[460px] motion-reduce:transition-none max-mobile:w-full max-mobile:min-w-0 max-mobile:focus-within:w-full" />
  );
}
