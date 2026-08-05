import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(scriptDir, "..");

export const sourceModules = Object.freeze({
  template: "src/index.html",
  locales: Object.freeze({
    "zh-CN": "src/locales/zh-CN.json",
    en: "src/locales/en.json",
  }),
  styles: [
    "src/styles/tokens.css",
    "src/styles/base.css",
    "src/styles/components.css",
    "src/styles/results.css",
    "src/styles/policy.css",
    "src/styles/responsive.css",
    "src/styles/print.css",
  ],
  themeInit: "src/scripts/theme-init.js",
  app: "src/scripts/app.js",
});

const markers = Object.freeze({
  styles: "/* @inline styles */",
  themeInit: "/* @inline theme-init */",
  locale: "/* @inline locale */",
  app: "/* @inline app */",
});

async function readSource(root, path) {
  return readFile(resolve(root, path), "utf8");
}

function replaceOnce(source, marker, replacement) {
  const occurrences = source.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected one ${marker} marker, found ${occurrences}.`);
  }
  return source.replace(marker, replacement.trimEnd());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function localizeTemplate(template, messages) {
  const localized = template.replace(/\{\{([A-Za-z0-9]+)\}\}/g, (token, key) => {
    if (!Object.hasOwn(messages, key)) {
      throw new Error(`Missing locale message for template token: ${key}`);
    }
    return escapeHtml(messages[key]);
  });
  const leftovers = [...localized.matchAll(/\{\{([A-Za-z0-9]+)\}\}/g)].map((match) => match[1]);
  if (leftovers.length) {
    throw new Error(`Unresolved locale tokens: ${leftovers.join(", ")}`);
  }
  return localized;
}

export async function assembleHtml(root = projectRoot, locale = "zh-CN") {
  const localePath = sourceModules.locales[locale];
  if (!localePath) throw new Error(`Unsupported locale: ${locale}`);

  const [template, localeSource, themeInit, app, ...styles] = await Promise.all([
    readSource(root, sourceModules.template),
    readSource(root, localePath),
    readSource(root, sourceModules.themeInit),
    readSource(root, sourceModules.app),
    ...sourceModules.styles.map((path) => readSource(root, path)),
  ]);

  const messages = JSON.parse(localeSource);
  if (messages.locale !== locale) {
    throw new Error(`Locale file ${localePath} declares ${messages.locale}; expected ${locale}.`);
  }
  const combinedStyles = styles.map((style) => style.trim()).join("\n\n");
  const localizedApp = replaceOnce(
    app,
    markers.locale,
    JSON.stringify(messages).replaceAll("<", "\\u003c"),
  );
  let html = localizeTemplate(template, messages);
  html = replaceOnce(html, markers.themeInit, themeInit);
  html = replaceOnce(html, markers.styles, combinedStyles);
  html = replaceOnce(html, markers.app, localizedApp);

  if (/@inline (?:styles|theme-init|locale|app)/.test(html)) {
    throw new Error("The assembled HTML still contains an inline source marker.");
  }
  if ((html.match(/<style>/g) || []).length !== 1) {
    throw new Error("The assembled HTML must contain exactly one style block.");
  }
  if ((html.match(/<script>/g) || []).length !== 2) {
    throw new Error("The assembled HTML must contain exactly two inline script blocks.");
  }
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel\s*=\s*["']stylesheet/i.test(html)) {
    throw new Error("The assembled HTML must not depend on external scripts or stylesheets.");
  }

  return html;
}
