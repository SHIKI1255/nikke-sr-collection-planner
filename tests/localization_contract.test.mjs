import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assembleHtml, projectRoot, sourceModules } from "../scripts/assemble.mjs";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

const [zh, en, template, app, buildScript, siteConfig, manifest, license, readme, readmeEn] = await Promise.all([
  readJson(sourceModules.locales["zh-CN"]),
  readJson(sourceModules.locales.en),
  readFile(new URL(`../${sourceModules.template}`, import.meta.url), "utf8"),
  readFile(new URL(`../${sourceModules.app}`, import.meta.url), "utf8"),
  readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
  readJson("config/site.json"),
  readJson("manifest.json"),
  readFile(new URL("../LICENSE", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../README.en.md", import.meta.url), "utf8"),
]);
const [zhHtml, enHtml] = await Promise.all([
  assembleHtml(projectRoot, "zh-CN"),
  assembleHtml(projectRoot, "en"),
]);

test("locale catalogs have identical keys and cover every template and app reference", () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const key of Object.keys(zh)) {
    assert.equal(typeof zh[key], "string", `Chinese locale key ${key} must be a string`);
    assert.equal(typeof en[key], "string", `English locale key ${key} must be a string`);
    const placeholders = (value) => [...value.matchAll(/\{([A-Za-z0-9]+)\}/g)]
      .map((match) => match[1])
      .sort();
    assert.deepEqual(
      placeholders(en[key]),
      placeholders(zh[key]),
      `Locale placeholders differ for ${key}`,
    );
  }
  const referencedKeys = new Set([
    ...[...template.matchAll(/\{\{([A-Za-z0-9]+)\}\}/g)].map((match) => match[1]),
    ...[...app.matchAll(/\bTEXT\.([A-Za-z0-9]+)/g)].map((match) => match[1]),
    ...[...app.matchAll(/\bmessage\("([A-Za-z0-9]+)"/g)].map((match) => match[1]),
  ]);
  const missing = [...referencedKeys].filter((key) => !Object.hasOwn(zh, key));
  const unused = Object.keys(zh).filter((key) => !referencedKeys.has(key));
  assert.deepEqual(missing, []);
  assert.deepEqual(unused, []);
});

test("Chinese and English pages are separate, complete single-language documents", () => {
  assert.match(zhHtml, /<html lang="zh-CN">/);
  assert.match(enHtml, /<html lang="en">/);
  assert.match(zhHtml, /<title>NIKKE SR收藏品强化规划器<\/title>/);
  assert.match(enHtml, /<title>NIKKE SR Collection Item Enhancement Planner<\/title>/);
  assert.match(enHtml, /Maintenance Kit/);
  assert.match(enHtml, /Super Success/);
  assert.match(enHtml, /Target Phase/);
  assert.doesNotMatch(Object.values(en).join("\n"), /\bsets?\b/i);
  assert.doesNotMatch(Object.values(en).join("\n"), /Estimated Average Cost/);
  assert.doesNotMatch(enHtml, /[\p{Script=Han}]/u);
  for (const html of [zhHtml, enHtml]) {
    assert.doesNotMatch(html, /\{\{[A-Za-z0-9]+\}\}|@inline locale/);
    assert.doesNotMatch(html, /努力学习的Gabriel|B站UP主/);
  }
});

test("pages do not include a language switch or automatic language redirect", () => {
  for (const html of [zhHtml, enHtml]) {
    assert.doesNotMatch(html, /language-switch|hreflang|navigator\.language|location\.(?:assign|replace)/i);
  }
});

test("both pages credit the GitHub owner in the footer", () => {
  for (const html of [zhHtml, enHtml]) {
    assert.match(html, /<a href="https:\/\/github\.com\/SHIKI1255" rel="author">SHIKI1255<\/a>/);
  }
  assert.match(zhHtml, /制作：.*SHIKI1255/);
  assert.match(enHtml, /Created by .*SHIKI1255/);
  assert.deepEqual(siteConfig.creator, {
    platform: "GitHub",
    display_name: "SHIKI1255",
    profile: "https://github.com/SHIKI1255",
    credit: "制作：SHIKI1255",
  });
  assert.match(license, /Copyright \(c\) 2026 SHIKI1255/);
  assert.match(readme, /制作：\[SHIKI1255\]\(https:\/\/github\.com\/SHIKI1255\)/);
  assert.match(readmeEn, /Created by: \[SHIKI1255\]\(https:\/\/github\.com\/SHIKI1255\)/);
});

test("README files link both documentation and page languages", () => {
  const languageNavigation = /\[简体中文\]\(README\.md\) \| \[English\]\(README\.en\.md\)/;
  const chinesePage = /https:\/\/shiki1255\.github\.io\/nikke-sr-collection-planner\//;
  const englishPage = /https:\/\/shiki1255\.github\.io\/nikke-sr-collection-planner\/en\//;
  for (const content of [readme, readmeEn]) {
    assert.match(content, languageNavigation);
    assert.match(content, chinesePage);
    assert.match(content, englishPage);
    assert.match(content, /v1\.3\.0/);
    assert.match(content, /2026-07-29/);
  }
});

test("build emits independent Pages routes and standalone downloads", () => {
  assert.match(buildScript, /pagePath: "index\.html"/);
  assert.match(buildScript, /pagePath: "en\/index\.html"/);
  assert.match(buildScript, /offlineName: "NIKKE_SR\.html"/);
  assert.match(buildScript, /offlineName: "NIKKE_SR_EN\.html"/);
  assert.match(buildScript, /English source HTML contains Chinese interface text/);
  assert.equal(manifest.default_locale, "zh-CN");
  assert.deepEqual(manifest.supported_locales, ["zh-CN", "en"]);
  assert.deepEqual(manifest.pages_routes, { "zh-CN": "/", en: "/en/" });
  assert.equal(siteConfig.pages_en, "https://shiki1255.github.io/nikke-sr-collection-planner/en/");
});
