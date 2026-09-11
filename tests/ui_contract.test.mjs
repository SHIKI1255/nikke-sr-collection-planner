import assert from "node:assert/strict";
import test from "node:test";
import { assembleHtml } from "../scripts/assemble.mjs";

const html = await assembleHtml();
const styles = html.match(/<style>([\s\S]+)<\/style>/)?.[1] || "";

test("typography uses one semantic scale with a 12px minimum", () => {
  for (const token of [
    "--font-xs: 12px",
    "--font-sm: 13px",
    "--font-base: 14px",
    "--font-lg: 16px",
    "--font-xl: 18px",
    "--font-2xl: 20px",
    "--font-3xl: 24px",
  ]) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const sizeDeclarations = [...styles.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(sizeDeclarations.length > 0);
  assert.ok(sizeDeclarations.every((value) => value.startsWith("var(--font-")));
  assert.doesNotMatch(styles, /font-size:\s*(?:9|10(?:\.5)?|11)px/);

  const weightDeclarations = [...styles.matchAll(/font-weight:\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(weightDeclarations.every((value) => value.startsWith("var(--weight-")));

  const lineHeightDeclarations = [...styles.matchAll(/line-height:\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(lineHeightDeclarations.every((value) => value.startsWith("var(--leading-")));
});

test("status vectors share size tokens without duplicate CSS-mask geometry", () => {
  assert.match(styles, /--size-status-icon: 22px;/);
  assert.match(styles, /\.status-icon\s*\{[\s\S]*?width: var\(--size-status-icon\);[\s\S]*?height: var\(--size-status-icon\);/);
  assert.doesNotMatch(styles, /--mark-mask|data:image\/svg/);
});

test("select controls reserve space for a consistent custom arrow", () => {
  assert.match(styles, /\.field select\s*\{[\s\S]*?appearance: none;/);
  assert.match(styles, /--space-select-indicator: 40px;/);
  assert.match(styles, /padding-right: var\(--space-select-indicator\);/);
  assert.match(styles, /--size-select-arrow: 5px;/);
  assert.match(styles, /background-size:[\s\S]*?var\(--size-select-arrow\) var\(--size-select-arrow\),/);
  assert.match(styles, /grid-template-columns: minmax\(0, 0\.8fr\) minmax\(0, 1fr\) minmax\(130px, 1\.25fr\);/);
  assert.match(styles, /\.field,[\s\S]*?\.execution-grid > \* \{ min-width: 0; \}/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?appearance: auto;/);
});

test("interactive components share measurable sizing tokens", () => {
  assert.match(styles, /--size-control: 44px;/);
  assert.match(styles, /--size-control-primary: 50px;/);
  assert.match(styles, /--radius-control: 9px;/);
  assert.match(styles, /--padding-control-inline: 12px;/);
  assert.match(styles, /\.field input,[\s\S]*?height: var\(--size-control\);/);
  assert.match(styles, /\.button\s*\{[\s\S]*?min-height: var\(--size-control\);/);
  assert.match(styles, /\.button\.primary\s*\{[\s\S]*?min-height: var\(--size-control-primary\);/);
  assert.match(styles, /\.theme-option\s*\{[\s\S]*?min-height: var\(--size-control\);/);
  assert.match(styles, /details\.advanced summary\s*\{[\s\S]*?min-height: var\(--size-control\);/);
  assert.match(styles, /\.reserve-grid input\s*\{[\s\S]*?height: var\(--size-control\);[\s\S]*?border-radius: var\(--radius-control\);/);
  assert.doesNotMatch(styles, /min-height:\s*(?:40|42|44|47|50)px/);
});

test("top-level panels share one layout rhythm", () => {
  for (const token of [
    "--layout-content-max: 1280px",
    "--space-grid: 9px",
    "--space-stack: 14px",
    "--space-section: 16px",
    "--radius-panel: 15px",
    "--padding-panel-inline: 17px",
    "--padding-panel-inline-mobile: 15px",
  ]) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(styles, /\.app-shell\s*\{[\s\S]*?width: min\(var\(--layout-content-max\),/);
  assert.match(styles, /\.panel\s*\{[\s\S]*?border-radius: var\(--radius-panel\);/);
  assert.match(styles, /\.status-panel\s*\{[\s\S]*?border-radius: var\(--radius-panel\);/);
  assert.match(styles, /\.method-panel details\s*\{[\s\S]*?border-radius: var\(--radius-panel\);/);
  assert.match(styles, /\.panel-header\s*\{[\s\S]*?padding: 15px var\(--padding-panel-inline\);/);
  assert.match(styles, /\.panel-body\s*\{\s*padding: 16px var\(--padding-panel-inline\) 18px;\s*\}/);
  assert.match(styles, /\.status-panel \+ \.panel \{ margin-top: var\(--space-stack\); \}/);
  assert.match(styles, /\.status-panel\s*\{[\s\S]*?padding: 19px var\(--padding-panel-inline\);[\s\S]*?border: 1px solid transparent;/);
  assert.doesNotMatch(styles, /border-radius:\s*(?:15|17)px/);
});

test("inventory and target form data align consistently to the left", () => {
  assert.match(styles, /\.inventory-card input\s*\{[\s\S]*?text-align: left;/);
  assert.match(styles, /\.input-hint\s*\{[\s\S]*?text-align: left;/);
  assert.match(styles, /\.reserve-grid input\s*\{[\s\S]*?text-align: left;/);
  assert.match(styles, /\.field input,[\s\S]*?\.field select\s*\{[\s\S]*?text-align: left;/);
});

test("semantic emphasis maps to the documented VI weight scale", () => {
  assert.match(styles, /b,\s*strong\s*\{\s*font-weight: var\(--weight-bold\);\s*\}/);
  assert.match(styles, /\.capacity strong\s*\{[\s\S]*?font-weight: var\(--weight-heavy\);/);
  assert.match(styles, /\.bottleneck strong\s*\{[\s\S]*?font-weight: var\(--weight-heavy\);/);
  assert.doesNotMatch(styles, /font-weight:\s*(?:500|800|900);/);
});

test("number and disabled controls use consistent native-independent states", () => {
  assert.match(styles, /input\[type="number"\]\s*\{[\s\S]*?appearance: textfield;/);
  assert.match(styles, /::-webkit-inner-spin-button,[\s\S]*?::-webkit-outer-spin-button[\s\S]*?-webkit-appearance: none;/);
  assert.match(styles, /\.button:disabled \{ cursor: not-allowed;/);
  assert.match(styles, /\.button\[aria-busy="true"\] \{ cursor: wait; \}/);
});
