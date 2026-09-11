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

test("target options preserve the three game milestones", () => {
  for (const target of [5, 10, 15]) assert.match(html, new RegExp(`<option value="${target}"`));
});

test("page semantics connect descriptions, table headers and busy state", () => {
  for (const material of ["r", "sr", "ssr"]) {
    assert.match(html, new RegExp(`id="stock-${material}"[^>]+aria-describedby="groups-${material}"`));
  }
  assert.match(html, /class="notice-icon" aria-hidden="true"/);





  assert.doesNotMatch(html, />Lv\$\{/);
});

test("print report keeps reproducible conditions and public context", () => {
  assert.match(html, /class="print-summary" aria-label="本次计算条件"/);
  for (const id of ["print-current-state", "print-target-level", "print-stock", "print-reserve"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /footer\.page-footer \{[\s\S]+display: block;/);
});
