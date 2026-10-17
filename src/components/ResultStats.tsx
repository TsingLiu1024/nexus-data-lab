import { Activity, BarChart3, Check, Database, Fingerprint, ShieldCheck } from 'lucide-react'
import type { Column, profileColumn } from '../data'
import { formatNumber } from '../format'
type Props = {
  count: number
  missing: number
  complete: number | null
  numericCount: number
  busy: boolean
  datasetCount: number
  columnCount: number
  currentMetric?: Column
  metricProfile: ReturnType<typeof profileColumn> | null
}
export function ResultStats({
  count,
  missing,
  complete,
  numericCount,
  busy,
  datasetCount,
  columnCount,
  currentMetric,
  metricProfile,
}: Props) {
  return (
    <section className="stats-grid" aria-label="当前结果统计" aria-busy={busy}>
      <article className="stat-card">
        <div className="stat-top">
          <span>记录总数</span>
          <Database />
        </div>
        <div className="stat-value" data-testid="row-count">
          {formatNumber(count, 0)}
        </div>
        <div className="stat-foot">
          <span className="emphasis">
            {datasetCount ? ((count / datasetCount) * 100).toFixed(0) : 0}%
          </span>
          <span>占原始数据 · {formatNumber(datasetCount)} 条</span>
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-top">
          <span>{currentMetric ? `${currentMetric.label} · 合计` : '记录数 · 合计'}</span>
          <BarChart3 />
        </div>
        <div className="stat-value" data-testid="metric-total">
          {currentMetric ? formatNumber(metricProfile?.sum ?? null) : formatNumber(count)}
        </div>
        <div className="stat-foot">
          <span className="emphasis">Σ</span>
          <span>{currentMetric ? '当前指标的有效数值之和' : '当前筛选下的记录数量'}</span>
        </div>
      </article>
      <article className="stat-card purple">
        <div className="stat-top">
          <span>{currentMetric ? `${currentMetric.label} · 均值` : '数值字段'}</span>
          <Activity />
        </div>
        <div className="stat-value">
          {currentMetric ? formatNumber(metricProfile?.mean ?? null) : numericCount}
          <small>{currentMetric ? '' : '列'}</small>
        </div>
        <div className="stat-foot">
          <span className="emphasis">{currentMetric ? 'AVG' : 'TYPE'}</span>
          <span>{currentMetric ? '已排除缺失值' : '可切换为记录计数分析'}</span>
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-top">
          <span>数据完整率</span>
          <ShieldCheck />
        </div>
        <div className="stat-value">
          {complete === null ? '—' : complete.toFixed(1)}
          <small>{complete === null ? '' : '%'}</small>
        </div>
        <div className="stat-foot">
          <span className="emphasis">
            {complete === 100 ? <Check size={12} /> : <Fingerprint size={12} />}
          </span>
          <span>
            {formatNumber(missing)} 个缺失值 · {columnCount} 个字段
          </span>
        </div>
      </article>
    </section>
  )
}
