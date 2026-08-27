import { expect, test } from "bun:test";

import { readFileSync } from "node:fs";

const pager = readFileSync(new URL("./Pager.tsx", import.meta.url), "utf8");

test("mobile pager controls have larger touch targets", () => {
  expect(pager).toContain("max-mobile:inline-flex");
  expect(pager).toContain("max-mobile:min-h-[44px]");
  expect(pager).toContain("max-mobile:min-w-[44px]");
});

test("top pager is hidden on mobile without hiding other variants", () => {
  expect(pager).toContain('variant === "top" && "max-mobile:hidden"');
  expect(pager).toContain('variant === "bottom" && "mt-[0.4rem] mb-0 max-mobile:mt-0"');
});
