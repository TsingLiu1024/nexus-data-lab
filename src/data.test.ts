import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  numberValue,
  profileColumn,
  selectRows,
  aggregateRows,
  serializeCsv,
  serializeJson,
  LIMITS,
} from './data'

describe('CSV import preserves real-world data', () => {
  it('honors explicit delimiters and preserves original date text while sorting actual dates', () => {
    expect(parseCsv('名称|金额\nx,y|2', 'pipe.csv', { delimiter: '|' }).rows[0]).toEqual({
      c0: 'x,y',
      c1: '2',
    })
    const d = parseCsv('日期,金额\n02/01/2026,1\n01/12/2025,2', 'dates.csv', {
      dateFormat: 'dmy-slash',
    })
    expect(d.columns[0].type).toBe('date')
    expect(d.rows[0].c0).toBe('02/01/2026')
    expect(selectRows(d, '', [], { key: 'c0', direction: 'asc' }).map((r) => r.c0)).toEqual([
      '01/12/2025',
      '02/01/2026',
    ])
    expect(
      aggregateRows(d.rows, 'c0', 'c1', 'sum', 30, { type: 'date', dateFormat: 'dmy-slash' }).map(
        (p) => p.name,
      ),
    ).toEqual(['01/12/2025', '02/01/2026'])
  })
  it('supports explicit date formats and rejects invalid conversions instead of dropping values', () => {
    for (const [dateFormat, date] of [
      ['ymd-slash', '2026/12/31'],
      ['dmy-slash', '31/12/2026'],
      ['mdy-slash', '12/31/2026'],
    ] as const) {
      expect(
        parseCsv(`日期\n${date}`, 'd.csv', { dateFormat, columnTypes: { c0: 'date' } }).columns[0]
          .type,
      ).toBe('date')
    }
    expect(() =>
      parseCsv('日期\n31/02/2026', 'bad.csv', {
        dateFormat: 'dmy-slash',
        columnTypes: { c0: 'date' },
      }),
    ).toThrow(/日期/)
    expect(() => parseCsv('金额\nN/A', 'bad.csv', { columnTypes: { c0: 'number' } })).toThrow(
      /金额/,
    )
    expect(() => parseCsv('a\nx', 'bad.csv', { columnTypes: { missing: 'text' } })).toThrow(/字段/)
  })
  it('lets people override inferred columns without changing their raw values', () => {
    const d = parseCsv('编号,金额\n001,1.00\n002,2.00', 'types.csv', {
      columnTypes: { c0: 'number', c1: 'text' },
    })
    expect(d.columns.map((c) => c.type)).toEqual(['number', 'text'])
    expect(d.rows[0]).toEqual({ c0: '001', c1: '1.00' })
  })
  it('uses original file bytes for the size cap, including GB18030 files', () => {
    const text = '名称\n' + ('中'.repeat(90) + '\n').repeat(40_000)
    expect(parseCsv(text, '中文.csv', { sourceByteSize: 7_240_005 }).rows).toHaveLength(40_000)
    expect(() => parseCsv('a\nx', 'large.csv', { sourceByteSize: LIMITS.bytes + 1 })).toThrow(
      /10 MiB/,
    )
  })
  it('parses BOM, quoted commas, embedded newlines and leading-zero identifiers', () => {
    const d = parseCsv('\uFEFF编号,备注,金额\r\n001,"上海,华东",12\r\n002,"两行\n备注",0\r\n')
    expect(d.rows).toHaveLength(2)
    expect(d.rows[0]).toEqual({ c0: '001', c1: '上海,华东', c2: '12' })
    expect(d.rows[1].c1).toBe('两行\n备注')
    expect(d.columns.map((c) => c.type)).toEqual(['text', 'text', 'number'])
  })
  it('handles TSV, semicolons, blank and duplicate column names without overwrites', () => {
    const d = parseCsv('值;值;;__proto__\n1;2;x;y')
    expect(d.columns.map((c) => c.label)).toEqual(['值', '值 (2)', '未命名列 3', '__proto__'])
    expect(d.rows[0]).toEqual({ c0: '1', c1: '2', c2: 'x', c3: 'y' })
    expect(parseCsv('a\tb\nx\t3').rows[0].c1).toBe('3')
  })
  it('disambiguates headers that already contain a generated suffix', () => {
    expect(parseCsv('A,A,A (2)\nx,y,z').columns.map((c) => c.label)).toEqual([
      'A',
      'A (2)',
      'A (2) (2)',
    ])
  })
  it('normalizes short rows and reports them', () => {
    const d = parseCsv('a,b\nx,1\ny')
    expect(d.rows[1]).toEqual({ c0: 'y', c1: '' })
    expect(d.warnings).toHaveLength(1)
  })
  it('rejects extra cells rather than silently losing data', () => {
    expect(() => parseCsv('a,b\nx,1,extra')).toThrow(/列/)
  })
  it('rejects malformed quotes and empty/header-only files', () => {
    expect(() => parseCsv('a,b\nx,"broken')).toThrow()
    expect(() => parseCsv('  \r\n')).toThrow()
    expect(() => parseCsv('a,b\n')).toThrow(/数据/)
  })
  it('supports a one-column file and keeps invalid calendar dates as text', () => {
    expect(parseCsv('name\nAlice\nBob').rows).toHaveLength(2)
    expect(parseCsv('日期\n2026-02-30\n2026-03-01').columns[0].type).toBe('text')
    expect(parseCsv('日期\n2026-02-28\n2026-03-01').columns[0].type).toBe('date')
  })
  it('rejects row and column limits instead of returning truncated datasets', () => {
    expect(() => parseCsv('a\n' + 'x\n'.repeat(LIMITS.rows + 1))).toThrow(/50,000|50000/)
    expect(() =>
      parseCsv(
        Array.from({ length: LIMITS.columns + 1 }, (_, i) => `h${i}`).join(',') +
          '\n' +
          'x,'.repeat(100) +
          'x',
      ),
    ).toThrow(/100/)
  })
})

describe('numeric handling and profiling', () => {
  it('preserves integers beyond safe numeric precision as text and sorts them without rounding', () => {
    const d = parseCsv('编号\n9007199254740993\n9007199254740992')
    expect(d.columns[0].type).toBe('text')
    expect(d.rows[0].c0).toBe('9007199254740993')
    expect(profileColumn(d.rows, d.columns[0]).sum).toBeNull()
    expect(selectRows(d, '', [], { key: 'c0', direction: 'asc' }).map((r) => r.c0)).toEqual([
      '9007199254740992',
      '9007199254740993',
    ])
  })
  it('distinguishes missing, zero, grouped numbers and non-numbers', () => {
    expect(
      ['', ' ', '0', '-2.5', '1,200.50', '1e3', '12abc', 'Infinity', '1,2'].map(numberValue),
    ).toEqual([null, null, 0, -2.5, 1200.5, 1000, null, null, null])
  })
  it('excludes missing values from the denominator and numeric range', () => {
    const d = parseCsv('值\n10\n0\n" "\n20')
    expect(profileColumn(d.rows, d.columns[0])).toEqual({
      missing: 1,
      unique: 3,
      min: 0,
      max: 20,
      mean: 10,
      sum: 30,
    })
  })
  it('returns null numeric statistics for text and all-missing fields', () => {
    const d = parseCsv('名称,空\nA,\nB,')
    expect(profileColumn(d.rows, d.columns[0]).sum).toBeNull()
    expect(profileColumn(d.rows, d.columns[1]).mean).toBeNull()
    expect(profileColumn(d.rows, d.columns[1]).missing).toBe(2)
  })
})

describe('shared query pipeline', () => {
  it('matches numerically equal values without coercing text identifiers', () => {
    const d = parseCsv('名称,金额,编号\nA,1,001\nB,1.00,1\nC,2,002')
    expect(
      selectRows(d, '', [{ column: 'c1', operator: 'eq', value: '1' }]).map((r) => r.c0),
    ).toEqual(['A', 'B'])
    expect(
      selectRows(d, '', [{ column: 'c2', operator: 'eq', value: '1' }]).map((r) => r.c0),
    ).toEqual(['B'])
    expect(selectRows(d, '', [{ column: 'c1', operator: 'eq', value: '' }])).toEqual([])
  })
  const fixture = () =>
    parseCsv('名称,数值,地区\nAlpha,100,上海\nBeta,2,北京\nGamma,,上海\nDelta,10,上海')
  it('combines case-insensitive search with numeric and categorical filters', () => {
    const d = fixture()
    const rows = selectRows(d, 'A', [
      { column: 'c1', operator: 'gt', value: '5' },
      { column: 'c2', operator: 'eq', value: '上海' },
    ])
    expect(rows.map((r) => r.c0)).toEqual(['Alpha', 'Delta'])
    expect(selectRows(d, '不存在')).toEqual([])
  })
  it('sorts actual numbers and keeps missing cells last in both directions', () => {
    const d = fixture()
    expect(selectRows(d, '', [], { key: 'c1', direction: 'asc' }).map((r) => r.c0)).toEqual([
      'Beta',
      'Delta',
      'Alpha',
      'Gamma',
    ])
    expect(selectRows(d, '', [], { key: 'c1', direction: 'desc' }).map((r) => r.c0)).toEqual([
      'Alpha',
      'Delta',
      'Beta',
      'Gamma',
    ])
    expect(d.rows[0].c0).toBe('Alpha')
  })
  it('matches missing values explicitly and does not compare missing cells as zero', () => {
    const d = fixture()
    expect(
      selectRows(d, '', [{ column: 'c1', operator: 'empty', value: '' }]).map((r) => r.c0),
    ).toEqual(['Gamma'])
    expect(
      selectRows(d, '', [{ column: 'c1', operator: 'lt', value: '5' }]).map((r) => r.c0),
    ).toEqual(['Beta'])
  })
})

describe('chart aggregation', () => {
  it('combines equivalent numeric and date dimensions while preserving text identifiers and raw exports', () => {
    const rows = [
      { x: '1', y: '10' },
      { x: '1.00', y: '20' },
      { x: '2', y: '5' },
    ]
    expect(aggregateRows(rows, 'x', 'y', 'sum', 30, { type: 'number' })).toEqual([
      { name: '1', value: 30, count: 2 },
      { name: '2', value: 5, count: 1 },
    ])
    expect(
      aggregateRows(rows, 'x', '__count__', 'count', 5, { type: 'number', order: 'value' })[0],
    ).toEqual({ name: '1', value: 2, count: 2 })
    expect(aggregateRows(rows, 'x', 'y', 'mean', 30, { type: 'number' })[0].value).toBe(15)
    expect(aggregateRows(rows, 'x', 'y', 'sum', 30, { type: 'text' })).toHaveLength(3)
    const d = parseCsv('日期,金额\n1/2/2026,10\n01/02/2026,20\n2/2/2026,5', 'dates.csv', {
      dateFormat: 'dmy-slash',
    })
    const options = { type: 'date', dateFormat: 'dmy-slash' } as const
    expect(aggregateRows(d.rows, 'c0', 'c1', 'sum', 30, options)).toEqual([
      { name: '1/2/2026', value: 30, count: 2 },
      { name: '2/2/2026', value: 5, count: 1 },
    ])
    expect(aggregateRows(d.rows, 'c0', 'c1', 'mean', 30, options)[0].value).toBe(15)
    expect(aggregateRows(d.rows, 'c0', '__count__', 'count', 30, options)[0].value).toBe(2)
    expect(JSON.parse(serializeJson(d.columns, d.rows))[1]['日期']).toBe('01/02/2026')
  })
  it('orders numeric trend dimensions by X while distributions retain value order', () => {
    const data = [
      { x: '1', y: '100' },
      { x: '2', y: '1' },
      { x: '3', y: '50' },
    ]
    expect(aggregateRows(data, 'x', 'y', 'sum', 30, { type: 'number' }).map((p) => p.name)).toEqual(
      ['1', '2', '3'],
    )
    expect(
      aggregateRows(data, 'x', 'y', 'sum', 30, { type: 'number', order: 'value' }).map(
        (p) => p.name,
      ),
    ).toEqual(['1', '3', '2'])
    expect(aggregateRows(data, 'x', 'y', 'sum', 2, { type: 'number' })).toEqual([
      { name: '1 ~ 2', value: 101, count: 2 },
      { name: '3', value: 50, count: 1 },
    ])
  })
  const rows = [
    { x: '2026-02-02', y: '10' },
    { x: '2026-01-01', y: '0' },
    { x: '2026-02-02', y: '' },
    { x: '2026-02-02', y: '20' },
  ]
  it('orders date groups chronologically and sums values', () => {
    expect(aggregateRows(rows, 'x', 'y', 'sum')).toEqual([
      { name: '2026-01-01', value: 0, count: 1 },
      { name: '2026-02-02', value: 30, count: 3 },
    ])
  })
  it('averages only valid values and can count text-only records', () => {
    expect(aggregateRows(rows, 'x', 'y', 'mean').find((p) => p.name === '2026-02-02')?.value).toBe(
      15,
    )
    expect(
      aggregateRows(rows, 'x', '__count__', 'count').find((p) => p.name === '2026-02-02')?.value,
    ).toBe(3)
  })
  it('keeps totals correct when reducing high-cardinality categories', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ x: `category${i}`, y: '1' }))
    const points = aggregateRows(data, 'x', 'y', 'sum', 8)
    expect(points).toHaveLength(8)
    expect(points.reduce((sum, p) => sum + (p.value ?? 0), 0)).toBe(50)
    expect(points.find((p) => p.name.startsWith('其他'))?.value).toBe(43)
  })
  it('does not invent a zero mean for an all-missing group', () => {
    expect(
      aggregateRows(
        [
          { x: 'A', y: '' },
          { x: 'B', y: '0' },
        ],
        'x',
        'y',
        'mean',
      ),
    ).toEqual([
      { name: 'B', value: 0, count: 1 },
      { name: 'A', value: null, count: 1 },
    ])
    expect(aggregateRows([{ x: 'A', y: '' }], 'x', 'y', 'sum')[0].value).toBeNull()
  })
  it('keeps sparse date groups chronological with missing dates separate and last', () => {
    const result = aggregateRows(
      [
        { x: '2026-02-01', y: '100' },
        { x: '', y: '200' },
        { x: '2026-01-01', y: '1' },
      ],
      'x',
      'y',
      'sum',
    )
    expect(result.map((p) => p.name)).toEqual(['2026-01-01', '2026-02-01', '（缺失）'])
  })
  it('keeps a missing date bucket separate when coalescing date ranges', () => {
    const result = aggregateRows(
      [
        { x: '2026-01-01', y: '10' },
        { x: '2026-01-02', y: '' },
        { x: '2026-01-03', y: '20' },
        { x: '', y: '100' },
      ],
      'x',
      'y',
      'mean',
      2,
    )
    expect(result).toEqual([
      { name: '2026-01-01 ~ 2026-01-03', value: 15, count: 3 },
      { name: '（缺失）', value: 100, count: 1 },
    ])
  })
  it('keeps a literal missing-label category distinct from actual missing values', () => {
    const result = aggregateRows(
      [
        { x: '（缺失）', y: '1' },
        { x: '', y: '2' },
      ],
      'x',
      'y',
      'sum',
    )
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.value).sort()).toEqual([1, 2])
    expect(new Set(result.map((p) => p.name)).size).toBe(2)
  })
})

describe('exports', () => {
  it('exports BOM, header-only zero results and quotes dangerous spreadsheet formulas', () => {
    const d = parseCsv('名称,备注\nA,"hello,world"\nB,=1+1')
    const csv = serializeCsv(d.columns, d.rows)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"hello,world"')
    expect(csv).toContain("'=1+1")
    expect(serializeCsv(d.columns, []).slice(1).trimEnd()).toBe('名称,备注')
  })
  it('exports JSON using distinct labels, including prototype-like names', () => {
    const d = parseCsv('a,a,__proto__\nx,y,z')
    expect(JSON.parse(serializeJson(d.columns, d.rows))).toEqual([
      JSON.parse('{"a":"x","a (2)":"y","__proto__":"z"}'),
    ])
  })
})
