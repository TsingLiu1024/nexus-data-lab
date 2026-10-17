import { validateWorkspace, workspaceTransaction, type SavedWorkspace } from './workspace'

export type NamedWorkspaceInfo = {
  id: string
  name: string
  filename: string
  count: number
  savedAt: string
  revision: string
}
type Failure = (error: unknown) => void

export function workspaceName(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80)
    throw new Error('工作区名称需要 1–80 个字符。')
  return value.trim()
}

function validateInfo(value: unknown): asserts value is NamedWorkspaceInfo {
  const info = value as NamedWorkspaceInfo | null
  if (
    !info ||
    typeof info.id !== 'string' ||
    !info.id ||
    typeof info.revision !== 'string' ||
    !info.revision ||
    typeof info.name !== 'string' ||
    !info.name.trim() ||
    info.name.length > 80 ||
    typeof info.filename !== 'string' ||
    !Number.isInteger(info.count) ||
    info.count < 1 ||
    typeof info.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(info.savedAt))
  )
    throw new Error('工作区存档信息无效。')
}

function collectInfos(
  store: IDBObjectStore,
  done: (entries: NamedWorkspaceInfo[]) => void,
  fail: Failure,
) {
  const request = store.getAllKeys()
  request.onsuccess = () => {
    const keys = request.result.filter((key) => typeof key === 'string' && key.startsWith('meta:'))
    const entries: NamedWorkspaceInfo[] = []
    let remaining = keys.length
    if (!remaining) {
      try {
        done(entries)
      } catch (error) {
        fail(error)
      }
      return
    }
    for (const key of keys) {
      const item = store.get(key)
      item.onsuccess = () => {
        try {
          validateInfo(item.result)
          entries.push(item.result)
          if (--remaining === 0) done(entries)
        } catch (error) {
          fail(error)
        }
      }
    }
  }
}

export function uniqueWorkspaceName(name: string, entries: NamedWorkspaceInfo[]): string {
  const base = workspaceName(name.slice(0, 80))
  let candidate = base,
    count = 1
  while (entries.some((info) => info.name === candidate)) {
    const suffix = `（副本 ${count++}）`
    candidate = base.slice(0, 80 - suffix.length) + suffix
  }
  return candidate
}

async function migrateLegacy(factory: IDBFactory | undefined) {
  await workspaceTransaction<void>(factory, 'readwrite', (store, result, fail) => {
    const request = store.get('current')
    request.onsuccess = () => {
      try {
        const snapshot: unknown = request.result
        if (snapshot === undefined) {
          result()
          return
        }
        // Existing local saves predate the new query limits; migrate without truncating them.
        validateWorkspace(snapshot, { allowLegacyQueryLimits: true })
        collectInfos(
          store,
          (entries) => {
            const id = crypto.randomUUID()
            const info: NamedWorkspaceInfo = {
              id,
              name: uniqueWorkspaceName(snapshot.dataset.name, entries),
              filename: snapshot.dataset.name,
              count: snapshot.dataset.rows.length,
              savedAt: snapshot.savedAt,
              revision: crypto.randomUUID(),
            }
            store.put(snapshot, 'data:' + id)
            store.put(info, 'meta:' + id)
            store.delete('current')
            store.delete('metadata')
            result()
          },
          fail,
        )
      } catch (error) {
        fail(error)
      }
    }
  })
}

export async function listWorkspaces(
  factory = globalThis.indexedDB,
): Promise<NamedWorkspaceInfo[]> {
  await migrateLegacy(factory)
  return workspaceTransaction(factory, 'readonly', (store, result, fail) =>
    collectInfos(
      store,
      (entries) =>
        result(
          entries.sort(
            (a, b) => b.savedAt.localeCompare(a.savedAt) || a.name.localeCompare(b.name),
          ),
        ),
      fail,
    ),
  )
}

function checkCurrent(target: NamedWorkspaceInfo, current: NamedWorkspaceInfo | undefined) {
  if (!current || current.revision !== target.revision)
    throw new Error('此工作区已在其他页面更新或删除，请刷新存档列表后重试。')
}

export async function writeWorkspace(
  snapshot: SavedWorkspace,
  name: string,
  existing?: NamedWorkspaceInfo,
  factory = globalThis.indexedDB,
): Promise<NamedWorkspaceInfo> {
  validateWorkspace(snapshot)
  const title = workspaceName(name)
  await migrateLegacy(factory)
  return workspaceTransaction(factory, 'readwrite', (store, result, fail) =>
    collectInfos(
      store,
      (entries) => {
        if (existing)
          checkCurrent(
            existing,
            entries.find((info) => info.id === existing.id),
          )
        if (entries.some((info) => info.name === title && info.id !== existing?.id))
          throw new Error('已有同名工作区，请使用其他名称。')
        const id = existing?.id ?? crypto.randomUUID()
        const info: NamedWorkspaceInfo = {
          id,
          name: title,
          filename: snapshot.dataset.name,
          count: snapshot.dataset.rows.length,
          savedAt: snapshot.savedAt,
          revision: crypto.randomUUID(),
        }
        store.put(snapshot, 'data:' + id)
        store.put(info, 'meta:' + id)
        result(info)
      },
      fail,
    ),
  )
}

export async function readNamedWorkspace(
  id: string,
  factory = globalThis.indexedDB,
): Promise<{ info: NamedWorkspaceInfo; snapshot: SavedWorkspace }> {
  await migrateLegacy(factory)
  return workspaceTransaction(factory, 'readonly', (store, result, fail) => {
    const meta = store.get('meta:' + id)
    meta.onsuccess = () => {
      try {
        validateInfo(meta.result)
        const info = meta.result
        const data = store.get('data:' + id)
        data.onsuccess = () => {
          try {
            const snapshot: unknown = data.result
            validateWorkspace(snapshot, { allowLegacyQueryLimits: true })
            if (
              info.id !== id ||
              snapshot.dataset.name !== info.filename ||
              snapshot.dataset.rows.length !== info.count ||
              snapshot.savedAt !== info.savedAt
            )
              throw new Error('工作区数据与存档信息不一致。')
            result({ info, snapshot })
          } catch (error) {
            fail(error)
          }
        }
      } catch (error) {
        fail(error)
      }
    }
  })
}

export async function renameWorkspace(
  target: NamedWorkspaceInfo,
  name: string,
  factory = globalThis.indexedDB,
): Promise<NamedWorkspaceInfo> {
  const title = workspaceName(name)
  await migrateLegacy(factory)
  return workspaceTransaction(factory, 'readwrite', (store, result, fail) =>
    collectInfos(
      store,
      (entries) => {
        const current = entries.find((info) => info.id === target.id)
        checkCurrent(target, current)
        if (entries.some((info) => info.name === title && info.id !== target.id))
          throw new Error('已有同名工作区，请使用其他名称。')
        const updated = { ...current!, name: title, revision: crypto.randomUUID() }
        store.put(updated, 'meta:' + target.id)
        result(updated)
      },
      fail,
    ),
  )
}

export async function deleteNamedWorkspace(
  target: NamedWorkspaceInfo,
  factory = globalThis.indexedDB,
): Promise<void> {
  await migrateLegacy(factory)
  await workspaceTransaction<void>(factory, 'readwrite', (store, result, fail) => {
    const request = store.get('meta:' + target.id)
    request.onsuccess = () => {
      try {
        checkCurrent(target, request.result)
        store.delete('data:' + target.id)
        store.delete('meta:' + target.id)
        result()
      } catch (error) {
        fail(error)
      }
    }
  })
}
