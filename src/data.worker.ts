import { AnalysisEngine } from './analysis'
import { createDemo } from './demo'
import type { WorkerRequest, WorkerResponse } from './protocol'

const engine = new AnalysisEngine()
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id } = event.data
  try {
    const request = event.data
    let result: unknown
    const transfer: Transferable[] = []
    switch (request.command) {
      case 'demo': result = engine.load(createDemo()); break
      case 'analyze': result = engine.analyze(request.payload); break
      case 'stage': { const p = request.payload; result = engine.stage(p.buffer, p.name, p.encoding, p.options); break }
      case 'confirm': result = engine.confirm(); break
      case 'discard': result = engine.discard(); break
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
