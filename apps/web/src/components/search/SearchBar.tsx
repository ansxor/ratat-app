import { SearchField } from "#/components/search/SearchField.tsx";

/**
 * The inline masthead search, from 880px up. Narrower than that it gives way to
 * `MobileSearch`, which expands the same field over the masthead row on demand.
 */
export function SearchBar() {
  return (
    <SearchField
      className="relative w-[340px] transition-[width] duration-[180ms] max-[880px]:hidden"
      openClassName="w-[460px]"
    />
  );
}
