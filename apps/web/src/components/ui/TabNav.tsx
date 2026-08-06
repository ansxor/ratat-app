import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "#/lib/utils.ts";

export type TabNavItem = {
  key: string;
  link: LinkProps;
  label: string;
  icon: ReactNode;
};

export function TabNav({
  items,
  activeKey,
  ariaLabel,
}: {
  items: readonly TabNavItem[];
  activeKey: string;
  ariaLabel: string;
}) {
  return (
    <nav
      className="flex gap-[2px] mt-[22px] border-b border-line overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Link
            key={item.key}
            {...item.link}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center whitespace-nowrap no-underline cursor-pointer",
              "font-body text-[14px] border-b-[3px] border-b-transparent -mb-px",
              active
                ? "gap-[7px] px-[14px] py-[9px] font-[700] text-primary border-b-primary"
                : "gap-0 px-[12px] py-[9px] font-[600] text-paper hover:text-primary",
            )}
          >
            <span className="inline-flex flex-none [&_svg]:size-[15px]">{item.icon}</span>
            {active && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
