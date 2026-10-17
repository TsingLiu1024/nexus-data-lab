import type { Commands, WorkerResponse } from './protocol'

export class DataClient {
  private worker = new Worker(new URL('./data.worker.ts', import.meta.url), { type: 'module', name: 'nexus-analysis' })
  private sequence = 0
  private closed = false
  private pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>()

  constructor() {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      const task = this.pending.get(message.id)
      if (!task) return
      this.pending.delete(message.id)
      if (message.ok) task.resolve(message.result)
      else task.reject(new Error(message.error))
    }
    this.worker.onerror = () => this.fail(new Error('分析线程异常，请刷新页面后重试。'))
    this.worker.onmessageerror = () => this.fail(new Error('无法读取分析结果，请刷新页面后重试。'))
  }

  request<K extends keyof Commands>(command: K, payload: Commands[K]['input'], transfer: Transferable[] = []): Promise<Commands[K]['output']> {
    if (this.closed) return Promise.reject(new Error('分析线程已关闭，请刷新页面。'))
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: result => resolve(result as Commands[K]['output']), reject })
      try { this.worker.postMessage({ id, command, payload }, transfer) }
      catch (error) { this.pending.delete(id); reject(error) }
    })
  }

  private fail(error: Error) {
    this.closed = true
    this.pending.forEach(task => task.reject(error))
    this.pending.clear()
    this.worker.terminate()
  }

  dispose() { this.fail(new Error('页面已关闭。')) }
}
