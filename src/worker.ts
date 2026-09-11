import { createEngine } from "./core/engine";
import { ruleset } from "./runtime/config";
import { planEvents } from "./runtime/plan";
import type { Inputs } from "./state/inputs";

const engine = createEngine(ruleset);
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<{ id: number; inputs: Inputs }>) => void) | null;
  postMessage(message: unknown): void;
};
worker.onmessage = ({ data: { id, inputs } }) => {
  try {
    for (const event of planEvents(engine, inputs)) worker.postMessage({ id, event });
  } catch (error) {
    worker.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
