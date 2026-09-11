import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(resolve("dist/index.html")).href;
const storageKey = "nikke-sr-inventory-calculator-v1";
const ready = (page) => page.waitForSelector('html[data-status="ready"]');

for (const target of [5, 10]) {
  test(`reaching target ${target} never silently advances the selected target`, async ({ page }) => {
    await page.goto(pageUrl);
    await ready(page);
    await page.locator("#current-level").fill(String(target - 1));
    await page.selectOption("#target-level", String(target));
    await page.click("#calculate");
    await ready(page);
    await page.selectOption("#actual-material", "SSR");
    await page.click("#record-success");
    await ready(page);
    await expect(page.locator("#target-level")).toHaveValue(String(target));
    await expect(page.locator("#capacity-value")).toHaveText("已达成");
    await page.click("#undo");
    await ready(page);
    await expect(page.locator("#current-level")).toHaveValue(String(target - 1));
    await expect(page.locator("#target-level")).toHaveValue(String(target));
  });
}

test("editing any calculation input invalidates old output and print data", async ({ page }) => {
  await page.goto(pageUrl);
  await ready(page);
  await page.locator("#stock-r").fill("1234");
  await expect(page.locator("html")).toHaveAttribute("data-status", "dirty");
  await expect(page.locator("#policy-tables table")).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-warning")).toBeVisible();
  await expect(page.locator(".print-summary")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.click("#calculate");
  await ready(page);
  await expect(page.locator("#print-stock")).toContainText("R 1234个");
});

test("damaged legacy history cannot prevent initialization", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({ stock: { R: 4321 }, history: [{}, null, { material: "<img>" }] }));
  }, { key: storageKey });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pageUrl);
  await ready(page);
  await expect(page.locator("#stock-r")).toHaveValue("4321");
  await expect(page.locator("#history-list")).toContainText("尚无强化记录");
  expect(errors).toEqual([]);
});

test("print status colors remain readable regardless of screen theme", async ({ page }) => {
  await page.goto(pageUrl);
  await ready(page);
  await page.click('[data-theme-mode="dark"].theme-option');
  await page.emulateMedia({ media: "print" });
  const ratios = await page.locator(".legend .mark svg").evaluateAll((marks) => marks.map((mark) => {
    const rgb = getComputedStyle(mark).color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const linear = rgb.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 1.05 / (linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 + 0.05);
  }));
  expect(ratios.every((ratio) => ratio >= 3)).toBe(true);
});
