import { useEffect, useId, useState } from 'react'
import { track } from '../lib/analytics'
import {
  ENDPOINTS,
  ERROR_DOCS,
  MAX_KEYS,
  PUBLIC_API_BASE,
  STATUS_NAMES,
  fetchKeyUsage,
  fetchMyKeys,
  fetchScopes,
  requestKey,
  revokeKey,
  type ApiKeyView,
  type KeyStatus,
  type ScopeInfo,
} from '../lib/apiKeys'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { requestLogin } from '../lib/gap'
import { showToast } from '../lib/toast'
import { full, useAdminData } from './AdminParts'
import { ScrollPage, PageHeader } from './AppPage'
import { ApiUsageView } from './ApiUsage'
import { ConfirmDialog, Modal } from './Dialog'
import { Failed, Notice, Panel } from './GapParts'
import {
  Badge,
  Checkbox,
  FormError,
  ghostButton,
  label as labelText,
  loadCenter,
  LoadProgress,
  primaryButton,
  quietButton,
  Segmented,
  stagger,
  Tabs,
  textArea,
  textFieldSm,
  toolDangerButton,
} from './ui'

const STATUS_TONES: Record<KeyStatus, 'gray' | 'brand' | 'red' | 'muted'> = {
  pending: 'gray',
  approved: 'brand',
  rejected: 'red',
  revoked: 'muted',
}

export function StatusBadge({ status }: { status: KeyStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_NAMES[status]}</Badge>
}

/** 권한 값(postings:read)을 이름(채용 공고)으로 바꿔요. */
export const scopeName = (scopes: ScopeInfo[], value: string) => scopes.find((s) => s.value === value)?.label ?? value

const dateOf = (value: string | null) => (value ? formatDateTime(value) : '없음')

type Tab = 'keys' | 'docs'

/** 내 API 키(/api-keys)예요. 키를 요청하고, 승인 상태와 호출량을 보고, 문서를 읽어요. */
export function ApiKeys() {
  const { me } = useAuth()
  const [tab, setTab] = useState<Tab>('keys')
  const [asking, setAsking] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const state = useAdminData(async () => {
    const [keys, scopes] = await Promise.all([fetchMyKeys(), fetchScopes()])
    if (!keys.ok) return keys
    if (!scopes.ok) return scopes
    return { ok: true as const, data: { keys: keys.data, scopes: scopes.data } }
  }, me?.email ?? 'guest', true)
  const opened = state.data?.keys.find((k) => k.id === openId) ?? null
  const active = state.data?.keys.filter((k) => k.status === 'pending' || k.status === 'approved').length ?? 0

  const header = (
    <>
      <PageHeader
        title={opened ? opened.name : 'API 키'}
        onBack={opened ? () => setOpenId(null) : undefined}
        actions={
          me && tab === 'keys' && !opened ? (
            <button type="button" className={primaryButton} disabled={active >= MAX_KEYS} onClick={() => setAsking(true)}>
              키 요청
            </button>
          ) : undefined
        }
      />
      {!opened && (
        <Tabs
          label="API 키 메뉴"
          items={[
            { key: 'keys', label: '내 키' },
            { key: 'docs', label: '문서' },
          ]}
          current={tab}
          onSelect={(next: Tab) => {
            setTab(next)
            track('api_keys_tab', { tab: next })
          }}
        />
      )}
    </>
  )

  return (
    <ScrollPage header={header}>
      {tab === 'docs' && !opened ? (
        <Docs scopes={state.data?.scopes ?? []} />
      ) : !me ? (
        <Notice className="mt-16" title="로그인하면 API 키를 요청할 수 있어요" action="로그인" onAction={requestLogin} />
      ) : !state.data ? (
        state.error ? (
          <Failed message={state.error} onRetry={state.reload} className="mt-16" />
        ) : (
          <LoadProgress percent={state.percent} className={loadCenter} />
        )
      ) : opened ? (
        <KeyDetail apiKey={opened} scopes={state.data.scopes} onChanged={state.reload} />
      ) : !state.data.keys.length ? (
        <Notice className="mt-16" title="아직 API 키가 없어요" body="쓸 API와 사유를 적어 요청하면 관리자가 확인한 뒤 열어 드려요." action="키 요청" onAction={() => setAsking(true)} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 @container lg:grid-cols-2">
          {state.data.keys.map((k, order) => (
            <li key={k.id} className="animate-rise" style={stagger(order)}>
              <button type="button" onClick={() => setOpenId(k.id)} className="block w-full rounded-2xl bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[15px] font-semibold text-gray-900">{k.name}</p>
                  <StatusBadge status={k.status} />
                </div>
                <p className="mt-1 font-mono text-[12.5px] text-gray-500">{k.prefix}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(k.status === 'approved' ? k.scopes : k.requestedScopes).map((s) => (
                    <Badge key={s} tone="white">
                      {scopeName(state.data!.scopes, s)}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-[12.5px] text-gray-500 tabular-nums">
                  {k.status === 'approved'
                    ? `오늘 ${full(k.callsToday)}번, 하루 ${full(k.perDay)}번까지`
                    : k.status === 'pending'
                      ? `${dateOf(k.createdAt)}에 요청했어요`
                      : dateOf(k.reviewedAt ?? k.createdAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {asking && state.data && (
        <RequestDialog
          scopes={state.data.scopes}
          onClose={() => setAsking(false)}
          onCreated={() => state.reload()}
        />
      )}
    </ScrollPage>
  )
}

function KeyDetail({ apiKey: k, scopes, onChanged }: { apiKey: ApiKeyView; scopes: ScopeInfo[]; onChanged: () => void }) {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [confirm, setConfirm] = useState(false)
  const [working, setWorking] = useState(false)
  const usage = useAdminData(() => fetchKeyUsage(k.id, days), `${k.id}:${days}`, true)
  const closed = k.status === 'rejected' || k.status === 'revoked'
  const narrowed = k.status === 'approved' && k.scopes.length < k.requestedScopes.length

  async function revoke() {
    setWorking(true)
    const result = await revokeKey(k.id)
    setWorking(false)
    if (!result.ok) {
      showToast(result.message)
      return
    }
    setConfirm(false)
    track('api_key_revoke', { status: k.status })
    showToast(k.status === 'pending' ? '요청을 거뒀어요.' : '키를 해지했어요.')
    onChanged()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={k.status} />
        <span className="font-mono text-[13px] text-gray-500">{k.prefix}</span>
        {!closed && (
          <button type="button" className={`${toolDangerButton} ml-auto`} onClick={() => setConfirm(true)}>
            {k.status === 'pending' ? '요청 거두기' : '해지'}
          </button>
        )}
      </div>
      {k.note && (
        <p className="mt-4 rounded-2xl bg-brand-soft p-4 text-[13.5px] leading-relaxed text-gray-800">
          <span className="mr-2 font-semibold text-brand-hover">관리자</span>
          {k.note}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-gray-50 p-4 text-[13px] sm:grid-cols-4 sm:p-5">
        {(
          [
            ['한도', `1분 ${full(k.perMinute)}번, 하루 ${full(k.perDay)}번`],
            ['기간', k.expiresAt ? `${dateOf(k.expiresAt)}까지` : '제한 없음'],
            ['요청', dateOf(k.createdAt)],
            ['마지막 호출', dateOf(k.lastUsedAt)],
          ] as const
        ).map(([name, value]) => (
          <div key={name}>
            <dt className="text-[12px] text-gray-400">{name}</dt>
            <dd className="mt-0.5 text-gray-900 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Panel className="mt-3" title="권한">
        <ul className="space-y-2">
          {(k.status === 'approved' ? k.scopes : k.requestedScopes).map((s) => (
            <li key={s} className="text-[13.5px]">
              <span className="font-medium text-gray-900">{scopeName(scopes, s)}</span>
              <span className="ml-2 font-mono text-[12px] text-gray-400">{s}</span>
            </li>
          ))}
        </ul>
        {narrowed && (
          <p className="mt-3 text-[12.5px] text-gray-500">
            승인되지 않은 권한: {k.requestedScopes.filter((s) => !k.scopes.includes(s)).map((s) => scopeName(scopes, s)).join(', ')}
          </p>
        )}
      </Panel>
      <Panel className="mt-3" title="사유">
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-gray-800">{k.purpose}</p>
        {k.site && (
          <a href={k.site} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] text-brand hover:text-brand-hover">
            {k.site}
          </a>
        )}
      </Panel>
      {k.status !== 'pending' && k.status !== 'rejected' && (
        <>
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
          {usage.data ? (
            <ApiUsageView usage={usage.data} />
          ) : usage.error ? (
            <Failed message={usage.error} onRetry={usage.reload} className="mt-8" />
          ) : (
            <LoadProgress percent={usage.percent} compact />
          )}
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={k.status === 'pending' ? '요청을 거둘까요?' : '이 키를 해지할까요?'}
          body={k.status === 'pending' ? '관리자에게 보낸 요청을 거둬요.' : '이 키로 부르는 요청은 바로 막혀요. 해지한 키는 다시 켤 수 없어요.'}
          confirm={k.status === 'pending' ? '거두기' : '해지'}
          danger
          working={working}
          onCancel={() => setConfirm(false)}
          onConfirm={() => void revoke()}
        />
      )}
    </>
  )
}

function RequestDialog({ scopes, onClose, onCreated }: { scopes: ScopeInfo[]; onClose: () => void; onCreated: () => void }) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [site, setSite] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const ready = name.trim() && purpose.trim().length >= 10 && picked.length > 0

  useEffect(() => {
    track('api_key_request_open')
  }, [])

  async function submit() {
    if (!ready || working) return
    setWorking(true)
    setError('')
    const result = await requestKey({ name: name.trim(), purpose: purpose.trim(), site: site.trim(), scopes: picked })
    setWorking(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    track('api_key_request', { scopes: picked.length })
    setCreated(result.data.key)
    onCreated()
  }

  async function copy() {
    if (!created) return
    const ok = await navigator.clipboard.writeText(created).then(
      () => true,
      () => false,
    )
    if (!ok) showToast('복사하지 못했어요.')
    else setCopied(true)
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} closeOnBackdrop={false} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6">
      <h2 id={titleId} className="text-[17px] font-semibold text-gray-900">
        {created ? '키를 복사해 두세요' : 'API 키 요청'}
      </h2>
      {created ? (
        <>
          <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">이 창을 닫으면 키를 다시 볼 수 없어요. 관리자가 승인하면 바로 쓸 수 있어요.</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3">
            <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all text-gray-900">{created}</code>
            <button type="button" className={ghostButton} onClick={() => void copy()}>
              {copied ? '복사했어요' : '복사'}
            </button>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" className={primaryButton} onClick={onClose}>
              닫기
            </button>
          </div>
        </>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label className="block">
            <span className={`mb-1.5 block ${labelText}`}>키 이름</span>
            <input className={textFieldSm} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 공고 알림 봇" autoFocus />
          </label>
          <fieldset>
            <legend className={`mb-2 ${labelText}`}>쓸 API</legend>
            <ul className="space-y-2.5">
              {scopes.map((s) => (
                <li key={s.value}>
                  <Checkbox checked={picked.includes(s.value)} onChange={(on) => setPicked((list) => (on ? [...list, s.value] : list.filter((v) => v !== s.value)))}>
                    <span className="font-medium text-gray-900">{s.label}</span>
                  </Checkbox>
                  <p className="mt-0.5 pl-6 text-[12.5px] leading-relaxed text-gray-500">{s.description}</p>
                </li>
              ))}
            </ul>
          </fieldset>
          <label className="block">
            <span className={`mb-1.5 block ${labelText}`}>사유</span>
            <textarea className={textArea} rows={4} maxLength={2000} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="어떤 서비스에서 어떻게 쓰려는지 적어 주세요." />
          </label>
          <label className="block">
            <span className={`mb-1.5 block ${labelText}`}>서비스 주소 (선택)</span>
            <input className={textFieldSm} type="url" maxLength={500} value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" />
          </label>
          <FormError>{error}</FormError>
          <div className="flex justify-end gap-2">
            <button type="button" className={quietButton} onClick={onClose}>
              취소
            </button>
            <button type="submit" className={primaryButton} disabled={!ready || working}>
              {working ? '보내고 있어요' : '요청 보내기'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function Docs({ scopes }: { scopes: ScopeInfo[] }) {
  const example = `curl "${PUBLIC_API_BASE}/postings?family=backend&size=5" \\\n  -H "X-API-Key: jvd_..."`
  return (
    <div className="max-w-3xl space-y-3">
      <Panel title="시작하기">
        <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-gray-800">
          <li>내 키에서 쓸 API를 골라 키를 요청해요.</li>
          <li>관리자가 승인하면 요청에 X-API-Key 헤더로 키를 넣어 불러요.</li>
          <li>응답은 늘 {'{ data, error: { code, message } }'} 모양이에요. 시각은 한국 시각이에요.</li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 font-mono text-[12px] leading-relaxed text-gray-800">{example}</pre>
        <p className="mt-3 text-[12.5px] leading-relaxed text-gray-500">
          키마다 1분과 하루(한국 시각) 호출 한도가 있고, 응답 헤더 X-RateLimit-Remaining에 오늘 남은 수를 적어요. 키는 서버에서만 쓰고 브라우저 코드에 넣지 마세요.
        </p>
      </Panel>
      <Panel title="API">
        <p className="mb-3 font-mono text-[12.5px] break-all text-gray-500">{PUBLIC_API_BASE}</p>
        <ul className="divide-y divide-gray-200/60">
          {ENDPOINTS.map((e) => (
            <li key={e.path} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="white">GET</Badge>
                <code className="font-mono text-[13px] font-medium text-gray-900">{e.path}</code>
                <span className="ml-auto text-[12px] text-gray-400">{scopeName(scopes, e.scope)}</span>
              </div>
              <p className="mt-1.5 text-[13px] text-gray-600">{e.summary}</p>
              {e.params.length > 0 && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12.5px]">
                  {e.params.map(([key, desc]) => (
                    <div key={key} className="contents">
                      <dt className="font-mono text-gray-900">{key}</dt>
                      <dd className="text-gray-500">{desc}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="오류">
        <dl className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px] tabular-nums">
          {ERROR_DOCS.map(([status, code, desc]) => (
            <div key={code} className="contents">
              <dt className="text-gray-500">{status}</dt>
              <dd className="font-mono text-gray-900">{code}</dd>
              <dd className="text-gray-600">{desc}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  )
}
