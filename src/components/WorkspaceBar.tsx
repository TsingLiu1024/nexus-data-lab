import { useEffect, useRef, useState } from 'react'
import { HardDrive, RotateCcw, Save, Trash2 } from 'lucide-react'
import type { AnalysisQuery, DatasetInfo } from '../analysis'
import type { DataClient } from '../worker-client'
import type { WorkspaceInfo, WorkspacePreferences } from '../workspace'

type Props = { client: DataClient; dataset: DatasetInfo; query: AnalysisQuery; view: WorkspacePreferences['view']; demo: boolean; disabled: boolean;
  onBusy: (value: boolean) => void; onRestore: (info: DatasetInfo, preferences: WorkspacePreferences) => void; onMessage: (value: string) => void }

export function WorkspaceBar({ client, dataset, query, view, demo, disabled, onBusy, onRestore, onMessage }: Props) {
  const [saved, setSaved] = useState<WorkspaceInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    client.request('savedInfo', undefined).then(info => { if (active.current) setSaved(info) }).catch(reason => { if (active.current) setError(reason.message) }).finally(() => { if (active.current) setChecking(false) })
    return () => { active.current = false }
  }, [client])

  async function action(kind: 'save' | 'restore' | 'delete') {
    onBusy(true); setError('')
    try {
      if (kind === 'save') {
        const info = await client.request('save', { preferences: { ...query, view, demo }, version: dataset.version })
        if (active.current) setSaved(info)
        onMessage('工作区已保存在此浏览器，可在刷新后恢复。')
      } else if (kind === 'restore') {
        const restored = await client.request('restore', undefined)
        onRestore(restored.info, restored.preferences)
        onMessage('已恢复本地数据与分析设置。')
      } else {
        await client.request('deleteSaved', undefined)
        if (active.current) setSaved(null)
        onMessage('已删除本地存档，当前分析数据仍可使用。')
      }
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : '本地存档操作失败。') }
    finally { onBusy(false) }
  }

  return <section className="workspace-bar" aria-label="本地工作区存档"><div className="workspace-storage"><HardDrive /><div><span data-testid="saved-workspace">{checking ? '正在检查本地存档…' : saved ? `${saved.name} · ${new Date(saved.savedAt).toLocaleString('zh-CN')}` : '暂无本地存档'}</span><small>主动保存后才写入此浏览器，支持恢复与删除</small></div></div><div className="workspace-actions"><button className="button ghost small" disabled={disabled || checking} onClick={() => void action('save')}><Save />保存工作区</button><button className="button ghost small" disabled={disabled || checking || !saved} onClick={() => void action('restore')}><RotateCcw />恢复工作区</button><button className="icon-button" aria-label="删除存档" title="删除本地存档" disabled={disabled || checking || !saved} onClick={() => void action('delete')}><Trash2 /></button></div>{error && <p className="storage-error" role="alert">{error}</p>}</section>
}
