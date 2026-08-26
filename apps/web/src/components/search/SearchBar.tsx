import { SearchField } from "#/components/search/SearchField.tsx";

/**
 * The inline masthead search. Desktop gives it a fixed width that grows while
 * it is focused; below 880px it fills the space the masthead hands it (it
 * replaced the old button-and-overlay `MobileSearch`).
 */
export function SearchBar() {
  return (
    <SearchField className="relative shrink-0 w-[340px] transition-[width] duration-[260ms] ease-out focus-within:w-[460px] motion-reduce:transition-none max-[880px]:hidden" />
  );
}
