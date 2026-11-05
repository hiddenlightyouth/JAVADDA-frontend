import { useState } from 'react'
import { manageRequest, listManage } from '../lib/adminManage'
import { track } from '../lib/analytics'
import { STATUS_NAMES, fetchScopes, type ApiKeyView, type ApiSummary, type ApiUsage, type KeyStatus } from '../lib/apiKeys'
import { formatDateTime } from '../lib/format'
import { showToast } from '../lib/toast'
import { full, InfoGrid, openableRow, PagedTable, SearchBox, Stat, StatsLoading, td, th, useAdminData, useDebounced, usePaged, Failed } from './AdminParts'
import { ApiUsageView } from './ApiUsage'
import { StatusBadge, scopeName } from './ApiKeys'
import { ConfirmDialog, SidePanel } from './Dialog'
import { Dropdown } from './Dropdown'
import { RefreshIcon } from './Icons'
import {
  Badge,
  Checkbox,
  FormError,
  iconButton,
  label as labelText,
  LoadProgress,
  primaryButton,
  Segmented,
  textArea,
  textFieldSm,
  toolButton,
  toolDangerButton,
} from './ui'

const dateOf = (value: string | null) => (value ? formatDateTime(value) : '없음')
const STATUS_FILTERS: [string, string][] = [
  ['all', '전체 키'],
  ['pending', STATUS_NAMES.pending],
  ['approved', STATUS_NAMES.approved],
  ['rejected', STATUS_NAMES.rejected],
  ['revoked', STATUS_NAMES.revoked],
]

/** 관리자의 API 탭이에요. 맨 위에 호출량, 아래에 키 요청 목록이 있고, 줄을 누르면 심사 칸이 열려요. */
export function ManagementApi() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [opened, setOpened] = useState<ApiKeyView | null>(null)
  const keyword = useDebounced(query)
  const summary = useAdminData(() => manageRequest<ApiSummary>(`/admin/manage/api-usage?days=${days}`), days, true)
  const scopes = useAdminData(() => fetchScopes(), 'scopes')
  const list = usePaged((page) => listManage<ApiKeyView>('/api-keys', keyword, { status }, page), `${keyword}:${status}`)
  const refresh = () => {
    summary.reload()
    list.refresh()
  }
  const s = summary.data
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder="키 이름, 요청자" />
        <Dropdown
          value={STATUS_FILTERS.find(([key]) => key === status)?.[1]}
          active={status !== 'all'}
          groups={[{ items: STATUS_FILTERS.map(([key, name]) => ({ label: name, checked: key === status, onSelect: () => setStatus(key) })) }]}
        />
        <button type="button" aria-label="새로고침" title="새로고침" className={`${iconButton.md} ml-auto size-10`} onClick={refresh}>
          <RefreshIcon />
        </button>
      </div>
      {s && (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="심사 중" value={full(s.pending)} />
          <Stat label="사용 중인 키" value={full(s.approved)} />
        </dl>
      )}
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable
        list={list}
        empty="조건에 맞는 키가 없어요."
        head={
          <>
            {['키', '요청자', '권한', '상태', '오늘 호출', '요청'].map((t) => (
              <th key={t} className={th}>
                {t}
              </th>
            ))}
          </>
        }
      >
        {(k) => (
          <tr key={k.id} className={openableRow(opened?.id === k.id)} onClick={() => setOpened(k)}>
            <td className={`${td} max-w-[220px]`}>
              <p className="truncate font-medium text-gray-900">{k.name}</p>
              <p className="font-mono text-[12px] text-gray-500">{k.prefix ?? '발급 전'}</p>
            </td>
            <td className={`${td} max-w-[200px]`}>
              <p className="truncate text-gray-900">{k.owner?.name}</p>
              <p className="truncate text-[12px] text-gray-500">{k.owner?.email}</p>
            </td>
            <td className={`${td} max-w-[240px]`}>
              <p className="truncate">{(k.status === 'pending' ? k.requestedScopes : k.scopes).map((v) => scopeName(scopes.data ?? [], v)).join(', ')}</p>
            </td>
            <td className={td}>
              <StatusBadge status={k.status} />
            </td>
            <td className={td}>{full(k.callsToday)}</td>
            <td className={`${td} whitespace-nowrap`}>{dateOf(k.createdAt)}</td>
          </tr>
        )}
      </PagedTable>

      <div className="mt-8 mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-gray-900">호출량</h2>
        <Segmented
          label="기간"
          options={[
            [7, '7일'],
            [30, '30일'],
            [90, '90일'],
          ]}
          value={days}
          onChange={setDays}
        />
      </div>
      {s ? (
        <ApiUsageView usage={s.usage} />
      ) : summary.error ? (
        <Failed message={summary.error} onRetry={summary.reload} />
      ) : (
        <StatsLoading percent={summary.percent} />
      )}
      {opened && (
        <KeyPanel
          key={opened.id}
          apiKey={opened}
          scopes={scopes.data ?? []}
          close={() => setOpened(null)}
          changed={(next) => {
            setOpened(next)
            refresh()
          }}
        />
      )}
    </>
  )
}

const toLocal = (value: string | null) => (value ? value.slice(0, 16) : '')

/** 키 하나의 심사 칸이에요. 권한, 한도, 기간, 관리자 메모를 고치고 승인, 거절, 해지해요. */
function KeyPanel({ apiKey: k, scopes, close, changed }: { apiKey: ApiKeyView; scopes: { value: string; label: string }[]; close: () => void; changed: (next: ApiKeyView) => void }) {
  const [picked, setPicked] = useState<string[]>(k.status === 'pending' ? k.requestedScopes : k.scopes)
  const [perMinute, setPerMinute] = useState(String(k.perMinute))
  const [perDay, setPerDay] = useState(String(k.perDay))
  const [expiresAt, setExpiresAt] = useState(toLocal(k.expiresAt))
  const [note, setNote] = useState(k.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState<KeyStatus | null>(null)
  const [days, setDays] = useState<7 | 30>(30)
  const usage = useAdminData(() => manageRequest<ApiUsage>(`/admin/manage/api-keys/${k.id}/usage?days=${days}`), `${k.id}:${days}`, true)
  const closed = k.status === 'revoked'

  async function save(status?: KeyStatus) {
    if (busy) return
    if ((status === 'approved' || (!status && k.status === 'approved')) && !picked.length) {
      setError('권한을 하나 이상 골라 주세요.')
      return
    }
    setBusy(true)
    setError('')
    const result = await manageRequest<ApiKeyView>(`/admin/manage/api-keys/${k.id}`, 'PUT', {
      status,
      scopes: picked,
      perMinute: Number(perMinute),
      perDay: Number(perDay),
      expiresAt: expiresAt ? `${expiresAt}:00` : null,
      clearExpiry: !expiresAt,
      note,
    })
    setBusy(false)
    setAsking(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    track('admin_api_key_update', { status: status ?? 'save', scopes: picked.length })
    showToast(status === 'approved' ? '승인했어요.' : status === 'rejected' ? '거절했어요.' : status === 'revoked' ? '해지했어요.' : '저장했어요.')
    changed(result.data)
  }

  return (
    <>
      <SidePanel
        label={k.name}
        closeLabel="닫기"
        onClose={() => {
          if (!busy) close()
        }}
        dismissable={!busy}
        closeOnOutside={false}
        className="max-w-[640px]"
        header={
          <>
            <p className="text-[13px] text-gray-500">{k.owner?.email}</p>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              {k.name}
              <StatusBadge status={k.status} />
            </h2>
          </>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <InfoGrid
            wide
            rows={[
              ['요청자', k.owner?.name ?? ''],
              ['키', <span className="font-mono text-[12.5px]">{k.prefix ?? '발급 전'}</span>],
              ['요청', dateOf(k.createdAt)],
              ['마지막 호출', dateOf(k.lastUsedAt)],
            ]}
          />
          {k.reviewedBy && (
            <p className="mt-3 text-[12.5px] text-gray-500">
              {dateOf(k.reviewedAt)}에 {k.reviewedBy} 계정이 처리했어요
            </p>
          )}
          <section className="mt-6 rounded-2xl bg-gray-50 p-4">
            <h3 className={labelText}>사유</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-gray-800">{k.purpose}</p>
            {k.site && (
              <a href={k.site} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] break-all text-brand hover:text-brand-hover">
                {k.site}
              </a>
            )}
          </section>

          <fieldset className="mt-6" disabled={closed}>
            <legend className={`mb-2 ${labelText}`}>권한</legend>
            <ul className="space-y-2">
              {scopes.map((s) => (
                <li key={s.value} className="flex items-center gap-2">
                  <Checkbox checked={picked.includes(s.value)} onChange={(on) => setPicked((list) => (on ? [...list, s.value] : list.filter((v) => v !== s.value)))}>
                    <span className="text-gray-900">{s.label}</span>
                  </Checkbox>
                  {k.requestedScopes.includes(s.value) && <Badge tone="gray">요청함</Badge>}
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="block">
                <span className={`mb-1.5 block ${labelText}`}>1분 한도</span>
                <input type="number" min={1} max={10000} className={textFieldSm} value={perMinute} onChange={(e) => setPerMinute(e.target.value)} />
              </label>
              <label className="block">
                <span className={`mb-1.5 block ${labelText}`}>하루 한도</span>
                <input type="number" min={1} max={10000000} className={textFieldSm} value={perDay} onChange={(e) => setPerDay(e.target.value)} />
              </label>
            </div>
            <label className="mt-3 block">
              <span className={`mb-1.5 block ${labelText}`}>사용 기간 (비우면 제한 없음)</span>
              <input type="datetime-local" className={textFieldSm} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
            <label className="mt-3 block">
              <span className={`mb-1.5 block ${labelText}`}>요청자에게 보일 메모</span>
              <textarea className={textArea} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="거절 이유나 안내" />
            </label>
          </fieldset>
          <FormError className="mt-3">{error}</FormError>
          {!closed && (
            <div className="mt-5 flex flex-wrap gap-2">
              {k.status !== 'approved' && (
                <button type="button" className={primaryButton} disabled={busy} onClick={() => void save('approved')}>
                  승인
                </button>
              )}
              {k.status === 'pending' && (
                <button type="button" className={toolDangerButton} disabled={busy} onClick={() => setAsking('rejected')}>
                  거절
                </button>
              )}
              {k.status !== 'pending' && (
                <button type="button" className={k.status === 'approved' ? primaryButton : toolButton} disabled={busy} onClick={() => void save()}>
                  저장
                </button>
              )}
              {k.status === 'approved' && (
                <button type="button" className={toolDangerButton} disabled={busy} onClick={() => setAsking('revoked')}>
                  해지
                </button>
              )}
            </div>
          )}

          {k.status !== 'pending' && (
            <>
              <div className="mt-8 mb-3 flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-gray-900">호출량</h3>
                <Segmented
                  label="기간"
                  options={[
                    [7, '7일'],
                    [30, '30일'],
                  ]}
                  value={days}
                  onChange={setDays}
                />
              </div>
              {usage.data ? (
                <ApiUsageView usage={usage.data} compactView />
              ) : usage.error ? (
                <Failed message={usage.error} onRetry={usage.reload} />
              ) : (
                <LoadProgress percent={usage.percent} compact />
              )}
            </>
          )}
        </div>
      </SidePanel>
      {asking && (
        <ConfirmDialog
          title={asking === 'rejected' ? '요청을 거절할까요?' : '이 키를 해지할까요?'}
          body={asking === 'rejected' ? '메모에 적은 말이 요청자에게 보여요.' : '이 키로 부르는 요청이 바로 막히고, 다시 켤 수 없어요.'}
          confirm={asking === 'rejected' ? '거절' : '해지'}
          danger
          working={busy}
          onCancel={() => setAsking(null)}
          onConfirm={() => void save(asking)}
        />
      )}
    </>
  )
}
