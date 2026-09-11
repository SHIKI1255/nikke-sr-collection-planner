# NIKKE SR收藏品强化规划器

[简体中文](README.md) | [English](README.en.md)

[![CI](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml)
[![Pages](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml)

一个完全在浏览器本地运行的NIKKE SR收藏品强化规划工具。输入当前等级、经验以及R、SR、SSR保养工具库存后，规划器会生成建议使用策略，估算达到目标的平均消耗，并在每次记录普通结果或大成功后自动重新规划。

- 在线使用（中文）：[GitHub Pages](https://shiki1255.github.io/nikke-sr-collection-planner/)
- Online (English): [English Page](https://shiki1255.github.io/nikke-sr-collection-planner/en/)
- 离线使用：[下载最新Release](https://github.com/SHIKI1255/nikke-sr-collection-planner/releases/latest)
- 当前程序版本：`v1.4.0`
- 当前数据基线：`2026-07-29`
- 制作：[SHIKI1255](https://github.com/SHIKI1255)

## 功能

- 按实际工具个数计算，每10个工具视为一次可执行强化。
- 支持当前等级、当前经验、目标等级和保留库存。
- 计算当前可用库存下的预计可完成次数。
- 显示当前建议使用及混合策略占比。
- 按0–4级、5–9级、10–14级三个强化阶段提供圈、三角、叉形式的工具建议，并根据目标等级显示对应阶段。
- 记录普通结果或大成功后，自动扣减库存并重新求解。
- R、SR、SSR分别使用蓝、紫、金色语义，并同时提供浅色与深色视觉方案。
- 主题可自动跟随系统，也可在页面右上角手动固定为浅色或深色。
- 打印或另存PDF时保留计算条件、阶段标题、策略图标、数据基线和制作信息。
- 提供相互独立的中文首页和英文`/en/`页面；每个页面只显示一种语言，不自动跳转。
- 支持完全离线运行，不上传库存或操作记录。

## 语言页面

中文页面和英文页面共用同一套计算逻辑、规则数据、视觉样式和本地状态，只在构建时注入对应文案。页面不提供语言切换按钮，也不会根据浏览器语言自动跳转。

英文界面统一使用`Collection Item`、`Maintenance Kit`、`Phase`和`Super Success`等游戏术语；普通强化结果使用描述性的`Normal Result`，避免误写为失败。中英文的计算结果和交互能力由自动化测试保持一致。

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

程序版本记录功能、界面和构建流程的变化；数据基线记录游戏内概率与强化规则的核对日期。完整版本记录见[`CHANGELOG.md`](CHANGELOG.md)。

## 本地验证

需要Node.js 20或更高版本。

```powershell
npm ci
npx playwright install chromium
npm run check
```

生成GitHub Pages和离线单文件成品：

```powershell
npm run build
```

构建结果位于`dist/`，该目录由自动化生成，不提交到仓库。

## 源码结构

源码使用严格 TypeScript、原生 HTML/CSS 和 esbuild，不引入 UI 框架。构建结果仍为可双击打开的单文件 HTML。

- `src/core/`：纯计算引擎、规则校验、预计算状态转移、数值优化与有界缓存；不依赖界面或本地存储。
- `src/state/`：库存（工具个数）、目标、记录/撤销与存储版本迁移；计算预算统一换算为强化次数。
- `src/runtime/`：主题、计算任务与 Worker/分段执行降级。
- `src/view/`：格式化、表单、结果、历史与共用 SVG 图标。
- `src/index.html`、`src/locales/`、`src/styles/`：共用模板、独立语言文案和统一 VI。
- `src/app.ts`、`src/worker.ts`：页面与后台计算入口。
- `config/site.json`：规则集、默认场景与语言输出路径的选择入口。

规则来自 `data/rulesets/`，默认库存来自 `data/scenarios/`。不要在页面脚本中再维护一份常量。`src/index.html` 是模板，不应直接分发；`npm run build` 生成中文 `dist/index.html`、英文 `dist/en/index.html` 及两个离线文件。

架构、扩展方式及兼容约定见 [架构说明](docs/architecture.md)。本地预览和性能对比：

```powershell
npm run preview
npm run benchmark
npm run benchmark -- --baseline-ref 4e6cd64
```

预览仅监听 `127.0.0.1:4173`；中文路径为 `/`，英文路径为 `/en/`。基准测试每种模式独立运行五次，报告中位数；CPU 降速是本机模拟，不是实测手机性能。对比参数应使用重构前的提交。

## 本次重构

- 保持现有页面、VI、离线能力和历史计算基线；公开计算 API 保持兼容。
- 修改任一计算条件后，旧结果立即失效，需要点击“计算强化规划”；达到目标不会自动切换到下一目标。
- 后台计算优先给出当前结果，再生成阶段建议；旧任务不能覆盖新输入，同一请求可复用缓存。
- 记录与撤销先更新本地状态，再重新计算；自动兼容旧库存，过滤损坏历史。
- 页面打印按钮等待完整规划；直接使用浏览器打印时，未完成的规划会显示提示而非旧报告。
- 无可用库存时显示参考策略缺口，不宣称它是“最小缺口”。结果始终是概率期望，不是单次成功保证。

## 发布

- PR 使用共享验证门禁；`main` 推送由 Pages 工作流验证一次后部署，避免重复执行整套检查。
- 推送`v*`标签后，Release工作流会再次执行同等门禁并自动创建GitHub Release。
- Release包含中文`NIKKE_SR.html`、英文`NIKKE_SR_EN.html`和统一的SHA-256校验文件。

详细流程见[`docs/release_process.md`](docs/release_process.md)。

## 贡献

程序错误、游戏数据修正和功能建议请使用对应Issue模板。数据修正必须说明来源、核对日期、影响范围和是否已通过游戏内复核。参见[`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 免责声明

这是非官方玩家工具，与SHIFT UP、Level Infinite及相关运营方无隶属或合作关系。NIKKE名称及相关商标归各自权利人所有。详见[`DISCLAIMER.md`](DISCLAIMER.md)。

## 许可证

本仓库原创代码与文档采用[MIT License](LICENSE)。第三方名称、商标、链接与事实数据不因本许可证而改变其原有权利归属。
