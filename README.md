# NEXUS Data Lab

[![Quality checks](https://github.com/TsingLiu1024/nexus-data-lab/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/TsingLiu1024/nexus-data-lab/actions/workflows/ci.yml)
[![Version 1.3.0](https://img.shields.io/badge/version-1.3.0-56d9be)](https://github.com/TsingLiu1024/nexus-data-lab/releases/tag/v1.3.0)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-43853d)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-758de5)](LICENSE)

**让数据，清晰可见。** 一个深色科技风的中文 CSV 数据分析工作台。

![工作台预览](docs/screenshot.png)

在浏览器本地完成数据导入、探索、可视化与导出。无需注册、后端、数据库配置或 API Key。

A local-first CSV analytics workspace with a Chinese interface. Import, filter, visualize and export data in your browser; computation runs in a Web Worker, and workspace storage stays on your device.

适合快速检查业务报表、探索 CSV 数据和制作本地分析结果；金额等数值使用 JavaScript 浮点计算，精确财务核算需另行处理。

## 下载与快速体验

从 [最新正式版本](https://github.com/TsingLiu1024/nexus-data-lab/releases/latest) 下载源码包，解压后双击 `start.cmd`（需安装 Node.js 24+，首次安装依赖需联网）。已准备好静态托管环境时，可下载静态站点包；不能通过双击 HTML 完整运行。

打开后即可使用合成演示数据。以下演示依次展示概览、搜索、图表切换与导入预览：

![操作演示](docs/walkthrough.gif)

版本变化见 [更新记录](CHANGELOG.md)，下载包的 SHA-256 校验值随 Release 提供。仓库已公开，源码和正式版本均可直接查看及下载。

## 功能

- **导入数据**：拖放 / 选择 CSV、TSV；自动或手动选择逗号、制表符、分号与竖线；UTF-8 / GB18030 编码可选。先预览再确认，支持日期格式与逐列类型覆盖。
- **后台计算**：常驻 Web Worker 保管原始数据，页面只接收 20 条分页记录与聚合结果；150ms 搜索延迟、查询缓存和过期响应隔离。
- **本地工作区**：多个命名存档，保留数据与搜索、筛选、排序、图表、视图和页码。支持重命名、恢复、确认删除与跨标签页过期写入保护；旧单工作区存档自动迁移。
- **备份与迁移**：所选存档导出为 JSON，跨浏览器或端口导入为新工作区；同名生成副本，不覆盖原存档。备份校验和读写均在 Worker 完成。
- **一键启动**：Windows 双击 `start.cmd`，自动检查依赖、构建并打开 Edge。
- **即时分析**：记录数、指标总计、均值、完整率；指标与图表随筛选同步更新。
- **交互图表**：折线 / 柱状切换；数值与日期按真实横轴间距定位，文本按分类显示；自选维度、数值指标与求和 / 均值 / 计数；分类环图。
- **数据探索**：全字段搜索、多个条件组合筛选、数值 / 日期 / 文本排序、分页表格。
- **字段画像**：字段类型、非空唯一值、缺失数量、数值范围与完整度。
- **结果导出**：当前搜索、筛选与排序结果导出为 CSV / JSON。CSV 带 UTF-8 BOM，转义公式；JSON 保留单元格原始文本。
- **演示数据**：360 条可重复生成的合成零售记录，支持随时恢复。
- **响应式与无障碍**：手机适配、表格独立横向滚动、键盘焦点、导入对话框焦点管理、减少动画偏好。

## 本地启动

需要 Node.js 24 LTS 和 npm。

**Windows 推荐：** 下载或克隆仓库后，双击根目录的 `start.cmd`。首次安装锁定依赖并构建，后续按依赖与源码指纹复用。服务就绪后自动打开 Edge，默认地址为 `http://127.0.0.1:4173/`。保持启动窗口开启，按 `Ctrl+C` 停止。Edge 不存在时会打印地址供手动打开。

命令行也可执行 `npm.cmd start`。指定其他端口：PowerShell 中先执行 `$env:NEXUS_PORT='4176'`，再启动。已有最新服务会复用；若运行中实例对应旧源码或依赖，会提示先在原窗口按 `Ctrl+C` 停止，再重新启动以构建新版本；其他程序占用同一端口时明确报错。

开发模式：

```bash
git clone https://github.com/TsingLiu1024/nexus-data-lab.git
cd nexus-data-lab
npm ci
npm run dev
```

访问终端显示的本地地址。

```bash
npm run check            # 格式、静态检查、单元、启动器单元与构建
npm run format           # 统一格式
npm run lint             # Oxlint 静态检查
npm test                 # 数据引擎与本地存档测试
npm run test:launcher    # 启动器服务识别与源码指纹测试
npm run test:launcher:smoke # 中文路径下真实启动、复用与端口冲突测试
npm run build            # TypeScript 检查 + 生产构建
npx playwright install chromium
npm run test:e2e         # 真实浏览器操作测试
npm run preview          # 预览生产构建
```

Windows 默认使用系统 Microsoft Edge；其他系统使用 Playwright Chromium。可通过 `PLAYWRIGHT_CHANNEL` 环境变量覆盖浏览器通道。

## 使用方法

1. 打开页面，先用演示数据体验；或点击「导入数据」，设置编码、分隔符与日期格式，选择本地文件。
2. 查看前 5 条预览记录，可逐列指定自动 / 文本 / 数值 / 日期类型。修改解析设置后点「更新预览」，最后点「确认导入」。取消或转换失败均保留旧数据。
3. 在「分析概览」中选择图表维度、指标与聚合方式；在表格上方搜索或添加条件筛选。
4. 点击列标题排序；「字段分析」查看当前结果的完整度和分布统计。
5. 点击「导出结果」，下载 CSV 或 JSON。导出包含全部匹配记录，不局限于当前页。
6. 在存档选择器选择「新建工作区」，填写名称并点击「保存工作区」。选择已有存档后，可恢复、重命名，或保存当前分析覆盖所选存档；图上会显示当前分析文件和所选存档，删除需要再次确认。
7. 点击「导出存档」下载所选已保存版本的 JSON 备份；未保存的改动需要先保存。点击「导入备份」后新建独立副本，再点「恢复工作区」载入。导入失败不会改变已有存档或当前分析。
8. 其他标签页更新了同一存档时，旧页面不能直接覆盖或删除；点击刷新图标更新列表后再操作。

## 数据规则与边界

- 首行作为表头。重复表头自动分配不冲突的名称，空表头自动命名；所有单元格保留原始文本。
- 最多 10 MiB 原始文件字节、50,000 条数据、100 列；中文 GB18030 解码后的 UTF-8 大小不再用于判断源文件上限。超限拒绝导入，避免截断后被误当作完整数据。
- 日期默认识别有效的 `YYYY-MM-DD`，也可指定 `YYYY/MM/DD`、`DD/MM/YYYY`、`MM/DD/YYYY`；显示和导出保留原始文本，排序和图表使用实际日期。带前导零的编号与超出 JavaScript 安全整数范围的长整数保留为文本，不参与数值统计；手动指定数值类型时，会校验所有非空值，无法安全转换则阻止导入。
- 数值支持小数、负数、科学计数法与标准千位分隔。混合文本的列默认视为文本。数值列的「等于」按数值比较（`1` 与 `1.00` 相等），文本编号保留文本语义。
- 空白单元格视为缺失；无有效观测值的分组显示为空，均值不将缺失值计为零。缺失值排序始终在末尾；日期图中的缺失日期单独分组。
- 概览数值最多显示两位小数，表格数值最多六位；原始文本可在单元格悬停或 JSON 导出中查看。数值计算使用 JavaScript 浮点数。
- 短行补空并提示，额外字段和错误引号拒绝导入，旧数据保留。
- 趋势图最多展示 30 组；日期按时间、数值维度按横轴数值排序，超限按相邻区间合并；文本分类按指标排序并合并「其他」。均值合并使用有效数值数量加权。
- 数值 / 日期趋势按真实间距显示；日期使用 UTC 日历日，刻度保留年份。合并区间按中点定位，悬停查看完整区间；缺失横轴值在图下单独统计，不放到任意坐标。折线是观测点之间的线性连接。
- 环图以记录数展示分类分布，最多 5 组；超过的类别合并到「其他」。
- CSV 为避免电子表格执行公式，会给以 `= + - @ Tab CR` 开头的字段添加单引号；需要完全原始值时选择 JSON。
- 未主动保存的数据仅在当前页面 Worker 内存中，刷新即清空；已保存工作区位于 IndexedDB，删除存档不影响当前分析。应用不会上传数据、写入 localStorage、发送遥测或请求远程字体。
- 工作区名称为 1–80 个字符，同名保存 / 重命名会提示修改名称。备份文件最大 128 MiB；工作区文本预算 64 MiB，按每个 UTF-16 代码单元三字节保守计量，以限制伪造文件的解码后负载。CSV 原始文件大小、行列上限保持不变。备份包含原始数据，请妥善保管。
- 最多 32 个组合筛选条件；搜索与单个筛选值最多 4096 个字符。界面输入与工作区备份使用相同限制，避免导入文件要求过量分析或渲染。
- 已有旧存档的查询设置迁移时不截断；如果超过新限制，请移除部分条件或缩短文本后再保存、导出备份。
- 本地存档按浏览器与来源隔离。`localhost:5173` 开发模式、`127.0.0.1:4173` 启动器、其他端口和隐私窗口互不共享存档。需要持续恢复时使用固定启动器地址；可用 JSON 备份迁移到其他浏览器或来源。

## 部署

`npm run build` 产出 `dist/`，可部署到任意静态托管服务；资源使用相对路径，兼容仓库子路径。

仓库包含两条 GitHub Actions 工作流：

- **Quality checks**：main push / PR 自动在 Ubuntu Chromium 与 Windows Edge 上运行格式检查、Oxlint、单元测试、启动器测试、类型检查、构建和浏览器测试（含 50,000 行主线程响应性检查）。同分支新运行自动取消旧运行，失败时分别保留各系统的浏览器诊断文件。
- **Deploy GitHub Pages**：手动运行。先在仓库 Settings → Pages 中选择 GitHub Actions；仓库的可见性与 GitHub 套餐需支持 Pages。工作流不会自动改变仓库可见性。

Dependabot 每周一（上海时间）检查 npm 与 GitHub Actions，次版本 / 补丁更新分组，npm 主版本单独提交 PR。更新需要审阅与 CI 验证，不自动合并。正式交付步骤见 [发布流程](docs/releasing.md)。

## 技术结构

```text
src/
  data.ts               CSV 解析、类型推断、筛选排序、聚合与导出
  data.test.ts          数据边界和计算正确性测试
  analysis.ts           查询缓存、分页与图表分析引擎
  data.worker.ts        原始数据、导入、导出与本地存档线程
  worker-client.ts      带请求 ID 的 Worker 通信
  use-analysis.ts       异步状态、搜索延迟与过期结果处理
  workspace.ts          IndexedDB 事务与快照校验
  workspace-store.ts    多工作区、原子迁移与版本冲突保护
  workspace-backup.ts   备份编解码与预算校验
  use-workspaces.ts     工作区操作状态
  navigation.ts         共享视图定义
  download.ts           浏览器文件下载
  demo.ts               确定性的合成演示数据
  App.tsx               工作台状态和视图联动
  components/           图表、表格、导入对话框、字段画像
  styles.css            主题和响应式界面
  workspace.css         表格、表单和对话框
tests/                  浏览器操作、配置导入、存档与性能测试
scripts/start.mjs       跨平台启动器与源码指纹
start.cmd               Windows 一键入口
```

React · TypeScript · Vite · Papa Parse · Recharts · Lucide · Vitest · Playwright。

![导入预览与配置](docs/import-preview.png)

v1.3 验证记录见 [多工作区与维护验证](docs/workspace-maintenance-verification.md)；v1.2 验证记录见 [docs/release-readiness-verification.md](docs/release-readiness-verification.md)；[v1.1 验证记录](docs/optimization-verification.md) 与 [初版验证记录](docs/verification.md) 保留供历史参考。

解析与导出行为参考 [Papa Parse 官方文档](https://www.papaparse.com/docs)。构建配置参考 [Vite 官方指南](https://vite.dev/guide/)。

## 参与贡献与反馈

请阅读 [贡献指南](CONTRIBUTING.md)。[提交问题](https://github.com/TsingLiu1024/nexus-data-lab/issues/new/choose)时可选择缺陷报告或功能建议表单；提交变更时使用仓库 PR 模板。请提供合成或匿名化的最小示例，避免上传真实 CSV 或工作区备份。欢迎通过公开 Issues 和 Pull Requests 参与。

![多工作区管理](docs/workspaces.png)

## License

[MIT](LICENSE)
