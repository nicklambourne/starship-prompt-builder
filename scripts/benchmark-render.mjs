#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const { build } = createRequire(new URL("../packages/cli/package.json", import.meta.url))("esbuild");
const scratch = ["/Volumes/Repos", "/Volumes/Cache", "/Volumes/Scratch"].every(existsSync) ? "/Volumes/Scratch" : tmpdir();
const directory = await mkdtemp(join(scratch, "starship-render-benchmark-"));
try {
  const outfile = join(directory, "benchmark.mjs");
  await build({ entryPoints: ["tools/perf/render.ts"], outfile, bundle: true, platform: "node", format: "esm", target: "node22", tsconfig: "tsconfig.json" });
  execFileSync(process.execPath, [outfile], { stdio: "inherit" });
} finally { await rm(directory, { recursive: true }); }
