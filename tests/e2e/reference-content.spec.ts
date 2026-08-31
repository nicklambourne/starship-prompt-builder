import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SITE = "https://starship.ndl.au";

const GUIDE_ROUTES = [
  "starship-config-generator",
  "import-existing-config",
  "format-strings",
  "style-strings",
  "custom-modules",
] as const;

const MODULE_ROUTES = [
  "directory",
  "git-branch",
  "git-status",
  "character",
  "username",
  "hostname",
  "nodejs",
  "python",
  "custom",
  "aws",
  "kubernetes",
] as const;

const CONTENT_ROUTES = [
  "guides",
  ...GUIDE_ROUTES.map((slug) => `guides/${slug}`),
  "modules",
  ...MODULE_ROUTES.map((slug) => `modules/${slug}`),
] as const;

test.describe("guide and module reference content", () => {
  test("every promised route is exported and listed in the sitemap", async ({
    request,
  }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");

    const sitemap = await (await request.get("./sitemap.xml")).text();
    for (const route of CONTENT_ROUTES) {
      const response = await request.get(`./${route}/`);
      expect(response.status(), route).toBe(200);
      expect(sitemap, route).toContain(`<loc>${SITE}/${route}/</loc>`);
    }

    const llms = await request.get("./llms.txt");
    expect(llms.status()).toBe(200);
    await expect(llms.text()).resolves.toContain(`${SITE}/guides/`);
    await expect(llms.text()).resolves.toContain(`${SITE}/modules/`);
  });

  test("the builder and reference pages carry the permanent site navigation", async ({
    page,
  }) => {
    for (const route of ["", "guides/", "modules/"]) {
      await page.goto(`./${route}`);
      const navigation = page.getByRole("navigation", { name: "Primary" });
      await expect(navigation.getByRole("link", { name: "Builder", exact: true })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Guides", exact: true })).toBeVisible();
      await expect(
        navigation.getByRole("link", { name: "Module reference", exact: true }),
      ).toBeVisible();
    }
  });

  test("reference pages expose theme, GitHub, and current-page share actions", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./guides/format-strings/");

    const header = page.locator("header").first();
    await expect(
      header.getByRole("link", { name: "View this project on GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/nicklambourne/starship-prompt-builder",
    );

    await header.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const pageUrl = page.url();
    await header.getByRole("button", { name: "Copy a share link" }).click();
    await expect(
      header.getByRole("button", { name: "Share link copied" }),
    ).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(pageUrl);
  });

  test("the breadcrumb root is a compact logo link to the builder", async ({ page }) => {
    await page.goto("./guides/format-strings/");

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    const builder = breadcrumb.getByRole("link", { name: "Builder", exact: true });
    await expect(builder).toHaveAttribute("href", "/");
    await expect(builder.locator("svg")).toHaveAttribute("width", "16");
    await expect(builder).not.toContainText("Builder");
  });

  test("the module reference lists every module and filters the collection", async ({
    page,
  }) => {
    await page.goto("./modules/");

    const results = page.getByRole("region", { name: "Module results" });
    const modules = results.getByRole("listitem");
    await expect(modules).toHaveCount(106);
    await expect(page.getByText("106 modules", { exact: true })).toBeVisible();

    const filter = page.getByRole("searchbox", { name: "Filter modules" });
    await filter.fill("terraform");
    await expect(modules).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Terraform module" })).toBeVisible();
    await expect(page.getByText("1 of 106 modules", { exact: true })).toBeVisible();

    await filter.fill("");
    await page.getByLabel("Category").selectOption("Languages");
    await expect(results.getByRole("link", { name: "Python module" })).toBeVisible();
    await expect(results.getByRole("link", { name: "AWS module" })).toHaveCount(0);

    await filter.fill("does not exist");
    await expect(modules).toHaveCount(0);
    await expect(page.getByText("No modules match that filter.", { exact: true })).toBeVisible();
  });

  test("reference pages reuse the builder header structure and visual identity", async ({
    page,
  }) => {
    const headers = [];
    for (const route of ["", "guides/"]) {
      await page.goto(`./${route}`);
      const header = page.locator("header").first();
      const navigation = header.getByRole("navigation", { name: "Primary" });
      const identity = header.getByText("Starship Prompt Builder", { exact: true });
      const metrics = await identity.evaluate((element) => {
        const style = getComputedStyle(element);
        const logo = element.querySelector("svg")!.getBoundingClientRect();
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          logoWidth: Math.round(logo.width),
        };
      });

      await expect(header.locator(":scope > nav")).toHaveCount(1);
      headers.push({
        headerClass: await header.getAttribute("class"),
        navigationClass: await navigation.getAttribute("class"),
        ...metrics,
      });
    }

    expect(headers[1]).toEqual(headers[0]);
  });

  test("content pages have unique canonical metadata and useful headings", async ({
    page,
  }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");
    const titles = new Set<string>();

    for (const route of CONTENT_ROUTES) {
      await page.goto(`./${route}/`);
      const title = await page.title();
      expect(title, route).not.toBe("");
      expect(titles.has(title), `duplicate title: ${title}`).toBe(false);
      titles.add(title);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${SITE}/${route}/`,
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
    }
  });

  test("module examples open as private, round-trippable builder links", async ({
    page,
  }) => {
    await page.goto("./modules/git-status/");
    const open = page.getByRole("link", { name: "Open git status in the builder" });
    await expect(open).toHaveAttribute("href", /\/#.+/);
    await open.click();
    await expect(page).toHaveURL(/\/#.+/);
    await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
  });

  test("module pages render their starting configuration through the preview engine", async ({
    page,
  }) => {
    await page.goto("./modules/nodejs/");
    await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("1.2.3");

    await page.goto("./modules/claude-context/");
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("65%");
  });

  test("reference content remains readable without JavaScript", async ({
    browser,
  }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("./guides/format-strings/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/format strings/i);
    await expect(page.locator("main")).toContainText("$directory");
    await context.close();
  });

  test("the reference surfaces are accessible in both themes", async ({ page }) => {
    for (const colorScheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme });
      for (const route of ["guides/", "modules/", "modules/directory/"]) {
        await page.goto(`./${route}`);
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(violations, `${colorScheme}:${route}`).toEqual([]);
      }
    }
  });
});
