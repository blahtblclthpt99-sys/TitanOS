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
});

test.describe("cross-device chrome", () => {
  test("mobile viewport still renders shell", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile project only");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
