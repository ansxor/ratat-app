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

test("mobile infinite pagination follows the viewport mode", () => {
  expect(shouldUseMobileInfinitePagination({ isMobile: true })).toBe(true);
  expect(shouldUseMobileInfinitePagination({ isMobile: false })).toBe(false);
});
