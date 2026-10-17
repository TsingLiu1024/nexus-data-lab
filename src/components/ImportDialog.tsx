import { useEffect, useRef, useState } from 'react'
import { FileUp, ShieldCheck, Upload, X, LoaderCircle, RefreshCw } from 'lucide-react'
import { LIMITS } from '../data'
import type { ColumnTypes, DateFormat, ImportOptions } from '../data'
import type { DatasetInfo, ImportPreview } from '../analysis'
import type { DataClient } from '../worker-client'
import { typeLabels } from './Profiles'

type Props = { client: DataClient; onClose: () => void; onImport: (dataset: DatasetInfo) => void }

export function ImportDialog({ client, onClose, onImport }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  const [encoding, setEncoding] = useState('utf-8')
  const [delimiter, setDelimiter] = useState<ImportOptions['delimiter']>('')
  const [dateFormat, setDateFormat] = useState<DateFormat>('iso')
  const [types, setTypes] = useState<ColumnTypes>({})
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const active = useRef(true)
  const reading = useRef(false)
  const confirming = useRef(false)
  const [confirmingNow, setConfirmingNow] = useState(false)

  useEffect(() => {
    active.current = true
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const container = dialog.current!
    container.querySelector<HTMLButtonElement>('button')?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!confirming.current) onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = [
        ...container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex="0"]',
        ),
      ]
      const first = items[0],
        last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      active.current = false
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      previous?.focus()
      void client.request('discard', undefined).catch(() => {})
    }
  }, [client, onClose])

  function changed() {
    setDirty(true)
    setTypes({})
    setError('')
  }

  async function readFile(selected: File | null | undefined = file) {
    if (!selected || reading.current) return
    setError('')
    setPreview(null)
    setTypes({})
    setFile(selected)
    setDirty(true)
    if (!/\.(csv|tsv|txt)$/i.test(selected.name)) {
      setError('请选择 .csv、.tsv 或 .txt 分隔文本文件。')
      return
    }
    if (selected.size > LIMITS.bytes) {
      setError('文件超过 10 MiB，请拆分后导入。')
      return
    }
    reading.current = true
    setBusy(true)
    try {
      const buffer = await selected.arrayBuffer()
      if (!active.current) return
      const result = await client.request(
        'stage',
        { buffer, name: selected.name, encoding, options: { delimiter, dateFormat } },
        [buffer],
      )
      if (active.current) {
        setPreview(result)
        setDirty(false)
      }
    } catch (reason) {
      if (active.current)
        setError(reason instanceof Error ? reason.message : '读取失败，请重新选择文件。')
    } finally {
      reading.current = false
      if (active.current) setBusy(false)
    }
  }

  async function confirm() {
    if (!preview || dirty || busy || confirming.current) return
    confirming.current = true
    setConfirmingNow(true)
    setBusy(true)
    setError('')
    try {
      const info = await client.request('confirm', types)
      if (active.current) onImport(info)
    } catch (reason) {
      if (active.current) setError(reason instanceof Error ? reason.message : '导入失败。')
    } finally {
      confirming.current = false
      if (active.current) {
        setBusy(false)
        setConfirmingNow(false)
      }
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirming.current) onClose()
      }}
    >
      <div
        className={`modal import-modal ${preview ? 'has-preview' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        aria-describedby="import-description"
        ref={dialog}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">IMPORT YOUR DATA</div>
            <h2 id="import-title">每一次洞察，从数据开始。</h2>
            <p id="import-description">预览数据与字段类型，确认后开始分析。</p>
          </div>
          <button
            className="icon-button"
            aria-label="关闭导入窗口"
            disabled={confirmingNow}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="import-options">
          <label className="form-label">
            文件编码
            <select
              aria-label="文件编码"
              value={encoding}
              disabled={busy}
              onChange={(e) => {
                setEncoding(e.target.value)
                changed()
              }}
            >
              <option value="utf-8">UTF-8（推荐）</option>
              <option value="gb18030">GB18030 / GBK</option>
            </select>
          </label>
          <label className="form-label">
            分隔符
            <select
              aria-label="分隔符"
              value={delimiter}
              disabled={busy}
              onChange={(e) => {
                setDelimiter(e.target.value as ImportOptions['delimiter'])
                changed()
              }}
            >
              <option value="">自动识别</option>
              <option value=",">逗号 ,</option>
              <option value=";">分号 ;</option>
              <option value={'\t'}>制表符 Tab</option>
              <option value="|">竖线 |</option>
            </select>
          </label>
          <label className="form-label">
            日期格式
            <select
              aria-label="日期格式"
              value={dateFormat}
              disabled={busy}
              onChange={(e) => {
                setDateFormat(e.target.value as DateFormat)
                changed()
              }}
            >
              <option value="iso">YYYY-MM-DD</option>
              <option value="ymd-slash">YYYY/MM/DD</option>
              <option value="dmy-slash">DD/MM/YYYY</option>
              <option value="mdy-slash">MM/DD/YYYY</option>
            </select>
          </label>
        </div>
        <label
          className={`drop-zone ${preview ? 'compact' : ''} ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void readFile(e.dataTransfer.files[0])
          }}
        >
          <input
            className="visually-hidden"
            aria-label="选择 CSV 文件"
            type="file"
            accept=".csv,.tsv,.txt"
            disabled={busy}
            onChange={(e) => {
              void readFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="upload-icon">{busy ? <LoaderCircle /> : <FileUp />}</div>
          <strong>
            {busy ? '正在读取与分析数据…' : file ? file.name : '拖拽文件到这里，或点击选择'}
          </strong>
          <span>CSV / TSV / TXT · 最大 10 MiB · 最多 50,000 行</span>
          <span className="button primary small">
            <Upload />
            {file ? '重新选择文件' : '选择本地文件'}
          </span>
        </label>
        {file && dirty && !busy && (
          <div className="preview-refresh">
            <span>解析设置已改变，请更新预览后确认。</span>
            <button className="button ghost small" onClick={() => void readFile()}>
              <RefreshCw />
              更新预览
            </button>
          </div>
        )}
        {preview && (
          <section className="import-preview">
            <div className="preview-title">
              <h3>导入预览</h3>
              <span className="tag">
                {preview.info.count.toLocaleString('zh-CN')} 条 · {preview.info.columns.length}{' '}
                个字段
              </span>
            </div>
            <p>可指定字段类型；无法转换的值会阻止导入，原始文本始终保留。</p>
            <div
              className="preview-scroll"
              tabIndex={0}
              role="region"
              aria-label="导入文件预览，可横向滚动"
            >
              <table className="data-table">
                <thead>
                  <tr>
                    {preview.info.columns.map((column) => (
                      <th key={column.key} scope="col">
                        <span>{column.label}</span>
                        <select
                          aria-label={`${column.label} 类型`}
                          value={types[column.key] ?? 'auto'}
                          disabled={busy || dirty}
                          onChange={(e) => {
                            setTypes({
                              ...types,
                              [column.key]: e.target.value as ColumnTypes[string],
                            })
                            setError('')
                          }}
                        >
                          <option value="auto">自动（{typeLabels[column.type]}）</option>
                          <option value="text">文本</option>
                          <option value="number">数值</option>
                          <option value="date">日期</option>
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={index}>
                      {preview.info.columns.map((column) => (
                        <td key={column.key} title={row[column.key]}>
                          {row[column.key] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small>仅预览前 {preview.rows.length} 条；确认后分析全部记录。</small>
          </section>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-note">
          <ShieldCheck />
          <span>
            解析与计算在本地完成，不上传至服务器。仅点击「保存工作区」后才会持久保存数据。
          </span>
        </div>
        <div className="import-footer">
          <button className="button ghost" disabled={confirmingNow} onClick={onClose}>
            取消导入
          </button>
          <button
            className="button primary"
            disabled={!preview || dirty || busy}
            onClick={() => void confirm()}
          >
            {confirmingNow ? '正在导入…' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
