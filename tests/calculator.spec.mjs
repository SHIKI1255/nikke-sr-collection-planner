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
  await expect(page.locator("#history-list")).toContainText("尚无强化记录");
});

test("reached target states are explicit and do not show a count unit", async ({ page }) => {
  await page.locator("#current-level").fill("15");
  await page.locator("#calculate").click();

  await expect(page.locator("#capacity-value")).toHaveText("已达成");
  await expect(page.locator("#capacity-unit")).toBeEmpty();
  await expect(page.locator("#capacity-note")).toContainText("当前等级已达到所选目标（15级）");
});

test("has no horizontal overflow at common narrow widths", async ({ page }) => {
  for (const width of [320, 380, 390, 719, 720, 721, 759, 760, 761, 1040, 1041, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  }
});

test("canonical responsive breakpoints switch at 720px and 1040px", async ({ page }) => {
  async function columnCounts(width) {
    await page.setViewportSize({ width, height: 844 });
    return page.evaluate(() => {
      const countColumns = (selector) => getComputedStyle(document.querySelector(selector))
        .gridTemplateColumns.split(" ").filter(Boolean).length;
      return {
        workspace: countColumns(".workspace"),
        state: countColumns(".state-grid"),
        status: countColumns(".status-top"),
      };
    });
  }

  expect(await columnCounts(720)).toEqual({ workspace: 1, state: 1, status: 1 });
  expect(await columnCounts(721)).toEqual({ workspace: 1, state: 3, status: 2 });
  expect((await columnCounts(1040)).workspace).toBe(1);
  expect((await columnCounts(1041)).workspace).toBe(2);
});

test("status icons use identical vector geometry", async ({ page }) => {
  const geometry = await page.locator(".legend .mark").evaluateAll((icons) => icons.map((icon) => {
    const box = icon.getBoundingClientRect();
    const pseudo = getComputedStyle(icon, "::before");
    return {
      width: box.width,
      height: box.height,
      pseudoWidth: pseudo.width,
      pseudoHeight: pseudo.height,
      mask: pseudo.maskImage || pseudo.webkitMaskImage,
    };
  }));

  expect(geometry).toHaveLength(3);
  for (const icon of geometry) {
    expect(icon.width).toBe(22);
    expect(icon.height).toBe(22);
    expect(icon.pseudoWidth).toBe("22px");
    expect(icon.pseudoHeight).toBe("22px");
    expect(icon.mask).toContain("svg");
  }
});

test("select arrows stay inside their controls with reserved space", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const controls = await page.locator("#target-level, #actual-material").evaluateAll((selects) => selects.map((select) => {
    const box = select.getBoundingClientRect();
    const parentBox = select.parentElement.getBoundingClientRect();
    const styles = getComputedStyle(select);
    return {
      left: box.left,
      right: box.right,
      parentLeft: parentBox.left,
      parentRight: parentBox.right,
      appearance: styles.appearance,
      paddingRight: Number.parseFloat(styles.paddingRight),
      backgroundImage: styles.backgroundImage,
    };
  }));

  for (const control of controls) {
    expect(control.left).toBeGreaterThanOrEqual(control.parentLeft);
    expect(control.right).toBeLessThanOrEqual(control.parentRight);
    expect(control.appearance).toBe("none");
    expect(control.paddingRight).toBeGreaterThanOrEqual(40);
    expect(control.backgroundImage).not.toBe("none");
  }
});

test("inventory and target form values align to the left", async ({ page }) => {
  const alignments = await page.locator(
    "#stock-r, #stock-sr, #stock-ssr, #groups-r, #groups-sr, #groups-ssr, #current-level, #current-exp, #target-level, #reserve-r, #reserve-sr, #reserve-ssr",
  ).evaluateAll((elements) => elements.map((element) => getComputedStyle(element).textAlign));
  expect(new Set(alignments)).toEqual(new Set(["left"]));
});

test("auto theme follows live system changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('.theme-option[data-theme-mode="auto"]')).toHaveAttribute("aria-pressed", "true");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("manual theme overrides the system, persists and can return to auto", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.locator('.theme-option[data-theme-mode="dark"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('.theme-option[data-theme-mode="dark"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("nikke-sr-theme-v1"))).toBe("dark");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await page.waitForSelector('html[data-status="ready"]');
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.locator('.theme-option[data-theme-mode="auto"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme changes expose the intended rarity palette", async ({ page }) => {
  const readPalette = () => page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return ["--r", "--sr", "--ssr"].map((name) => styles.getPropertyValue(name).trim());
  });

  await page.locator('.theme-option[data-theme-mode="light"]').click();
  expect(await readPalette()).toEqual(["#37b7f4", "#b03bed", "#f2b637"]);
  await page.locator('.theme-option[data-theme-mode="dark"]').click();
  expect(await readPalette()).toEqual(["#43bdf6", "#c05af2", "#f4c451"]);
});
