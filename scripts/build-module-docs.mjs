#!/usr/bin/env node
/**
 * Extracts each module's options and format variables from starship's own
 * documentation.
 *
 * Every module section in `docs/config/README.md` carries two tables: Options
 * (what you may set) and Variables (what the module then produces). They are
 * the only authoritative account of what `show_always` does or what `$branch`
 * holds, and starship's JSON Schema carries neither — it types every option as
 * a string and describes none of them. Writing a hundred modules' worth of
 * paraphrase by hand would drift from upstream on the next release, so they
 * are parsed instead.
 *
 * The result is keyed by the section's anchor (`git-branch`), not by module
 * name: `src/lib/config/meta.ts` already records each module's deep link into
 * that page, so the anchor is a mapping the project maintains anyway.
 *
 * Run after `pnpm sync:docs`:  pnpm build:module-docs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(repoRoot, "data", "config-docs.md");
const VARIABLES = join(repoRoot, "data", "variables.generated.json");
const OPTIONS = join(repoRoot, "data", "options.generated.json");

/**
 * VuePress's heading slugs, which are what the anchors in `meta.ts` point at.
 * Punctuation becomes a dash rather than disappearing — "Node.js" anchors at
 * `#node-js`, not `#nodejs` — which is the whole reason this is not a
 * one-liner.
 */
function slugify(heading) {
  return heading
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^\w\u00C0-\uFFFF]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Markdown inline syntax, reduced to plain text a row can show. */
function plain(cell) {
  return cell
    .replace(/`([^`]*)`/g, "$1")
    // Solidity's `compiler` row opens a code span it never closes, and an
    // unpaired backtick would otherwise become part of the option's name.
    .replace(/`/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([*_[\]])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Plain prose plus the links that gave phrases such as "See below" meaning.
 * Relative targets are authored from Starship's configuration reference.
 */
function documentation(cell) {
  const links = [...cell.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => ({
    label: plain(match[1]),
    url: new URL(match[2], "https://starship.rs/config/").href,
  }));
  const description = plain(cell);
  return links.length > 0 ? { description, links } : { description };
}

function splitRow(line) {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

const lines = readFileSync(SOURCE, "utf8").split("\n");
const variables = {};
const options = {};

/** Column positions from a table's header row, by what the column is called. */
function columns(header) {
  const cells = splitRow(header).map((cell) => plain(cell).toLowerCase());
  // Options tables head their first column "Option", except azure's, which
  // says "Variable", and directory's <details> table, which says "Advanced
  // Option" — so the column is the one that mentions either word.
  const name = cells.findIndex((cell) => /\b(option|variable)\b/.test(cell));
  const description = cells.indexOf("description");
  return name < 0 || description < 0
    ? null
    : { name, description, example: cells.indexOf("example") };
}

/** Every table under one `### <heading>` block, merged, keyed by first column. */
function tablesUnder(start) {
  const table = {};
  for (let row = start + 1; row < lines.length && !/^###?\s/.test(lines[row]); row += 1) {
    if (!lines[row].startsWith("|")) continue;
    const shape = columns(lines[row]);
    if (!shape) continue;
    row += 2; // past the header and its separator
    for (; row < lines.length && lines[row].startsWith("|"); row += 1) {
      const cells = splitRow(lines[row]);
      // `style\*` marks "usable only inside a style string", which the builder
      // shows in its own way; the name is what has to match the format string.
      const name = plain(cells[shape.name] ?? "").replace(/\*+$/, "").trim();
      const documented = documentation(cells[shape.description] ?? "");
      if (!name || !documented.description) continue;
      const example = shape.example >= 0 ? plain(cells[shape.example] ?? "") : "";
      table[name] ??= example ? { ...documented, example } : documented;
    }
  }
  return table;
}

let anchor = null;
for (let i = 0; i < lines.length; i += 1) {
  const heading = /^##\s+(.+)$/.exec(lines[i]);
  if (heading) {
    anchor = slugify(heading[1]);
    continue;
  }
  if (!anchor) continue;

  // Every table in the block, not just the first: `directory` keeps the
  // repository variables in a <details>, `git_status` documents what its
  // nested format strings accept in tables of their own, and several modules
  // split their options across a table per platform.
  if (/^###\s+Variables\s*$/.test(lines[i])) {
    const table = tablesUnder(i);
    if (Object.keys(table).length > 0) variables[anchor] ??= table;
  }
  if (/^###\s+Options\s*$/.test(lines[i])) {
    const table = tablesUnder(i);
    if (Object.keys(table).length > 0) options[anchor] ??= table;
  }
}

/** Sorted, so a docs sync produces a reviewable diff rather than a reshuffle. */
function sortDeep(sections) {
  return Object.fromEntries(
    Object.keys(sections).sort().map((key) => [
      key,
      Object.fromEntries(
        Object.keys(sections[key]).sort().map((name) => [name, sections[key][name]]),
      ),
    ]),
  );
}

function write(target, sections, noun) {
  const sorted = sortDeep(sections);
  writeFileSync(target, `${JSON.stringify(sorted, null, 2)}\n`);
  const count = Object.values(sorted).reduce((n, t) => n + Object.keys(t).length, 0);
  console.log(`${Object.keys(sorted).length} sections, ${count} ${noun} → ${target}`);
}

write(VARIABLES, variables, "variables");
write(OPTIONS, options, "options");
