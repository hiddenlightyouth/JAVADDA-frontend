import type { ApiUsage, UsageGroup } from '../lib/apiKeys'
import { formatDateTime } from '../lib/format'
import { BarChart, compact, full, Stat, tableRow, td, th, type Bar } from './AdminParts'
import { Panel } from './GapParts'
import { Badge } from './ui'

const rate = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%')

/** API 호출량이에요. 내 API 키 화면과 관리자 화면이 같이 써요. keys가 있으면(관리자) 키별 표도 보여줘요. */
export function ApiUsageView({ usage, compactView = false }: { usage: ApiUsage; compactView?: boolean }) {
  const { total } = usage
  const bars: Bar[] = usage.daily.map((d) => {
    const [, m, day] = d.date.split('-').map(Number)
    return { key: d.date, value: d.calls, title: `${m}월 ${day}일, ${full(d.calls)}번${d.errors ? `, 오류 ${full(d.errors)}번` : ''}` }
  })
  const label = (date: string) => {
    const [, m, day] = date.split('-').map(Number)
    return `${m}월 ${day}일`
  }
  return (
    <>
      <dl className={`grid grid-cols-2 gap-3 ${compactView ? '' : 'lg:grid-cols-4'}`}>
        <Stat label="호출" value={full(total.calls)} note={`하루 ${(total.calls / Math.max(1, usage.daily.length)).toFixed(1)}번`} />
        <Stat label="오류" value={rate(total.errors, total.calls)} note={`${full(total.errors)}번`} />
        <Stat label="한도 넘음" value={full(total.limited)} note="429 응답" />
        <Stat label="평균 응답" value={`${Math.round(total.latencyMs / Math.max(1, total.calls))}ms`} />
      </dl>
      <Panel className="mt-3" title="날짜별 호출">
        {bars.length > 0 && <BarChart bars={bars} label="날짜별 호출" first={label(bars[0].key)} last={label(bars[bars.length - 1].key)} />}
      </Panel>
      <div className={`mt-3 grid grid-cols-1 gap-3 ${compactView ? '' : 'xl:grid-cols-2'}`}>
        {usage.keys.length > 0 && <GroupTable title="키별" groups={usage.keys} />}
        <GroupTable title="API별" groups={usage.paths} mono />
        {!compactView && usage.keys.length === 0 && <GroupTable title="권한별" groups={usage.scopes} />}
      </div>
      <Panel className="mt-3" title="최근 호출">
        {!usage.recent.length ? (
          <p className="text-[13px] text-gray-500">아직 부른 적이 없어요.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[560px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  {['시각', 'API', '응답', '시간'].map((t) => (
                    <th key={t} className={th}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((r) => (
                  <tr key={r.id} className={tableRow}>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.createdAt)}</td>
                    <td className={`${td} font-mono text-[12px]`}>
                      {r.method} {r.path.replace('/api/public/v1', '')}
                    </td>
                    <td className={td}>
                      <Badge tone={r.status === 429 ? 'amber' : r.status >= 400 ? 'red' : 'white'}>{r.status}</Badge>
                    </td>
                    <td className={td}>{r.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}

function GroupTable({ title, groups, mono = false }: { title: string; groups: UsageGroup[]; mono?: boolean }) {
  const most = Math.max(1, ...groups.map((g) => g.total.calls))
  return (
    <Panel title={title} className="min-w-0">
      {!groups.length ? (
        <p className="text-[13px] text-gray-500">없어요.</p>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((g) => (
            <li key={g.key} className="flex items-center gap-3 text-[13px] tabular-nums">
              <span className={`w-44 shrink-0 truncate text-gray-900 ${mono ? 'font-mono text-[12px]' : ''}`} title={g.label}>
                {mono ? g.label.replace('/api/public/v1', '') : g.label}
              </span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200/70">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${(g.total.calls / most) * 100}%` }} />
              </span>
              <span className="w-24 shrink-0 text-right text-gray-700">
                {compact(g.total.calls)}
                {g.total.errors > 0 && <span className="ml-1 text-red-500">({compact(g.total.errors)})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
