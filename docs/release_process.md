# 发布流程

## Pages

推送到`main`后：

1. 安装锁定依赖。
2. 运行数学和页面契约测试。
3. 构建Pages与离线单文件。
4. 上传`dist/`为GitHub Pages产物。
5. 部署到`github-pages`环境。

## Release

1. 更新`CHANGELOG.md`和`package.json`版本。
2. 确认数据基线是否变化。
3. 完整运行`npm run check`。
4. 创建并推送版本标签，例如`v1.0.0`。
5. Release工作流生成并上传：
   - `NIKKE_SR收藏品强化规划器.html`
   - `SHA256SUMS.txt`

不要手工修改Release中的HTML；它必须从标签对应的源码构建。
