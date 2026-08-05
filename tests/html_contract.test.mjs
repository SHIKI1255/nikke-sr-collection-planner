import assert from "node:assert/strict";
import test from "node:test";
import { assembleHtml } from "../scripts/assemble.mjs";

const html = await assembleHtml();

test("public metadata appears only in the footer", () => {
  assert.match(html, /制作：<a href="https:\/\/github\.com\/SHIKI1255" rel="author">SHIKI1255<\/a>/);
  assert.doesNotMatch(html, /努力学习的Gabriel|B站UP主/);
  const hero = html.slice(
    html.indexOf('<header class="hero">'),
    html.indexOf("</header>", html.indexOf('<header class="hero">')),
  );
  assert.doesNotMatch(hero, /数据基线|SHIKI1255|GitHub/);
});

test("default example inventory is 6000, 2000 and 1000", () => {
  assert.match(html, /id="stock-r"[^>]+value="6000"/);
  assert.match(html, /id="stock-sr"[^>]+value="2000"/);
  assert.match(html, /id="stock-ssr"[^>]+value="1000"/);
  assert.match(html, /id="load-example"/);
});

test("calculator API and offline boundary remain present", () => {
  assert.match(html, /window\.__SR_CALCULATOR__/);
  assert.match(html, /本地计算|不上传库存数据/);
  assert.doesNotMatch(html, /https?:\/\/[^"' )]+\.js/);
});

test("theme selector provides auto, light and dark modes", () => {
  assert.match(html, /class="theme-switcher"[^>]+aria-label="页面主题"/);
  assert.match(html, /data-theme-mode="auto"[^>]+aria-pressed="true">自动<\/button>/);
  assert.match(html, /data-theme-mode="light"[^>]+>浅色<\/button>/);
  assert.match(html, /data-theme-mode="dark"[^>]+>深色<\/button>/);
  assert.match(html, /nikke-sr-theme-v1/);
  assert.match(html, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(html, /dataset\.themeMode === "auto"/);
});

test("rarity colors and dark semantic theme remain explicit", () => {
  assert.match(html, /--r: #37b7f4;/);
  assert.match(html, /--sr: #b03bed;/);
  assert.match(html, /--ssr: #f2b637;/);
  assert.match(html, /html\[data-theme="dark"\]/);
  assert.match(html, /--r: #43bdf6;/);
  assert.match(html, /--sr: #c05af2;/);
  assert.match(html, /--ssr: #f4c451;/);
});

test("policy guidance follows the three game milestone ranges", () => {
  assert.match(html, /\{ start: 0, end: 4, goal: 5 \}/);
  assert.match(html, /\{ start: 5, end: 9, goal: 10 \}/);
  assert.match(html, /\{ start: 10, end: 14, goal: 15 \}/);
  assert.match(html, /"stageRange":"\{start\}–\{end\}级"/);
  assert.match(html, /"stageGoal":"强化至\{goal\}级"/);
  assert.match(html, /message\("stageRange", \{ start: startLevel, end: endLevel \}\)/);
  assert.doesNotMatch(html, /renderPolicyTable\(policyMap, 0, 7/);
  assert.doesNotMatch(html, /renderPolicyTable\(policyMap, 8, 14/);
});

test("page semantics connect descriptions, table headers and busy state", () => {
  for (const material of ["r", "sr", "ssr"]) {
    assert.match(html, new RegExp(`id="stock-${material}"[^>]+aria-describedby="groups-${material}"`));
  }
  assert.match(html, /class="notice-icon" aria-hidden="true"/);
  assert.match(html, /"levelHeader":"等级"/);
  assert.match(html, /"expHeader":"经验"/);
  assert.match(html, /<th scope="col">\$\{TEXT\.levelHeader\}<\/th><th scope="col">\$\{TEXT\.expHeader\}<\/th>/);
  assert.match(html, /class="r-head" scope="col">R<\/th>/);
  assert.match(html, /els\.calculate\.setAttribute\("aria-busy", String\(busy\)\)/);
  assert.doesNotMatch(html, />Lv\$\{/);
});

test("print report keeps reproducible conditions and public context", () => {
  assert.match(html, /class="print-summary" aria-label="本次计算条件"/);
  for (const id of ["print-current-state", "print-target-level", "print-stock", "print-reserve"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /els\.printCurrentState\.textContent/);
  assert.match(html, /footer\.page-footer \{[\s\S]+display: block;/);
});
