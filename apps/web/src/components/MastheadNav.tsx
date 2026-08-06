import { Link, useRouterState } from "@tanstack/react-router";

import { HomeIcon } from "#/components/ui/icons.tsx";
import { cn } from "#/lib/utils.ts";

const NAV_LINK =
  "text-[13.5px] font-[500] px-[7px] py-[5px] rounded-[6px] transition-[color,background] duration-[180ms] text-header-fg-dim hover:text-header-fg hover:bg-header-tint";
const NAV_LINK_ACTIVE = "text-header-fg bg-header-tint";

export function MastheadNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const home = pathname === "/";

  return (
    <nav className="flex gap-4 ml-[8px] items-center max-[880px]:hidden" aria-label="Primary">
      <Link
        className={cn("flex gap-2", NAV_LINK, home && NAV_LINK_ACTIVE)}
        to="/"
        aria-current={home ? "page" : undefined}
      >
        <HomeIcon className="size-5" /> Home
      </Link>
    </nav>
  );
}
