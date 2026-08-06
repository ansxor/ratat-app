import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { SearchIcon } from "#/components/ui/icons.tsx";

/**
 * Stands in for the old app's SearchBar until search lands: same frame, same
 * typography, but it only jumps to an artist's portfolio.
 */
export function HandleSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const handle = value.trim().replace(/^@/, "");
    if (!handle) return;
    setValue("");
    void navigate({ to: "/profile/$handle", params: { handle } });
  };

  return (
    <form onSubmit={submit} className="relative w-[340px] max-[880px]:hidden" role="search">
      <div className="flex items-center flex-nowrap gap-[5px] bg-search-bg border border-search-line rounded-none py-[5px] pl-3 pr-2 text-faint transition-shadow duration-[180ms] focus-within:shadow-[0_0_0_2px_var(--color-primary)] [&>svg]:w-[15px] [&>svg]:h-[15px] [&>svg]:flex-none">
        <SearchIcon />
        <input
          type="text"
          className="bg-transparent border-none outline-none text-paper font-body text-[13.5px] flex-1 min-w-[40px] w-full placeholder:text-faint"
          value={value}
          placeholder="Go to an artist by handle…"
          autoComplete="off"
          spellCheck={false}
          aria-label="Go to an artist by handle"
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    </form>
  );
}
