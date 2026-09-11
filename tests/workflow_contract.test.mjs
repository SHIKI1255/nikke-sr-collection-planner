import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (name) => readFile(new URL(`../.github/${name}`, import.meta.url), "utf8");

test("PR, Pages and Release reuse one validation/build gate", async () => {
  const shared = await read("actions/validate/action.yml");
  for (const step of ["npm ci", "npm run typecheck", "npm test", "npx playwright install --with-deps chromium", "npm run test:browser"]) {
    assert.ok(shared.includes(step), step);
  }
  for (const name of ["ci", "pages", "release"]) {
    const workflow = await read(`workflows/${name}.yml`);
    const gate = workflow.indexOf("uses: ./.github/actions/validate");
    assert.ok(gate > 0);
    const publish = Math.max(workflow.indexOf("actions/upload-pages-artifact"), workflow.indexOf("gh release create"));
    if (publish >= 0) assert.ok(gate < publish);
  }
  const ci = await read("workflows/ci.yml");
  assert.ok(ci.includes("pull_request:"));
  assert.doesNotMatch(ci, /push:/);
  assert.match(await read("workflows/pages.yml"), /push:\s*branches: \["main"\]/);
});

test("external actions stay pinned and release tag is checked before publishing", async () => {
  for (const path of ["actions/validate/action.yml", ...["ci", "pages", "release"].map((name) => `workflows/${name}.yml`)]) {
    const content = await read(path);
    for (const match of content.matchAll(/uses:\s+([^\s]+)/g)) {
      if (!match[1].startsWith("./")) assert.match(match[1], /@[0-9a-f]{40}$/);
    }
  }
  const workflow = await read("workflows/release.yml");
  assert.ok(workflow.indexOf("EXPECTED_TAG=") < workflow.indexOf("gh release create"));
  assert.ok(workflow.includes("GITHUB_REF_NAME") && workflow.includes("package.json"));
  for (const file of ["NIKKE_SR.html", "NIKKE_SR_EN.html", "SHA256SUMS.txt"]) assert.ok(workflow.includes(`dist/downloads/${file}`));
});
