import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * E2E runs against the PRODUCTION static export, not the dev server.
 *
 * The dev server hides real bugs: it is slower (masking races), serves
 * unminified output, and serves the paths the deployed site uses
 * that GitHub Pages actually serves under — which is precisely where asset and
 * routing mistakes hide.
 */
const PORT = 4321;

export default defineConfig({
  testDir: "../../tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: "on-first-retry",
    // The interface follows the operating system now, and Playwright's own
    // default is light. Pinning the baseline keeps every other test on the
    // design's default surface; the tests that care emulate their own.
    colorScheme: "dark",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Pixel 7 rather than an iPhone: both exercise the mobile breakpoint, but
    // this one is Chromium, so CI needs no extra WebKit download.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // `serve-export` publishes out/ under the base path the site really uses.
    command: "pnpm build && pnpm serve:export",
    cwd: resolve(__dirname, "../.."),
    url: `http://127.0.0.1:${PORT}/`,
    // Never reuse: a stale server silently tests the previous build.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
