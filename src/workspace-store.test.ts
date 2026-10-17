import { describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBObjectStore as FakeStore } from 'fake-indexeddb'
import { defaultSettings } from './analysis'
import { parseCsv } from './data'
import { readWorkspace, saveWorkspace, type SavedWorkspace } from './workspace'
import {
  deleteNamedWorkspace,
  listWorkspaces,
  readNamedWorkspace,
  renameWorkspace,
  writeWorkspace,
} from './workspace-store'

function snapshot(name = 'raw.csv'): SavedWorkspace {
  const dataset = parseCsv('编号,金额\n001,1.00\n002,2', name)
  return {
    schema: 1,
    savedAt: new Date().toISOString(),
    dataset,
    preferences: {
      query: '001',
      filters: [],
      sort: null,
      page: 1,
      settings: defaultSettings(dataset),
      view: 'table',
      demo: false,
    },
  }
}

describe('named browser workspaces', () => {
  it('saves two independent datasets and preserves every raw cell and preference', async () => {
    const factory = new IDBFactory(),
      first = snapshot('a.csv'),
      second = snapshot('b.csv')
    const a = await writeWorkspace(first, '一月分析', undefined, factory)
    const b = await writeWorkspace(second, '二月分析', undefined, factory)
    expect(a.id).not.toBe(b.id)
    expect(await listWorkspaces(factory)).toHaveLength(2)
    expect((await readNamedWorkspace(a.id, factory)).snapshot).toEqual(first)
    expect((await readNamedWorkspace(b.id, factory)).snapshot).toEqual(second)
  })
  it('atomically migrates the old single save exactly once and keeps its contents', async () => {
    const factory = new IDBFactory(),
      old = snapshot()
    await saveWorkspace(old, factory)
    const entries = await listWorkspaces(factory)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('raw.csv')
    expect((await readNamedWorkspace(entries[0].id, factory)).snapshot).toEqual(old)
    expect(await readWorkspace(factory)).toBeNull()
    expect(await listWorkspaces(factory)).toEqual(entries)
  })
  it('refuses stale overwrites, renames and deletes without losing the latest data', async () => {
    const factory = new IDBFactory(),
      old = snapshot()
    const first = await writeWorkspace(old, '销售', undefined, factory)
    const newer = snapshot('new.csv')
    const updated = await writeWorkspace(newer, '销售', first, factory)
    await expect(writeWorkspace(old, '销售', first, factory)).rejects.toThrow(/更新|刷新/)
    await expect(renameWorkspace(first, '旧名称', factory)).rejects.toThrow(/更新|刷新/)
    await expect(deleteNamedWorkspace(first, factory)).rejects.toThrow(/更新|刷新/)
    expect((await readNamedWorkspace(updated.id, factory)).snapshot).toEqual(newer)
  })
  it('renames and deletes only the selected entry and rejects duplicate/blank names', async () => {
    const factory = new IDBFactory()
    const a = await writeWorkspace(snapshot(), '甲', undefined, factory)
    const b = await writeWorkspace(snapshot(), '乙', undefined, factory)
    await expect(writeWorkspace(snapshot(), '甲', undefined, factory)).rejects.toThrow(/名称|同名/)
    await expect(renameWorkspace(b, '甲', factory)).rejects.toThrow(/名称|同名/)
    await expect(writeWorkspace(snapshot(), '   ', undefined, factory)).rejects.toThrow(/名称/)
    const renamed = await renameWorkspace(a, '新名称', factory)
    expect(renamed.id).toBe(a.id)
    await deleteNamedWorkspace(renamed, factory)
    expect((await listWorkspaces(factory)).map((info) => info.id)).toEqual([b.id])
  })
  it('a failed replacement leaves both metadata and data intact', async () => {
    const factory = new IDBFactory(),
      original = snapshot()
    const info = await writeWorkspace(original, '安全存档', undefined, factory)
    const bad = snapshot('invalid.csv')
    Object.assign(bad.dataset.rows[0], { uncloneable: () => 1 })
    await expect(writeWorkspace(bad, '错误存档', info, factory)).rejects.toThrow()
    expect(await listWorkspaces(factory)).toEqual([info])
    expect((await readNamedWorkspace(info.id, factory)).snapshot).toEqual(original)
  })
  it('rolls back a partial data write when metadata hits a quota failure, including migration', async () => {
    const factory = new IDBFactory(),
      original = snapshot()
    const info = await writeWorkspace(original, '稳定存档', undefined, factory)
    const put = FakeStore.prototype.put
    const failure = vi.spyOn(FakeStore.prototype, 'put').mockImplementation(function (
      this: InstanceType<typeof FakeStore>,
      value,
      key,
    ) {
      if (typeof key === 'string' && key.startsWith('meta:'))
        throw new DOMException('Simulated quota exhausted', 'QuotaExceededError')
      return put.call(this, value, key)
    })
    try {
      await expect(writeWorkspace(snapshot('new.csv'), '新内容', info, factory)).rejects.toThrow(
        /quota/,
      )
    } finally {
      failure.mockRestore()
    }
    expect((await readNamedWorkspace(info.id, factory)).snapshot).toEqual(original)
    expect(await listWorkspaces(factory)).toEqual([info])

    const legacyFactory = new IDBFactory()
    await saveWorkspace(original, legacyFactory)
    const migrationFailure = vi.spyOn(FakeStore.prototype, 'put').mockImplementation(function (
      this: InstanceType<typeof FakeStore>,
      value,
      key,
    ) {
      if (typeof key === 'string' && key.startsWith('meta:'))
        throw new DOMException('Simulated quota exhausted', 'QuotaExceededError')
      return put.call(this, value, key)
    })
    try {
      await expect(listWorkspaces(legacyFactory)).rejects.toThrow(/quota/)
    } finally {
      migrationFailure.mockRestore()
    }
    expect(await readWorkspace(legacyFactory)).toEqual(original)
    expect(await listWorkspaces(legacyFactory)).toHaveLength(1)
  })
})
