import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(resolve("dist/index.html")).href;

test.beforeEach(async ({ page }) => {
  await page.goto(pageUrl);
  await page.waitForSelector('html[data-status="ready"]');
});

test("loads the formal public interface and default example", async ({ page }) => {
  await expect(page).toHaveTitle("NIKKE SR收藏品强化规划器");
  await expect(page.locator("#stock-r")).toHaveValue("6000");
  await expect(page.locator("#stock-sr")).toHaveValue("2000");
  await expect(page.locator("#stock-ssr")).toHaveValue("1000");
  await expect(page.locator("footer")).toContainText(
    "本工具由B站UP主「努力学习的Gabriel」制作",
  );
  await expect(page.locator("header.hero")).not.toContainText("Gabriel");
});

test("reproduces the two audited optimization baselines", async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = window.__SR_CALCULATOR__;
    const balance = api.solveMaxUnits(
      { level: 0, exp: 0 },
      15,
      {
        R: 27.10472217509205,
        SR: 8.4090869871621,
        SSR: 3.6927541998417297,
      },
    );
    const raid = api.solveMaxUnits(
      { level: 0, exp: 0 },
      15,
      {
        R: 50.36831173851833,
        SR: 5.24788751975503,
        SSR: 1.9394366920833799,
      },
    );
    return { balance: balance.perUnit, raid: raid.perUnit };
  });

  expect(result.balance.R).toBeCloseTo(27.10472217509205, 10);
  expect(result.balance.SR).toBeCloseTo(8.4090869871621, 10);
  expect(result.balance.SSR).toBeCloseTo(3.6927541998417297, 10);
  expect(result.raid.R).toBeCloseTo(50.36831173851833, 10);
  expect(result.raid.SR).toBeCloseTo(5.24788751975503, 10);
  expect(result.raid.SSR).toBeCloseTo(1.9394366920833799, 10);
});

test("records a normal result and can undo it", async ({ page }) => {
  await page.selectOption("#actual-material", "R");
  await page.click("#record-normal");
  await expect(page.locator("#stock-r")).toHaveValue("5990");
  await expect(page.locator("#current-exp")).toHaveValue("200");
  await expect(page.locator("#history-list")).toContainText("Lv0/0 → Lv0/200");

  await page.click("#undo");
  await expect(page.locator("#stock-r")).toHaveValue("6000");
  await expect(page.locator("#current-exp")).toHaveValue("0");
  await expect(page.locator("#history-list")).toContainText("尚无执行记录");
});

test("has no horizontal overflow at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
});
