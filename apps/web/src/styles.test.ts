import { expect, test } from "bun:test";

import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

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

test("mobile masthead is a four-cell action bar fixed to the bottom", () => {
  expect(styles).toMatch(
    /@media\s*\(max-width:\s*880px\)\s*\{[\s\S]*?\.masthead\s*\{[\s\S]*?bottom:\s*0;/,
  );
  expect(styles).toMatch(
    /\.masthead-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/,
  );
  expect(styles).toMatch(/\.masthead\s*\{[\s\S]*?max-inline-size:\s*100vw;/);
});

test("mobile masthead reserves space and places search above the action bar", () => {
  expect(styles).toMatch(/body\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--mobile-masthead-h\)/);
  expect(styles).toMatch(/\.masthead-mobile-search-panel\s*\{[\s\S]*?min-height:\s*60px;/);
});

test("mobile quick settings uses a full-width sheet without an arrow", () => {
  expect(styles).toMatch(
    /\.masthead-actions > \.relative > \[role="dialog"\]\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*100vw;/,
  );
  expect(styles).toMatch(
    /\.masthead-actions > \.relative > \[role="dialog"\] > span\[aria-hidden="true"\]\s*\{[\s\S]*?display:\s*none;/,
  );
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
