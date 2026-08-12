import { expect, test } from "bun:test";

import { mobilePageSlots } from "./Pager.tsx";

test("mobile pager keeps a compact run of page numbers around the current page", () => {
  const slots = [
    { page: 1, link: { to: "/" } },
    "gap",
    { page: 4, link: { to: "/", search: { page: 4 } } },
    { page: 5, link: { to: "/", search: { page: 5 } } },
    { page: 6, link: { to: "/", search: { page: 6 } } },
    { page: 7, link: { to: "/", search: { page: 7 } } },
    { page: 8, link: { to: "/", search: { page: 8 } } },
    "gap",
    { page: 20, link: { to: "/", search: { page: 20 } } },
  ] as const;

  expect(mobilePageSlots(slots, 6).map((slot) => slot.page)).toEqual([5, 6, 7]);
});

test("mobile pager keeps page numbers at the start of a feed", () => {
  const slots = [
    { page: 1, link: { to: "/" } },
    { page: 2, link: { to: "/", search: { page: 2 } } },
    { page: 3, link: { to: "/", search: { page: 3 } } },
    { page: 4, link: { to: "/", search: { page: 4 } } },
  ] as const;

  expect(mobilePageSlots(slots, 1).map((slot) => slot.page)).toEqual([1, 2]);
});

test("mobile pager keeps page numbers at the end of a feed", () => {
  const slots = [
    { page: 1, link: { to: "/" } },
    "gap",
    { page: 8, link: { to: "/", search: { page: 8 } } },
    { page: 9, link: { to: "/", search: { page: 9 } } },
    { page: 10, link: { to: "/", search: { page: 10 } } },
  ] as const;

  expect(mobilePageSlots(slots, 10).map((slot) => slot.page)).toEqual([9, 10]);
});
