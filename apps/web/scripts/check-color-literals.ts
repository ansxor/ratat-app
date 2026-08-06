#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APP = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SCAN_DIR = join(APP, "src");
const EXTENSIONS = [".ts", ".tsx", ".css"];
const GLOBALS_CSS = join(SCAN_DIR, "styles.css");

const MARKER = "theme-invariant";

// The lookahead prevents hash-like ids and composed tokens from matching.
const COLOR =
  /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?(?![0-9a-fA-F])|rgba?\(\s*[\d.]/g;

// The leading-digit requirement prevents composed tokens from matching.
const COLOR_FN = /\b(?:hsla?|oklch|oklab|lab|lch)\(\s*[\d.]/g;

const TAILWIND_PALETTE =
  /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|decoration|divide|placeholder|accent|caret)(?:-(?:t|r|b|l|x|y|s|e|offset))?-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?![\w-])/g;

const PATTERNS = [COLOR, COLOR_FN, TAILWIND_PALETTE];

function blankCssComments(source: string): string {
  const out = source.split("");
  let i = 0;
  while (i < source.length) {
    if (source.slice(i, i + 2) === "/*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (let k = i; k < stop && k < out.length; k++) if (out[k] !== "\n") out[k] = " ";
      i = stop;
    } else {
      i++;
    }
  }
  return out.join("");
}

function blankNonCode(source: string): string {
  const out = source.split("");
  let i = 0;
  const blankTo = (end: number) => {
    for (let k = i; k < end && k < out.length; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      const end = source.indexOf("\n", i);
      blankTo(end === -1 ? source.length : end);
      i = end === -1 ? source.length : end;
    } else if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blankTo(stop);
      i = stop;
    } else if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
      const quote = source[i];
      let k = i + 1;
      while (k < source.length && source[k] !== quote) {
        if (source[k] === "\\") k++;
        k++;
      }
      i = k + 1;
    } else {
      i++;
    }
  }
  return out.join("");
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) found.push(full);
  }
  return found;
}

interface Violation {
  file: string;
  line: number;
  literal: string;
  text: string;
}

const violations: Violation[] = [];

function rootBlocks(code: string): { start: number; end: number }[] {
  const found: { start: number; end: number }[] = [];
  for (const m of code.matchAll(/:root[^{}]*\{/g)) {
    let i = m.index + m[0].length;
    const start = i;
    let depth = 1;
    while (i < code.length && depth > 0) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
      i++;
    }
    found.push({ start, end: i - 1 });
  }
  return found;
}

function declarations(code: string, start: number, end: number) {
  const out: { name: string; value: string; index: number }[] = [];
  const decl = /(--[\w-]+)\s*:\s*([^;}]*)(?:;|(?=\s*\}))/g;
  decl.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(code)) !== null && m.index < end) {
    out.push({ name: m[1]!, value: m[2]!, index: m.index });
  }
  return out;
}

function label(match: string): string {
  if (match.startsWith("#")) return match;
  const paren = match.indexOf("(");
  return paren === -1 ? match : `${match.slice(0, paren)}(`;
}

for (const file of walk(SCAN_DIR)) {
  const source = readFileSync(file, "utf8");
  const isCss = file.endsWith(".css");
  const code = isCss ? blankCssComments(source) : blankNonCode(source);
  const lines = source.split("\n");

  const codeLines = code.split("\n");
  // The `theme-invariant` marker is scanned as a block, not a fixed line count,
  const isJustified = (line: number): boolean => {
    for (let i = line - 1; i >= 0; i--) {
      const isComment = codeLines[i]?.trim() === "" && lines[i]?.trim() !== "";
      if (i !== line - 1 && !isComment) return false;
      if (lines[i]?.includes(MARKER)) return true;
      if (i === line - 1 && !isComment) continue;
    }
    return false;
  };

  const isGroupJustified = (line: number): boolean => {
    if (lines[line - 1]?.includes(MARKER)) return true;
    const isComment = (i: number) => codeLines[i]?.trim() === "" && lines[i]?.trim() !== "";
    let i = line - 2;
    while (i >= 0 && !isComment(i)) i--;
    for (; i >= 0 && isComment(i); i--) if (lines[i]?.includes(MARKER)) return true;
    return false;
  };

  const report = (index: number, literal: string, justified = isJustified) => {
    const line = code.slice(0, index).split("\n").length;
    if (justified(line)) return;
    violations.push({
      file: relative(APP, file),
      line,
      literal,
      text: (lines[line - 1] ?? "").trim().slice(0, 96),
    });
  };

  if (file === GLOBALS_CSS) {
    for (const block of rootBlocks(code)) {
      for (const decl of declarations(code, block.start, block.end)) {
        if (decl.value.includes("light-dark(")) continue;
        if (!PATTERNS.some((p) => new RegExp(p.source, p.flags).test(decl.value))) continue;
        report(decl.index, decl.name, isGroupJustified);
      }
    }
    const inRoot = rootBlocks(code);
    for (const pattern of PATTERNS) {
      for (const match of code.matchAll(pattern)) {
        if (inRoot.some((b) => match.index >= b.start && match.index < b.end)) continue;
        report(match.index, label(match[0]));
      }
    }
    continue;
  }

  for (const pattern of PATTERNS) {
    for (const match of code.matchAll(pattern)) report(match.index, label(match[0]));
  }
}

const unique = violations.filter(
  (v, i) => violations.findIndex((w) => w.file === v.file && w.line === v.line) === i,
);

if (unique.length === 0) {
  console.log("✓ no un-themed colour literals in src");
  process.exit(0);
}

console.error(`\n✗ ${unique.length} un-themed colour literal(s) in src\n`);
for (const v of unique) {
  console.error(`  ${v.file}:${v.line}  ${v.literal}`);
  console.error(`    ${v.text}`);
}
console.error(`
Colours belong in src/styles.css as one
\`light-dark(<light>, <dark>)\` declaration, reached from here through a token —
\`bg-ink\`, \`border-line-2\`, \`var(--shadow)\`. A literal here — a hex, an
\`hsl()\`, or a Tailwind palette class like \`text-white\` — is invisible in
light and wrong in dark, which is the worst way to find out. Inside styles.css
itself the report names a \`:root\` token that is not \`light-dark(...)\`.

If this colour genuinely must not flip — a brand mark, or a scrim over user
artwork that has to stay dark against an unknown image — say so in a comment on
the line or just above it, including the word "${MARKER}".
`);
process.exit(1);
