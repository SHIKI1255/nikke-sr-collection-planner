# 发布流程

## Pages

推送到`main`后：

1. 安装锁定依赖。
2. 安装Playwright使用的Chromium。
3. 运行数学、页面契约与真实浏览器测试；任一失败均停止部署。
4. 按`tokens → base → components → responsive → print`顺序组装源码，并内联主题与应用脚本。
5. 构建Pages与离线单文件，确认不存在外部脚本或样式依赖。
6. 上传`dist/`为GitHub Pages产物。
7. 部署到`github-pages`环境。

## Release

1. 更新`CHANGELOG.md`和`package.json`版本。
2. 确认数据基线是否变化。
3. 完整运行`npm run check`；Release工作流会再次执行同等的数学、契约和真实浏览器门禁。
4. 创建并推送版本标签，例如`v1.0.0`。
5. Release工作流生成并上传：
   - `NIKKE_SR.html`
   - `SHA256SUMS.txt`

不要手工修改`dist/`或Release中的HTML；它们必须由`scripts/assemble.mjs`和`scripts/build.mjs`从标签对应的模块化源码生成。
