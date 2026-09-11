import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModule } from "./load-module.mjs";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const readJson = async (path, root = projectRoot) => JSON.parse(await readFile(resolve(root, path), "utf8"));
export async function loadProject(root = projectRoot) {
  const site = await readJson("config/site.json", root);
  const rulesSource = await readJson(`data/rulesets/${site.default_ruleset}.json`, root);
  const scenarioFile = site.default_scenario.replaceAll("-", "_");
  const scenario = await readJson(`data/scenarios/${scenarioFile}.json`, root);
  const { validateRuleset } = await loadModule(resolve(root, "src/core/rules.ts"));
  const rules = validateRuleset(rulesSource);
  if (rules.exp_per_level % (3 * rules.exp_step)) throw new Error("UI needs three aligned EXP anchors per level");
  const { normalizeSnapshot } = await loadModule(resolve(root, "src/state/inputs.ts"));
  const normalized = normalizeSnapshot(scenario, { stock: { R: 0, SR: 0, SSR: 0 }, reserve: { R: 0, SR: 0, SSR: 0 }, start: { level: 0, exp: 0 }, target: rules.milestones.at(-1) }, rules);
  for (const key of ["stock", "reserve", "start", "target"]) {
    if (JSON.stringify(scenario[key]) !== JSON.stringify(normalized[key])) throw new Error(`Invalid default scenario: ${key}`);
  }
  if (scenario.scenario_id !== site.default_scenario) throw new Error("Scenario identity mismatch");
  if (!Array.isArray(site.languages) || !site.languages.length) throw new Error("No language builds configured");
  const paths = new Set();
  for (const language of site.languages) {
    if (!/^[a-zA-Z-]+$/.test(language.locale) || !/^(?:[a-z-]+\/)?index\.html$/.test(language.pagePath) ||
        !/^[A-Za-z_]+\.html$/.test(language.offlineName) || paths.has(language.pagePath) || paths.has(language.offlineName)) {
      throw new Error("Invalid or duplicate language output path");
    }
    paths.add(language.pagePath); paths.add(language.offlineName);
  }
  if (!/^https:\/\/github\.com\/[A-Za-z\d-]+$/.test(site.creator.profile)) throw new Error("Invalid author profile");
  return { site, rules, scenario: normalized };
}
