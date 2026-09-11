import type { HistoryItem } from "../state/inputs";
import { TEXT } from "../runtime/config";
import { byId, element } from "./dom";
import { message } from "./format";

export function renderHistory(history: HistoryItem[]) {
  byId<HTMLButtonElement>("undo").disabled = history.length === 0;
  const children = history.slice(-5).reverse().map((item) => {
    const row = element("div", "history-item");
    row.append(element("span", "", `${item.material} · ${item.outcome === "success" ? TEXT.outcomeSuccess : TEXT.outcomeNormal}`),
      element("span", "", message("historyState", { fromLevel: item.from.level, fromExp: item.from.exp, toLevel: item.to.level, toExp: item.to.exp })));
    return row;
  });
  byId("history-list").replaceChildren(...(children.length ? children : [element("div", "history-empty", TEXT.historyEmpty)]));
}
