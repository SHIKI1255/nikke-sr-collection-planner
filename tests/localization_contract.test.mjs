import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assembleHtml, projectRoot } from "../scripts/assemble.mjs";
import { loadProject, readJson } from "../scripts/project-config.mjs";

const [zh, en, readme, readmeEn, project, pkg] = await Promise.all([
  readJson("src/locales/zh-CN.json"), readJson("src/locales/en.json"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../README.en.md", import.meta.url), "utf8"),
  loadProject(), readJson("package.json"),
]);
const [zhHtml, enHtml] = await Promise.all([assembleHtml(projectRoot, "zh-CN"), assembleHtml(projectRoot, "en")]);

test("locale keys, parameter names and types agree", () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  const placeholders = (text) => [...text.matchAll(/\{([A-Za-z0-9]+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(en)) {
    assert.equal(typeof zh[key], "string");
    assert.equal(typeof en[key], "string");
    assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), key);
  }
});

test("independent language documents preserve game terms, ownership and offline boundaries", () => {
  assert.match(zhHtml, /<html lang="zh-CN">/);
  assert.match(enHtml, /<html lang="en">/);
  for (const word of ["Maintenance Kit", "Super Success", "Target Phase"]) assert.ok(enHtml.includes(word));
  assert.doesNotMatch(enHtml, /\p{Script=Han}/u);
  for (const html of [zhHtml, enHtml]) {
    assert.doesNotMatch(html, /\{\{[A-Za-z0-9]+\}\}|@inline |努力学习的Gabriel|B站UP主/);
    assert.doesNotMatch(html, /language-switch|hreflang|navigator\.language|location\.(?:assign|replace)/i);
    assert.ok(html.includes(`<a href="${project.site.creator.profile}" rel="author">${project.site.creator.display_name}</a>`));
  }
  assert.match(zhHtml, /制作：.*SHIKI1255/);
  assert.match(enHtml, /Created by .*SHIKI1255/);
});

test("documentation links both page languages and current release", () => {
  for (const content of [readme, readmeEn]) {
    assert.ok(content.includes("[简体中文](README.md) | [English](README.en.md)"));
    assert.ok(content.includes(project.site.pages));
    assert.ok(content.includes(project.site.pages_en));
    assert.ok(content.includes(`v${pkg.version}`));
    assert.ok(content.includes(project.rules.verified_at));
  }
  assert.match(readme, /制作：\[SHIKI1255\]\(https:\/\/github\.com\/SHIKI1255\)/);
  assert.match(readmeEn, /Created by: \[SHIKI1255\]\(https:\/\/github\.com\/SHIKI1255\)/);
});

test("routes and downloads are driven by site configuration", () => {
  assert.deepEqual(project.site.languages, [
    { locale: "zh-CN", pagePath: "index.html", offlineName: "NIKKE_SR.html" },
    { locale: "en", pagePath: "en/index.html", offlineName: "NIKKE_SR_EN.html" },
  ]);
  assert.ok(zhHtml.includes(`value="${project.scenario.stock.R}"`));
  assert.ok(enHtml.includes(`value="${project.scenario.stock.SSR}"`));
  assert.ok(enHtml.includes(`Each enhancement consumes ${project.rules.action_size} kits`));
});
