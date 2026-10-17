import { describe, expect, it } from 'vitest'
import { AnalysisEngine } from './analysis'
import type { AnalysisQuery } from './analysis'
import { parseCsv } from './data'

function fixture() {
  const engine = new AnalysisEngine()
  const info = engine.load(parseCsv('城市,金额\n上海,1\n上海,1.00\n北京,10'))
  const query: AnalysisQuery = { query: '', filters: [], sort: null, page: 1, settings: info.defaults }
  return { engine, info, query }
}

describe('resident analysis engine', () => {
  it('returns typed numeric matches consistently across profiles, charts and export', () => {
    const { engine, query } = fixture()
    query.filters = [{ column: 'c1', operator: 'eq', value: '1' }]
    const result = engine.analyze(query)
    expect(result.count).toBe(2)
    expect(result.profiles[1].sum).toBe(2)
    expect(result.distribution).toEqual([{ name: '上海', value: 2, count: 2 }])
    expect(JSON.parse(engine.exportText(query, 'json'))).toEqual([{ 城市: '上海', 金额: '1' }, { 城市: '上海', 金额: '1.00' }])
  })
  it('returns only one bounded page and reuses profiles across sorting and pagination', () => {
    const engine = new AnalysisEngine()
    const info = engine.load(parseCsv('名称,金额\n' + Array.from({ length: 45 }, (_, i) => `A${i},${i}`).join('\n')))
    const query: AnalysisQuery = { query: '', filters: [], sort: null, page: 1, settings: info.defaults }
    const first = engine.analyze(query)
    const second = engine.analyze({ ...query, page: 2, sort: { key: 'c1', direction: 'desc' } })
    expect(first.rows).toHaveLength(20)
    expect(second.rows).toHaveLength(20)
    expect(second.rows[0].c1).toBe('24')
    expect(second.profiles).toBe(first.profiles)
    expect(second.profiles[1].sum).toBe(990)
    expect(engine.analyze({ ...query, page: 99 }).page).toBe(3)
    expect(engine.analyze({ ...query, query: 'missing', page: 99 }).rows).toEqual([])
  })
  it('keeps active data intact when staging fails or is cancelled', () => {
    const { engine, query } = fixture()
    const encode = (text: string) => new TextEncoder().encode(text).buffer
    expect(() => engine.stage(encode('a,b\nx,1,extra'), 'bad.csv', 'utf-8')).toThrow()
    expect(engine.analyze(query).count).toBe(3)
    const preview = engine.stage(encode('姓名,年龄\n小明,18'), 'new.csv', 'utf-8')
    expect(preview.rows[0].c0).toBe('小明')
    expect(engine.analyze(query).count).toBe(3)
    engine.discard()
    expect(() => engine.confirm()).toThrow()
    engine.stage(encode('姓名,年龄\n小明,18'), 'new.csv', 'utf-8')
    const info = engine.confirm()
    expect(info.name).toBe('new.csv')
    expect(engine.analyze({ ...query, settings: info.defaults }).count).toBe(1)
  })
  it('rejects oversized buffers and invalid encodings before changing data', () => {
    const { engine, query } = fixture()
    expect(() => engine.stage(new ArrayBuffer(10 * 1024 * 1024 + 1), 'big.csv', 'utf-8')).toThrow(/10 MiB/)
    expect(() => engine.stage(new Uint8Array([0xff]).buffer, 'bad.csv', 'utf-8')).toThrow(/编码/)
    expect(engine.analyze(query).count).toBe(3)
  })
})
