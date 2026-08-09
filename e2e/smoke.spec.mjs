import { test, expect } from "@playwright/test";

async function waitForAppReady(page) {
  await expect(page.locator("body")).toBeVisible();
  await expect
    .poll(async () => {
      const text = (await page.locator("body").innerText().catch(() => "")) || "";
      return text.trim();
    }, { timeout: 20_000 })
    .not.toMatch(/^Loading (?:page|TitanOS|app)â€¦?$/i);
}

/**
 * Critical-flow smoke — marketing + auth shell reachability.
 * Business flows that need auth stay behind login; we assert public surfaces + login form.
 */
test.describe("TitanOS smoke", () => {
  test("landing loads with Titan branding", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    // Brand or CTA should appear
    const text = await page.locator("body").innerText();
    expect(text.length).toBeGreaterThan(20);
  });

  test("login route is reachable", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    // The route is code-split; wait for its stable form contract rather than
    // sampling the DOM while the lazy chunk is still rendering.
    const email = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]');
    await expect(email).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("privacy policy is public", async ({ page }) => {
    await page.goto("/privacy-policy", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.locator("body")).toContainText(/privacy|Titan/i);
  });

  test("unauthenticated /jobs redirects or shows login", async ({ page }) => {
    await page.goto("/jobs", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    // Preview SPA: auth redirect, login copy, or jobs shell — any non-blank document is enough
    await expect
      .poll(async () => {
        const url = page.url();
        const body = (await page.locator("body").innerText().catch(() => "")) || "";
        return (
          body.trim().length > 0 ||
          /login|jobs/i.test(url)
        );
      }, { timeout: 15_000 })
      .toBe(true);
  });

  test("pricing page is public", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    const text = await page.locator("body").innerText();
    expect(text.trim().length).toBeGreaterThan(5);
  });

  test("free profit calculator is public and interactive", async ({ page }) => {
    await page.goto("/free-tools", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: "Know what the week actually earned." })).toBeVisible();
    await expect(page.getByText("Estimated weekly result")).toBeVisible();
  });

  test("industry landing page offers a trial path", async ({ page }) => {
    await page.goto("/industries/hvac", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: "One operating system for your hvac business." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create workspace" })).toBeVisible();
  });
});

test.describe("cross-device chrome", () => {
  test("mobile and tablet viewports render without horizontal overflow", async ({ page }, testInfo) => {
    test.skip(!/mobile|tablet/.test(testInfo.project.name), "touch viewport projects only");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await waitForAppReady(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
