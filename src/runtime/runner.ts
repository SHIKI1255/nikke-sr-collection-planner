import type { Engine } from "../core/engine";
import type { Inputs } from "../state/inputs";
import { planEvents } from "./plan";
import type { PlanEvent } from "./plan";
import { workerSource } from "./config";

const cancelled = () => new DOMException("Calculation superseded", "AbortError");
export function createRunner(engine: Engine) {
  let worker: Worker | null = null;
  let workerDisabled = false;
  let sequence = 0;
  let abort: (() => void) | null = null;
  let transport = "idle";
  const terminate = () => { worker?.terminate(); worker = null; };
  const cancel = () => {
    sequence++;
    if (abort) { abort(); abort = null; terminate(); }
  };
  return {
    cancel,
    transport: () => transport,
    run(inputs: Inputs, onEvent: (event: PlanEvent) => void): Promise<void> {
      cancel();
      const id = sequence;
      return new Promise((resolve, reject) => {
        let settled = false;
        let fallingBack = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (error?: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (id === sequence) abort = null;
          if (error) reject(error); else resolve();
        };
        abort = () => finish(cancelled());
        const receive = (event: PlanEvent) => {
          if (settled || id !== sequence) return;
          try {
            onEvent(event);
            if (event.kind === "complete") finish();
          } catch (error) { finish(error); }
        };
        const fallback = async () => {
          if (settled || fallingBack || id !== sequence) return;
          fallingBack = true;
          clearTimeout(timer);
          workerDisabled = true;
          terminate();
          transport = "cooperative";
          try {
            const events = planEvents(engine, inputs);
            while (!settled && id === sequence) {
              // Yield BEFORE each solver step; superseded work is never resumed.
              await new Promise<void>((resume) => setTimeout(resume, 0));
              if (settled || id !== sequence) break;
              const next = events.next();
              if (next.done) break;
              receive(next.value);
            }
          } catch (error) { finish(error); }
        };
        if (workerDisabled || typeof Worker === "undefined") { void fallback(); return; }
        try {
          if (!worker) {
            const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
            try { worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
          }
          transport = "worker";
          worker.onmessage = ({ data }: MessageEvent<{ id: number; event?: PlanEvent; error?: string }>) => {
            if (data.id !== id || settled || sequence !== id) return;
            clearTimeout(timer);
            if (data.error) finish(new Error(data.error));
            else if (data.event) receive(data.event);
          };
          worker.onerror = (event) => { event.preventDefault(); void fallback(); };
          worker.onmessageerror = () => { void fallback(); };
          timer = setTimeout(() => { void fallback(); }, 5000);
          worker.postMessage({ id, inputs });
        } catch { void fallback(); }
      });
    },
  };
}
