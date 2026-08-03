import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readWorkflow(name) {
  return readFile(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8");
}

test("CI, Pages and Release all enforce the browser publishing gate", async () => {
  for (const name of ["ci", "pages", "release"]) {
    const workflow = await readWorkflow(name);
    assert.match(workflow, /run: npm ci/);
    assert.match(workflow, /run: npx playwright install --with-deps chromium/);
    assert.match(workflow, /npm test/);
    assert.match(workflow, /npm run test:browser/);

    const browserGate = workflow.indexOf("npm run test:browser");
    const publishStep = Math.max(
      workflow.indexOf("actions/upload-pages-artifact"),
      workflow.indexOf("gh release create"),
    );
    if (publishStep >= 0) {
      assert.ok(browserGate < publishStep, `${name} must test in Chromium before publishing`);
    }
  }
});

test("Release rejects a tag that differs from the program version", async () => {
  const workflow = await readWorkflow("release");
  const tagGate = workflow.indexOf("EXPECTED_TAG=");
  const publishStep = workflow.indexOf("gh release create");

  assert.match(workflow, /EXPECTED_TAG="v\$\(node -p .*package\.json.*\)"/);
  assert.match(workflow, /GITHUB_REF_NAME.*EXPECTED_TAG/);
  assert.ok(tagGate >= 0 && tagGate < publishStep, "Release must validate its tag before publishing");
});
