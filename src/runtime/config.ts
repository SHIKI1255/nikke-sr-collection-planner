import type { Ruleset } from "../core/types";
import type { Snapshot } from "../state/inputs";
import type Messages from "../locales/en.json";

declare const __RULESET__: Ruleset;
declare const __SCENARIO__: Snapshot;
declare const __MESSAGES__: typeof Messages;
declare const __WORKER_SOURCE__: string;
export const ruleset = __RULESET__;
export const defaults = __SCENARIO__;
export const TEXT = __MESSAGES__;
export const workerSource = __WORKER_SOURCE__;
