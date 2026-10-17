import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileSpreadsheet,
  Home,
  LockKeyhole,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import type { DatasetInfo } from './analysis'
import { useAnalysis } from './use-analysis'
import { compactNumber, formatBytes, formatNumber } from './format'
import { DataTable } from './components/DataTable'
import { ImportDialog } from './components/ImportDialog'
import { Profiles } from './components/Profiles'
import { ExportMenu } from './components/ExportMenu'
import { WorkspaceBar } from './components/WorkspaceBar'
import { useWorkspaces } from './use-workspaces'
import { VIEWS, type View } from './navigation'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { ResultStats } from './components/ResultStats'

const Charts = lazy(() =>
  import('./components/Charts').then((module) => ({ default: module.Charts })),
)

export default function App() {
  const model = useAnalysis()
  const {
    client,
    dataset,
    analysis,
    settings,
    setSettings,
    demo,
    query,
    setQuery,
    filters,
    setFilters,
    sort,
    setSort,
    setPage,
    resetFilters,
    busy,
  } = model
  const [view, setView] = useState<View>('overview')
  const [importOpen, setImportOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [uiError, setUiError] = useState('')
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const [dismissedWarnings, setDismissedWarnings] = useState(false)
  const closeImport = useCallback(() => setImportOpen(false), [])
  const workspaces = useWorkspaces({
    client,
    dataset,
    query: model.request,
    view,
    demo,
    onBusy: setWorkspaceBusy,
    onRestore: (info, preferences) => {
      model.restore(info, preferences)
      setView(preferences.view)
      setDismissedWarnings(false)
    },
    onMessage: setToast,
  })
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  function load(data: DatasetInfo) {
    workspaces.newWorkspace()
    model.accept(data)
    setDismissedWarnings(false)
    setImportOpen(false)
    setView('overview')
    setUiError('')
    setToast(`已导入 ${data.name} · ${data.count.toLocaleString('zh-CN')} 条记录`)
  }
  async function loadDemo() {
    try {
      await model.loadDemo()
      workspaces.newWorkspace()
      setView('overview')
      setDismissedWarnings(false)
      setToast('已恢复演示数据 · 360 条合成记录')
    } catch (error) {
      setUiError(error instanceof Error ? error.message : '加载失败。')
    }
  }
  function selectMetric(metric: string) {
    setSettings({
      ...settings,
      metric,
      mode: metric !== '__count__' && settings.mode === 'count' ? 'sum' : settings.mode,
    })
  }
  if (!dataset || !analysis)
    return (
      <main className="boot-screen">
        <div className="brand-mark">N</div>
        <h1>让数据，清晰可见。</h1>
        {model.error ? (
          <>
            <p role="alert">{model.error}</p>
            <button className="button primary" onClick={() => location.reload()}>
              重新加载
            </button>
          </>
        ) : (
          <p role="status">正在准备分析工作区…</p>
        )}
      </main>
    )
  const currentMetric = dataset.columns.find((c) => c.key === settings.metric)
  const metricProfile = currentMetric
    ? analysis.profiles[dataset.columns.indexOf(currentMetric)]
    : null
  const { count, missing, complete } = analysis
  const numericCount = dataset.columns.filter((c) => c.type === 'number').length
  return (
    <>
      <a className="skip-link" href="#workspace-main">
        跳转到工作区
      </a>
      <div className="app">
        <WorkspaceSidebar
          view={view}
          datasetName={dataset.name}
          disabled={workspaceBusy}
          onView={setView}
          onImport={() => setImportOpen(true)}
          onDemo={loadDemo}
        />
        <div className="main-shell">
          <header className="topbar">
            <div className="mobile-brand">
              <Activity />
              NEXUS
            </div>
            <div className="breadcrumbs">
              <Home />
              <span>工作空间</span>
              <ChevronRight />
              <strong>{VIEWS.find((v) => v.key === view)?.label}</strong>
            </div>
            <div className="topbar-right">
              <span className="local-badge">
                <span className="status-dot" />
                本地运行 · 数据安全
              </span>
              <span className="top-divider" />
              <div className="avatar" aria-label="个人工作区">
                TL
              </div>
            </div>
          </header>
          <main className="main-content" id="workspace-main" tabIndex={-1}>
            <div className="page-heading">
              <div>
                <div className="title-kicker">EXPLORE. ANALYZE. DISCOVER.</div>
                <h1>让数据，清晰可见。</h1>
                <p>从一份 CSV 开始，将每一条记录转化为有价值的洞察。</p>
              </div>
              <div className="heading-actions">
                <ExportMenu
                  disabled={busy || workspaceBusy}
                  count={count}
                  onDownload={(format) =>
                    client.request('export', { query: model.request, format, name: dataset.name })
                  }
                  onExport={setToast}
                  onError={setUiError}
                />
                <button
                  className="button primary"
                  disabled={workspaceBusy}
                  onClick={() => setImportOpen(true)}
                >
                  <Upload />
                  导入数据
                </button>
              </div>
            </div>
            <section className="dataset-card" aria-label="当前数据集">
              <div className="file-icon">
                <FileSpreadsheet />
              </div>
              <div className="file-details">
                <div className="file-title">
                  <span className="file-name" title={dataset.name}>
                    {dataset.name}
                  </span>
                  <span className="tag">{dataset.name.split('.').at(-1)?.toUpperCase()}</span>
                  {demo && <span className="tag cyan">演示数据</span>}
                </div>
                <p>
                  <span>{formatBytes(dataset.byteSize)}</span>
                  <span>·</span>
                  <span>
                    {formatNumber(dataset.count)} 行 × {dataset.columns.length} 列
                  </span>
                  <span>·</span>
                  <span>{demo ? '合成零售数据' : '本地文件'}</span>
                </p>
              </div>
              <div className="dataset-actions">
                <span className="dataset-state">
                  <CheckCircle2 />
                  已就绪
                </span>
                <button
                  className="text-button"
                  aria-label="加载演示数据"
                  disabled={workspaceBusy}
                  onClick={() => void loadDemo()}
                >
                  <RotateCcw />
                  加载演示
                  <ArrowUpRight />
                </button>
              </div>
            </section>
            <WorkspaceBar
              model={workspaces}
              filename={dataset.name}
              disabled={busy || workspaceBusy}
            />
            {(uiError || model.error) && (
              <div className="notice error-notice" role="alert">
                <CircleDot />
                <span>{uiError || model.error}</span>
                <button aria-label="关闭错误提示" onClick={() => setUiError('')}>
                  <X />
                </button>
              </div>
            )}
            {dataset.warnings.length > 0 && !dismissedWarnings && (
              <div className="notice" role="status">
                <CircleDot />
                <span>{dataset.warnings.join(' ')}</span>
                <button onClick={() => setDismissedWarnings(true)} aria-label="关闭数据提示">
                  <X />
                </button>
              </div>
            )}
            <ResultStats
              columnCount={dataset.columns.length}
              count={count}
              missing={missing}
              complete={complete}
              numericCount={numericCount}
              busy={busy}
              datasetCount={dataset.count}
              currentMetric={currentMetric}
              metricProfile={metricProfile}
            />
            <div className="content-tabs" role="group" aria-label="切换分析视图">
              {VIEWS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={view === key ? 'active' : ''}
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
              <span className="tab-note">
                <Clock3 size={10} />
                {busy ? '正在计算…' : 'LIVE ANALYSIS'}
              </span>
            </div>
            {view === 'overview' && (
              <Suspense
                fallback={
                  <div className="panel empty-chart" role="status">
                    正在准备图表…
                  </div>
                }
              >
                <Charts
                  columns={dataset.columns}
                  count={count}
                  points={analysis.trend}
                  distribution={analysis.distribution}
                  {...settings}
                  onKind={(kind) => setSettings({ ...settings, kind })}
                  onDimension={(dimension) =>
                    setSettings({
                      ...settings,
                      dimension,
                      kind:
                        dataset.columns.find((c) => c.key === dimension)?.type === 'text'
                          ? 'bar'
                          : 'area',
                    })
                  }
                  onMetric={selectMetric}
                  onMode={(mode) => setSettings({ ...settings, mode })}
                  onCategory={(category) => setSettings({ ...settings, category })}
                />
              </Suspense>
            )}
            {view !== 'profiles' ? (
              <DataTable
                key={dataset.version}
                columns={dataset.columns}
                rows={analysis.rows}
                count={count}
                page={analysis.page}
                pages={analysis.pages}
                onPage={setPage}
                busy={busy}
                total={dataset.count}
                query={query}
                onQuery={setQuery}
                filters={filters}
                onFilters={setFilters}
                sort={sort}
                onSort={setSort}
                onReset={resetFilters}
              />
            ) : (
              <>
                <Profiles columns={dataset.columns} count={count} profiles={analysis.profiles} />
                {(query || filters.length > 0) && (
                  <button
                    className="button ghost small"
                    style={{ marginTop: 16 }}
                    onClick={resetFilters}
                  >
                    <RotateCcw />
                    重置筛选
                  </button>
                )}
              </>
            )}
            <footer className="workspace-footer">
              <span>
                <LockKeyhole />
                本地分析，数据不离开你的浏览器
              </span>
              <span className="mono">
                <span className="status-dot" />
                NEXUS DATA LAB / {compactNumber(count)} RECORDS
              </span>
            </footer>
          </main>
        </div>
      </div>
      {importOpen && <ImportDialog client={client} onClose={closeImport} onImport={load} />}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 />
          {toast}
        </div>
      )}
    </>
  )
}
