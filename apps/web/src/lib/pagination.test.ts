import { expect, test } from "bun:test";

import { pageSlots, paginationSearch } from "./pagination.tsx";

test("pagination search preserves an explicit page one", () => {
  expect(paginationSearch({ page: "1" })).toEqual({ page: 1 });
  expect(paginationSearch({})).toEqual({});
});

test("pagination search ignores invalid page values", () => {
  expect(paginationSearch({ page: "0" })).toEqual({});
  expect(paginationSearch({ page: "not-a-page" })).toEqual({});
});

test("pagination slots stay compact at either end", () => {
  expect(pageSlots(1, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
  expect(pageSlots(20, 20)).toEqual([1, "gap", 17, 18, 19, 20]);
});
