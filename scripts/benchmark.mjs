import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const builds = [{ name: "current", path: resolve("dist/index.html") }];
const refIndex = process.argv.indexOf("--baseline-ref");
if (refIndex >= 0) {
  const ref = process.argv[refIndex + 1];
  if (!ref || ref.startsWith("-")) throw new Error("Specify a pre-refactor commit after --baseline-ref");
  const sha = execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { encoding: "utf8" }).trim();
  const source = (path) => execFileSync("git", ["show", `${sha}:${path}`], { encoding: "utf8", maxBuffer: 2 ** 20 });
  // Preserve the exact original implementation/data while assembling a test artifact.
  // No checkout, index, tracked files or user storage are touched.
  const messages = JSON.parse(source("src/locales/zh-CN.json"));
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  let html = source("src/index.html").replace(/\{\{([A-Za-z0-9]+)\}\}/g, (_token, key) => escape(messages[key]));
  const css = ["tokens", "base", "components", "results", "policy", "responsive", "print"].map((name) => source(`src/styles/${name}.css`).trim()).join("\n\n");
  const app = source("src/scripts/app.js").replace("/* @inline locale */", () => JSON.stringify(messages).replaceAll("<", "\\u003c"));
  html = html.replace("/* @inline styles */", () => css).replace("/* @inline theme-init */", () => source("src/scripts/theme-init.js").trimEnd()).replace("/* @inline app */", () => app.trimEnd());
  const directory = resolve(".cache/benchmark");
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${sha}.html`);
  await writeFile(path, html, "utf8");
  builds.unshift({ name: `baseline:${sha}`, path });
}

// Same machine, Chromium, input and throttle; five fresh contexts per profile.
// Long tasks include DOM/layout too, so inspect attribution before blaming the solver.
const browser = await chromium.launch();
try {
  console.log(JSON.stringify({ environment: { node: process.version, chromium: browser.version(), runs: 5 } }));
  for (const build of builds) {
  for (const throttle of [1, 4]) {
    const samples = [];
    for (let run = 0; run < 5; run++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      await page.addInitScript(() => {
        window.__benchmark = { first: null, ready: null, longTasks: [] };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__benchmark.longTasks.push(entry.duration);
        }).observe({ type: "longtask", buffered: true });
        new MutationObserver(() => {
          const b = window.__benchmark;
          const value = document.getElementById("capacity-value")?.textContent;
          if (b.first === null && value && value !== "—") b.first = performance.now();
          if (b.ready === null && document.documentElement.dataset.status === "ready") b.ready = performance.now();
        }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      });
      await page.goto(pathToFileURL(build.path).href);
      await page.waitForFunction(() => window.__benchmark.ready !== null);
      const initial = await page.evaluate(() => window.__benchmark);
      const repeat = await page.evaluate(async () => {
        const start = performance.now();
        await window.__SR_CALCULATOR__.calculate();
        return performance.now() - start;
      });
      samples.push({ ...initial, repeat });
      await context.close();
    }
    const median = (key) => samples.map((sample) => sample[key]).sort((a, b) => a - b)[2];
    console.log(JSON.stringify({ build: build.name, throttle, median: { first: median("first"), ready: median("ready"), repeat: median("repeat") }, samples }));
  }
  }
} finally {
  await browser.close();
}
