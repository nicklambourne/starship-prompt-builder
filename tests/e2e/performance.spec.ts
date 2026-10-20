import { expect, test } from "@playwright/test";

test("production cold-load and first-edit baseline", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "Fixed desktop performance fixture, not a device comparison.");
  const samples = [];
  for (let sample = 0; sample < 5; sample++) {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
    const page = await context.newPage();
    const start = performance.now();
    await page.goto("./");
    await page.locator("[data-section='toml'] button[aria-expanded]").click();
    const readyMs = performance.now() - start;
    const editStart = performance.now();
    await page.getByLabel("starship.toml").fill('format = "performance-marker"\n');
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("performance-marker");
    const editMs = performance.now() - editStart;
    const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return { type: resource.initiatorType, decoded: resource.decodedBodySize, encoded: resource.encodedBodySize, transfer: resource.transferSize };
    }));
    const decodedScriptBytes = resources.filter((item) => item.type === "script").reduce((sum, item) => sum + item.decoded, 0);
    expect(decodedScriptBytes).toBeGreaterThan(0);
    // A deterministic size ceiling, not a timing assertion on a shared runner.
    expect(decodedScriptBytes).toBeLessThan(2 * 1024 * 1024);
    samples.push({ readyMs, editMs, decodedScriptBytes, resources });
    await context.close();
  }
  const report = { fixture: "default preset -> literal config", viewport: "1280x900", network: "unthrottled loopback, fresh context per sample", cpu: "unthrottled", node: process.version, browser: browser.version(), samples };
  await info.attach("performance-baseline.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  console.log("PERFORMANCE_BASELINE", JSON.stringify({ ...report, samples: samples.map(({ readyMs, editMs, decodedScriptBytes }) => ({ readyMs, editMs, decodedScriptBytes })) }));
});
