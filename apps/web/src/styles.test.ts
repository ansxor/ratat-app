import { expect, test } from "bun:test";

import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const masthead = readFileSync(new URL("./components/Masthead.tsx", import.meta.url), "utf8");
const rootRoute = readFileSync(new URL("./routes/__root.tsx", import.meta.url), "utf8");
const quickSettings = readFileSync(
  new URL("./components/QuickSettingsMenu.tsx", import.meta.url),
  "utf8",
);

function declaration(selector: string, property: string, css = styles): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
  return block?.match(new RegExp(`(?:^|\\n)\\s*${property}\\s*:\\s*([^;]+)`))?.[1]?.trim();
}

test("censored gallery cards keep their artist header above the veil", () => {
  // ArtworkVeil uses z-[3]; the artist header must remain above it.
  expect(Number(declaration(".piece__top", "z-index"))).toBeGreaterThan(3);
});

test("the search combobox disables document scroll padding only while focused", () => {
  expect(declaration("html", "scroll-padding-top")).toBe("calc(var(--header-h) + 10px)");
  expect(declaration('html:has(header [role="combobox"]:focus)', "scroll-padding-top")).toBe("0");
  expect(declaration("html:has(header:focus-within)", "scroll-padding-top")).toBeUndefined();
});

test("mobile masthead is a four-cell sibling below the scrolling content", () => {
  expect(styles).not.toContain("position: sticky");
  expect(rootRoute).toContain("app-shell flex flex-col h-dvh overflow-hidden");
  expect(rootRoute).toContain("app-content flex-auto min-h-0 overflow-auto overflow-x-hidden");
  expect(masthead).toMatch(/<MastheadBar \/>[\s\S]*<MastheadBar mobile \/>/);
  expect(masthead).toContain("grid grid-cols-4");
});

test("mobile masthead places search above the action bar", () => {
  expect(masthead).toContain("<MobileSearch />");
  expect(masthead).toContain("order-2 flex-none");
  expect(styles).toMatch(
    /\.masthead-mobile-search-field > div:first-child\s*\{[\s\S]*?min-height:\s*44px;/,
  );
});

test("mobile quick settings uses a full-width sheet without an arrow", () => {
  expect(quickSettings).toContain("max-[880px]:static");
  expect(quickSettings).toContain("max-[880px]:w-full");
  expect(quickSettings).toContain("max-[880px]:hidden");
  expect(quickSettings).toContain("max-[880px]:bottom-[calc(100%+8px)]");
});

test("the mobile gallery feed fills the column instead of shrinking to its cards", () => {
  expect(declaration(".feed", "width")).toBeUndefined();
  expect(styles).toMatch(
    /@media\s*\(max-width:\s*880px\)\s*\{[\s\S]*?\.feed\s*\{\s*width:\s*100%\s*;/,
  );
});

test("gallery card details are controlled by their page context", () => {
  expect(styles).not.toContain("body.show-details");
  expect(styles).toMatch(/\.piece--pinned \.piece__top\s*\{/);
  expect(styles).toMatch(/\.piece--reveal \.piece__top\s*\{/);
});

test("home gallery item headers are hidden on mobile", () => {
  expect(styles).toMatch(
    /@media\s*\(max-width:\s*880px\)\s*\{[\s\S]*?\.gallery--home \.piece__top\s*\{\s*display:\s*none;/,
  );
});
