import { useEffect, useRef, useState } from 'react'
import { Braces, ChevronDown, Download as DownloadIcon, FileSpreadsheet } from 'lucide-react'
import type { Download } from '../protocol'

type Props = { disabled: boolean; count: number; onDownload: (kind: 'csv' | 'json') => Promise<Download>; onExport: (message: string) => void; onError: (message: string) => void }

export function ExportMenu({ disabled, count, onDownload, onExport, onError }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    function click(event: PointerEvent) { if (!wrapper.current?.contains(event.target as Node)) setOpen(false) }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key) }
  }, [open])
  async function download(kind: 'csv' | 'json') {
    setBusy(true)
    try {
      const file = await onDownload(kind)
      const url = URL.createObjectURL(new Blob([file.buffer], { type: file.mime }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = file.filename
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setOpen(false); trigger.current?.focus()
      onExport(`已导出 ${count.toLocaleString('zh-CN')} 条记录 · ${kind.toUpperCase()}`)
    } catch (error) { onError(error instanceof Error ? error.message : '导出失败，请重试。') }
    finally { setBusy(false) }
  }
  return <div className="export-wrapper" ref={wrapper}>
    <button className="button secondary" disabled={disabled || busy} onClick={() => setOpen(!open)} aria-expanded={open} ref={trigger}><DownloadIcon />{busy ? '正在导出…' : '导出结果'}<ChevronDown /></button>
    {open && <div className="popover export-menu"><button disabled={disabled || busy} onClick={() => void download('csv')}><FileSpreadsheet />导出 CSV</button><button disabled={disabled || busy} onClick={() => void download('json')}><Braces />导出 JSON</button><small>包含所有匹配记录<br />保持当前筛选与排序</small></div>}
  </div>
}
