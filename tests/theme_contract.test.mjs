import assert from "node:assert/strict";
import test from "node:test";
import { assembleHtml } from "../scripts/assemble.mjs";

const html = await assembleHtml();

function variableBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "s"));
  assert.ok(match, `missing CSS variable block: ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((entry) => [entry[1], entry[2].trim()]),
  );
}

function rgb(hex) {
  const value = hex.replace("#", "");
  assert.equal(value.length, 6, `expected six-digit hex, received ${hex}`);
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
}

function luminance(hex) {
  const channels = rgb(hex).map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const light = variableBlock(":root");
const dark = variableBlock('html[data-theme="dark"]');

test("light and dark text tokens meet WCAG AA on their surfaces", () => {
  for (const [name, tokens] of [["light", light], ["dark", dark]]) {
    for (const textToken of ["ink", "text-secondary", "muted"]) {
      assert.ok(
        contrast(tokens[textToken], tokens.paper) >= 4.5,
        `${name} ${textToken} must reach 4.5:1 on paper`,
      );
    }
    assert.ok(
      contrast(tokens["control-line"], tokens.paper) >= 3,
      `${name} control border must reach 3:1 on paper`,
    );
  }
});

test("rarity labels remain readable in both themes", () => {
  for (const [name, tokens] of [["light", light], ["dark", dark]]) {
    for (const rarity of ["r", "sr", "ssr"]) {
      assert.ok(
        contrast(tokens[`${rarity}-ink`], tokens[`${rarity}-soft`]) >= 4.5,
        `${name} ${rarity.toUpperCase()} label must reach 4.5:1`,
      );
    }
  }
});

test("brand and semantic status colors keep readable contrast", () => {
  for (const [name, tokens] of [["light", light], ["dark", dark]]) {
    assert.ok(contrast(tokens["on-status"], tokens.navy) >= 4.5, `${name} primary button contrast`);
    assert.ok(contrast(tokens.info, tokens.paper) >= 4.5, `${name} information text contrast`);
    assert.ok(contrast(tokens["green-ink"], tokens["green-soft"]) >= 4.5, `${name} success contrast`);
    assert.ok(contrast(tokens["red-ink"], tokens["red-soft"]) >= 4.5, `${name} danger contrast`);
  }
});

test("rarity, success, mixed and danger colors have separate semantic tokens", () => {
  for (const tokens of [light, dark]) {
    assert.equal(new Set([tokens.r, tokens.sr, tokens.ssr, tokens.green, tokens.mixed, tokens.red]).size, 6);
  }
});

test("print styling forces readable light surfaces and hides theme controls", () => {
  assert.match(html, /@media print[\s\S]+html\[data-theme="dark"\][\s\S]+color-scheme: light/);
  assert.match(html, /\.theme-switcher, \.button, \.progress-line \{ display: none !important; \}/);
  assert.match(html, /\.status-panel \{ border: 1px solid var\(--line\); background: #ffffff; color: var\(--ink\); \}/);
});
