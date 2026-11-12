import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  clampPage,
  formatTotal,
  mobileSlots,
  pageCount,
  pageHref,
  pageSlots,
  pagerLinks,
  paginationSearch,
} from "./pagination.ts";

const pager = readFileSync(new URL("./components/Pager.svelte", import.meta.url), "utf8");

describe("pagination", () => {
  test("pagination search preserves an explicit page one", () => {
    expect(paginationSearch({ page: "1" })).toEqual({ page: 1 });
    expect(paginationSearch({})).toEqual({});
  });

  test("pagination search ignores invalid page values", () => {
    expect(paginationSearch({ page: "0" })).toEqual({});
    expect(paginationSearch({ page: "not-a-page" })).toEqual({});
    expect(paginationSearch(new URLSearchParams("page=3"))).toEqual({ page: 3 });
    expect(paginationSearch(new URLSearchParams("page=-2"))).toEqual({});
  });

  test("pagination slots stay compact at either end", () => {
    expect(pageSlots(1, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
    expect(pageSlots(20, 20)).toEqual([1, "gap", 17, 18, 19, 20]);
  });

  test("pageCount and clampPage handle bounds", () => {
    expect(pageCount(0, 30)).toBe(1);
    expect(pageCount(90, 30)).toBe(3);
    expect(pageCount(91, 30)).toBe(4);
    expect(clampPage(10, 50, 30)).toBe(2);
    expect(clampPage(0, 50, 30)).toBe(1);
    expect(clampPage(5, undefined, 30)).toBe(5);
  });

  test("pagerLinks builds numbered slots and prev/next hrefs", () => {
    const p1 = pagerLinks({
      page: 1,
      limit: 30,
      total: 920,
      itemCount: 30,
      href: (target) => pageHref("/profile/bsky.app", target),
    });
    expect(p1.current).toBe(1);
    expect(p1.totalPages).toBe(31);
    expect(p1.prevHref).toBeUndefined();
    expect(p1.nextHref).toBe("/profile/bsky.app?page=2");

    const p2 = pagerLinks({
      page: 2,
      limit: 30,
      total: 920,
      itemCount: 30,
      href: (target) => pageHref("/profile/bsky.app", target),
    });
    expect(p2.prevHref).toBe("/profile/bsky.app");
    expect(p2.nextHref).toBe("/profile/bsky.app?page=3");
    expect(mobileSlots(p2).some((s) => s !== "gap" && s.page === 2)).toBe(true);
    expect(formatTotal(920, true)).toBe("920+");
  });
});

describe("Pager.svelte", () => {
  test("mobile pager controls have larger touch targets", () => {
    expect(pager).toContain("max-mobile:inline-flex");
    expect(pager).toContain("max-mobile:min-h-[44px]");
    expect(pager).toContain("max-mobile:min-w-[44px]");
  });

  test("top pager is hidden on mobile without hiding other variants", () => {
    expect(pager).toContain('variant === "top" && "max-mobile:hidden"');
    expect(pager).toContain('variant === "bottom" && "mt-[0.4rem] mb-0 max-mobile:mt-0"');
  });
});
