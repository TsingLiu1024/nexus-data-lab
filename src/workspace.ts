import type { AnalysisQuery } from './analysis'
import type { Dataset } from './data'
import { LIMITS, normalizeDate, numberValue } from './data'

export type WorkspacePreferences = AnalysisQuery & { view: 'overview' | 'table' | 'profiles'; demo: boolean }
export type SavedWorkspace = { schema: 1; savedAt: string; dataset: Dataset; preferences: WorkspacePreferences }
export type WorkspaceInfo = { name: string; count: number; savedAt: string }

export function validateWorkspace(value: unknown): asserts value is SavedWorkspace {
  const record = value as SavedWorkspace | null
  const fail = () => { throw new Error('本地存档格式或版本无效，请删除存档后重新保存。') }
  if (!record || record.schema !== 1 || typeof record.savedAt !== 'string' || !Number.isFinite(Date.parse(record.savedAt))) return fail()
  const d = record.dataset, p = record.preferences
  if (!d || typeof d.name !== 'string' || !Number.isFinite(d.byteSize) || d.byteSize < 0 || d.byteSize > LIMITS.bytes || !Array.isArray(d.columns) || d.columns.length < 1 || d.columns.length > LIMITS.columns || !Array.isArray(d.rows) || !d.rows.length || d.rows.length > LIMITS.rows || !Array.isArray(d.warnings) || d.warnings.some(w => typeof w !== 'string')) return fail()
  const keys = new Set<string>()
  for (const column of d.columns) {
    if (!column || typeof column.key !== 'string' || typeof column.label !== 'string' || !['text', 'date', 'number'].includes(column.type) || keys.has(column.key)) return fail()
    keys.add(column.key)
  }
  for (const row of d.rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return fail()
    for (const column of d.columns) {
      const cell = row[column.key]
      if (typeof cell !== 'string' || (column.type === 'number' && cell.trim() && numberValue(cell) === null) || (column.type === 'date' && cell.trim() && normalizeDate(cell, column.dateFormat) === null)) return fail()
    }
  }
  if (!p || typeof p.query !== 'string' || typeof p.demo !== 'boolean' || !['overview', 'table', 'profiles'].includes(p.view) || !Number.isInteger(p.page) || p.page < 1 || !Array.isArray(p.filters) || p.filters.some(f => !f || !keys.has(f.column) || !['contains', 'eq', 'gt', 'gte', 'lt', 'lte', 'empty', 'not-empty'].includes(f.operator) || typeof f.value !== 'string')) return fail()
  if (p.sort !== null && (!p.sort || !keys.has(p.sort.key) || !['asc', 'desc'].includes(p.sort.direction))) return fail()
  const s = p.settings
  if (!s || !keys.has(s.dimension) || !keys.has(s.category) || (s.metric !== '__count__' && !d.columns.some(c => c.key === s.metric && c.type === 'number')) || !['sum', 'mean', 'count'].includes(s.mode) || !['area', 'bar'].includes(s.kind)) return fail()
}

async function open(factory: IDBFactory | undefined): Promise<IDBDatabase> {
  if (!factory) throw new Error('此浏览器无法使用本地存储 IndexedDB，当前数据仍可继续分析和导出。')
  return new Promise((resolve, reject) => {
    const request = factory.open('nexus-data-lab', 1)
    let blocked = false
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('workspaces')) request.result.createObjectStore('workspaces') }
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result) }
    request.onerror = () => reject(new Error('无法打开本地存档，请检查浏览器的存储设置。'))
    request.onblocked = () => { blocked = true; reject(new Error('本地存档正在被其他页面使用，请关闭其他标签页后重试。')) }
  })
}

async function transaction<T>(factory: IDBFactory | undefined, mode: IDBTransactionMode, work: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const database = await open(factory)
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction('workspaces', mode)
      let value: T
      tx.oncomplete = () => resolve(value)
      tx.onabort = () => reject(new Error('本地存档未写入成功，原存档已保留；请检查可用空间后重试。'))
      tx.onerror = () => { /* transaction abort reports the final outcome */ }
      try { work(tx.objectStore('workspaces'), result => { value = result }) }
      catch (error) { tx.abort(); reject(error) }
    })
  } finally { database.close() }
}

export async function saveWorkspace(record: SavedWorkspace, factory = globalThis.indexedDB): Promise<WorkspaceInfo> {
  validateWorkspace(record)
  const info = { name: record.dataset.name, count: record.dataset.rows.length, savedAt: record.savedAt }
  await transaction<void>(factory, 'readwrite', store => { store.put(record, 'current'); store.put(info, 'metadata') })
  return info
}

export async function readWorkspace(factory = globalThis.indexedDB): Promise<SavedWorkspace | null> {
  const record = await transaction<unknown>(factory, 'readonly', (store, result) => { const request = store.get('current'); request.onsuccess = () => result(request.result) })
  if (record === undefined) return null
  validateWorkspace(record)
  return record
}

export async function workspaceInfo(factory = globalThis.indexedDB): Promise<WorkspaceInfo | null> {
  const info = await transaction<WorkspaceInfo | undefined>(factory, 'readonly', (store, result) => { const request = store.get('metadata'); request.onsuccess = () => result(request.result) })
  if (!info) return null
  if (typeof info.name !== 'string' || !Number.isInteger(info.count) || info.count < 1 || typeof info.savedAt !== 'string' || !Number.isFinite(Date.parse(info.savedAt))) throw new Error('本地存档信息无效，请删除存档后重新保存。')
  return info
}

export async function deleteWorkspace(factory = globalThis.indexedDB): Promise<void> {
  await transaction<void>(factory, 'readwrite', store => { store.delete('current'); store.delete('metadata') })
}
