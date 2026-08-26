import { expect, test } from "bun:test";

import { readFileSync } from "node:fs";

const pager = readFileSync(new URL("./Pager.tsx", import.meta.url), "utf8");

test("mobile pager measures whole page controls instead of clipping their text", () => {
  expect(pager).toContain("ResizeObserver");
  expect(pager).toContain("observer.observe(probe)");
  expect(pager).toContain("document.fonts?.ready.then(update)");
  expect(pager).toContain("let disposed = false");
  expect(pager).toContain("if (disposed) return");
  expect(pager).toContain("disposed = true");
  expect(pager).toContain("getBoundingClientRect().width");
  expect(pager).not.toContain('className="min-w-0 overflow-hidden"');
});

test("mobile pager keeps each visible page control intact", () => {
  expect(pager).toContain('className={cn("flex-none", index >= visibleCount && "hidden")}');
});

test("mobile pager controls have larger touch targets", () => {
  expect(pager).toContain("max-[880px]:inline-flex");
  expect(pager).toContain("max-[880px]:min-h-[44px]");
  expect(pager).toContain("max-[880px]:min-w-[44px]");
});
