import { AnalysisEngine } from './analysis'
import { createDemo } from './demo'
import type { WorkerRequest, WorkerResponse } from './protocol'
import { deleteWorkspace, readWorkspace, saveWorkspace, workspaceInfo } from './workspace'

const engine = new AnalysisEngine()
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { id } = event.data
  try {
    const request = event.data
    let result: unknown
    const transfer: Transferable[] = []
    switch (request.command) {
      case 'demo': result = engine.load(createDemo()); break
      case 'analyze': result = engine.analyze(request.payload); break
      case 'stage': { const p = request.payload; result = engine.stage(p.buffer, p.name, p.encoding, p.options); break }
      case 'confirm': result = engine.confirm(request.payload); break
      case 'discard': result = engine.discard(); break
      case 'savedInfo': result = await workspaceInfo(); break
      case 'save': result = await saveWorkspace(engine.snapshot(request.payload.preferences, request.payload.version)); break
      case 'restore': {
        const record = await readWorkspace()
        if (!record) throw new Error('没有可恢复的本地工作区。')
        result = { info: engine.load(record.dataset), preferences: record.preferences }
        break
      }
      case 'deleteSaved': result = await deleteWorkspace(); break
      case 'export': {
        const { query, format, name } = request.payload
        const buffer = new TextEncoder().encode(engine.exportText(query, format)).buffer
        result = { buffer, filename: `${name.replace(/\.[^.]+$/, '')}-filtered.${format}`, mime: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }
        transfer.push(buffer)
        break
      }
    }
    const response: WorkerResponse = { id, ok: true, result }
    self.postMessage(response, { transfer })
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : '数据处理失败。' } satisfies WorkerResponse)
  }
})
