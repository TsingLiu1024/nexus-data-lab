import type { AnalysisQuery, AnalysisResult, DatasetInfo, ImportPreview } from './analysis'
import type { ColumnTypes, ImportOptions } from './data'
import type { WorkspaceInfo, WorkspacePreferences } from './workspace'

export type Download = { buffer: ArrayBuffer; filename: string; mime: string }
export type Commands = {
  demo: { input: undefined; output: DatasetInfo }
  analyze: { input: AnalysisQuery; output: AnalysisResult }
  stage: { input: { buffer: ArrayBuffer; name: string; encoding: string; options?: ImportOptions }; output: ImportPreview }
  confirm: { input: ColumnTypes | undefined; output: DatasetInfo }
  discard: { input: undefined; output: void }
  export: { input: { query: AnalysisQuery; format: 'csv' | 'json'; name: string }; output: Download }
  savedInfo: { input: undefined; output: WorkspaceInfo | null }
  save: { input: { preferences: WorkspacePreferences; version: number }; output: WorkspaceInfo }
  restore: { input: undefined; output: { info: DatasetInfo; preferences: WorkspacePreferences } }
  deleteSaved: { input: undefined; output: void }
}
export type WorkerRequest = { [K in keyof Commands]: { id: number; command: K; payload: Commands[K]['input'] } }[keyof Commands]
export type WorkerResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }
