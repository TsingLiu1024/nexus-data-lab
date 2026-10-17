import { describe, expect, it } from 'vitest'
import { defaultSettings } from './analysis'
import { parseCsv } from './data'
import {
  BACKUP_FILE_LIMIT,
  decodeBackup,
  encodeBackup,
  validateBackupSize,
} from './workspace-backup'
import { validateWorkspace, WORKSPACE_TEXT_LIMIT, type SavedWorkspace } from './workspace'

function fixture(): SavedWorkspace {
  const dataset = parseCsv('编号;日期;金额\n001;31/12/2025;1.00\n002;01/01/2026;2', 'backup.csv', {
    delimiter: ';',
    dateFormat: 'dmy-slash',
  })
  return {
    schema: 1,
    savedAt: new Date().toISOString(),
    dataset,
    preferences: {
      query: '001',
      filters: [{ column: 'c2', operator: 'gte', value: '1' }],
      sort: { key: 'c1', direction: 'desc' },
      page: 1,
      settings: defaultSettings(dataset),
      view: 'profiles',
      demo: false,
    },
  }
}
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer

describe('portable workspace backups', () => {
  it('roundtrips raw identifiers, non-ISO dates, numeric formatting and every preference', () => {
    const snapshot = fixture()
    expect(decodeBackup(encodeBackup('年末分析', snapshot))).toEqual({ name: '年末分析', snapshot })
  })
  it('rejects invalid JSON, unsupported versions and malformed numeric/date cells', () => {
    expect(() => decodeBackup(new TextEncoder().encode('{').buffer)).toThrow(/备份|JSON/)
    expect(() =>
      decodeBackup(
        bytes({ format: 'nexus-workspace', version: 99, name: 'Test', snapshot: fixture() }),
      ),
    ).toThrow(/版本|备份/)
    const snapshot = fixture()
    snapshot.dataset.rows[0].c2 = 'not-a-number'
    expect(() =>
      decodeBackup(bytes({ format: 'nexus-workspace', version: 1, name: 'Test', snapshot })),
    ).toThrow(/存档|格式/)
    snapshot.dataset.rows[0].c2 = '1'
    snapshot.dataset.rows[0].c1 = '31/02/2025'
    expect(() => encodeBackup('Test', snapshot)).toThrow(/存档|格式/)
  })
  it('rejects unknown date formats, extra row properties and hidden payloads', () => {
    const snapshot = fixture()
    Object.assign(snapshot.dataset.columns[1], { dateFormat: 'unknown' })
    expect(() => validateWorkspace(snapshot)).toThrow()
    const extra = fixture()
    Object.assign(extra.dataset.rows[0], { __extra__: 'hidden' })
    expect(() => validateWorkspace(extra)).toThrow()
    const hidden = Object.assign(fixture(), { unexpected: 'hidden' })
    expect(() => validateWorkspace(hidden)).toThrow()
    expect(() =>
      decodeBackup(bytes({ format: 'nexus-workspace', version: 1, name: '', snapshot: fixture() })),
    ).toThrow()
  })
  it('enforces file and decoded text budgets before storage can be changed', () => {
    expect(() => validateBackupSize(BACKUP_FILE_LIMIT + 1)).toThrow(/128|大小|备份/)
    expect(() => validateBackupSize(0)).toThrow(/空|备份/)
    expect(() => validateBackupSize(BACKUP_FILE_LIMIT)).not.toThrow()
    const oversized = fixture()
    oversized.dataset.rows[0].c0 = 'x'.repeat(Math.ceil(WORKSPACE_TEXT_LIMIT / 3))
    expect(() => validateWorkspace(oversized)).toThrow(/预算|过大|超过/)
  })
})
