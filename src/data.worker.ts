import { AnalysisEngine } from './analysis'
import { createDemo } from './demo'
import type { WorkerRequest, WorkerResponse } from './protocol'
import {
  deleteNamedWorkspace,
  listWorkspaces,
  readNamedWorkspace,
  renameWorkspace,
  uniqueWorkspaceName,
  writeWorkspace,
} from './workspace-store'
import { decodeBackup, encodeBackup } from './workspace-backup'

const engine = new AnalysisEngine()
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { id } = event.data
  try {
    const request = event.data
    let result: unknown
    const transfer: Transferable[] = []
    switch (request.command) {
      case 'demo':
        result = engine.load(createDemo())
        break
      case 'analyze':
        result = engine.analyze(request.payload)
        break
      case 'stage': {
        const p = request.payload
        result = engine.stage(p.buffer, p.name, p.encoding, p.options)
        break
      }
      case 'confirm':
        result = engine.confirm(request.payload)
        break
      case 'discard':
        result = engine.discard()
        break
      case 'workspaceList':
        result = await listWorkspaces()
        break
      case 'workspaceSave': {
        const { preferences, version, name, existing } = request.payload
        result = await writeWorkspace(engine.snapshot(preferences, version), name, existing)
        break
      }
      case 'workspaceRestore': {
        const { snapshot: record } = await readNamedWorkspace(request.payload.id)
        result = { info: engine.load(record.dataset), preferences: record.preferences }
        break
      }
      case 'workspaceRename':
        result = await renameWorkspace(request.payload.target, request.payload.name)
        break
      case 'workspaceDelete':
        result = await deleteNamedWorkspace(request.payload.target)
        break
      case 'workspaceBackup': {
        const { info, snapshot } = await readNamedWorkspace(request.payload.id)
        const buffer = encodeBackup(info.name, snapshot)
        const safeName = Array.from(info.name, (char) =>
          char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char,
        ).join('')
        result = {
          buffer,
          filename: `${safeName}-workspace.json`,
          mime: 'application/json;charset=utf-8',
        }
        transfer.push(buffer)
        break
      }
      case 'workspaceImport': {
        const backup = decodeBackup(request.payload.buffer)
        const entries = await listWorkspaces()
        result = await writeWorkspace(backup.snapshot, uniqueWorkspaceName(backup.name, entries))
        break
      }
      case 'export': {
        const { query, format, name } = request.payload
        const buffer = new TextEncoder().encode(engine.exportText(query, format)).buffer
        result = {
          buffer,
          filename: `${name.replace(/\.[^.]+$/, '')}-filtered.${format}`,
          mime: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
        }
        transfer.push(buffer)
        break
      }
    }
    const response: WorkerResponse = { id, ok: true, result }
    self.postMessage(response, { transfer })
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : '数据处理失败。',
    } satisfies WorkerResponse)
  }
})
