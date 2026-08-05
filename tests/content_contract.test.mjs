import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assembleHtml } from "../scripts/assemble.mjs";

const html = await assembleHtml();
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const guide = await readFile(
  new URL("../docs/ui_content_style_guide.md", import.meta.url),
  "utf8",
);

test("primary interface uses the player-facing terminology", () => {
  for (const preferredText of [
    "库存与目标",
    "目标等级",
    "计算强化规划",
    "当前建议使用",
    "达到目标1次的预计平均消耗",
    "主要限制工具",
    "可完整达成目标",
    "本次使用工具",
    "分阶段工具建议",
    "计算说明与使用限制",
  ]) {
    assert.match(html, new RegExp(preferredText));
  }

  assert.doesNotMatch(
    html,
    /建议使用顺序|目标节点|当前建议用料|实际使用材料|分阶段用料参考|完整强化容量|单次完成的期望消耗|库存瓶颈|锚点|混合或次选|尚无执行记录|当前无需材料/,
  );
});

test("reached-target capacity can remove an inapplicable unit", () => {
  assert.match(html, /id="capacity-value"[^>]*>—<\/strong><span id="capacity-unit">次<\/span>/);
  assert.match(html, /"capacityAchieved":"已达成"/);
  assert.match(html, /els\.capacityValue\.textContent = TEXT\.capacityAchieved;/);
  assert.match(html, /els\.capacityUnit\.textContent = "";/);
  assert.match(html, /els\.capacityUnit\.textContent = TEXT\.capacityUnit;/);
});

test("the repository documents one enforceable UI, VI and content standard", () => {
  assert.match(readme, /docs\/ui_content_style_guide\.md/);

  for (const rule of [
    "## 用户界面术语",
    "## 英文界面术语",
    "## 单语言页面规则",
    "## VI颜色职责",
    "## 排版系统",
    "## 图标规则",
    "## 控件尺寸与对齐",
    "## 主题行为",
    "## 可访问性与验证",
    "#37B7F4",
    "#B03BED",
    "#F2B637",
    "44×44px",
    "22×22px",
    "4.5:1",
    "text-align: left",
  ]) {
    assert.match(guide, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
