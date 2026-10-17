import type { AnalysisQuery, AnalysisResult, DatasetInfo, ImportPreview } from './analysis'
import type { ColumnTypes, ImportOptions } from './data'
import type { WorkspacePreferences } from './workspace'
import type { NamedWorkspaceInfo } from './workspace-store'

export type Download = { buffer: ArrayBuffer; filename: string; mime: string }
export type Commands = {
  demo: { input: undefined; output: DatasetInfo }
  analyze: { input: AnalysisQuery; output: AnalysisResult }
  stage: {
    input: { buffer: ArrayBuffer; name: string; encoding: string; options?: ImportOptions }
    output: ImportPreview
  }
  confirm: { input: ColumnTypes | undefined; output: DatasetInfo }
  discard: { input: undefined; output: void }
  export: {
    input: { query: AnalysisQuery; format: 'csv' | 'json'; name: string }
    output: Download
  }
  workspaceList: { input: undefined; output: NamedWorkspaceInfo[] }
  workspaceSave: {
    input: {
      preferences: WorkspacePreferences
      version: number
      name: string
      existing?: NamedWorkspaceInfo
    }
    output: NamedWorkspaceInfo
  }
  workspaceRestore: {
    input: { id: string }
    output: { info: DatasetInfo; preferences: WorkspacePreferences }
  }
  workspaceRename: {
    input: { target: NamedWorkspaceInfo; name: string }
    output: NamedWorkspaceInfo
  }
  workspaceDelete: { input: { target: NamedWorkspaceInfo }; output: void }
  workspaceBackup: { input: { id: string }; output: Download }
  workspaceImport: { input: { buffer: ArrayBuffer }; output: NamedWorkspaceInfo }
}
export type WorkerRequest = {
  [K in keyof Commands]: { id: number; command: K; payload: Commands[K]['input'] }
}[keyof Commands]
export type WorkerResponse =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }
