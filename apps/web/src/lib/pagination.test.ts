import { expect, test } from "bun:test";

import { paginationSearch, shouldUseMobileInfinitePagination } from "./pagination.tsx";

test("pagination search preserves an explicit page one", () => {
  expect(paginationSearch({ page: "1" })).toEqual({ page: 1 });
  expect(paginationSearch({})).toEqual({});
});

test("pagination search ignores invalid page values", () => {
  expect(paginationSearch({ page: "0" })).toEqual({});
  expect(paginationSearch({ page: "not-a-page" })).toEqual({});
});

test("mobile infinite pagination has the desktop and URL opt-outs", () => {
  expect(
    shouldUseMobileInfinitePagination({
      isMobile: true,
      hasBeenDesktop: false,
      hasPageParam: false,
    }),
  ).toBe(true);
  expect(
    shouldUseMobileInfinitePagination({
      isMobile: false,
      hasBeenDesktop: false,
      hasPageParam: false,
    }),
  ).toBe(false);
  expect(
    shouldUseMobileInfinitePagination({
      isMobile: true,
      hasBeenDesktop: true,
      hasPageParam: false,
    }),
  ).toBe(false);
  expect(
    shouldUseMobileInfinitePagination({
      isMobile: true,
      hasBeenDesktop: false,
      hasPageParam: true,
    }),
  ).toBe(false);
});
