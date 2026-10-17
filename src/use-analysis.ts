import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnalysisQuery, AnalysisResult, ChartSettings, DatasetInfo } from './analysis'
import type { Filter, Sort } from './data'
import { DataClient } from './worker-client'
import type { WorkspacePreferences } from './workspace'

const emptySettings: ChartSettings = {
  dimension: '',
  metric: '__count__',
  category: '',
  mode: 'sum',
  kind: 'area',
}

export function useAnalysis() {
  const [client] = useState(() => new DataClient())
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [settings, setSettings] = useState<ChartSettings>(emptySettings)
  const [query, setQueryValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filters, setFilterValues] = useState<Filter[]>([])
  const [sort, setSortValue] = useState<Sort>(null)
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [demo, setDemo] = useState(true)

  const accept = useCallback((info: DatasetInfo, isDemo = false) => {
    setDataset(info)
    setSettings(info.defaults)
    setAnalysis(null)
    setDemo(isDemo)
    setQueryValue('')
    setDebounced('')
    setFilterValues([])
    setSortValue(null)
    setPage(1)
    setError('')
    setPending(true)
  }, [])

  useEffect(() => {
    let active = true
    client
      .request('demo', undefined)
      .then((info) => {
        if (active) accept(info, true)
      })
      .catch((reason) => {
        if (active) {
          setError(reason.message)
          setPending(false)
        }
      })
    return () => {
      active = false
      client.dispose()
    }
  }, [client, accept])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(timer)
  }, [query])

  const request = useMemo<AnalysisQuery>(
    () => ({ query: debounced, filters, sort, page, settings }),
    [debounced, filters, sort, page, settings],
  )
  useEffect(() => {
    if (!dataset || query !== debounced) return
    let active = true
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize the UI with a new asynchronous Worker request.
    setPending(true)
    client
      .request('analyze', request)
      .then((result) => {
        if (active && result.version === dataset.version) {
          setAnalysis(result)
          setPending(false)
          setError('')
        }
      })
      .catch((reason) => {
        if (active) {
          setError(reason.message)
          setPending(false)
        }
      })
    return () => {
      active = false
    }
  }, [client, dataset, request, query, debounced])

  function setQuery(value: string) {
    setPage(1)
    setQueryValue(value)
  }
  function setFilters(value: Filter[]) {
    setPage(1)
    setFilterValues(value)
  }
  function setSort(value: Sort) {
    setPage(1)
    setSortValue(value)
  }
  function resetFilters() {
    setQueryValue('')
    setFilterValues([])
    setSortValue(null)
    setPage(1)
  }
  function restore(info: DatasetInfo, preferences: WorkspacePreferences) {
    accept(info, preferences.demo)
    setQueryValue(preferences.query)
    setDebounced(preferences.query)
    setFilterValues(preferences.filters)
    setSortValue(preferences.sort)
    setPage(preferences.page)
    setSettings(preferences.settings)
  }
  const busy = pending || query !== debounced
  return {
    client,
    dataset,
    analysis,
    settings,
    setSettings,
    query,
    setQuery,
    filters,
    setFilters,
    sort,
    setSort,
    page,
    setPage,
    resetFilters,
    accept,
    restore,
    demo,
    busy,
    error,
    request,
    loadDemo: async () => {
      const info = await client.request('demo', undefined)
      accept(info, true)
    },
  }
}
