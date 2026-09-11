import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assembleHtml, projectRoot, sourceModules } from "../scripts/assemble.mjs";
import { resolve } from "node:path";

async function readSource(path) {
  return readFile(resolve(projectRoot, path), "utf8");
}

function topLevelSelectors(css) {
  const selectors = [];
  let depth = 0;
  let segmentStart = 0;
  let quote = "";
  let inComment = false;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (char === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (!quote && char === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        const selector = css.slice(segmentStart, index).trim().replace(/\s+/g, " ");
        if (selector && !selector.startsWith("@")) selectors.push(selector);
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) segmentStart = index + 1;
      assert.ok(depth >= 0, "CSS closes more blocks than it opens");
    }
  }

  assert.equal(depth, 0, "CSS must have balanced blocks");
  return selectors;
}

test("source is split into bounded, purpose-specific modules", async () => {
  assert.deepEqual(sourceModules.locales, {
    "zh-CN": "src/locales/zh-CN.json",
    en: "src/locales/en.json",
  });
  assert.deepEqual(sourceModules.styles, [
    "src/styles/tokens.css",
    "src/styles/base.css",
    "src/styles/components.css",
    "src/styles/results.css",
    "src/styles/policy.css",
    "src/styles/responsive.css",
    "src/styles/print.css",
  ]);

  // Import graph, strict types and behavior tests replace arbitrary line limits.
  for (const path of [sourceModules.template, sourceModules.themeInit, sourceModules.app, ...sourceModules.styles]) {
    assert.ok((await readSource(path)).trim().length > 0);
  }
});

test("the template has one marker per inline source category", async () => {
  const template = await readSource(sourceModules.template);
  assert.equal((template.match(/@inline theme-init/g) || []).length, 1);
  assert.equal((template.match(/@inline styles/g) || []).length, 1);
  assert.equal((template.match(/@inline app/g) || []).length, 1);
  assert.doesNotMatch(template, /window\.__SR_CALCULATOR__|--font-base|\.workspace\s*\{/);
  assert.doesNotMatch(template, /[\p{Script=Han}]/u);
});

test("normal component selectors have one canonical definition", async () => {
  const normalStylePaths = sourceModules.styles.filter(
    (path) => !path.endsWith("/responsive.css") && !path.endsWith("/print.css"),
  );
  const normalStyles = await Promise.all(
    normalStylePaths.map((path) => readSource(path)),
  );
  const selectors = normalStyles.flatMap(topLevelSelectors);
  const seen = new Set();
  const duplicates = new Set();
  for (const selector of selectors) {
    if (seen.has(selector)) duplicates.add(selector);
    seen.add(selector);
  }
  assert.deepEqual([...duplicates], []);
});

test("responsive CSS uses one documented breakpoint system", async () => {
  const responsive = await readSource("src/styles/responsive.css");
  assert.equal((responsive.match(/max-width:\s*1040px/g) || []).length, 1);
  assert.equal((responsive.match(/max-width:\s*720px/g) || []).length, 1);
  assert.equal((responsive.match(/max-width:\s*380px/g) || []).length, 1);
  assert.doesNotMatch(responsive, /max-width:\s*760px|Public preview/);
});

test("assembly produces one dependency-free standalone document", async () => {
  const documents = await Promise.all([
    assembleHtml(projectRoot, "zh-CN"),
    assembleHtml(projectRoot, "en"),
  ]);
  for (const html of documents) {
    assert.equal((html.match(/<style>/g) || []).length, 1);
    assert.equal((html.match(/<script>/g) || []).length, 2);
    assert.doesNotMatch(html, /@inline (?:styles|theme-init|locale|app)|\{\{[A-Za-z0-9]+\}\}/);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel\s*=\s*["']stylesheet/i);
  }

  const html = documents[0];
  const positions = sourceModules.styles.map((path) => {
    const name = path.split("/").at(-1);
    const signatures = {
      "tokens.css": ":root {",
      "base.css": "* { box-sizing: border-box; }",
      "components.css": ".workspace {",
      "results.css": ".status-panel {",
      "policy.css": ".policy-panel {",
      "responsive.css": "@media (max-width: 1040px)",
      "print.css": "@media print",
    };
    return html.indexOf(signatures[name]);
  });
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test("core modules cannot import UI, runtime, persistence or browser globals", async () => {
  const { build } = await import("esbuild");
  const result = await build({ entryPoints: ["src/core/engine.ts"], bundle: true, write: false, metafile: true, platform: "neutral" });
  assert.ok(Object.keys(result.metafile.inputs).length >= 5);
  for (const path of Object.keys(result.metafile.inputs)) {
    assert.ok(path.replaceAll("\\\\", "/").startsWith("src/core/"), path);
    assert.doesNotMatch(await readSource(path), /\\b(?:document|window|localStorage)\\b/);
  }
  const ts = JSON.parse(await readSource("tsconfig.json"));
  assert.equal(ts.compilerOptions.strict, true);
  assert.equal(ts.compilerOptions.noEmit, true);
});
