# NIKKE SR收藏品强化规划器

[![CI](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/ci.yml)
[![Pages](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml/badge.svg)](https://github.com/SHIKI1255/nikke-sr-collection-planner/actions/workflows/pages.yml)

一个完全在浏览器本地运行的NIKKE SR收藏品强化规划工具。输入当前等级、经验以及R、SR、SSR保养工具库存后，计算器会在库存约束下求解期望最优用料，并在每次记录普通结果或大成功后重新规划。

- 在线使用：[GitHub Pages](https://shiki1255.github.io/nikke-sr-collection-planner/)
- 离线使用：[下载最新Release](https://github.com/SHIKI1255/nikke-sr-collection-planner/releases/latest)
- 当前数据基线：`2026-07-29`
- 制作：B站UP主「努力学习的Gabriel」

## 功能

- 按实际工具个数计算，每10个工具视为一次可执行强化。
- 支持当前等级、当前经验、目标节点和保留库存。
- 计算库存约束下的期望完整强化容量。
- 显示当前建议材料及混合策略占比。
- 提供圈、三角、叉形式的分阶段用料参考。
- 记录普通结果或大成功后，自动扣减库存并重新求解。
- 支持完全离线运行，不上传库存或操作记录。

## 正确理解推荐

计算结果属于概率期望，不是一次强化的确定消耗。

当页面同时显示多种材料及百分比时，它们表示混合策略比例。圈表示当前主要使用，三角表示仍属于混合策略的次选，叉表示当前库存条件下不建议使用。实际执行时应在每次强化后记录真实结果并重新计算。

## 数据与计算

- 正式规则集：[`data/rulesets/2026-07-29.json`](data/rulesets/2026-07-29.json)
- 数据来源：[`data/sources.yml`](data/sources.yml)
- 核算底稿：[`reference/workbook/NIKKE_SR收藏品三方案核算底稿.xlsx`](reference/workbook/NIKKE_SR收藏品三方案核算底稿.xlsx)
- 计算说明：[`docs/calculation_model.md`](docs/calculation_model.md)
- 推荐边界：[`docs/recommendation_boundaries.md`](docs/recommendation_boundaries.md)

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
