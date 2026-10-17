# NEXUS Data Lab

**让数据，清晰可见。** 一个深色科技风的中文 CSV 数据分析工作台。

![工作台预览](docs/screenshot.png)

在浏览器本地完成数据导入、探索、可视化与导出。无需注册、后端、数据库或 API Key。

## 功能

- **导入数据**：拖放 / 选择 CSV、TSV；自动识别逗号、制表符、分号与竖线；UTF-8 / GB18030 编码可选。
- **即时分析**：记录数、指标总计、均值、完整率；指标与图表随筛选同步更新。
- **交互图表**：折线 / 柱状切换；自选维度、数值指标与求和 / 均值 / 计数；分类环图。
- **数据探索**：全字段搜索、多个条件组合筛选、数值 / 日期 / 文本排序、分页表格。
- **字段画像**：字段类型、非空唯一值、缺失数量、数值范围与完整度。
- **结果导出**：当前搜索、筛选与排序结果导出为 CSV / JSON。CSV 带 UTF-8 BOM，转义公式；JSON 保留单元格原始文本。
- **演示数据**：360 条可重复生成的合成零售记录，支持随时恢复。
- **响应式与无障碍**：手机适配、表格独立横向滚动、键盘焦点、导入对话框焦点管理、减少动画偏好。

## 本地启动

需要 Node.js 24 LTS 和 npm。

```bash
git clone https://github.com/TsingLiu1024/nexus-data-lab.git
cd nexus-data-lab
npm ci
npm run dev
```

访问终端显示的本地地址。私有仓库需要先登录有权限的 GitHub 账号。

```bash
npm test                 # 数据处理单元测试
npm run build            # TypeScript 检查 + 生产构建
npx playwright install chromium
npm run test:e2e         # 真实浏览器操作测试
npm run preview          # 预览生产构建
```

## 使用方法

1. 打开页面，先用演示数据体验；或点击「导入数据」，选择编码并上传本地分隔文本。
2. 在「分析概览」中选择图表维度、指标与聚合方式；在表格上方搜索或添加条件筛选。
3. 点击列标题排序；「字段分析」查看当前结果的完整度和分布统计。
4. 点击「导出结果」，下载 CSV 或 JSON。导出包含全部匹配记录，不局限于当前页。

## 数据规则与边界

- 首行作为表头。重复表头自动分配不冲突的名称，空表头自动命名；所有单元格保留原始文本。
- 最多 10 MiB、50,000 条数据、100 列。超限拒绝导入，避免截断后被误当作完整数据。
- 日期推断只接受有效的 `YYYY-MM-DD`。带前导零的编号保留为文本，不参与数值统计。
- 数值支持小数、负数、科学计数法与标准千位分隔。混合文本的列视为文本。
- 空白单元格视为缺失；均值不将缺失值计为零。缺失值排序始终在末尾。
- 短行补空并提示，额外字段和错误引号拒绝导入，旧数据保留。
- 趋势图最多展示 30 组；更多日期按相邻时间段合并，分类按指标排序并合并「其他」。均值合并使用有效数值数量加权。
- 环图以记录数展示分类分布，最多 5 组；超过的类别合并到「其他」。
- CSV 为避免电子表格执行公式，会给以 `= + - @ Tab CR` 开头的字段添加单引号；需要完全原始值时选择 JSON。
- 导入数据仅在当前页面内存中，刷新即清空。应用代码不会上传数据、写入 localStorage、发送遥测或请求远程字体。

## 部署

`npm run build` 产出 `dist/`，可部署到任意静态托管服务；资源使用相对路径，兼容仓库子路径。

仓库包含两条 GitHub Actions 工作流：

- **Quality checks**：push / PR 自动运行单元测试、类型检查、构建和 Chromium 测试。
- **Deploy GitHub Pages**：手动运行。先在仓库 Settings → Pages 中选择 GitHub Actions；仓库的可见性与 GitHub 套餐需支持 Pages。工作流不会自动改变仓库可见性。

## 技术结构

```text
src/
  data.ts               CSV 解析、类型推断、筛选排序、聚合与导出
  data.test.ts          数据边界和计算正确性测试
  demo.ts               确定性的合成演示数据
  App.tsx               工作台状态和视图联动
  components/           图表、表格、导入对话框、字段画像
  styles.css            主题和响应式界面
  workspace.css         表格、表单和对话框
tests/workspace.spec.ts 浏览器操作测试
```

React · TypeScript · Vite · Papa Parse · Recharts · Lucide · Vitest · Playwright。

解析与导出行为参考 [Papa Parse 官方文档](https://www.papaparse.com/docs)。构建配置参考 [Vite 官方指南](https://vite.dev/guide/)。

## License

[MIT](LICENSE)
