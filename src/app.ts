import { createEngine } from "./core/engine";
import type { Material } from "./core/types";
import { defaults, ruleset, TEXT } from "./runtime/config";
import { createRunner } from "./runtime/runner";
import { bindTheme } from "./runtime/theme";
import { createStore } from "./state/store";
import { decodeState, encodeState, STORAGE_KEY } from "./state/storage";
import { deriveInputs, normalizeSnapshot } from "./state/inputs";
import { byId, input, setText } from "./view/dom";
import { message } from "./view/format";
import { readForm, renderForm, renderHints } from "./view/forms";
import { renderHistory } from "./view/history";
import { renderLegend } from "./view/icons";
import { renderPolicy } from "./view/policy";
import { renderCurrentResult, renderInvalid } from "./view/results";

const engine = createEngine(ruleset);
let serialized: string | null = null;
try { serialized = localStorage.getItem(STORAGE_KEY); } catch { /* file:// storage may be unavailable. */ }
const saved = decodeState(serialized, defaults, ruleset, engine.rulesIdentity);
const store = createStore(defaults, ruleset, saved.snapshot, saved.history);
const runner = createRunner(engine);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let activeCalculation: Promise<void> | null = null;
let printing = false;
let restoreCalculateFocus = false;

function showToast(text: string) {
  setText("toast", text);
  byId("toast").classList.add("active");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => byId("toast").classList.remove("active"), 2600);
}
function persist() {
  if (!saved.writable) return;
  try { localStorage.setItem(STORAGE_KEY, encodeState(store.snapshot(), store.history(), engine.rulesIdentity)); } catch { /* In-memory use remains available. */ }
}
function setBusy(busy: boolean) {
  const button = byId<HTMLButtonElement>("calculate");
  if (busy) restoreCalculateFocus = document.activeElement === button;
  button.disabled = busy;
  byId("calculate").setAttribute("aria-busy", String(busy));
  byId("progress-line").classList.toggle("active", busy);
  if (!busy) {
    if (restoreCalculateFocus && document.activeElement === document.body) button.focus({ preventScroll: true });
    restoreCalculateFocus = false;
  }
}
function invalidate() {
  runner.cancel();
  document.documentElement.dataset.status = "dirty";
  setBusy(false);
  renderInvalid(TEXT.inputsChanged);
  persist();
}
// Compatibility getter reflects form values without mutating the target or DOM.
function getInputs() { return deriveInputs(normalizeSnapshot(readForm(), defaults, ruleset), ruleset); }
function calculate(): Promise<void> {
  store.replace(readForm());
  const revision = store.revision();
  const inputs = store.inputs();
  runner.cancel();
  renderForm(inputs, ruleset);
  persist();
  document.documentElement.dataset.status = "busy";
  setBusy(true);
  renderInvalid(TEXT.calculating);
  setText("progress-text", TEXT.calculating);
  const task = runner.run(inputs, (event) => {
    if (revision !== store.revision()) return;
    if (event.kind === "current") renderCurrentResult(inputs, event.solution, ruleset);
    if (event.kind === "progress") setText("progress-text", message("progressStages", event));
    if (event.kind === "complete") {
      renderPolicy(event.entries, ruleset, inputs.target);
      setText("progress-text", TEXT.progressDone);
      document.documentElement.dataset.status = "ready";
    }
  }).catch((error: unknown) => {
    if (revision !== store.revision() || error instanceof DOMException && error.name === "AbortError") return;
    document.documentElement.dataset.status = "error";
    const detail = error instanceof Error && error.message === "NUMERICAL_CONVERGENCE" ? TEXT.convergenceError : TEXT.strategyError;
    renderInvalid(detail);
    showToast(message("calculationFailed", { message: detail }));
  }).finally(() => {
    if (revision === store.revision()) setBusy(false);
    if (activeCalculation === task) activeCalculation = null;
  });
  activeCalculation = task;
  return task;
}

function applyOutcome(outcome: "normal" | "success") {
  const form = normalizeSnapshot(readForm(), defaults, ruleset);
  if (JSON.stringify(form) !== JSON.stringify(store.snapshot())) { store.replace(form); invalidate(); }
  const material = input("actual-material").value as Material;
  const error = store.record(material, outcome);
  if (error) { showToast(message(error, { material, actionSize: ruleset.action_size })); return; }
  invalidate(); // Persist the action before starting any expensive calculation.
  renderForm(store.snapshot(), ruleset);
  renderHistory(store.history());
  void calculate();
}

async function printReport() {
  if (printing) return;
  printing = true;
  try {
    if (document.documentElement.dataset.status === "busy" && activeCalculation) await activeCalculation;
    else if (document.documentElement.dataset.status !== "ready") await calculate();
    if (document.documentElement.dataset.status !== "ready") { showToast(TEXT.printUnavailable); return; }
    // Paint the complete snapshot before opening the browser's synchronous dialog.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (document.documentElement.dataset.status === "ready") window.print();
  } finally { printing = false; }
}

bindTheme();
renderLegend();
renderForm(store.snapshot(), ruleset);
renderHistory(store.history());
document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(".left-column input, .left-column select").forEach((control) => {
  const changed = () => {
    store.replace(readForm());
    renderHints(store.snapshot(), ruleset);
    invalidate();
  };
  control.addEventListener("input", changed);
  control.addEventListener("change", changed);
});
byId("calculate").addEventListener("click", () => { void calculate(); });
byId("load-example").addEventListener("click", () => {
  store.example(); invalidate(); renderForm(store.snapshot(), ruleset); renderHistory(store.history()); void calculate();
});
byId("clear-stock").addEventListener("click", () => {
  store.replace({ ...readForm(), stock: { R: 0, SR: 0, SSR: 0 } });
  invalidate(); renderForm(store.snapshot(), ruleset); void calculate();
});
byId("record-normal").addEventListener("click", () => applyOutcome("normal"));
byId("record-success").addEventListener("click", () => applyOutcome("success"));
byId("undo").addEventListener("click", () => {
  if (store.undo()) { invalidate(); renderForm(store.snapshot(), ruleset); renderHistory(store.history()); void calculate(); }
});
byId("print-page").addEventListener("click", () => { void printReport(); });
window.addEventListener("beforeprint", () => {
  // Native Ctrl+P cannot await work. CSS hides any dirty/busy/failed report.
  if (JSON.stringify(getInputs()) !== JSON.stringify(store.inputs())) {
    store.replace(readForm()); invalidate();
  }
});
window.addEventListener("pagehide", () => runner.cancel());
window.addEventListener("pageshow", (event) => {
  if (event.persisted && document.documentElement.dataset.status !== "ready") void calculate();
});
const publicApi = {
  solveMaxUnits: engine.solveMaxUnits, solveMinShortage: engine.solveMinShortage,
  solveScenario: engine.solveScenario, normalTransition: engine.normalTransition,
  successTransition: engine.successTransition, constants: engine.constants, getInputs, calculate,
  diagnostics: () => ({ revision: store.revision(), transport: runner.transport(), cache: engine.cacheInfo() }),
};
declare global { interface Window { __SR_CALCULATOR__: typeof publicApi } }
window.__SR_CALCULATOR__ = publicApi;
if (saved.repaired) showToast(TEXT.storageRecovered);
void calculate();
