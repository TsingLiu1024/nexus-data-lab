import { useEffect, useRef, useState } from 'react'
import { FileUp, ShieldCheck, Upload, X, LoaderCircle } from 'lucide-react'
import { LIMITS, parseCsv } from '../data'
import type { Dataset } from '../data'

type Props = { onClose: () => void; onImport: (dataset: Dataset) => void }

export function ImportDialog({ onClose, onImport }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  const [encoding, setEncoding] = useState('utf-8')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const active = useRef(true)
  const reading = useRef(false)

  useEffect(() => {
    active.current = true
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const container = dialog.current!
    container.querySelector<HTMLButtonElement>('button')?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = [...container.querySelectorAll<HTMLElement>('button:not([disabled]), select, input:not([disabled]), [tabindex="0"]')]
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      active.current = false
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [onClose])

  async function readFile(file?: File) {
    if (!file || reading.current) return
    setError('')
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) { setError('请选择 .csv、.tsv 或 .txt 分隔文本文件。'); return }
    if (file.size > LIMITS.bytes) { setError('文件超过 10 MiB，请拆分后导入。'); return }
    reading.current = true
    setBusy(true)
    try {
      const buffer = await file.arrayBuffer()
      const text = new TextDecoder(encoding, { fatal: true }).decode(buffer)
      if (text.includes('\u0000')) throw new Error('文件包含二进制或 UTF-16 内容，请另存为 UTF-8 CSV。')
      // Yield once so the loading state paints before parsing bounded local input.
      await new Promise(resolve => setTimeout(resolve, 30))
      const dataset = parseCsv(text, file.name)
      dataset.byteSize = file.size
      if (active.current) onImport(dataset)
    } catch (reason) {
      if (active.current) setError(reason instanceof TypeError ? '无法按当前编码读取，请切换 UTF-8 / GB18030 后重新选择文件。' : reason instanceof Error ? reason.message : '读取失败，请重新选择文件。')
    } finally {
      reading.current = false
      if (active.current) setBusy(false)
    }
  }

  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title" aria-describedby="import-description" ref={dialog}>
      <div className="modal-head"><div><div className="eyebrow">IMPORT YOUR DATA</div><h2 id="import-title">每一次洞察，从数据开始。</h2><p id="import-description">导入本地 CSV 或 TSV，立即开始探索。</p></div><button className="icon-button" aria-label="关闭导入窗口" onClick={onClose}><X /></button></div>
      <label className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void readFile(e.dataTransfer.files[0]) }}>
        <input className="visually-hidden" aria-label="选择 CSV 文件" type="file" accept=".csv,.tsv,.txt" disabled={busy} onChange={e => { void readFile(e.target.files?.[0]); e.target.value = '' }} />
        <div className="upload-icon">{busy ? <LoaderCircle /> : <FileUp />}</div><strong>{busy ? '正在读取与分析数据…' : '拖拽文件到这里，或点击选择'}</strong><span>CSV / TSV / TXT · 最大 10 MiB · 最多 50,000 行</span><span className="button primary small"><Upload />选择本地文件</span>
      </label>
      <div className="encoding-row"><label htmlFor="encoding">文件编码 <span className="muted">/ 中文乱码时切换</span></label><select id="encoding" value={encoding} disabled={busy} onChange={e => setEncoding(e.target.value)}><option value="utf-8">UTF-8（推荐）</option><option value="gb18030">GB18030 / GBK</option></select></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-note"><ShieldCheck /><span>数据仅在浏览器本地处理，不上传至服务器。首行将作为表头，刷新页面后导入数据会清空。</span></div>
    </div>
  </div>
}
