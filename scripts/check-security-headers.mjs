#!/usr/bin/env node
/** Read-only edge smoke; no redirect following, body capture, or prompt data. */
import { execFileSync } from "node:child_process";

const origin = new URL(process.argv[2] ?? "https://starship.ndl.au");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error("Supply a credential-free HTTPS origin without a query or fragment.");
}
const expected = {
  "content-security-policy": ["default-src 'self'", "base-uri 'self'", "connect-src 'self'", "font-src 'self'", "form-action 'none'", "frame-ancestors 'none'", "img-src 'self' data:", "object-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "upgrade-insecure-requests"],
  "permissions-policy": ["camera=()", "geolocation=()", "microphone=()", "payment=()", "usb=()"],
  "referrer-policy": ["strict-origin-when-cross-origin"],
  "x-content-type-options": ["nosniff"],
};
let failed = false;
for (const [path, status] of [["/", 200], ["/guides/import-existing-config/", 200], ["/modules/directory/", 200], ["/robots.txt", 200], ["/__header-smoke-missing__/", 404]]) {
  const url = new URL(path, origin);
  const raw = execFileSync("curl", ["--proto", "=https", "--tlsv1.2", "-sS", "--max-time", "20", "-D", "-", "-o", process.platform === "win32" ? "NUL" : "/dev/null", url.href], { encoding: "utf8" });
  const blocks = raw.trim().split(/\r?\n\r?\n/);
  const lines = blocks.at(-1).split(/\r?\n/);
  const actualStatus = Number(lines.shift().split(" ")[1]);
  const headers = new Map(lines.map((line) => { const at = line.indexOf(":"); return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()]; }));
  const errors = [];
  if (actualStatus !== status) errors.push(`HTTP ${actualStatus}, expected ${status}`);
  for (const [name, required] of Object.entries(expected)) {
    const actual = (headers.get(name) ?? "").split(name === "permissions-policy" ? "," : ";").map((part) => part.trim());
    if (required.some((value) => !actual.includes(value))) errors.push(`${name} missing or different`);
  }
  console.log(`${path}: ${errors.length ? errors.join("; ") : "PASS"}`);
  failed ||= errors.length > 0;
}
process.exitCode = failed ? 1 : 0;
