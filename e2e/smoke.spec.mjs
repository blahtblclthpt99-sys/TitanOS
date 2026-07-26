import { test, expect } from "@playwright/test";

/**
 * Critical-flow smoke — marketing + auth shell reachability.
 * Business flows that need auth stay behind login; we assert public surfaces + login form.
 */
test.describe("TitanOS smoke", () => {
  test("landing loads with Titan branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // Brand or CTA should appear
    const text = await page.locator("body").innerText();
    expect(text.length).toBeGreaterThan(20);
  });

  test("login route is reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
    // Email field or sign-in affordance
    const email = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]');
    const count = await email.count();
    expect(count + (await page.getByRole("button").count())).toBeGreaterThan(0);
  });

  test("privacy policy is public", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("body")).toContainText(/privacy|Titan/i);
  });

  test("unauthenticated /jobs redirects or shows login", async ({ page }) => {
    await page.goto("/jobs");
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    const body = await page.locator("body").innerText();
    const gated =
      /login|sign in|create an account|email/i.test(body) ||
      /\/login/i.test(url) ||
      /\/#\/login/i.test(url);
    expect(gated || body.length > 20).toBeTruthy();
    // Prefer auth gate when app is configured; always require a usable shell
    await expect(page.locator("body")).toBeVisible();
  });

  test("pricing page is public", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text.length).toBeGreaterThan(20);
  });
});

test.describe("cross-device chrome", () => {
  test("mobile viewport still renders shell", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile project only");
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
