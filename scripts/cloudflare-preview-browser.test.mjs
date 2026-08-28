import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = String(process.env.TITAN_PREVIEW_URL || "").replace(/\/$/, "");
assert.ok(baseUrl.startsWith("https://"), "TITAN_PREVIEW_URL must be an https URL");

mkdirSync("artifacts", { recursive: true });

const browser = await chromium.launch({ headless: true });

async function verifyViewport(name, viewport, screenshotPath) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error?.stack || error?.message || String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 45_000 });
  assert.ok(response, `${name}: no navigation response`);
  assert.equal(response.status(), 200, `${name}: root returned HTTP ${response.status()}`);

  await page.waitForSelector("#root", { state: "attached", timeout: 10_000 });
  await page.waitForFunction(() => document.body.innerText.includes("TitanOS"), null, { timeout: 15_000 });

  const state = await page.evaluate(() => {
    const root = document.querySelector("#root");
    const styles = getComputedStyle(document.documentElement);
    const links = [...document.querySelectorAll("a")].map((link) => link.getAttribute("href") || "");
    const heading = document.querySelector("h1");
    const headingStyle = heading ? getComputedStyle(heading) : null;
    return {
      title: document.title,
      text: document.body.innerText,
      rootChildren: root?.childElementCount || 0,
      titanCyan: styles.getPropertyValue("--titan-cyan").trim(),
      titanSurface: styles.getPropertyValue("--titan-surface-1").trim(),
      hasBuiltStylesheet: [...document.styleSheets].some((sheet) => String(sheet.href || "").includes("/assets/")),
      links,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      headingFontSize: headingStyle ? Number.parseFloat(headingStyle.fontSize) : 0,
      configWarningVisible: document.body.innerText.includes("TitanOS is misconfigured"),
    };
  });

  assert.match(state.title, /TitanOS/i, `${name}: document title is not TitanOS`);
  assert.doesNotMatch(state.title, /Titan Attention/i, `${name}: Attention title leaked into preview`);
  assert.doesNotMatch(state.text, /Titan Attention/i, `${name}: Attention UI leaked into preview`);
  assert.ok(state.rootChildren > 0, `${name}: React root did not render`);
  assert.ok(state.titanCyan, `${name}: --titan-cyan is missing; TitanOS design system did not load`);
  assert.ok(state.titanSurface, `${name}: --titan-surface-1 is missing; TitanOS design system did not load`);
  assert.equal(state.hasBuiltStylesheet, true, `${name}: built Vite stylesheet is not attached`);
  assert.ok(state.links.some((href) => href.includes("/register")), `${name}: registration navigation missing`);
  assert.equal(state.hasHorizontalOverflow, false, `${name}: page has horizontal layout overflow`);
  assert.equal(state.configWarningVisible, false, `${name}: isolated preview is obscured by production config warning`);
  assert.ok(state.headingFontSize >= (name === "desktop" ? 40 : 30), `${name}: hero typography is unexpectedly collapsed`);

  await page.screenshot({ path: screenshotPath, fullPage: true });

  assert.deepEqual(pageErrors, [], `${name}: page errors:\n${pageErrors.join("\n")}`);
  assert.deepEqual(consoleErrors, [], `${name}: console errors:\n${consoleErrors.join("\n")}`);

  await context.close();
}

try {
  await verifyViewport("desktop", { width: 1440, height: 1100 }, "artifacts/titanos-preview-desktop.png");
  await verifyViewport("mobile", { width: 390, height: 844 }, "artifacts/titanos-preview-mobile.png");
} finally {
  await browser.close();
}
