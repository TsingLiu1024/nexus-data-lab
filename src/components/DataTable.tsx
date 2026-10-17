import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Filter as FilterIcon, Search, SearchX, X } from 'lucide-react'
import { numberValue } from '../data'
import type { Column, Filter, Row, Sort } from '../data'
import { formatNumber } from '../format'
import { typeIcons } from './Profiles'

export const OPERATORS = { contains: '包含', eq: '等于', gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于', empty: '为空', 'not-empty': '不为空' }

type Props = {
  columns: Column[]; rows: Row[]; total: number; query: string; onQuery: (value: string) => void;
  filters: Filter[]; onFilters: (value: Filter[]) => void; sort: Sort; onSort: (value: Sort) => void; onReset: () => void
}

export function DataTable({ columns, rows, total, query, onQuery, filters, onFilters, sort, onSort, onReset }: Props) {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [field, setField] = useState(columns[0].key)
  const [operator, setOperator] = useState<Filter['operator']>('contains')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const wrapper = useRef<HTMLDivElement>(null)
  const filterTrigger = useRef<HTMLButtonElement>(null)
  const perPage = 20
  const pages = Math.max(1, Math.ceil(rows.length / perPage))
  const actualPage = Math.min(page, pages)
  const start = (actualPage - 1) * perPage
  const visible = rows.slice(start, start + perPage)
  const hasFilters = Boolean(query || filters.length)
  const selectedColumn = columns.find(c => c.key === field) ?? columns[0]

  useEffect(() => { setPage(1) }, [query, filters, sort, columns])
  useEffect(() => {
    if (!open) return
    wrapper.current?.querySelector<HTMLSelectElement>('[aria-label="筛选字段"]')?.focus()
    function close(event: PointerEvent) { if (!wrapper.current?.contains(event.target as Node)) setOpen(false) }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); filterTrigger.current?.focus() } }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key) }
  }, [open])

  function apply(event: React.FormEvent) {
    event.preventDefault()
    const noValue = operator === 'empty' || operator === 'not-empty'
    if (!noValue && !value.trim()) { setError('请填写筛选值。'); return }
    if (['gt', 'gte', 'lt', 'lte'].includes(operator) && numberValue(value) === null) { setError('请输入有效的数字。'); return }
    onFilters([...filters, { column: selectedColumn.key, operator, value }])
    setOpen(false); setValue(''); setError(''); filterTrigger.current?.focus()
  }

  return <section className="panel table-panel" aria-labelledby="table-title"><div className="table-toolbar"><div className="table-title"><h2 id="table-title">数据预览</h2><span className="record-badge">{formatNumber(rows.length)} RECORDS</span></div><div className="table-tools"><label className="search-field"><Search /><input aria-label="搜索所有字段" placeholder="搜索所有字段…" value={query} onChange={e => onQuery(e.target.value)} /></label><div ref={wrapper} style={{ position: 'relative' }}><button ref={filterTrigger} className={`filter-button ${filters.length ? 'has-filter' : ''}`} aria-expanded={open} onClick={() => { setOpen(!open); setError('') }}><FilterIcon />筛选{filters.length ? <span>{filters.length}</span> : null}</button>
    {open && <form className="popover" onSubmit={apply} role="dialog" aria-label="添加筛选条件"><h3>添加筛选条件</h3><label className="form-label">筛选字段<select aria-label="筛选字段" value={selectedColumn.key} onChange={e => { setField(e.target.value); setOperator('contains'); setError('') }}>{columns.map(c => <option value={c.key} key={c.key}>{c.label}</option>)}</select></label><label className="form-label">筛选条件<select aria-label="筛选条件" value={operator} onChange={e => setOperator(e.target.value as Filter['operator'])}>{Object.entries(OPERATORS).filter(([key]) => selectedColumn.type === 'number' || !['gt', 'gte', 'lt', 'lte'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{!['empty', 'not-empty'].includes(operator) && <label className="form-label">筛选值<input aria-label="筛选值" value={value} onChange={e => setValue(e.target.value)} placeholder={selectedColumn.type === 'number' ? '输入数字或文本' : '输入匹配内容'} /></label>}{error && <p role="alert" className="form-error">{error}</p>}<div className="popover-actions"><button type="button" className="button ghost small" onClick={() => { setOpen(false); filterTrigger.current?.focus() }}>取消</button><button className="button primary small" type="submit">应用筛选</button></div></form>}
    </div></div></div>
    {hasFilters && <div className="filter-chips">{query && <span className="filter-chip">搜索：{query}<button aria-label="移除搜索" onClick={() => onQuery('')}><X /></button></span>}{filters.map((f, i) => <span className="filter-chip" key={i}>{columns.find(c => c.key === f.column)?.label} {OPERATORS[f.operator]} {f.value}<button aria-label={`移除筛选 ${i + 1}`} onClick={() => onFilters(filters.filter((_, index) => index !== i))}><X /></button></span>)}<button className="text-button" onClick={onReset}>重置筛选</button></div>}
    {rows.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="数据表格，可横向滚动"><table className="data-table"><thead><tr><th scope="col">#</th>{columns.map(c => {
      const Icon = typeIcons[c.type]
      const selected = sort?.key === c.key
      return <th key={c.key} scope="col" className={c.type === 'number' ? 'numeric' : ''} aria-sort={selected ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className={selected ? 'sorted' : ''} aria-label={`按${c.label}排序`} onClick={() => onSort(selected && sort.direction === 'desc' ? null : { key: c.key, direction: selected ? 'desc' : 'asc' })}><Icon className="type-icon" />{c.label}{selected ? sort.direction === 'asc' ? <ArrowUp /> : <ArrowDown /> : <ArrowUpDown />}</button></th>
    })}</tr></thead><tbody>{visible.map((row, index) => <tr key={start + index}><td>{String(start + index + 1).padStart(2, '0')}</td>{columns.map(c => {
      const raw = row[c.key]
      return <td key={c.key} title={raw} className={!raw.trim() ? 'empty-cell' : c.type === 'number' ? 'number-cell' : c.type === 'date' ? 'date-cell' : ''}>{!raw.trim() ? '—' : c.label === '状态' && ['已完成', '处理中'].includes(raw) ? <span className={`status-pill ${raw === '处理中' ? 'pending' : ''}`}>{raw}</span> : c.type === 'number' ? formatNumber(numberValue(raw), 6) : raw}</td>
    })}</tr>)}</tbody></table></div> : <div className="no-results"><SearchX /><strong>没有匹配的记录</strong><p>试试其他关键词，或移除部分筛选条件。</p><button className="button ghost small" onClick={onReset}>清除所有条件</button></div>}
    <div className="table-footer"><span>显示 <strong>{rows.length ? start + 1 : 0}–{Math.min(start + perPage, rows.length)}</strong> 条，共 <strong>{formatNumber(rows.length)}</strong> 条{hasFilters && <span> / 原始 {formatNumber(total)} 条</span>}</span><div className="pagination"><button className="icon-button" aria-label="上一页" disabled={actualPage <= 1} onClick={() => setPage(actualPage - 1)}><ChevronLeft /></button><span className="page-number">{actualPage}</span><span className="page-total">/ {pages}</span><button className="icon-button" aria-label="下一页" disabled={actualPage >= pages} onClick={() => setPage(actualPage + 1)}><ChevronRight /></button></div></div>
  </section>
}
