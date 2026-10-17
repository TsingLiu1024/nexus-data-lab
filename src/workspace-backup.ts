import { validateWorkspace, type SavedWorkspace } from './workspace'
import { workspaceName } from './workspace-store'

export const BACKUP_FILE_LIMIT = 128 * 1024 * 1024
export function validateBackupSize(size: number) {
  if (!Number.isInteger(size) || size <= 0 || size > BACKUP_FILE_LIMIT)
    throw new Error('备份文件不能为空，且不能超过 128 MiB。')
}
export function encodeBackup(name: string, snapshot: SavedWorkspace): ArrayBuffer {
  validateWorkspace(snapshot)
  const buffer = new TextEncoder().encode(
    JSON.stringify({ format: 'nexus-workspace', version: 1, name: workspaceName(name), snapshot }),
  ).buffer
  validateBackupSize(buffer.byteLength)
  return buffer
}
export function decodeBackup(buffer: ArrayBuffer): { name: string; snapshot: SavedWorkspace } {
  validateBackupSize(buffer.byteLength)
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
  } catch {
    throw new Error('无法读取备份 JSON，请选择本应用导出的 UTF-8 工作区备份。')
  }
  const record = parsed as {
    format?: unknown
    version?: unknown
    name?: unknown
    snapshot?: unknown
  } | null
  if (
    !record ||
    record.format !== 'nexus-workspace' ||
    record.version !== 1 ||
    typeof record.name !== 'string' ||
    Object.keys(record).some((key) => !['format', 'version', 'name', 'snapshot'].includes(key))
  )
    throw new Error('备份格式或版本无效，请检查文件。')
  const name = workspaceName(record.name)
  validateWorkspace(record.snapshot)
  return { name, snapshot: record.snapshot }
}
