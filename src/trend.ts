import type { Column, Point } from './data'
import { normalizeDate, numberValue } from './data'

export type TrendModel = {
  kind: 'category' | 'number' | 'time'
  points: (Point & { x?: number })[]
  unplaced: Point[]
  domain?: [number, number]
}

export function createTrendModel(points: Point[], column?: Column): TrendModel {
  if (!column || column.type === 'text') return { kind: 'category', points, unplaced: [] }
  const kind = column.type === 'date' ? 'time' : 'number'
  const model: TrendModel = { kind, points: [], unplaced: [] }
  const bounds: number[] = []
  const coordinate = (label: string): number | null => {
    if (kind === 'number') return numberValue(label)
    const date = normalizeDate(label, column.dateFormat)
    return date ? Date.parse(date + 'T00:00:00Z') : null
  }
  for (const point of points) {
    // Only validated numeric/date labels reach this path; text labels are never split.
    const range = point.name.split(' ~ ')
    const start = coordinate(range[0])
    const end = coordinate(range.at(-1)!)
    if (start === null || end === null) { model.unplaced.push(point); continue }
    bounds.push(start, end)
    model.points.push({ ...point, x: start / 2 + end / 2 })
  }
  if (bounds.length) {
    const min = Math.min(...bounds), max = Math.max(...bounds)
    const padding = min === max ? (kind === 'time' ? 43_200_000 : Math.abs(min) * 0.05 || 1) : 0
    model.domain = [min - padding, max + padding]
  }
  return model
}
