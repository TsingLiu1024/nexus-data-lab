import { CalendarDays, Hash, Type } from 'lucide-react'
import type { profileColumn, Column } from '../data'
import { formatNumber } from '../format'

export const typeLabels = { number: '数值', date: '日期', text: '文本' }
export const typeIcons = { number: Hash, date: CalendarDays, text: Type }

export function Profiles({
  columns,
  count,
  profiles,
}: {
  columns: Column[]
  count: number
  profiles: ReturnType<typeof profileColumn>[]
}) {
  return (
    <section aria-labelledby="profiles-title">
      <div className="profiles-heading">
        <div>
          <h2 id="profiles-title">字段画像</h2>
          <p>理解每一个字段，发现数据的质量与结构。</p>
        </div>
        <span className="tag">
          {columns.length} FIELDS / {formatNumber(count)} ROWS
        </span>
      </div>
      <div className="profiles-grid">
        {columns.map((column, index) => {
          const profile = profiles[index]
          const complete = count ? (1 - profile.missing / count) * 100 : 0
          const Icon = typeIcons[column.type]
          return (
            <article key={column.key} className="profile-card panel">
              <div className="profile-card-head">
                <Icon />
                <h3 title={column.label}>{column.label}</h3>
                <span className="tag">{typeLabels[column.type]}</span>
              </div>
              <div className="profile-row">
                <span>唯一值</span>
                <strong>{formatNumber(profile.unique)}</strong>
              </div>
              <div className="profile-row">
                <span>缺失值</span>
                <strong>{formatNumber(profile.missing)}</strong>
              </div>
              {column.type === 'number' && (
                <>
                  <div className="profile-row">
                    <span>最小 / 最大</span>
                    <strong>
                      {formatNumber(profile.min)} / {formatNumber(profile.max)}
                    </strong>
                  </div>
                  <div className="profile-row">
                    <span>平均值</span>
                    <strong>{formatNumber(profile.mean)}</strong>
                  </div>
                </>
              )}
              <div className="completeness">
                <span style={{ width: `${complete}%` }} />
              </div>
              <div className="profile-footer">
                <span>字段完整度</span>
                <span className="mono">{complete.toFixed(1)}%</span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
