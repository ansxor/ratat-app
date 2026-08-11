import { expect, test } from "bun:test";

import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function declaration(selector: string, property: string): string | undefined {
  const block = styles.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1];
  return block?.match(new RegExp(`${property}\\s*:\\s*([^;]+)`))?.[1]?.trim();
}

test("censored gallery cards keep their artist header above the veil", () => {
  // ArtworkVeil uses z-[3]; the artist header must remain above it.
  expect(Number(declaration(".piece__top", "z-index"))).toBeGreaterThan(3);
});
