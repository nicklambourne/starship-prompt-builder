import { chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const outfile = fileURLToPath(new URL("../dist/index.js", import.meta.url));

await build({
  entryPoints: [fileURLToPath(new URL("../src/index.tsx", import.meta.url))],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  tsconfig: fileURLToPath(new URL("../../../tsconfig.json", import.meta.url)),
  banner: { js: "#!/usr/bin/env node" },
  external: ["@inkjs/ui", "ink", "react"],
  sourcemap: true,
  logLevel: "info",
  absWorkingDir: packageRoot,
});

await chmod(outfile, 0o755);
