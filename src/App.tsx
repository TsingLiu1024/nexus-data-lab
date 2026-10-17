import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Activity, ArrowUpRight, BarChart3, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Clock3, Database, FileSpreadsheet, Fingerprint, Grid2X2, Home, Layers3, LockKeyhole, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Table2, Upload, X } from 'lucide-react'
import type { DatasetInfo } from './analysis'
import { useAnalysis } from './use-analysis'
import { compactNumber, formatBytes, formatNumber } from './format'
import { DataTable } from './components/DataTable'
import { ImportDialog } from './components/ImportDialog'
import { Profiles } from './components/Profiles'
import { ExportMenu } from './components/ExportMenu'
import { WorkspaceBar } from './components/WorkspaceBar'

type View = 'overview' | 'table' | 'profiles'
const Charts = lazy(() => import('./components/Charts').then(module => ({ default: module.Charts })))
const VIEWS = [{ key: 'overview', label: '分析概览', Icon: Grid2X2 }, { key: 'table', label: '数据表格', Icon: Table2 }, { key: 'profiles', label: '字段分析', Icon: SlidersHorizontal }] as const

export default function App() {
  const model = useAnalysis()
  const { client, dataset, analysis, settings, setSettings, demo, query, setQuery, filters, setFilters, sort, setSort, setPage, resetFilters, busy } = model
  const [view, setView] = useState<View>('overview')
  const [importOpen, setImportOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [uiError, setUiError] = useState('')
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const [dismissedWarnings, setDismissedWarnings] = useState(false)
  const closeImport = useCallback(() => setImportOpen(false), [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  function load(data: DatasetInfo) {
    model.accept(data); setDismissedWarnings(false); setImportOpen(false); setView('overview'); setUiError('')
    setToast(`已导入 ${data.name} · ${data.count.toLocaleString('zh-CN')} 条记录`)
  }
  async function loadDemo() {
    try { await model.loadDemo(); setView('overview'); setDismissedWarnings(false); setToast('已恢复演示数据 · 360 条合成记录') }
    catch (error) { setUiError(error instanceof Error ? error.message : '加载失败。') }
  }
  function selectMetric(metric: string) { setSettings({ ...settings, metric, mode: metric !== '__count__' && settings.mode === 'count' ? 'sum' : settings.mode }) }
  if (!dataset || !analysis) return <main className="boot-screen"><div className="brand-mark">N</div><h1>让数据，清晰可见。</h1>{model.error ? <><p role="alert">{model.error}</p><button className="button primary" onClick={() => location.reload()}>重新加载</button></> : <p role="status">正在准备分析工作区…</p>}</main>
  const currentMetric = dataset.columns.find(c => c.key === settings.metric)
  const metricProfile = currentMetric ? analysis.profiles[dataset.columns.indexOf(currentMetric)] : null
  const { count, missing, complete } = analysis
  const numericCount = dataset.columns.filter(c => c.type === 'number').length
  return <><a className="skip-link" href="#workspace-main">跳转到工作区</a><div className="app"><aside className="sidebar" aria-label="工作区导航"><div className="brand"><div className="brand-mark">N</div><div className="brand-text"><div className="brand-name">NEXUS</div><div className="brand-sub">DATA LAB</div></div></div>
    <div className="workspace-select"><div className="workspace-icon"><Layers3 /></div><div className="workspace-title">个人工作空间<small>PERSONAL WORKSPACE</small></div><ChevronDown className="workspace-chevron" /></div>
    <div className="nav-label">工作台 / WORKSPACE</div><nav className="nav" aria-label="主导航">{VIEWS.map(({ key, label, Icon }) => <button key={key} className={view === key ? 'active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)} title={label}><Icon /><span>{label}</span>{key === 'overview' && <span className="nav-count">01</span>}</button>)}</nav><div className="side-separator" /><div className="nav-label">当前数据集 / DATASET</div><div className="dataset-nav"><span className="status-dot" /><span title={dataset.name}>{dataset.name}</span></div><nav className="nav" aria-label="数据操作"><button disabled={workspaceBusy} onClick={() => setImportOpen(true)} title="导入 CSV"><Plus /><span>导入 CSV</span></button><button disabled={workspaceBusy} onClick={() => void loadDemo()} title="加载演示数据"><Sparkles /><span>加载演示数据</span></button></nav>
    <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck /><strong>你的数据，只属于你</strong><p>所有分析在浏览器本地完成。<br />无需上传，安心探索。</p></div><div className="side-footer"><span>v1.1.0</span><span><span className="status-dot" />LOCAL FIRST</span></div></div>
  </aside><div className="main-shell"><header className="topbar"><div className="mobile-brand"><Activity />NEXUS</div><div className="breadcrumbs"><Home /><span>工作空间</span><ChevronRight /><strong>{VIEWS.find(v => v.key === view)?.label}</strong></div><div className="topbar-right"><span className="local-badge"><span className="status-dot" />本地运行 · 数据安全</span><span className="top-divider" /><div className="avatar" aria-label="个人工作区">TL</div></div></header>
    <main className="main-content" id="workspace-main" tabIndex={-1}><div className="page-heading"><div><div className="title-kicker">EXPLORE. ANALYZE. DISCOVER.</div><h1>让数据，清晰可见。</h1><p>从一份 CSV 开始，将每一条记录转化为有价值的洞察。</p></div><div className="heading-actions"><ExportMenu disabled={busy || workspaceBusy} count={count} onDownload={format => client.request('export', { query: model.request, format, name: dataset.name })} onExport={setToast} onError={setUiError} /><button className="button primary" disabled={workspaceBusy} onClick={() => setImportOpen(true)}><Upload />导入数据</button></div></div>
    <section className="dataset-card" aria-label="当前数据集"><div className="file-icon"><FileSpreadsheet /></div><div className="file-details"><div className="file-title"><span className="file-name" title={dataset.name}>{dataset.name}</span><span className="tag">{dataset.name.split('.').at(-1)?.toUpperCase()}</span>{demo && <span className="tag cyan">演示数据</span>}</div><p><span>{formatBytes(dataset.byteSize)}</span><span>·</span><span>{formatNumber(dataset.count)} 行 × {dataset.columns.length} 列</span><span>·</span><span>{demo ? '合成零售数据' : '本地文件'}</span></p></div><div className="dataset-actions"><span className="dataset-state"><CheckCircle2 />已就绪</span><button className="text-button" aria-label="加载演示数据" disabled={workspaceBusy} onClick={() => void loadDemo()}><RotateCcw />加载演示<ArrowUpRight /></button></div></section>
    <WorkspaceBar client={client} dataset={dataset} query={model.request} view={view} demo={demo} disabled={busy || workspaceBusy} onBusy={setWorkspaceBusy} onRestore={(info, preferences) => { model.restore(info, preferences); setView(preferences.view); setDismissedWarnings(false) }} onMessage={setToast} />
    {(uiError || model.error) && <div className="notice error-notice" role="alert"><CircleDot /><span>{uiError || model.error}</span><button aria-label="关闭错误提示" onClick={() => setUiError('')}><X /></button></div>}
    {dataset.warnings.length > 0 && !dismissedWarnings && <div className="notice" role="status"><CircleDot /><span>{dataset.warnings.join(' ')}</span><button onClick={() => setDismissedWarnings(true)} aria-label="关闭数据提示"><X /></button></div>}
    <section className="stats-grid" aria-label="当前结果统计" aria-busy={busy}><article className="stat-card"><div className="stat-top"><span>记录总数</span><Database /></div><div className="stat-value" data-testid="row-count">{formatNumber(count, 0)}</div><div className="stat-foot"><span className="emphasis">{dataset.count ? (count / dataset.count * 100).toFixed(0) : 0}%</span><span>占原始数据 · {formatNumber(dataset.count)} 条</span></div></article>
      <article className="stat-card"><div className="stat-top"><span>{currentMetric ? `${currentMetric.label} · 合计` : '记录数 · 合计'}</span><BarChart3 /></div><div className="stat-value" data-testid="metric-total">{currentMetric ? formatNumber(metricProfile?.sum ?? null) : formatNumber(count)}</div><div className="stat-foot"><span className="emphasis">Σ</span><span>{currentMetric ? '当前指标的有效数值之和' : '当前筛选下的记录数量'}</span></div></article>
      <article className="stat-card purple"><div className="stat-top"><span>{currentMetric ? `${currentMetric.label} · 均值` : '数值字段'}</span><Activity /></div><div className="stat-value">{currentMetric ? formatNumber(metricProfile?.mean ?? null) : numericCount}<small>{currentMetric ? '' : '列'}</small></div><div className="stat-foot"><span className="emphasis">{currentMetric ? 'AVG' : 'TYPE'}</span><span>{currentMetric ? '已排除缺失值' : '可切换为记录计数分析'}</span></div></article>
      <article className="stat-card"><div className="stat-top"><span>数据完整率</span><ShieldCheck /></div><div className="stat-value">{complete === null ? '—' : complete.toFixed(1)}<small>{complete === null ? '' : '%'}</small></div><div className="stat-foot"><span className="emphasis">{complete === 100 ? <Check size={12} /> : <Fingerprint size={12} />}</span><span>{formatNumber(missing)} 个缺失值 · {dataset.columns.length} 个字段</span></div></article></section>
    <div className="content-tabs" role="group" aria-label="切换分析视图">{VIEWS.map(({ key, label, Icon }) => <button key={key} className={view === key ? 'active' : ''} aria-pressed={view === key} onClick={() => setView(key)}><Icon />{label}</button>)}<span className="tab-note"><Clock3 size={10} />{busy ? '正在计算…' : 'LIVE ANALYSIS'}</span></div>
    {view === 'overview' && <Suspense fallback={<div className="panel empty-chart" role="status">正在准备图表…</div>}><Charts columns={dataset.columns} count={count} points={analysis.trend} distribution={analysis.distribution} {...settings} onKind={kind => setSettings({ ...settings, kind })} onDimension={dimension => setSettings({ ...settings, dimension, kind: dataset.columns.find(c => c.key === dimension)?.type === 'text' ? 'bar' : 'area' })} onMetric={selectMetric} onMode={mode => setSettings({ ...settings, mode })} onCategory={category => setSettings({ ...settings, category })} /></Suspense>}
    {view !== 'profiles' ? <DataTable key={dataset.version} columns={dataset.columns} rows={analysis.rows} count={count} page={analysis.page} pages={analysis.pages} onPage={setPage} busy={busy} total={dataset.count} query={query} onQuery={setQuery} filters={filters} onFilters={setFilters} sort={sort} onSort={setSort} onReset={resetFilters} /> : <><Profiles columns={dataset.columns} count={count} profiles={analysis.profiles} />{(query || filters.length > 0) && <button className="button ghost small" style={{ marginTop: 16 }} onClick={resetFilters}><RotateCcw />重置筛选</button>}</>}
    <footer className="workspace-footer"><span><LockKeyhole />本地分析，数据不离开你的浏览器</span><span className="mono"><span className="status-dot" />NEXUS DATA LAB / {compactNumber(count)} RECORDS</span></footer></main></div></div>
    {importOpen && <ImportDialog client={client} onClose={closeImport} onImport={load} />}
    {toast && <div className="toast" role="status"><CheckCircle2 />{toast}</div>}
  </>
}
