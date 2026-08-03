# NIKKE SR收藏品强化规划器

[![CI](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml)
[![Pages](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml)

一个完全在浏览器本地运行的NIKKE SR收藏品强化规划工具。输入当前等级、经验以及R、SR、SSR保养工具库存后，计算器会给出建议使用顺序和预计平均消耗，并在每次记录普通结果或大成功后重新规划。

- 在线使用：[GitHub Pages](https://shiki1255.github.io/nikke-sr-collection-planner/)
- 离线使用：[下载最新Release](https://github.com/SHIKI1255/nikke-sr-collection-planner/releases/latest)
- 当前数据基线：`2026-07-29`
- 制作：B站UP主「努力学习的Gabriel」

## 功能

- 按实际工具个数计算，每10个工具视为一次可执行强化。
- 支持当前等级、当前经验、目标等级和保留库存。
- 计算当前可用库存下的预计可完成次数。
- 显示当前建议使用及混合策略占比。
- 提供圈、三角、叉形式的分阶段工具建议。
- 记录普通结果或大成功后，自动扣减库存并重新求解。
- R、SR、SSR分别使用蓝、紫、金色语义，并同时提供浅色与深色视觉方案。
- 主题可自动跟随系统，也可在页面右上角手动固定为浅色或深色。
- 支持完全离线运行，不上传库存或操作记录。

## 主题与颜色

页面右上角提供`自动`、`浅色`、`深色`三种主题模式。首次访问默认自动跟随系统；手动选择浅色或深色后将保存在当前浏览器中，并覆盖后续系统主题变化。选择`自动`即可恢复实时跟随。

颜色用于辅助识别而不是替代文字：R为蓝色、SR为紫色、SSR为金色；主用、混合/次选和不建议仍分别保留圈、三角和叉形标记。

## 正确理解推荐

计算结果属于概率期望，不是一次强化的确定消耗。

当页面同时显示多种保养工具及百分比时，它们表示混合策略比例。圈表示当前主用，三角表示仍属于混合策略的次选，叉表示当前库存条件下不建议使用。实际执行时应在每次强化后记录真实结果并重新计算。

## 数据与计算

- 正式规则集：[`data/rulesets/2026-07-29.json`](data/rulesets/2026-07-29.json)
- 数据来源：[`data/sources.yml`](data/sources.yml)
- 核算底稿：[`reference/workbook/NIKKE_SR收藏品三方案核算底稿.xlsx`](reference/workbook/NIKKE_SR收藏品三方案核算底稿.xlsx)
- 计算说明：[`docs/calculation_model.md`](docs/calculation_model.md)
- 推荐边界：[`docs/recommendation_boundaries.md`](docs/recommendation_boundaries.md)
- UI、VI与文案规范：[`docs/ui_content_style_guide.md`](docs/ui_content_style_guide.md)

规则集与程序版本独立。游戏数据发生变化时，应新增或更新规则集、来源记录和回归基线，而不是只修改页面显示值。

## 本地验证

需要Node.js 20或更高版本。

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

生成GitHub Pages和离线单文件成品：

```bash
npm run build
```

构建结果位于`dist/`，该目录由自动化生成，不提交到仓库。

## 源码结构

源码按职责拆分，构建时重新内联为一个不依赖外部资源的HTML：

- `src/index.html`：页面结构和内联位置模板。
- `src/styles/tokens.css`：浅色、深色、字号、尺寸和语义变量。
- `src/styles/base.css`：页面基础样式和顶部区域。
- `src/styles/components.css`：表单、面板、结果、图标和表格组件。
- `src/styles/responsive.css`：`1040/720/380px`响应式与辅助功能规则。
- `src/styles/print.css`：打印专用覆盖。
- `src/scripts/theme-init.js`：首屏主题初始化。
- `src/scripts/app.js`：计算、界面状态与本地记录。

`src/index.html`是构建模板，不应作为成品直接分发。`scripts/assemble.mjs`按固定顺序组装源码，`npm run build`生成可以直接打开的`dist/index.html`和Release离线文件。

## 发布

- `main`分支验证通过后自动部署GitHub Pages。
- 推送`v*`标签后自动创建GitHub Release。
- Release包含离线单文件HTML和SHA-256校验文件。

详细流程见[`docs/release_process.md`](docs/release_process.md)。

## 贡献

程序错误、游戏数据修正和功能建议请使用对应Issue模板。数据修正必须说明来源、核对日期、影响范围和是否已通过游戏内复核。参见[`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 免责声明

这是非官方玩家工具，与SHIFT UP、Level Infinite及相关运营方无隶属或合作关系。NIKKE名称及相关商标归各自权利人所有。详见[`DISCLAIMER.md`](DISCLAIMER.md)。

## 许可证

本仓库原创代码与文档采用[MIT License](LICENSE)。第三方名称、商标、链接与事实数据不因本许可证而改变其原有权利归属。
