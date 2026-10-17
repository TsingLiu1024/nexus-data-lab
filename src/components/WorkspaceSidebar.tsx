import { ChevronDown, Layers3, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { version } from '../../package.json'
import { VIEWS, type View } from '../navigation'
type Props = {
  view: View
  datasetName: string
  disabled: boolean
  onView: (view: View) => void
  onImport: () => void
  onDemo: () => Promise<void>
}
export function WorkspaceSidebar({ view, datasetName, disabled, onView, onImport, onDemo }: Props) {
  return (
    <aside className="sidebar" aria-label="工作区导航">
      <div className="brand">
        <div className="brand-mark">N</div>
        <div className="brand-text">
          <div className="brand-name">NEXUS</div>
          <div className="brand-sub">DATA LAB</div>
        </div>
      </div>
      <div className="workspace-select">
        <div className="workspace-icon">
          <Layers3 />
        </div>
        <div className="workspace-title">
          个人工作空间<small>PERSONAL WORKSPACE</small>
        </div>
        <ChevronDown className="workspace-chevron" />
      </div>
      <div className="nav-label">工作台 / WORKSPACE</div>
      <nav className="nav" aria-label="主导航">
        {VIEWS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={view === key ? 'active' : ''}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => onView(key)}
            title={label}
          >
            <Icon />
            <span>{label}</span>
            {key === 'overview' && <span className="nav-count">01</span>}
          </button>
        ))}
      </nav>
      <div className="side-separator" />
      <div className="nav-label">当前数据集 / DATASET</div>
      <div className="dataset-nav">
        <span className="status-dot" />
        <span title={datasetName}>{datasetName}</span>
      </div>
      <nav className="nav" aria-label="数据操作">
        <button disabled={disabled} onClick={() => onImport()} title="导入 CSV">
          <Plus />
          <span>导入 CSV</span>
        </button>
        <button disabled={disabled} onClick={() => void onDemo()} title="加载演示数据">
          <Sparkles />
          <span>加载演示数据</span>
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-card">
          <ShieldCheck />
          <strong>你的数据，只属于你</strong>
          <p>
            所有分析在浏览器本地完成。
            <br />
            无需上传，安心探索。
          </p>
        </div>
        <div className="side-footer">
          <span>v{version}</span>
          <span>
            <span className="status-dot" />
            LOCAL FIRST
          </span>
        </div>
      </div>
    </aside>
  )
}
