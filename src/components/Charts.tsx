import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, BarChart3, CircleDot, LineChart as LineIcon } from 'lucide-react'
import { aggregateRows } from '../data'
import type { AggregateMode, Column, Row } from '../data'
import { compactNumber, formatNumber } from '../format'

export const CHART_COLORS = ['#56d9be', '#758de5', '#9e83d2', '#d2b775', '#647a92']

type Props = {
  columns: Column[]; rows: Row[]; dimension: string; metric: string; mode: AggregateMode;
  onDimension: (value: string) => void; onMetric: (value: string) => void; onMode: (value: AggregateMode) => void;
  category: string; onCategory: (value: string) => void
}

export function Charts({ columns, rows, dimension, metric, mode, onDimension, onMetric, onMode, category, onCategory }: Props) {
  const [kind, setKind] = useState<'area' | 'bar'>('area')
  const numeric = columns.filter(c => c.type === 'number')
  const points = useMemo(() => aggregateRows(rows, dimension, metric, mode), [rows, dimension, metric, mode])
  const distribution = useMemo(() => aggregateRows(rows, category, '__count__', 'count', 5), [rows, category])
  const metricLabel = metric === '__count__' || mode === 'count' ? '记录数' : columns.find(c => c.key === metric)?.label ?? ''
  const modeLabel = mode === 'count' || metric === '__count__' ? '计数' : mode === 'mean' ? '均值' : '合计'
  const dateDimension = columns.find(c => c.key === dimension)?.type === 'date'
  const hasValues = points.some(point => point.value !== null)
  const axes = <>
    <CartesianGrid stroke="#283343" vertical={false} strokeDasharray="3 5" />
    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6e8199', fontSize: 9 }} minTickGap={36} dy={9} tickFormatter={v => dateDimension && /^\d{4}-/.test(String(v)) ? String(v).slice(5, 10) : String(v).length > 8 ? String(v).slice(0, 7) + '…' : String(v)} />
    <YAxis width={55} axisLine={false} tickLine={false} tick={{ fill: '#6e8199', fontSize: 9 }} tickFormatter={compactNumber} tickCount={5} />
    <Tooltip cursor={{ stroke: '#628d88', strokeDasharray: '3 3' }} formatter={v => [v == null ? '—' : formatNumber(Number(v)), metricLabel]} />
  </>
  return <div className="charts-grid">
    <section className="panel trend-panel" aria-labelledby="trend-title"><div className="panel-head"><div><div className="panel-heading"><Activity /><h2 id="trend-title">数据趋势</h2></div><p className="panel-caption">沿着数据的变化，发现新的增长信号</p></div><div className="chart-buttons"><button aria-label="折线图" aria-pressed={kind === 'area'} className={kind === 'area' ? 'active' : ''} onClick={() => setKind('area')}><LineIcon /></button><button aria-label="柱状图" aria-pressed={kind === 'bar'} className={kind === 'bar' ? 'active' : ''} onClick={() => setKind('bar')}><BarChart3 /></button></div></div>
      <div className="chart-controls"><label className="select-wrap"><span>维度</span><select aria-label="图表维度" value={dimension} onChange={e => onDimension(e.target.value)}>{columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label><label className="select-wrap"><span>指标</span><select aria-label="图表指标" value={metric} onChange={e => onMetric(e.target.value)}><option value="__count__">记录数</option>{numeric.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label><label className="select-wrap"><select aria-label="聚合方式" value={metric === '__count__' ? 'count' : mode} disabled={metric === '__count__'} onChange={e => onMode(e.target.value as AggregateMode)}><option value="sum">求和</option><option value="mean">均值</option><option value="count">计数</option></select></label></div>
      {rows.length > 0 && hasValues ? <div className="chart-area" data-testid="trend-chart" role="img" aria-label={`${columns.find(c => c.key === dimension)?.label}分组的${metricLabel}${modeLabel}图，${points.length}组`}><ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {kind === 'area' ? <AreaChart data={points} margin={{ top: 15, right: 10, left: 0, bottom: 15 }}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#52e3cb" stopOpacity={0.22} /><stop offset="95%" stopColor="#52e3cb" stopOpacity={0.01} /></linearGradient></defs>{axes}<Area type="monotone" dataKey="value" stroke="#52ddc1" strokeWidth={2} fill="url(#trendFill)" isAnimationActive={false} activeDot={{ r: 4, fill: '#86ffdf', stroke: '#1b443b', strokeWidth: 4 }} /></AreaChart>
          : <BarChart data={points} margin={{ top: 15, right: 10, left: 0, bottom: 15 }}>{axes}<Bar dataKey="value" fill="#55cdb5" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false} /></BarChart>}
      </ResponsiveContainer></div> : <div className="empty-chart"><Activity />{rows.length ? '当前指标没有有效数值' : '当前条件下暂无数据'}</div>}
      <div className="chart-foot"><span className="chart-legend">{metricLabel} · {modeLabel}</span><span>{dateDimension && new Set(rows.map(r => r[dimension])).size > 30 ? '相邻日期合并展示' : '按当前筛选结果聚合'} · {points.length} 组</span></div>
    </section>
    <section className="panel donut-panel" aria-labelledby="distribution-title"><div className="panel-head"><div><div className="panel-heading"><CircleDot /><h2 id="distribution-title">分类分布</h2></div><p className="panel-caption">每一部分，都是全貌的一部分</p></div><select aria-label="分类分布字段" value={category} onChange={e => onCategory(e.target.value)}>{columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
      {rows.length ? <div className="donut-inner"><div className="donut-area" role="img" aria-label={`按${columns.find(c => c.key === category)?.label}的记录数分布`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="67%" outerRadius="87%" startAngle={90} endAngle={-270} paddingAngle={3} stroke="none" isAnimationActive={false}>{distribution.map((point, i) => <Cell key={point.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={v => [`${formatNumber(Number(v))} 条`, '记录数']} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{formatNumber(rows.length)}</strong><span>记录总数</span></div></div><div className="donut-legend">{distribution.map((point, i) => <div key={point.name} className="donut-item"><span className="donut-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="category-name" title={point.name}>{point.name}</span><span className="category-value">{formatNumber(point.value)}</span><span className="category-percent">{(point.count / rows.length * 100).toFixed(0)}%</span></div>)}</div></div> : <div className="empty-chart"><CircleDot />暂无分布数据</div>}
    </section>
  </div>
}
