import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");

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
