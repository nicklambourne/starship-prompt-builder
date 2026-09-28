#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const outputs = ["data/schema.generated.json", "data/presets.generated.json", "data/glyphs.generated.json", "data/variables.generated.json", "data/options.generated.json", "data/provenance.generated.json", "src/lib/config/validation.generated.mjs"];
const before = new Map(outputs.map((path) => [path, readFileSync(path)]));
for (const generator of ["schema", "presets", "glyphs", "module-docs", "validation", "provenance"]) {
  execFileSync(process.execPath, [`scripts/build-${generator}.mjs`], { stdio: "inherit" });
}
const stale = outputs.filter((path) => !before.get(path).equals(readFileSync(path)));
if (stale.length) throw new Error(`Generated artifacts were stale; review and include regenerated changes: ${stale.join(", ")}`);
console.log("Generated artifacts and vendored-input hashes are byte-stable (offline).");
