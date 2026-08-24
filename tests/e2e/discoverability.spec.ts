/**
 * What a search engine and a link unfurler are given.
 *
 * All of it is invisible in the browser, which is exactly why it rots: a
 * renamed path or a dropped `metadataBase` breaks every shared link and
 * nobody notices, because the page still looks right.
 */

import { expect, test } from "@playwright/test";

const SITE = "https://starship.ndl.au";

test.describe("discoverability", () => {
  test("the page describes itself to crawlers", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");
    await page.goto("./");

    await expect(page).toHaveTitle(/Starship Prompt Builder/);

    const head = await page.evaluate(() => {
      const content = (selector: string) =>
        document.head.querySelector(selector)?.getAttribute("content") ?? null;
      return {
        description: content('meta[name="description"]'),
        canonical: document.head
          .querySelector('link[rel="canonical"]')
          ?.getAttribute("href"),
        ogTitle: content('meta[property="og:title"]'),
        ogImage: content('meta[property="og:image"]'),
        ogType: content('meta[property="og:type"]'),
        twitter: content('meta[name="twitter:card"]'),
        robots: content('meta[name="robots"]'),
        jsonLd: document.head.querySelector('script[type="application/ld+json"]')
          ?.textContent,
      };
    });

    expect(head.description?.length ?? 0).toBeGreaterThan(80);
    expect(head.canonical).toBe(`${SITE}/`);
    expect(head.ogTitle).toContain("Starship Prompt Builder");
    // Absolute, or no client can fetch it.
    expect(head.ogImage).toBe(`${SITE}/og.png`);
    expect(head.ogType).toBe("website");
    expect(head.twitter).toBe("summary_large_image");
    expect(head.robots).toContain("index");

    const structured = JSON.parse(head.jsonLd ?? "{}");
    expect(structured["@type"]).toBe("WebApplication");
    expect(structured.url).toBe(SITE);
  });

  test("the preview image exists and is the right shape", async ({
    page,
    request,
  }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");
    await page.goto("./");

    // Fetched through the page's own origin, so a base-path mistake shows up
    // here rather than in someone's chat client.
    const response = await request.get("./og.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image");

    const size = await page.evaluate(
      () =>
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = reject;
          image.src = "og.png";
        }),
    );
    // 1.91:1 is what every card renderer crops to.
    expect(size.width / size.height).toBeCloseTo(1200 / 630, 2);
  });

  test("the licences page credits every project whose work is redistributed", async ({
    page,
  }) => {
    await page.goto("./licences");
    const main = page.locator("main");
    // The fonts were always here; the vendored themes are the ones that were
    // being redistributed without a notice on this page.
    await expect(main).toContainText("Presets and palettes");
    for (const credit of [
      "catppuccin/starship",
      "© 2021 Catppuccin",
      "dracula/starship",
      "© 2022 Dracula Theme",
      "rose-pine/starship",
      "© Rosé Pine",
    ]) {
      await expect(main).toContainText(credit);
    }
    // Named against the presets they are, so the two lists cannot drift apart.
    await expect(main).toContainText("Rosé Pine, Rosé Pine Moon, Rosé Pine Dawn");
  });

  test("robots.txt and the sitemap are served", async ({ request }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");

    const robots = await request.get("./robots.txt");
    expect(robots.status()).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Allow: /");
    expect(robotsBody).toContain(`${SITE}/sitemap.xml`);

    const sitemap = await request.get("./sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain(`<loc>${SITE}/</loc>`);
    expect(sitemapBody).toContain("licences");
  });

  test("the page ships no analytics code of its own", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");

    const analytics: string[] = [];
    page.on("request", (request) => {
      if (/googletagmanager|google-analytics|analytics\.google|cloudflareinsights/.test(request.url())) {
        analytics.push(request.url());
      }
    });

    await page.goto("./");
    await page.getByLabel("Simulated terminal prompt").click();
    await page.waitForTimeout(1500);

    /*
     * Counting happens at Cloudflare's edge, which injects its beacon into
     * proxied responses — so the built site carries nothing, and a fork or a
     * local build reports nowhere by construction. Nothing in this repository
     * should ever request an analytics endpoint.
     */
    expect(analytics).toEqual([]);
    expect(await page.evaluate(() => "gtag" in window)).toBe(false);

    const html = await page.content();
    expect(html).not.toContain("googletagmanager");
    expect(html).not.toContain("dataLayer");
  });

  test("there is something to read without JavaScript", async ({
    browser,
  }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("./");

    /*
     * The app needs scripts to render a prompt; the page should still say
     * what it is rather than showing nothing at all. Read from the body
     * rather than the <noscript> element itself — with scripts off its
     * children are ordinary rendered DOM, and the element reports no text of
     * its own.
     */
    const visible = await page.locator("body").innerText();
    expect(visible).toContain("starship.toml");
    expect(visible).toContain("Starship Prompt Builder");
    await context.close();
  });
});
