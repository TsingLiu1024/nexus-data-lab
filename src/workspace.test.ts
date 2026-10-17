import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { defaultSettings } from './analysis'
import { parseCsv } from './data'
import { deleteWorkspace, readWorkspace, saveWorkspace, workspaceInfo } from './workspace'
import type { SavedWorkspace } from './workspace'

function record(): SavedWorkspace {
  const dataset = parseCsv('城市,金额\n上海,1.00\n北京,2', 'saved.csv')
  return {
    schema: 1,
    savedAt: '2026-10-17T08:00:00.000Z',
    dataset,
    preferences: {
      query: '上海',
      filters: [{ column: 'c1', operator: 'gte', value: '1' }],
      sort: { key: 'c1', direction: 'desc' },
      page: 1,
      settings: { ...defaultSettings(dataset), kind: 'bar' },
      view: 'table',
      demo: false,
    },
  }
}

describe('explicit browser-local workspace', () => {
  it('roundtrips raw cells and all query/chart/view preferences', async () => {
    const factory = new IDBFactory()
    expect(await readWorkspace(factory)).toBeNull()
    const saved = record()
    expect(await saveWorkspace(saved, factory)).toEqual({
      name: 'saved.csv',
      count: 2,
      savedAt: saved.savedAt,
    })
    expect(await workspaceInfo(factory)).toEqual({
      name: 'saved.csv',
      count: 2,
      savedAt: saved.savedAt,
    })
    expect(await readWorkspace(factory)).toEqual(saved)
  })
  it('deletes both data and metadata and remains safe when already empty', async () => {
    const factory = new IDBFactory()
    await saveWorkspace(record(), factory)
    await deleteWorkspace(factory)
    expect(await readWorkspace(factory)).toBeNull()
    expect(await workspaceInfo(factory)).toBeNull()
    await deleteWorkspace(factory)
  })
  it('refuses malformed saved data without replacing the previous valid snapshot', async () => {
    const factory = new IDBFactory()
    const saved = record()
    await saveWorkspace(saved, factory)
    const malformed = {
      ...saved,
      preferences: {
        ...saved.preferences,
        settings: { ...saved.preferences.settings, metric: 'missing' },
      },
    }
    await expect(saveWorkspace(malformed, factory)).rejects.toThrow(/存档|字段/)
    await expect(
      saveWorkspace({ ...saved, schema: 99 } as unknown as SavedWorkspace, factory),
    ).rejects.toThrow(/版本|存档/)
    expect(await readWorkspace(factory)).toEqual(saved)
  })
  it('reports unavailable storage rather than pretending to save', async () => {
    await expect(saveWorkspace(record(), undefined)).rejects.toThrow(/存储|IndexedDB|存档/)
  })
  it('reports structured-clone failure and preserves the previous stored snapshot', async () => {
    const factory = new IDBFactory()
    const saved = record()
    await saveWorkspace(saved, factory)
    const invalid = record()
    invalid.dataset.name = 'should-not-save.csv'
    Object.assign(invalid.dataset.rows[0], { unsupported: () => 1 })
    await expect(saveWorkspace(invalid, factory)).rejects.toThrow()
    expect(await readWorkspace(factory)).toEqual(saved)
    expect((await workspaceInfo(factory))?.name).toBe('saved.csv')
  })
})
