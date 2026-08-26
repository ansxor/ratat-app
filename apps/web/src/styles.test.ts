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

test("the focused mobile search overlays the masthead with a spring transition", () => {
  expect(styles).toMatch(
    /\.masthead-search--overlay\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset-inline-start:\s*var\(--masthead-search-start\);[\s\S]*?inset-inline-end:\s*var\(--masthead-search-end\);[\s\S]*?inset-inline-end 320ms cubic-bezier\(0\.34, 1\.45, 0\.64, 1\)/,
  );
  expect(styles).toMatch(
    /\.masthead-search--overlay\.masthead-search--expanded\s*\{[\s\S]*?inset-inline-end 520ms cubic-bezier\(0\.65, 0, 0\.35, 1\.35\)/,
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
