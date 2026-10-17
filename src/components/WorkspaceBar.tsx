import {
  Download,
  HardDrive,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import type { WorkspaceModel } from '../use-workspaces'

type Props = { model: WorkspaceModel; disabled: boolean; filename: string }

export function WorkspaceBar({ model, disabled, filename }: Props) {
  const {
    entries,
    selected,
    selectedId,
    name,
    setName,
    checking,
    error,
    deleting,
    setDeleting,
    choose,
    action,
    importBackup,
  } = model
  const busy = disabled || checking
  return (
    <section className="workspace-bar" aria-label="本地工作区存档">
      <div className="workspace-storage">
        <HardDrive />
        <div>
          <span data-testid="saved-workspace">
            {checking
              ? '正在检查本地存档…'
              : selected
                ? `${selected.name} · ${selected.filename} · ${new Date(selected.savedAt).toLocaleString('zh-CN')}`
                : entries.length
                  ? `新建工作区 · 已有 ${entries.length} 个存档`
                  : '暂无本地存档'}
          </span>
          <small>
            当前分析：{filename}；
            {selected ? `保存将覆盖所选「${selected.name}」` : '保存为独立新存档'}
            。备份包含原始数据，请妥善保管。
          </small>
        </div>
      </div>
      <div className="workspace-fields">
        <label>
          <span>选择存档</span>
          <select
            aria-label="已保存的工作区"
            value={selectedId}
            disabled={busy}
            onChange={(event) => choose(event.target.value)}
          >
            <option value="">新建工作区</option>
            {entries.map((info) => (
              <option key={info.id} value={info.id}>
                {info.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>工作区名称</span>
          <input
            aria-label="工作区名称"
            value={name}
            maxLength={80}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </div>
      <div className="workspace-actions">
        <button className="button ghost small" disabled={busy} onClick={() => void action('save')}>
          <Save />
          保存工作区
        </button>
        <button
          className="button ghost small"
          disabled={busy || !selected}
          onClick={() => void action('restore')}
        >
          <RotateCcw />
          恢复工作区
        </button>
        <button
          className="icon-button"
          aria-label="重命名工作区"
          title="重命名所选存档"
          disabled={busy || !selected}
          onClick={() => void action('rename')}
        >
          <Pencil />
        </button>
        <button
          className="button ghost small"
          disabled={busy || !selected}
          onClick={() => void action('backup')}
        >
          <Download />
          导出存档
        </button>
        <label className={`button ghost small backup-import${busy ? ' disabled' : ''}`}>
          <Upload />
          导入备份
          <input
            type="file"
            accept=".json,application/json"
            aria-label="导入工作区备份"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void importBackup(file)
            }}
          />
        </label>
        <button
          className="icon-button"
          aria-label="刷新存档列表"
          title="刷新存档列表"
          disabled={busy}
          onClick={() => void action('refresh')}
        >
          <RefreshCw />
        </button>
        <button
          className="icon-button"
          aria-label="删除存档"
          title="删除所选存档"
          disabled={busy || !selected}
          onClick={() => setDeleting(!deleting)}
        >
          <Trash2 />
        </button>
      </div>
      {deleting && selected && (
        <div className="workspace-confirm" role="group" aria-label="确认删除存档">
          <span>删除「{selected.name}」？当前分析数据会保留。</span>
          <button
            className="button ghost small"
            disabled={busy}
            onClick={() => void action('delete')}
          >
            确认删除
          </button>
          <button className="button ghost small" disabled={busy} onClick={() => setDeleting(false)}>
            取消删除
          </button>
        </div>
      )}
      {error && (
        <p className="storage-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
