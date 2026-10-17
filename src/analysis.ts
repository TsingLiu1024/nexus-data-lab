import type {
  AggregateMode,
  ColumnTypes,
  Dataset,
  DateFormat,
  Filter,
  ImportOptions,
  Point,
  Row,
  Sort,
} from './data'
import {
  aggregateRows,
  applyColumnTypes,
  LIMITS,
  parseCsv,
  profileColumn,
  selectRows,
  serializeCsv,
  serializeJson,
  sortRows,
} from './data'
import type { SavedWorkspace, WorkspacePreferences } from './workspace'

export type ChartSettings = {
  dimension: string
  metric: string
  category: string
  mode: AggregateMode
  kind: 'area' | 'bar'
}
export type DatasetInfo = Omit<Dataset, 'rows'> & {
  count: number
  version: number
  defaults: ChartSettings
}
export type AnalysisQuery = {
  query: string
  filters: Filter[]
  sort: Sort
  page: number
  settings: ChartSettings
}
export type AnalysisResult = {
  version: number
  count: number
  page: number
  pages: number
  rows: Row[]
  profiles: ReturnType<typeof profileColumn>[]
  trend: Point[]
  distribution: Point[]
  missing: number
  complete: number | null
}
export type ImportPreview = { info: DatasetInfo; rows: Row[] }

export function defaultSettings(dataset: Dataset): ChartSettings {
  const text = dataset.columns.filter((c) => c.type === 'text')
  const named = text.find((c) => /渠道|地区|分类|类型|category|region/i.test(c.label))
  const candidate =
    named ??
    text
      .map((column) => ({
        column,
        count: new Set(dataset.rows.map((row) => row[column.key])).size,
      }))
      .sort((a, b) => a.count - b.count)[0]?.column ??
    dataset.columns[0]
  const dimension = dataset.columns.find((c) => c.type === 'date') ?? candidate
  return {
    dimension: dimension.key,
    metric: dataset.columns.find((c) => c.type === 'number')?.key ?? '__count__',
    category: candidate.key,
    mode: 'sum',
    kind: dimension.type === 'text' ? 'bar' : 'area',
  }
}

export class AnalysisEngine {
  private dataset: Dataset | null = null
  private version = 0
  private staged: Dataset | null = null
  private stagedDateFormat: DateFormat = 'iso'
  private cache: {
    key: string
    rows: Row[]
    profiles: ReturnType<typeof profileColumn>[]
    missing: number
    complete: number | null
  } | null = null
  private sorted: { key: string; rows: Row[] } | null = null
  private charts = new Map<string, Point[]>()

  private info(dataset: Dataset, version = this.version): DatasetInfo {
    const { rows, ...metadata } = dataset
    return { ...metadata, count: rows.length, version, defaults: defaultSettings(dataset) }
  }

  load(dataset: Dataset): DatasetInfo {
    this.dataset = dataset
    this.version++
    this.cache = null
    this.sorted = null
    this.charts.clear()
    return this.info(dataset)
  }

  private filtered(query: AnalysisQuery) {
    if (!this.dataset) throw new Error('请先导入数据。')
    const key = JSON.stringify([query.query.trim().toLocaleLowerCase(), query.filters])
    if (this.cache?.key !== key) {
      const rows = selectRows(this.dataset, query.query, query.filters)
      const profiles = this.dataset.columns.map((column) => profileColumn(rows, column))
      const missing = profiles.reduce((sum, profile) => sum + profile.missing, 0)
      this.cache = {
        key,
        rows,
        profiles,
        missing,
        complete: rows.length
          ? (1 - missing / (rows.length * this.dataset.columns.length)) * 100
          : null,
      }
      this.sorted = null
      this.charts.clear()
    }
    return this.cache!
  }

  private ordered(query: AnalysisQuery) {
    const filtered = this.filtered(query)
    const key = JSON.stringify(query.sort)
    if (this.sorted?.key !== key)
      this.sorted = { key, rows: sortRows(filtered.rows, this.dataset!.columns, query.sort) }
    return this.sorted!.rows
  }

  analyze(query: AnalysisQuery): AnalysisResult {
    const cache = this.filtered(query)
    const rows = this.ordered(query)
    const pages = Math.max(1, Math.ceil(rows.length / 20))
    const page = Math.max(
      1,
      Math.min(Number.isFinite(query.page) ? Math.floor(query.page) : 1, pages),
    )
    const { dimension, metric, mode, category } = query.settings
    const trendKey = JSON.stringify(['trend', dimension, metric, mode])
    const distributionKey = JSON.stringify(['distribution', category])
    const dimensionColumn = this.dataset!.columns.find((c) => c.key === dimension)
    const categoryColumn = this.dataset!.columns.find((c) => c.key === category)
    if (!this.charts.has(trendKey))
      this.charts.set(
        trendKey,
        aggregateRows(cache.rows, dimension, metric, mode, 30, {
          type: dimensionColumn?.type,
          dateFormat: dimensionColumn?.dateFormat,
        }),
      )
    if (!this.charts.has(distributionKey))
      this.charts.set(
        distributionKey,
        aggregateRows(cache.rows, category, '__count__', 'count', 5, {
          order: 'value',
          type: categoryColumn?.type,
          dateFormat: categoryColumn?.dateFormat,
        }),
      )
    const result = {
      version: this.version,
      count: rows.length,
      page,
      pages,
      rows: rows.slice((page - 1) * 20, page * 20),
      profiles: cache.profiles,
      trend: this.charts.get(trendKey)!,
      distribution: this.charts.get(distributionKey)!,
      missing: cache.missing,
      complete: cache.complete,
    }
    if (this.charts.size > 24) this.charts.clear()
    return result
  }

  stage(
    buffer: ArrayBuffer,
    name: string,
    encoding: string,
    options: ImportOptions = {},
  ): ImportPreview {
    this.staged = null
    if (buffer.byteLength > LIMITS.bytes) throw new Error('文件超过 10 MiB，请拆分后导入。')
    let text: string
    try {
      text = new TextDecoder(encoding, { fatal: true }).decode(buffer)
    } catch {
      throw new Error('无法按当前编码读取，请切换 UTF-8 / GB18030 后重新选择文件。')
    }
    if (text.includes('\u0000'))
      throw new Error('文件包含二进制或 UTF-16 内容，请另存为 UTF-8 CSV。')
    const dataset = parseCsv(text, name, { ...options, sourceByteSize: buffer.byteLength })
    this.staged = dataset
    this.stagedDateFormat = options.dateFormat ?? 'iso'
    return { info: this.info(dataset, this.version + 1), rows: dataset.rows.slice(0, 5) }
  }

  confirm(types: ColumnTypes = {}): DatasetInfo {
    if (!this.staged) throw new Error('请先选择并预览文件。')
    const dataset = applyColumnTypes(this.staged, types, this.stagedDateFormat)
    this.staged = null
    return this.load(dataset)
  }

  discard() {
    this.staged = null
  }

  snapshot(preferences: WorkspacePreferences, version: number): SavedWorkspace {
    if (!this.dataset || version !== this.version)
      throw new Error('数据已改变，请等待分析完成后重新保存。')
    return { schema: 1, savedAt: new Date().toISOString(), dataset: this.dataset, preferences }
  }

  exportText(query: AnalysisQuery, format: 'csv' | 'json'): string {
    const rows = this.ordered(query)
    return format === 'csv'
      ? serializeCsv(this.dataset!.columns, rows)
      : serializeJson(this.dataset!.columns, rows)
  }
}
