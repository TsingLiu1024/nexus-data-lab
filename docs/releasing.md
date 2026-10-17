# 发布流程

运行环境：Node.js 24+、npm、Git。有写权限的 GitHub 账号负责发布。不要在包中加入真实 CSV、浏览器存档、依赖目录、凭据或本地配置。

1. 更新 `package.json` / `package-lock.json` 的版本、README 版本徽章与 `CHANGELOG.md`。
2. 运行 `npm ci`、`npm run check`、`npm run test:launcher:smoke`、`npm run test:e2e`。`check` 包含格式、静态检查、单元、启动器单元与构建；浏览器安装与通道设置见 README。
3. 审阅并推送待发布提交到 `main`，等待该提交的 Ubuntu / Windows Quality checks 全部通过。
4. 为同一提交创建附注标签，例如 `git tag -a v1.3.0 -m "NEXUS Data Lab v1.3.0"`，推送该标签。
5. 用 `git archive --format=zip --prefix=nexus-data-lab/ v1.3.0` 导出已跟踪源码，保存为 `nexus-data-lab-v1.3.0-source.zip`。源码包内含 `start.cmd`，首次运行需要联网安装依赖。
6. 将此提交构建的 `dist/` 内容、MIT 许可证及静态托管说明打包为 `nexus-data-lab-v1.3.0-static.zip`。说明需要 HTTP 静态服务器，不能双击 HTML 当作完整运行方式；此包不包含 Node.js 或桌面可执行文件。
7. 为两个 ZIP 生成 `SHA256SUMS.txt`，逐个核对哈希并打开检查归档内容。PowerShell 可以使用 `Get-FileHash 文件名 -Algorithm SHA256`。
8. 创建对应标签的 GitHub Release，附更新说明、两个 ZIP 和校验文件。下载资源需要仓库访问权限。
9. 再次核对 Release 标签解析到已通过 CI 的提交，下载包名称、大小、哈希与本地一致，并确认仓库可见性保持原设置。

版本约定遵循语义版本：新增兼容功能使用次版本，兼容修复使用补丁版本。Dependabot 只创建更新 PR，维护者在 CI 通过并审阅后合并。

参考：[Recharts XAxis](https://recharts.github.io/en-US/api/XAxis/)、[Playwright CI](https://playwright.dev/docs/ci-intro)、[Dependabot 配置](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)。
