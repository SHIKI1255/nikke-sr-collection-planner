import assert from "node:assert/strict";
import test from "node:test";
import { assembleHtml } from "../scripts/assemble.mjs";

const html = await assembleHtml();

test("public metadata appears only in the footer", () => {
  assert.equal((html.match(/努力学习的Gabriel/g) || []).length, 1);
  assert.match(
    html,
    /本工具由B站UP主「努力学习的Gabriel」制作/,
  );
  const hero = html.slice(
    html.indexOf('<header class="hero">'),
    html.indexOf("</header>", html.indexOf('<header class="hero">')),
  );
  assert.doesNotMatch(hero, /数据基线|Gabriel|B站/);
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
