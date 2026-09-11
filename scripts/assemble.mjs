import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { loadProject, projectRoot, readJson } from "./project-config.mjs";
export { projectRoot };

export const sourceModules = Object.freeze({
  template: "src/index.html",
  locales: { "zh-CN": "src/locales/zh-CN.json", en: "src/locales/en.json" },
  styles: ["tokens", "base", "components", "results", "policy", "responsive", "print"].map((name) => `src/styles/${name}.css`),
  themeInit: "src/theme-init.ts",
  app: "src/app.ts",
});
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
function replaceOnce(source, marker, replacement) {
  if (source.split(marker).length !== 2) throw new Error(`Expected exactly one marker: ${marker}`);
  return source.replace(marker, () => replacement.trimEnd());
}
const interpolate = (text, values) => text.replace(/\{([A-Za-z0-9]+)\}/g, (token, key) => Object.hasOwn(values, key) ? values[key] : token);
async function bundle(root, entry, define = {}) {
  const result = await build({
    absWorkingDir: root, entryPoints: [entry], bundle: true, write: false,
    platform: "browser", format: "iife", target: "es2022",
    minify: true, legalComments: "none", charset: "utf8", define,
  });
  // HTML parsers can terminate script tags inside JavaScript strings.
  return result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
}
export async function assembleHtml(root = projectRoot, locale = "zh-CN") {
  const { site, rules, scenario } = await loadProject(root);
  if (!site.languages.some((build) => build.locale === locale)) throw new Error(`Unsupported locale: ${locale}`);
  const rawMessages = await readJson(`src/locales/${locale}.json`, root);
  if (rawMessages.locale !== locale) throw new Error("Locale identity mismatch");
  const messages = Object.fromEntries(Object.entries(rawMessages).map(([key, value]) => [key, interpolate(value, { actionSize: rules.action_size })]));
  const define = {
    __RULESET__: JSON.stringify(rules),
    __SCENARIO__: JSON.stringify(scenario),
    __MESSAGES__: JSON.stringify(messages),
    __WORKER_SOURCE__: '""',
  };
  const worker = await bundle(root, "src/worker.ts", define);
  const [template, app, theme, ...styles] = await Promise.all([
    readFile(resolve(root, sourceModules.template), "utf8"),
    bundle(root, sourceModules.app, { ...define, __WORKER_SOURCE__: JSON.stringify(worker) }),
    bundle(root, sourceModules.themeInit),
    ...sourceModules.styles.map((path) => readFile(resolve(root, path), "utf8")),
  ]);
  const declarations = [...styles[0].match(/:root\s*\{([^}]+)\}/s)[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)];
  const themedNames = new Set([...styles[0].match(/html\[data-theme="dark"\]\s*\{([^}]+)\}/s)[1].matchAll(/(--[\w-]+):/g)].map((match) => match[1]));
  if ([...themedNames].some((name) => !declarations.some((entry) => entry[1] === name))) throw new Error("Dark theme token lacks a light print equivalent");
  const palette = declarations.filter(([, name]) => themedNames.has(name))
    .map(([, name, value]) => `${name}: ${["--bg", "--bg-top"].includes(name) ? "#ffffff" : value};`).join("\n    ");
  const css = replaceOnce(styles.join("\n\n"), "/* @inline print-theme */", palette);
  const stockText = (stock) => ["R", "SR", "SSR"].map((material) => interpolate(messages.stockItem, { material, value: stock[material] })).join(" / ");
  const values = {
    ...messages,
    defaultCurrentState: interpolate(messages.phaseExp, scenario.start),
    defaultTarget: interpolate(messages.phase, { value: scenario.target }),
    defaultStock: stockText(scenario.stock), defaultReserve: stockText(scenario.reserve),
    initialLevel: scenario.start.level, initialExp: scenario.start.exp,
    maxLevel: rules.milestones.at(-1), maxExp: rules.exp_per_level - rules.exp_step, expStep: rules.exp_step,
    verifiedAt: rules.verified_at, creatorProfile: site.creator.profile, creatorName: site.creator.display_name,
  };
  for (const material of ["R", "SR", "SSR"]) {
    values[`stock${material}`] = scenario.stock[material];
    values[`reserve${material}`] = scenario.reserve[material];
    values[`defaultGroups${material}`] = interpolate(messages.groupRemainder, { groups: Math.floor(scenario.stock[material] / rules.action_size), items: scenario.stock[material] % rules.action_size });
  }
  let html = template.replace(/\{\{([A-Za-z0-9]+)\}\}/g, (_token, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Missing template value: ${key}`);
    return escapeHtml(values[key]);
  });
  const targets = rules.milestones.map((target) => `<option value="${target}"${target === scenario.target ? " selected" : ""}>${escapeHtml(interpolate(messages.phase, { value: target }))}</option>`).join("\n");
  html = replaceOnce(html, "<!-- @inline targets -->", targets);
  html = replaceOnce(html, "/* @inline theme-init */", theme);
  html = replaceOnce(html, "/* @inline styles */", css);
  html = replaceOnce(html, "/* @inline app */", app);
  if (/@inline |\{\{[A-Za-z0-9]+\}\}/.test(html)) throw new Error("Unresolved assembly marker");
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel\s*=\s*["']stylesheet/i.test(html)) throw new Error("External script or stylesheet dependency");
  return html;
}
