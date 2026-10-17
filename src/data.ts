import Papa from 'papaparse'

export type Column = { key: string; label: string; type: 'number' | 'date' | 'text' }
export type Row = Record<string, string>
export type Dataset = { name: string; columns: Column[]; rows: Row[]; warnings: string[]; byteSize: number }
export type Filter = { column: string; operator: 'contains' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'not-empty'; value: string }
export type Sort = { key: string; direction: 'asc' | 'desc' } | null
export type AggregateMode = 'sum' | 'mean' | 'count'
export type Point = { name: string; value: number; count: number }
export const LIMITS = { bytes: 10 * 1024 * 1024, rows: 50_000, columns: 100 }

export function numberValue(value: string): number | null {
  const text = value.trim()
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null
  const number = Number(text.replaceAll(',', ''))
  return Number.isFinite(number) ? number : null
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function inferType(values: string[]): Column['type'] {
  const present = values.map(v => v.trim()).filter(Boolean)
  if (!present.length) return 'text'
  if (present.every(isDate)) return 'date'
  if (present.every(v => numberValue(v) !== null && !/^[+-]?0\d/.test(v))) return 'number'
  return 'text'
}

export function parseCsv(text: string, name = 'data.csv'): Dataset {
  const byteSize = new TextEncoder().encode(text).byteLength
  if (byteSize > LIMITS.bytes) throw new Error('文件内容超过 10 MiB，请拆分后导入。')
  if (!text.trim()) throw new Error('文件为空，请选择包含表头与数据的 CSV 文件。')
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: true, dynamicTyping: false, delimitersToGuess: [',', '\t', ';', '|'],
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
  columns.forEach(c => { c.type = inferType(rows.map(row => row[c.key])) })
  const warnings = []
  if (shortRows) warnings.push(`${shortRows} 条记录缺少字段，已补为空值。`)
  if (renamed) warnings.push(`${renamed} 个空白或重复表头已自动重命名。`)
  return { name, columns, rows, warnings, byteSize }
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

function matchesFilter(row: Row, filter: Filter) {
  const value = row[filter.column] ?? ''
  const needle = filter.value.toLocaleLowerCase()
  switch (filter.operator) {
    case 'empty': return value.trim() === ''
    case 'not-empty': return value.trim() !== ''
    case 'contains': return value.toLocaleLowerCase().includes(needle)
    case 'eq': return value.toLocaleLowerCase() === needle
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
  const rows = dataset.rows.filter(row =>
    (!needle || dataset.columns.some(c => row[c.key].toLocaleLowerCase().includes(needle))) && filters.every(f => matchesFilter(row, f)),
  )
  if (!sort) return rows
  const column = dataset.columns.find(c => c.key === sort.key)
  if (!column) return rows
  const collator = new Intl.Collator('zh-CN', { numeric: true })
  return rows.sort((a, b) => {
    const left = a[column.key].trim(), right = b[column.key].trim()
    if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1
    const comparison = column.type === 'number' ? (numberValue(left) ?? 0) - (numberValue(right) ?? 0) : collator.compare(left, right)
    return sort.direction === 'asc' ? comparison : -comparison
  })
}

export function aggregateRows(rows: Row[], dimension: string, metric: string, mode: AggregateMode, limit = 30): Point[] {
  type Group = { name: string; sum: number; valid: number; count: number }
  const groups = new Map<string, Group>()
  const countMode = mode === 'count' || metric === '__count__'
  for (const row of rows) {
    const name = row[dimension]?.trim() || '（缺失）'
    const group = groups.get(name) ?? { name, sum: 0, valid: 0, count: 0 }
    group.count++
    const n = numberValue(row[metric] ?? '')
    if (n !== null) { group.sum += n; group.valid++ }
    groups.set(name, group)
  }
  const value = (g: Group) => countMode ? g.count : mode === 'mean' ? (g.valid ? g.sum / g.valid : 0) : g.sum
  let result = [...groups.values()]
  const dates = result.length > 0 && result.every(g => isDate(g.name))
  result.sort(dates ? (a, b) => a.name.localeCompare(b.name) : (a, b) => value(b) - value(a))
  const cap = Math.max(2, limit)
  const merge = (batch: Group[], name: string): Group => ({ name,
    sum: batch.reduce((s, g) => s + g.sum, 0), valid: batch.reduce((s, g) => s + g.valid, 0), count: batch.reduce((s, g) => s + g.count, 0),
  })
  if (result.length > cap) {
    if (dates) {
      const size = Math.ceil(result.length / cap)
      const batches = []
      for (let i = 0; i < result.length; i += size) {
        const batch = result.slice(i, i + size)
        batches.push(merge(batch, `${batch[0].name} ~ ${batch.at(-1)!.name}`))
      }
      result = batches
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
