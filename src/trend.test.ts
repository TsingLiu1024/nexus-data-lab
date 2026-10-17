import { describe, expect, it } from 'vitest'
import { aggregateRows, type Column, type Point } from './data'
import { createTrendModel } from './trend'

const column = (type: Column['type'], dateFormat?: Column['dateFormat']): Column => ({ key: 'x', label: 'X', type, dateFormat })
const points = (...names: string[]): Point[] => names.map(name => ({ name, count: 1, value: 10 }))

describe('continuous trend coordinates', () => {
  it('uses real negative, decimal and thousands-separated numeric positions', () => {
    const model = createTrendModel(points('-10', '-9.5', '1,000'), column('number'))
    expect(model.kind).toBe('number')
    expect(model.points.map(p => p.x)).toEqual([-10, -9.5, 1000])
    expect(model.domain).toEqual([-10, 1000])
  })

  it('uses UTC calendar days for configured dates across years', () => {
    const model = createTrendModel(points('31/12/2025', '01/01/2026', '10/04/2026'), column('date', 'dmy-slash'))
    expect(model.kind).toBe('time')
    const [a, b, c] = model.points.map(p => p.x!)
    expect(b - a).toBe(86_400_000)
    expect(c - b).toBe(99 * 86_400_000)
  })

  it('locates merged numeric and date bins at their midpoint and preserves range labels', () => {
    const grouped = aggregateRows([{ x: '1', y: '2' }, { x: '3', y: '4' }, { x: '100', y: '6' }], 'x', 'y', 'mean', 2, { type: 'number' })
    const model = createTrendModel(grouped, column('number'))
    expect(model.points[0]).toMatchObject({ name: '1 ~ 3', value: 3, count: 2, x: 2 })
    expect(model.domain).toEqual([1, 100])
    const dates = createTrendModel(points('2025-12-31 ~ 2026-01-02'), column('date'))
    expect(dates.points[0].x).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('keeps missing-axis values outside the continuous plot without losing their metrics', () => {
    const source = points('1', '（缺失）')
    const model = createTrendModel(source, column('number'))
    expect(model.points).toHaveLength(1)
    expect(model.unplaced).toEqual([source[1]])
    const missingOnly = createTrendModel([source[1]], column('date'))
    expect(missingOnly.points).toEqual([])
    expect(missingOnly.domain).toBeUndefined()
    expect(missingOnly.unplaced).toEqual([source[1]])
  })

  it('provides finite nonzero domains for singleton numbers and dates', () => {
    for (const model of [createTrendModel(points('0'), column('number')), createTrendModel(points('-5'), column('number')), createTrendModel(points('2026-01-01'), column('date'))]) {
      const [min, max] = model.domain!
      expect(Number.isFinite(min) && Number.isFinite(max)).toBe(true)
      expect(min).toBeLessThan(model.points[0].x!)
      expect(max).toBeGreaterThan(model.points[0].x!)
    }
  })

  it('retains categorical identifiers and the literal range separator in text labels', () => {
    const source = points('001', 'A ~ B', '（缺失）')
    expect(createTrendModel(source, column('text'))).toEqual({ kind: 'category', points: source, unplaced: [] })
  })
})
