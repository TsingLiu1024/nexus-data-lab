import { useEffect, useRef, useState } from 'react'
import type { AnalysisQuery, DatasetInfo } from './analysis'
import type { DataClient } from './worker-client'
import type { WorkspacePreferences } from './workspace'
import type { NamedWorkspaceInfo } from './workspace-store'
import { validateBackupSize } from './workspace-backup'
import { downloadFile } from './download'

type Props = {
  client: DataClient
  dataset: DatasetInfo | null
  query: AnalysisQuery
  view: WorkspacePreferences['view']
  demo: boolean
  onBusy: (busy: boolean) => void
  onRestore: (info: DatasetInfo, preferences: WorkspacePreferences) => void
  onMessage: (message: string) => void
}

export function useWorkspaces({
  client,
  dataset,
  query,
  view,
  demo,
  onBusy,
  onRestore,
  onMessage,
}: Props) {
  const [entries, setEntries] = useState<NamedWorkspaceInfo[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const active = useRef(true),
    working = useRef(false),
    touched = useRef(false)
  const selected = entries.find((info) => info.id === selectedId)

  useEffect(() => {
    active.current = true
    client
      .request('workspaceList', undefined)
      .then((list) => {
        if (!active.current) return
        setEntries(list)
        if (!touched.current && list[0]) {
          setSelectedId(list[0].id)
          setName(list[0].name)
        }
      })
      .catch((reason) => {
        if (active.current) setError(reason.message)
      })
      .finally(() => {
        if (active.current) setChecking(false)
      })
    return () => {
      active.current = false
    }
  }, [client])

  function choose(id: string) {
    touched.current = true
    setSelectedId(id)
    setName(entries.find((info) => info.id === id)?.name ?? null)
    setDeleting(false)
    setError('')
  }
  function newWorkspace() {
    choose('')
  }
  function remember(info: NamedWorkspaceInfo) {
    if (!active.current) return
    setEntries((old) => [info, ...old.filter((entry) => entry.id !== info.id)])
    setSelectedId(info.id)
    setName(info.name)
    setDeleting(false)
  }
  async function perform(operation: () => Promise<void>) {
    if (working.current) return
    working.current = true
    onBusy(true)
    setError('')
    try {
      await operation()
    } catch (reason) {
      if (active.current) setError(reason instanceof Error ? reason.message : '工作区操作失败。')
    } finally {
      working.current = false
      onBusy(false)
    }
  }
  async function action(kind: 'save' | 'restore' | 'rename' | 'delete' | 'backup' | 'refresh') {
    await perform(async () => {
      if (kind === 'save') {
        if (!dataset) throw new Error('请等待数据就绪。')
        const info = await client.request('workspaceSave', {
          preferences: { ...query, view, demo },
          version: dataset.version,
          name: name ?? dataset.name.slice(0, 80),
          existing: selected,
        })
        remember(info)
        onMessage('工作区已保存在此浏览器，可在刷新后恢复。')
      } else if (kind === 'refresh') {
        const list = await client.request('workspaceList', undefined)
        if (active.current) {
          setEntries(list)
          const chosen = list.find((entry) => entry.id === selectedId)
          setSelectedId(chosen?.id ?? '')
          setName(chosen?.name ?? null)
          setDeleting(false)
        }
      } else {
        if (!selected) throw new Error('请先选择已保存的工作区。')
        if (kind === 'restore') {
          const restored = await client.request('workspaceRestore', { id: selected.id })
          onRestore(restored.info, restored.preferences)
          onMessage('已恢复本地数据与分析设置。')
        } else if (kind === 'rename') {
          remember(
            await client.request('workspaceRename', {
              target: selected,
              name: name ?? selected.name,
            }),
          )
          onMessage('工作区已重命名。')
        } else if (kind === 'backup') {
          downloadFile(await client.request('workspaceBackup', { id: selected.id }))
          onMessage('已导出所选存档，备份包含原始数据与分析设置。')
        } else {
          await client.request('workspaceDelete', { target: selected })
          if (active.current) {
            setEntries((old) => old.filter((info) => info.id !== selected.id))
            choose('')
          }
          onMessage('已删除所选存档，当前分析数据仍可使用。')
        }
      }
    })
  }
  async function importBackup(file: File | undefined) {
    if (!file) return
    await perform(async () => {
      validateBackupSize(file.size)
      const buffer = await file.arrayBuffer()
      if (!active.current) return
      remember(await client.request('workspaceImport', { buffer }, [buffer]))
      onMessage('备份已导入为新工作区，点击恢复工作区载入数据。')
    })
  }
  return {
    entries,
    selected,
    selectedId,
    name: name ?? dataset?.name.slice(0, 80) ?? '',
    setName,
    checking,
    error,
    deleting,
    setDeleting,
    choose,
    newWorkspace,
    action,
    importBackup,
  }
}

export type WorkspaceModel = ReturnType<typeof useWorkspaces>
