# 架构与兼容约定 / Architecture and compatibility

## 目标与依赖方向

保持完全静态、本地优先的单文件产品。维护源码使用严格 TypeScript；esbuild 只负责打包，不替代 `tsc --noEmit`。不引入 UI 框架、服务器、上传或遥测。

```text
data/rulesets + data/scenarios + config/site
                 ↓ build-time validation
core ← state ← app → view
  ↑              ↓
  └──── runtime task runner / embedded Worker
```

- `core` 只依赖本层类型和函数，不能读取 DOM、语言、存储或网络。
- `state` 独占输入、历史和输入修订号；视图和异步任务只拿快照。
- `view` 使用文案目录、元素属性和文本节点渲染，不将本地存储内容拼成 HTML。
- `runtime` 在 Worker 中运行同一个引擎，先返回当前结果，再返回逐阶段建议；不支持 Worker 时按步骤让出主线程。
- 模块按职责组织，不再用文件行数或压缩后变量名作为质量标准。

## 规则与数值接口

```ts
const engine = createEngine(ruleset, { optimizer /* optional */ });
const solution = engine.solve({
  start: { level: 0, exp: 0 },
  target: 15,
  availableAttempts: { R: 600, SR: 200, SSR: 100 },
});
```

库存输入、保留量是**工具个数**；`availableAttempts`、`usage`、`perUnit`、`shortage` 是**强化次数/组数**。只有状态层负责整数分组，零头不能用于一次强化。规则提供 `action_size`、`exp_step`、每级经验、节点及三种品质的经验/概率。

默认算法保持原有期望库存模型：以价格动态规划产生策略列，再优化三资源约束下的期望达成次数。先按最大库存规范化数值尺度；预构建状态图，只计算起点之后的状态；无并列选择时不重复求解不同优先顺序。

结果保留 `raw / unit / usage / perUnit / probabilities / shortage / mode`。新增 `raw.converged`、`iterations`、`relativeGap`；实际库存约束、概率归一化和对偶界一起验证。超过100轮或未确认收敛，不可称为最优；页面不展示未确认的策略。空库存参考策略用 `raw.reference` 标明，不把参考成本策略误称为最小缺口优化。

每个引擎独立维护64项 LRU 结果缓存。键包含完整规则内容、精确起点、目标和三种可用库存，不按四舍五入值合并请求。返回副本，公开调用方不能污染缓存。每个阶段起点分别求解，不能直接沿用另一状态的最优混合比例。

`optimizer(oracle, request)` 是算法扩展边界。规则校验器与当前算法明确只接受 R/SR/SSR；新资源、转移形式或目标函数必须增加对应校验、引擎实现和独立对照测试，不能静默解释成旧模型。测试用另一组规则和替代算法验证该接口，但产品没有增加新的计算目标。

## 页面与存储兼容

`window.__SR_CALCULATOR__` 保留同步 `solveMaxUnits`、`solveMinShortage`、`solveScenario`、两种转移函数、`constants`、`getInputs` 和异步 `calculate`。新增只读 `diagnostics()`，供检查执行通道和主线程缓存使用；Worker 与主线程缓存是不同实例。

库存键保持 `nikke-sr-inventory-calculator-v1`，数据内容升级为 `schemaVersion: 2` 并记录 `rulesIdentity`。兼容不带版本的旧对象；逐项保留可恢复的库存/等级，严格过滤不可验证的撤销记录，最多保留20条、展示5条。规则内容变化后不复用旧撤销记录；未知更新版本不被降级覆盖。存储不可用时仍可在当前页面使用。主题键 `nikke-sr-theme-v1` 不变。

任何输入编辑都使结果变为 `dirty`。计算使用输入修订号和任务编号双重隔离；过期任务被取消，不得渲染或保存。记录/撤销先更新持久状态，再计算；达到目标不自动切换。页面打印按钮等待 `ready` 快照；原生打印无法等待异步计算，因此隐藏过期/未完成报告并显示提示。

## 视觉与构建

保持现有版式、1040/720/380px断点、字号与尺寸变量。图例/表格/打印共用 `src/view/icons.ts` 的22px SVG，路径仅维护一份。打印配色由浅色 token 自动生成，避免深色语义色遗漏。

`config/site.json` 选择规则集、默认场景和语言输出位置。构建验证规则与默认场景，将规则、语言、主题、主脚本和 Worker 源码内联。所有页面组装成功后才替换本地 `dist`；同语言页面与下载写入相同字节。浏览器运行不需要 esbuild、TypeScript、模块服务器或网络请求。

验证采用生产代码直接测试、独立三状态全策略/原始资源约束穷举、历史基线、随机种子可行性、状态迁移及 Chromium 行为/几何测试。性能对比使用同机同版本 Chromium、同输入、每组五次的中位数；主线程长任务可能来自布局和绘制，不等同于求解器阻塞。

## English summary

The core is DOM-, locale-, storage- and network-independent. `createEngine(rules, { optimizer? })` accepts validated three-material rules and exposes `solve({ start, target, availableAttempts })`. Engine quantities are enhancement **attempts**, while the UI/storage inventory is individual **kits**.

The existing expected-inventory model and synchronous `window.__SR_CALCULATOR__` methods remain compatible. Numerical results include convergence diagnostics; the UI refuses unverified plans. A 64-entry exact-key LRU cache is isolated per engine. Every displayed starting state is optimized separately.

Inputs/history have one owner. Edits invalidate results, obsolete jobs cannot publish, and record/undo is saved before recomputing. Legacy storage migrates to schema 2; invalid undo records are discarded, unknown newer formats are not overwritten. Blob Workers and the cooperative fallback execute the same core without network requests. Native printing hides incomplete reports, and screen/print share one SVG definition with a complete light print palette.

Use `npm run check` for types, core/contracts, and Chromium tests. Use `npm run benchmark -- --baseline-ref <pre-refactor-commit>` for five-run comparisons. PR, Pages and tag releases reuse one validation action. Local checks are not evidence of a deployed release.
