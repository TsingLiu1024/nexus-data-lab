import { useEffect, useRef, useState } from 'react'
import { Braces, ChevronDown, Download, FileSpreadsheet } from 'lucide-react'
import { serializeCsv, serializeJson } from '../data'
import type { Column, Row } from '../data'

export function ExportMenu({ columns, rows, name, onExport }: { columns: Column[]; rows: Row[]; name: string; onExport: (message: string) => void }) {
  const [open, setOpen] = useState(false)
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
  function download(kind: 'csv' | 'json') {
    const content = kind === 'csv' ? serializeCsv(columns, rows) : serializeJson(columns, rows)
    const url = URL.createObjectURL(new Blob([content], { type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name.replace(/\.[^.]+$/, '')}-filtered.${kind}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setOpen(false)
    trigger.current?.focus()
    onExport(`已导出 ${rows.length.toLocaleString('zh-CN')} 条记录 · ${kind.toUpperCase()}`)
  }
  return <div className="export-wrapper" ref={wrapper}><button className="button secondary" onClick={() => setOpen(!open)} aria-expanded={open} ref={trigger}><Download />导出结果<ChevronDown /></button>{open && <div className="popover export-menu"><button onClick={() => download('csv')}><FileSpreadsheet />导出 CSV</button><button onClick={() => download('json')}><Braces />导出 JSON</button><small>包含所有匹配记录<br />保持当前筛选与排序</small></div>}</div>
}
