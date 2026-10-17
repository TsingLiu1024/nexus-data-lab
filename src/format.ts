export function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value)
}

export function compactNumber(value: number) {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}亿`
  if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(1)}万`
  return formatNumber(value, 0)
}

export function formatBytes(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(0.1, value / 1024).toFixed(1)} KB`
}
