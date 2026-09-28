/**
 * Serve `out/` at the origin root, matching the custom-domain deployment.
 * Production paths matter: testing a different prefix can hide asset bugs.
 */

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT ?? 4321);
const BASE = "";
const ROOT = new URL("../out/", import.meta.url).pathname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
};

function resolve(pathname) {
  if (!pathname.startsWith(BASE)) return null;
  const relative = pathname.slice(BASE.length) || "/";
  // normalize() collapses any ../ before it can escape the export directory.
  const candidate = join(ROOT, normalize(relative));
  if (!candidate.startsWith(ROOT)) return null;

  try {
    const stats = statSync(candidate);
    if (stats.isDirectory()) return join(candidate, "index.html");
    return candidate;
  } catch {
    try {
      const html = `${candidate}.html`;
      statSync(html);
      return html;
    } catch {
      return null;
    }
  }
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const file = resolve(decodeURIComponent(pathname));

  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Serving out/ at http://127.0.0.1:${PORT}${BASE}/`);
});
