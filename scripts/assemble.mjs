import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(scriptDir, "..");

export const sourceModules = Object.freeze({
  template: "src/index.html",
  styles: [
    "src/styles/tokens.css",
    "src/styles/base.css",
    "src/styles/components.css",
    "src/styles/responsive.css",
    "src/styles/print.css",
  ],
  themeInit: "src/scripts/theme-init.js",
  app: "src/scripts/app.js",
});

const markers = Object.freeze({
  styles: "/* @inline styles */",
  themeInit: "/* @inline theme-init */",
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

export async function assembleHtml(root = projectRoot) {
  const [template, themeInit, app, ...styles] = await Promise.all([
    readSource(root, sourceModules.template),
    readSource(root, sourceModules.themeInit),
    readSource(root, sourceModules.app),
    ...sourceModules.styles.map((path) => readSource(root, path)),
  ]);

  const combinedStyles = styles.map((style) => style.trim()).join("\n\n");
  let html = replaceOnce(template, markers.themeInit, themeInit);
  html = replaceOnce(html, markers.styles, combinedStyles);
  html = replaceOnce(html, markers.app, app);

  if (/@inline (?:styles|theme-init|app)/.test(html)) {
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
