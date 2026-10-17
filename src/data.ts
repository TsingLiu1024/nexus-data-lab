import Papa from 'papaparse'

export type DateFormat = 'iso' | 'ymd-slash' | 'dmy-slash' | 'mdy-slash'
export type Column = { key: string; label: string; type: 'number' | 'date' | 'text'; dateFormat?: DateFormat }
export type Row = Record<string, string>
export type Dataset = { name: string; columns: Column[]; rows: Row[]; warnings: string[]; byteSize: number }
export type Filter = { column: string; operator: 'contains' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'not-empty'; value: string }
export type Sort = { key: string; direction: 'asc' | 'desc' } | null
export type AggregateMode = 'sum' | 'mean' | 'count'
export type Point = { name: string; value: number | null; count: number }
export const LIMITS = { bytes: 10 * 1024 * 1024, rows: 50_000, columns: 100 }
export type ColumnTypes = Record<string, Column['type'] | 'auto'>
export type ImportOptions = { sourceByteSize?: number; delimiter?: '' | ',' | ';' | '\t' | '|'; dateFormat?: DateFormat; columnTypes?: ColumnTypes }
export type DimensionOptions = { type?: Column['type']; dateFormat?: DateFormat; order?: 'dimension' | 'value' }

export function numberValue(value: string): number | null {
  const text = value.trim()
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null
  const number = Number(text.replaceAll(',', ''))
  return Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number)) ? number : null
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function normalizeDate(value: string, format: DateFormat = 'iso'): string | null {
  const raw = value.trim()
  if (format === 'iso') return isDate(raw) ? raw : null
  const match = raw.match(format === 'ymd-slash' ? /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [year, month, day] = format === 'ymd-slash' ? [match[1], match[2], match[3]] : format === 'dmy-slash' ? [match[3], match[2], match[1]] : [match[3], match[1], match[2]]
  const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return isDate(normalized) ? normalized : null
}

function inferType(values: string[], dateFormat: DateFormat = 'iso'): Column['type'] {
  const present = values.map(v => v.trim()).filter(Boolean)
  if (!present.length) return 'text'
  if (present.every(value => normalizeDate(value, dateFormat) !== null)) return 'date'
  if (present.every(v => numberValue(v) !== null && !/^[+-]?0\d/.test(v))) return 'number'
  return 'text'
}

export function applyColumnTypes(dataset: Dataset, overrides: ColumnTypes, dateFormat: DateFormat = 'iso'): Dataset {
  if (Object.keys(overrides).some(key => !dataset.columns.some(c => c.key === key))) throw new Error('配置包含不存在的字段，请更新预览。')
  const columns = dataset.columns.map(column => {
    if (!Object.hasOwn(overrides, column.key)) return { ...column }
    const requested = overrides[column.key]
    if (!['auto', 'text', 'number', 'date'].includes(requested)) throw new Error(`字段「${column.label}」的类型配置无效。`)
    const values = dataset.rows.map(row => row[column.key])
    const type = requested === 'auto' ? inferType(values, dateFormat) : requested
    if (type === 'number' || type === 'date') {
      const invalid = values.find(value => value.trim() && (type === 'number' ? numberValue(value) === null : normalizeDate(value, dateFormat) === null))
      if (invalid !== undefined) throw new Error(`字段「${column.label}」包含无法转为${type === 'number' ? '数值' : '日期'}的值「${invalid.slice(0, 40)}」，请修改类型或日期格式。`)
    }
    const { dateFormat: _old, ...base } = column
    return type === 'date' ? { ...base, type, dateFormat } : { ...base, type }
  })
  return { ...dataset, columns }
}

export function parseCsv(text: string, name = 'data.csv', options: ImportOptions = {}): Dataset {
  const byteSize = options.sourceByteSize ?? new TextEncoder().encode(text).byteLength
  if (!Number.isFinite(byteSize) || byteSize < 0) throw new Error('文件大小无效。')
  if (byteSize > LIMITS.bytes) throw new Error('文件内容超过 10 MiB，请拆分后导入。')
  if (!text.trim()) throw new Error('文件为空，请选择包含表头与数据的 CSV 文件。')
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: true, dynamicTyping: false, delimiter: options.delimiter ?? '', delimitersToGuess: [',', '\t', ';', '|'],
  })
  const error = parsed.errors.find(e => e.code !== 'UndetectableDelimiter')
  if (error) throw new Error(`CSV 格式有误：第 ${(error.row ?? 0) + 1} 行引号或分隔格式不正确。`)
  const [headers, ...body] = parsed.data
  if (!headers?.length || !body.length) throw new Error('没有可分析的数据，请确保首行表头后至少有一条记录。')
  if (headers.length > LIMITS.columns) throw new Error('字段超过 100 列，请精简后导入。')
  if (body.length > LIMITS.rows) throw new Error('数据超过 50,000 行，请拆分后导入。')
  const used = new Set<string>()
  let renamed = 0
  const columns: Column[] = headers.map((header, i) => {
    const base = header.trim() || `未命名列 ${i + 1}`
    let label = base
    let suffix = 2
    while (used.has(label)) label = `${base} (${suffix++})`
    if (label !== header.trim()) renamed++
    used.add(label)
    return { key: `c${i}`, label, type: 'text' }
  })
  let shortRows = 0
  const rows = body.map((cells, i) => {
    if (cells.length > headers.length) throw new Error(`第 ${i + 2} 条 CSV 记录的列数超过表头，请检查分隔符或引号。`)
    if (cells.length < headers.length) shortRows++
    return Object.fromEntries(columns.map((c, index) => [c.key, cells[index] ?? '']))
  })
  columns.forEach(c => {
    c.type = inferType(rows.map(row => row[c.key]), options.dateFormat)
    if (c.type === 'date') c.dateFormat = options.dateFormat ?? 'iso'
  })
  const warnings = []
  if (shortRows) warnings.push(`${shortRows} 条记录缺少字段，已补为空值。`)
  if (renamed) warnings.push(`${renamed} 个空白或重复表头已自动重命名。`)
  const dataset = { name, columns, rows, warnings, byteSize }
  return options.columnTypes ? applyColumnTypes(dataset, options.columnTypes, options.dateFormat) : dataset
}

export function profileColumn(rows: Row[], column: Column) {
  const values = rows.map(row => row[column.key] ?? '')
  const present = values.filter(value => value.trim() !== '')
  const numbers = column.type === 'number' ? present.map(numberValue).filter((v): v is number => v !== null) : []
  const sum = numbers.length ? numbers.reduce((total, n) => total + n, 0) : null
  return {
    missing: values.length - present.length, unique: new Set(present).size,
    min: numbers.length ? numbers.reduce((min, n) => Math.min(min, n), Infinity) : null,
    max: numbers.length ? numbers.reduce((max, n) => Math.max(max, n), -Infinity) : null,
    mean: sum === null ? null : sum / numbers.length, sum,
  }
}

function matchesFilter(row: Row, filter: Filter, column?: Column) {
  if (!column) return false
  const value = row[filter.column] ?? ''
  const needle = filter.value.toLocaleLowerCase()
  switch (filter.operator) {
    case 'empty': return value.trim() === ''
    case 'not-empty': return value.trim() !== ''
    case 'contains': return value.toLocaleLowerCase().includes(needle)
    case 'eq': {
      if (column.type === 'date') {
        const left = normalizeDate(value, column.dateFormat), right = normalizeDate(filter.value, column.dateFormat) ?? normalizeDate(filter.value)
        return left !== null && right !== null && left === right
      }
      if (column.type !== 'number') return value.toLocaleLowerCase() === needle
      const left = numberValue(value), right = numberValue(filter.value)
      return left !== null && right !== null && left === right
    }
    default: {
      const left = numberValue(value)
      const right = numberValue(filter.value)
      if (left === null || right === null) return false
      switch (filter.operator) {
        case 'gt': return left > right
        case 'gte': return left >= right
        case 'lt': return left < right
        case 'lte': return left <= right
      }
    }
  }
}

export function selectRows(dataset: Dataset, query = '', filters: Filter[] = [], sort: Sort = null): Row[] {
  const needle = query.trim().toLocaleLowerCase()
  const columns = new Map(dataset.columns.map(c => [c.key, c]))
  const rows = dataset.rows.filter(row =>
    (!needle || dataset.columns.some(c => row[c.key].toLocaleLowerCase().includes(needle))) && filters.every(f => matchesFilter(row, f, columns.get(f.column))),
  )
  return sortRows(rows, dataset.columns, sort)
}

export function sortRows(source: Row[], columns: Column[], sort: Sort): Row[] {
  const rows = [...source]
  if (!sort) return rows
  const column = columns.find(c => c.key === sort.key)
  if (!column) return rows
  const collator = new Intl.Collator('zh-CN', { numeric: true })
  return rows.sort((a, b) => {
    const left = a[column.key].trim(), right = b[column.key].trim()
    if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1
    const comparison = column.type === 'number' ? (numberValue(left) ?? 0) - (numberValue(right) ?? 0) : column.type === 'date' ? (normalizeDate(left, column.dateFormat) ?? left).localeCompare(normalizeDate(right, column.dateFormat) ?? right) : collator.compare(left, right)
    return sort.direction === 'asc' ? comparison : -comparison
  })
}

export function aggregateRows(rows: Row[], dimension: string, metric: string, mode: AggregateMode, limit = 30, options: DimensionOptions = {}): Point[] {
  type Group = { name: string; sum: number; valid: number; count: number; missing: boolean }
  const groups = new Map<string | number | null, Group>()
  const countMode = mode === 'count' || metric === '__count__'
  for (const row of rows) {
    const raw = row[dimension]?.trim() || ''
    const key = !raw ? null : options.type === 'number' ? numberValue(raw) ?? raw : options.type === 'date' ? normalizeDate(raw, options.dateFormat) ?? raw : raw
    const group = groups.get(key) ?? { name: raw, sum: 0, valid: 0, count: 0, missing: key === null }
    group.count++
    const n = numberValue(row[metric] ?? '')
    if (n !== null) { group.sum += n; group.valid++ }
    groups.set(key, group)
  }
  const missingGroup = groups.get(null)
  if (missingGroup) {
    let label = '（缺失）'
    while (groups.has(label)) label += '·'
    missingGroup.name = label
  }
  const value = (g: Group): number | null => countMode ? g.count : !g.valid ? null : mode === 'mean' ? g.sum / g.valid : g.sum
  let result = [...groups.values()]
  const presentGroups = result.filter(g => !g.missing)
  const dates = options.type === 'date' || (!options.type && presentGroups.length > 0 && presentGroups.every(g => isDate(g.name)))
  const numeric = options.type === 'number'
  const ordered = options.order !== 'value' && (dates || numeric)
  result.sort(ordered ? (a, b) => a.missing ? 1 : b.missing ? -1 : numeric ? (numberValue(a.name) ?? 0) - (numberValue(b.name) ?? 0) : (normalizeDate(a.name, options.dateFormat) ?? a.name).localeCompare(normalizeDate(b.name, options.dateFormat) ?? b.name) : (a, b) => {
    const left = value(a), right = value(b)
    return left === null ? (right === null ? 0 : 1) : right === null ? -1 : right - left
  })
  const cap = Math.max(2, limit)
  const merge = (batch: Group[], name: string): Group => ({ name, missing: false,
    sum: batch.reduce((s, g) => s + g.sum, 0), valid: batch.reduce((s, g) => s + g.valid, 0), count: batch.reduce((s, g) => s + g.count, 0),
  })
  if (result.length > cap) {
    if (ordered) {
      const orderedDates = result.filter(g => !g.missing)
      const size = Math.ceil(orderedDates.length / (cap - (missingGroup ? 1 : 0)))
      const batches = []
      for (let i = 0; i < orderedDates.length; i += size) {
        const batch = orderedDates.slice(i, i + size)
        batches.push(merge(batch, batch.length === 1 ? batch[0].name : `${batch[0].name} ~ ${batch.at(-1)!.name}`))
      }
      result = missingGroup ? [...batches, missingGroup] : batches
    } else {
      const tail = result.slice(cap - 1)
      let other = `其他（${tail.length} 类）`
      while (groups.has(other)) other += '·'
      result = [...result.slice(0, cap - 1), merge(tail, other)]
    }
  }
  return result.map(g => ({ name: g.name, value: value(g), count: g.count }))
}

export function serializeCsv(columns: Column[], rows: Row[]): string {
  return '\uFEFF' + Papa.unparse({ fields: columns.map(c => c.label), data: rows.map(r => columns.map(c => r[c.key] ?? '')) }, { escapeFormulae: true })
}

export function serializeJson(columns: Column[], rows: Row[]): string {
  return JSON.stringify(rows.map(row => Object.fromEntries(columns.map(c => [c.label, row[c.key] ?? '']))), null, 2)
}
