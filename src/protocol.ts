import type { AnalysisQuery, AnalysisResult, DatasetInfo, ImportPreview } from './analysis'
import type { ImportOptions } from './data'

export type Download = { buffer: ArrayBuffer; filename: string; mime: string }
export type Commands = {
  demo: { input: undefined; output: DatasetInfo }
  analyze: { input: AnalysisQuery; output: AnalysisResult }
  stage: { input: { buffer: ArrayBuffer; name: string; encoding: string; options?: ImportOptions }; output: ImportPreview }
  confirm: { input: undefined; output: DatasetInfo }
  discard: { input: undefined; output: void }
  export: { input: { query: AnalysisQuery; format: 'csv' | 'json'; name: string }; output: Download }
}
export type WorkerRequest = { [K in keyof Commands]: { id: number; command: K; payload: Commands[K]['input'] } }[keyof Commands]
export type WorkerResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }
