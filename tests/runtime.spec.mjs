import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const ready = (page) => page.waitForSelector('html[data-status="ready"]');
const key = "nikke-sr-inventory-calculator-v1";
const url = (locale = "zh-CN") => pathToFileURL(resolve(locale === "en" ? "dist/downloads/NIKKE_SR_EN.html" : "dist/downloads/NIKKE_SR.html")).href;

for (const locale of ["zh-CN", "en"]) {
  test(`${locale} offline file uses a Worker without network or main-thread solver work`, async ({ page }) => {
    const network = [];
    page.on("request", (request) => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    await page.goto(url(locale));
    await ready(page);
    expect(await page.evaluate(() => window.__SR_CALCULATOR__.diagnostics())).toMatchObject({ transport: "worker", cache: { size: 0 } });
    expect(network).toEqual([]);
    await expect(page.locator(".policy-table")).toHaveCount(3);
    await page.locator("#calculate").focus();
    await page.keyboard.press("Enter");
    await ready(page);
    await expect(page.locator("#calculate")).toBeFocused();
  });
}

for (const failure of ["missing", "construction", "asynchronous"]) {
  test(`Worker ${failure} failure falls back to the same calculation engine`, async ({ page }) => {
    await page.addInitScript((mode) => {
      if (mode === "missing") window.Worker = undefined;
      if (mode === "construction") window.Worker = class { constructor() { throw new Error("blocked"); } };
      if (mode === "asynchronous") window.Worker = class {
        postMessage() { queueMicrotask(() => this.onerror({ preventDefault() {} })); }
        terminate() {}
      };
    }, failure);
    await page.goto(url());
    await ready(page);
    const comparison = await page.evaluate(() => {
      const api = window.__SR_CALCULATOR__;
      const inputs = api.getInputs();
      const solution = api.solveScenario(inputs.start, inputs.target, inputs.available);
      return { display: document.getElementById("capacity-value").textContent, expected: solution.unit.toFixed(2), transport: api.diagnostics().transport };
    });
    expect(comparison.transport).toBe("cooperative");
    expect(comparison.display).toBe(comparison.expected);
  });
}

test("edits during calculation cannot render or persist an older snapshot", async ({ page }) => {
  await page.addInitScript(() => { window.Worker = undefined; });
  await page.goto(url());
  await ready(page);
  await page.evaluate(async () => {
    const api = window.__SR_CALCULATOR__;
    const old = api.calculate();
    document.getElementById("stock-r").value = "1234";
    document.getElementById("stock-r").dispatchEvent(new Event("input", { bubbles: true }));
    await old;
  });
  await expect(page.locator("html")).toHaveAttribute("data-status", "dirty");
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).stock.R, key)).toBe(1234);
  await page.click("#calculate");
  await ready(page);
  await expect(page.locator("#print-stock")).toContainText("R 1234个");
});

test("rapid records and undo update persistence synchronously, even while recalculating", async ({ page }) => {
  await page.goto(url());
  await ready(page);
  const immediate = await page.evaluate((k) => {
    document.getElementById("actual-material").value = "R";
    document.getElementById("record-normal").click();
    document.getElementById("record-normal").click();
    document.getElementById("undo").click();
    return JSON.parse(localStorage.getItem(k));
  }, key);
  expect(immediate.stock.R).toBe(5990);
  expect(immediate.start.exp).toBe(200);
  expect(immediate.history).toHaveLength(1);
  await ready(page);
  await page.reload();
  await ready(page);
  await expect(page.locator("#stock-r")).toHaveValue("5990");
  await page.click("#undo");
  await ready(page);
  await expect(page.locator("#stock-r")).toHaveValue("6000");
});

test("print button waits for one complete current snapshot", async ({ page }) => {
  await page.goto(url());
  await ready(page);
  await page.evaluate(() => { window.print = () => { window.__printed = { status: document.documentElement.dataset.status, stock: document.getElementById("print-stock").textContent, tables: document.querySelectorAll(".policy-table").length }; }; });
  await page.locator("#stock-sr").fill("123");
  await page.click("#print-page");
  await page.waitForFunction(() => window.__printed);
  expect(await page.evaluate(() => window.__printed)).toMatchObject({ status: "ready", tables: 3 });
  expect((await page.evaluate(() => window.__printed)).stock).toContain("SR 123个");
});

test("all input kinds invalidate native printing and stale recommendations", async ({ page }) => {
  await page.goto(url());
  await ready(page);
  await page.locator("details.advanced summary").click();
  for (const [id, value] of [["reserve-sr", "100"], ["current-level", "2"], ["current-exp", "200"], ["target-level", "10"]]) {
    if (id === "target-level") await page.selectOption(`#${id}`, value); else await page.locator(`#${id}`).fill(value);
    await expect(page.locator("html")).toHaveAttribute("data-status", "dirty");
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".print-warning")).toBeVisible();
    await expect(page.locator(".status-panel")).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await page.click("#calculate");
    await ready(page);
  }
});

test("unavailable browser storage does not block calculations, history or theme", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url());
  await ready(page);
  await page.click('.theme-option[data-theme-mode="dark"]');
  await page.selectOption("#actual-material", "R");
  await page.click("#record-normal");
  await ready(page);
  await expect(page.locator("#stock-r")).toHaveValue("5990");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
