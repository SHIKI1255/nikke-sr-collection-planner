import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const chineseUrl = pathToFileURL(resolve("dist/index.html")).href;
const englishUrl = pathToFileURL(resolve("dist/en/index.html")).href;

test.beforeEach(async ({ page }) => {
  await page.goto(englishUrl);
  await page.waitForSelector('html[data-status="ready"]');
});

test("English route contains a complete English-only interface and GitHub credit", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("NIKKE SR Collection Item Enhancement Planner");
  await expect(page.locator("h1")).toHaveText("SR Collection Item Enhancement Planner");
  await expect(page.locator("body")).toContainText("Maintenance Kit");
  await expect(page.locator("#record-success")).toHaveText("Record Super Success");
  await expect(page.locator("footer")).toContainText("Created by SHIKI1255");
  await expect(page.locator("footer a[rel=author]")).toHaveAttribute("href", "https://github.com/SHIKI1255");
  expect(await page.locator("body").textContent()).not.toMatch(/[\p{Script=Han}]/u);
  await expect(page.locator('[class*="language"], [hreflang]')).toHaveCount(0);
});

test("English dynamic results, history and Phase captions use the reviewed terms", async ({ page }) => {
  await expect(page.locator("#capacity-unit")).toHaveText("times");
  await expect(page.locator("#policy-tables caption")).toHaveText([
    "Phases 0–4Enhance to Phase 5",
    "Phases 5–9Enhance to Phase 10",
    "Phases 10–14Enhance to Phase 15",
  ]);

  await page.selectOption("#actual-material", "R");
  await page.click("#record-normal");
  await expect(page.locator("#history-list")).toContainText("Normal Result");
  await expect(page.locator("#history-list")).toContainText("Phase 0 / 0 EXP → Phase 0 / 200 EXP");

  await page.locator("#current-level").fill("15");
  await page.locator("#calculate").click();
  await expect(page.locator("#capacity-value")).toHaveText("Target Reached");
  await expect(page.locator("#capacity-unit")).toBeEmpty();
});

test("English copy keeps controls readable without horizontal overflow", async ({ page }) => {
  for (const width of [320, 380, 720, 1040, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  }

  await page.locator("details.advanced > summary").click();
  const undersized = await page
    .locator("button:visible, input:visible, select:visible, summary:visible")
    .evaluateAll((elements) => elements
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { id: element.id, width: box.width, height: box.height };
      })
      .filter(({ width, height }) => width < 44 || height < 44));
  expect(undersized).toEqual([]);
});

test("English print mode keeps localized conditions and strategy symbols", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-summary")).toContainText("Current Calculation Inputs");
  await expect(page.locator(".print-summary")).toContainText("Phase 0 / 0 EXP");
  await expect(page.locator("footer.page-footer")).toContainText("Data baseline: 2026-07-29");
  const printMark = page.locator(".policy-table .status-icon").first();
  await expect(printMark).toHaveCSS("display", "block");
});

test("Chinese and English routes expose identical calculation results", async ({ page }) => {
  const solve = () => page.evaluate(() => window.__SR_CALCULATOR__.solveMaxUnits(
    { level: 0, exp: 0 },
    15,
    { R: 600, SR: 200, SSR: 100 },
  ).perUnit);
  const englishResult = await solve();
  await page.goto(chineseUrl);
  await page.waitForSelector('html[data-status="ready"]');
  const chineseResult = await solve();
  expect(englishResult).toEqual(chineseResult);
});
