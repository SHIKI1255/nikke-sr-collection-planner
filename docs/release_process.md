# 发布流程

## Pages

PR、Pages 和 Release 复用 `.github/actions/validate` 门禁：严格类型检查、生产引擎/存储/契约测试、构建及 Chromium 行为测试。PR 的 CI 不再同时订阅 main 推送；main 由 Pages 验证后部署。

推送到`main`后：

1. 安装锁定依赖。
2. 安装Playwright使用的Chromium。
3. 运行类型、数学、存储、页面契约与真实浏览器测试；任一失败均停止部署。
4. 按`tokens → base → components → results → policy → responsive → print`顺序组装源码，并分别注入中文或英文文案、主题与应用脚本。
5. 构建中文根页面、英文`/en/`页面与两个离线单文件，确认不存在外部脚本或样式依赖。
6. 上传`dist/`为GitHub Pages产物。
7. 部署到`github-pages`环境。

## Release

1. 确认本地重构已验收后，再同步更新 `package.json`、锁文件、`manifest.json`、双语 README 和 `CHANGELOG.md` 的发布版本；未发布工作留在 Unreleased。
2. 确认数据基线是否变化。
3. 完整运行`npm run check`；Release工作流会再次执行同等的数学、契约和真实浏览器门禁。
4. 在合并后的`main`提交上创建并推送与程序版本一致的标签，例如`v1.4.0`。
5. Release工作流会先验证标签与`package.json`版本完全一致，不一致则终止发布。
6. Release工作流生成并上传：
   - `NIKKE_SR.html`
   - `NIKKE_SR_EN.html`
   - `SHA256SUMS.txt`

不要手工修改`dist/`或Release中的HTML；它们必须由`scripts/assemble.mjs`和`scripts/build.mjs`从标签对应的模块化源码生成。

## 发布前核对

- `npm run check` 全部通过，工作树与暂存范围仅包含本次改动。
- 重复构建的 SHA-256 不变；各语言页面与同语言离线下载字节一致。
- 同机性能对比达到预定标准，不以降低数值精度换取速度。
- 检查两种语言、浅/深/自动主题、窄屏、记录/撤销、离线和打印。
- commit、push、PR 合并及标签推送按项目所有者授权分别执行。一次本地通过不代表远端工作流已通过或已上线。
- 发布标签必须指向 Pages 已验证和部署的同一个 main 提交。回滚使用保留的旧提交/标签重新部署，不手改成品。
