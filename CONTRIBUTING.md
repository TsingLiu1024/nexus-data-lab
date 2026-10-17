# 参与贡献

欢迎通过 Issue 和 Pull Request 改进 NEXUS Data Lab。仓库保持私有，参与者需要相应的 GitHub 访问权限。请先阅读 [README](README.md) 中的数据规则、功能边界与本地存储说明；发布操作另见 [发布流程](docs/releasing.md)。

## 准备开发环境

需要 Node.js 24+、npm 和 Git。在有权限的账号下克隆仓库，然后运行：

```bash
git clone https://github.com/TsingLiu1024/nexus-data-lab.git
cd nexus-data-lab
npm ci
npm run dev
```

使用终端显示的地址访问开发服务。Windows PowerShell 如果受脚本执行策略限制，可使用 `npm.cmd` 和 `npx.cmd`。面向日常使用的一键启动入口是 `start.cmd` 或 `npm start`，会安装依赖、构建并在默认地址 `http://127.0.0.1:4173/` 提供服务；开发时使用 Vite 的 `npm run dev`。

## 质量检查

提交前运行 `npm run check`。它依次执行格式检查、Oxlint、单元测试、启动器单元测试和 TypeScript 检查及生产构建。格式需要调整时先运行 `npm run format`，检查改动后再运行检查。

| 命令                          | 用途                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `npm run format`              | 使用 Prettier 格式化受支持的项目文件                    |
| `npm run format:check`        | 检查格式，不改写文件                                    |
| `npm run lint`                | 运行 Oxlint                                             |
| `npm test`                    | 运行数据引擎、工作区等单元测试                          |
| `npm run test:watch`          | 交互式运行单元测试                                      |
| `npm run test:launcher`       | 检查启动器识别、指纹和服务行为                          |
| `npm run build`               | TypeScript 检查并生成 `dist/`                           |
| `npm run check`               | 依次运行 format:check、lint、test、test:launcher、build |
| `npm run test:launcher:smoke` | 在真实进程中检查中文路径启动、服务复用和端口冲突        |
| `npm run test:e2e`            | 运行 Playwright 浏览器测试                              |

启动器冒烟测试和浏览器测试独立于 `npm run check`。修改启动器、构建或安装流程时运行 `npm run test:launcher:smoke`；修改导入、分析、存储或界面交互时运行 `npm run test:e2e`。提交 PR 时写明实际运行的命令和结果，以及未运行检查的原因。CI 会在 Ubuntu Chromium 与 Windows Edge 上验证项目，具体步骤以 [质量检查工作流](.github/workflows/ci.yml) 为准。

Windows 浏览器测试默认使用系统 Microsoft Edge，需先确保已安装。Linux 首次运行浏览器测试前安装 Chromium 及系统依赖：

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

`PLAYWRIGHT_CHANNEL` 可以覆盖浏览器通道。浏览器测试使用 `http://127.0.0.1:4173/`，运行前应停止占用该地址的一键启动器或其他服务，避免复用非预期实例。

## 代码结构与约束

- `src/data.ts` 负责解析、类型推断、筛选排序、聚合和导出；`src/analysis.ts` 负责查询缓存、分页与图表结果。
- `src/data.worker.ts` 在 Web Worker 中保管原始数据并执行计算、导入、导出和工作区操作。页面通过 `src/worker-client.ts` 的请求 ID 与 Worker 通信；`src/use-analysis.ts` 处理异步结果、搜索延迟和过期响应。保留分页与聚合结果的通信方式，避免将全部原始数据持续传回主线程。
- `src/workspace.ts` 与相关工作区模块负责 IndexedDB 存储和存档校验。读取、迁移、覆盖、删除或恢复失败时，应保留用户当前可用的数据，并给出可操作的错误信息。
- `src/App.tsx` 与 `src/components/` 负责视图和交互；`src/demo.ts` 提供可重复生成的合成数据。单元测试与对应模块相邻，浏览器测试放在 `tests/`。

修改行为时补充能证明用户可见结果的测试，例如解析边界、错误输入保留原数据、过期查询隔离、存档恢复和键盘操作。修复缺陷时尽量先构造能复现问题的最小测试；避免只验证内部实现细节。仅修改文案或格式时不必增加重复测试。

本项目的数据处理保持在用户设备内：不上传原始数据，不引入遥测、远程字体或需要向外部服务发送数据的功能。依赖安装需要联网，与应用处理用户数据的本地运行边界不同。新增依赖前检查它的必要性、许可证、体积和运行时网络行为。

IndexedDB 按浏览器和来源（协议、主机、端口）隔离。开发模式常用 `localhost:5173`，启动器使用 `127.0.0.1:4173`；更换端口、主机名、浏览器或隐私窗口后，存档不会自动共享。调试恢复问题时先核对地址，并避免清除含真实数据的浏览器存储。

## 提交问题与变更

使用 [缺陷报告](https://github.com/TsingLiu1024/nexus-data-lab/issues/new?template=bug_report.yml) 提供复现步骤、预期与实际结果、应用版本、浏览器和操作系统。CSV 问题请说明编码、分隔符、日期格式、列类型和数据规模；工作区问题请说明来源地址、保存或恢复步骤，以及是否涉及 `.workspacebackup` 备份。

Issue、PR、截图、日志和测试夹具中不要包含源数据集、私人信息、凭据或真实工作区备份。使用合成或充分匿名化的最小示例；`.workspacebackup` 也可能包含完整数据，不能视为普通诊断日志。模板不要求上传任何私人文件。

使用 [功能建议](https://github.com/TsingLiu1024/nexus-data-lab/issues/new?template=feature_request.yml) 描述要解决的问题与希望获得的结果。较大的行为变化宜先在 Issue 中讨论；保持每个 PR 的目标集中，并同步更新受影响的说明和测试。PR 描述应包含问题、具体改动与验证结果，便于维护者审阅。

## 依赖与交付

[Dependabot](.github/dependabot.yml) 每周一（上海时间）检查 npm 与 GitHub Actions 依赖。npm 次版本和补丁更新分组，主版本更新单独提交 PR。维护者应审阅更新说明和兼容性变化，等待 CI 通过后合并；本项目不启用自动合并。

源码包包含开发源码、锁文件和 `start.cmd`，需要 Node.js 24+，首次安装依赖需要联网。静态包是生产构建产物，需要通过 HTTP 静态服务器运行；它不包含开发环境、Node.js 或桌面可执行文件，不能通过双击 HTML 完整使用。修改发布内容时遵循 [发布流程](docs/releasing.md)，不要将真实数据、本地存档、`node_modules/` 或凭据打入归档。发布与 Pages 部署都不会改变仓库的私有可见性。
