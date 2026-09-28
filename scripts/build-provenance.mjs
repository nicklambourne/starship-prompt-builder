#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const sources = ["data/config-schema.json", "data/config-docs.md", "data/glyphnames.source.json"];
for (const dir of ["data/presets", "data/presets-community", "data/presets-inspired", "src/assets/fonts"]) {
  sources.push(...readdirSync(dir).filter((file) => /\.(toml|woff2)$/.test(file)).map((file) => `${dir}/${file}`));
}
const provenance = {
  schemaVersion: 1,
  starship: { version: "1.26.0", sourceNotes: "data/README.md", license: "ISC; community/inspired exceptions in THIRD_PARTY.md" },
  nerdFonts: { version: "3.5.0", glyphSource: "https://raw.githubusercontent.com/ryanoasis/nerd-fonts/v3.5.0/glyphnames.json", licenseNotes: "THIRD_PARTY.md and src/assets/fonts" },
  // Hashes identify the actual vendored bytes, not a claim that every community
  // input shares the upstream Starship tag. No timestamps: repeatable offline.
  sha256: Object.fromEntries(sources.sort().map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
};
writeFileSync("data/provenance.generated.json", JSON.stringify(provenance, null, 2) + "\n");
