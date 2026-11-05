import { useEffect, useId, useState } from 'react'
import { track } from '../lib/analytics'
import {
  MAX_KEYS,
  STATUS_NAMES,
  fetchKeyUsage,
  fetchMyKeys,
  fetchScopes,
  issueKey,
  requestKey,
  revokeKey,
  type ApiKeyView,
  type KeyStatus,
  type ScopeInfo,
} from '../lib/apiKeys'
import { useAuth } from '../lib/auth'
import { requestLogin } from '../lib/gap'
import { showToast } from '../lib/toast'
import { useAdminData } from './AdminParts'
import { ScrollPage, PageHeader } from './AppPage'
import { ApiDocs } from './ApiDocs'
import { ApiUsageView } from './ApiUsage'
import { ConfirmDialog, Modal } from './Dialog'
import { Failed, Notice } from './GapParts'
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
  toolButton,
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

/** 키 앞부분이에요. 발급 전이면 그 사정을 적어요. */
const prefixText = (k: ApiKeyView) => k.prefix ?? (k.status === 'approved' ? '발급 대기' : null)

type Tab = 'keys' | 'docs'

/** 내 API 키(/api-keys)예요. 키를 요청하고, 승인 상태와 호출량을 보고, 문서를 읽어요. */
export function ApiKeys() {
  const { me } = useAuth()
  const [tab, setTab] = useState<Tab>('keys')
  const [asking, setAsking] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const state = useAdminData(
    async () => {
      const [keys, scopes] = await Promise.all([fetchMyKeys(), fetchScopes()])
      if (!keys.ok) return keys
      if (!scopes.ok) return scopes
      return {
        ok: true as const,
        data: { keys: keys.data, scopes: scopes.data },
      }
    },
    me?.email ?? 'guest',
    true,
  )
  // 문서는 로그인하지 않아도 봐서 권한 이름을 따로 받아요.
  const publicScopes = useAdminData(() => fetchScopes(), 'scopes')
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
              새 API 키
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
        <ApiDocs scopes={publicScopes.data ?? state.data?.scopes ?? []} />
      ) : !me ? (
        <Notice className="mt-16" title="로그인하면 API 키를 요청할 수 있습니다" action="로그인" onAction={requestLogin} />
      ) : !state.data ? (
        state.error ? (
          <Failed message={state.error} onRetry={state.reload} className="mt-16" />
        ) : (
          <LoadProgress percent={state.percent} className={loadCenter} />
        )
      ) : opened ? (
        <KeyDetail apiKey={opened} onChanged={state.reload} />
      ) : !state.data.keys.length ? (
        <Notice className="mt-16" title="API 키가 발견되지 않음" action="새 API 키" onAction={() => setAsking(true)} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 @container lg:grid-cols-2">
          {state.data.keys.map((k, order) => (
            <li key={k.id} className="animate-rise" style={stagger(order)}>
              <button
                type="button"
                onClick={() => setOpenId(k.id)}
                className="block w-full rounded-2xl bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[15px] font-semibold text-gray-900">{k.name}</p>
                  <StatusBadge status={k.status} />
                </div>
                <p className={`mt-1 text-[12.5px] text-gray-500 ${k.prefix ? 'font-mono' : ''}`}>{prefixText(k)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(k.status === 'approved' ? k.scopes : k.requestedScopes).map((s) => (
                    <Badge key={s} tone="white">
                      {scopeName(state.data!.scopes, s)}
                    </Badge>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {asking && state.data && <RequestDialog scopes={state.data.scopes} onClose={() => setAsking(false)} onCreated={() => state.reload()} />}
    </ScrollPage>
  )
}

function KeyDetail({ apiKey: k, onChanged }: { apiKey: ApiKeyView; onChanged: () => void }) {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [confirm, setConfirm] = useState(false)
  const [working, setWorking] = useState(false)
  const [reissuing, setReissuing] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)
  const usage = useAdminData(() => fetchKeyUsage(k.id, days), `${k.id}:${days}`, true)
  const closed = k.status === 'rejected' || k.status === 'revoked'

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
    showToast(k.status === 'pending' ? '요청을 철회했습니다.' : '키를 해지했습니다.')
    onChanged()
  }

  async function issue() {
    const again = !!k.prefix
    setWorking(true)
    const result = await issueKey(k.id)
    setWorking(false)
    if (!result.ok) {
      showToast(result.message)
      return
    }
    setReissuing(false)
    track('api_key_issue', { reissue: again })
    setIssued(result.data.key)
    onChanged()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={k.status} />
        <span className={`text-[13px] text-gray-500 ${k.prefix ? 'font-mono' : ''}`}>{prefixText(k)}</span>
        <div className="ml-auto flex gap-2">
          {k.status === 'approved' &&
            (k.prefix ? (
              <button type="button" className={toolButton} onClick={() => setReissuing(true)}>
                재발급
              </button>
            ) : (
              <button type="button" className={primaryButton} disabled={working} onClick={() => void issue()}>
                {working ? '발급 중' : '키 발급'}
              </button>
            ))}
          {!closed && (
            <button type="button" className={toolDangerButton} onClick={() => setConfirm(true)}>
              {k.status === 'pending' ? '요청 철회' : '해지'}
            </button>
          )}
        </div>
      </div>
      {k.note && (
        <p className="mt-4 rounded-2xl bg-brand-soft p-4 text-[13.5px] leading-relaxed text-gray-800">
          <span className="mr-2 font-semibold text-brand-hover">관리자</span>
          {k.note}
        </p>
      )}
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
      {reissuing && (
        <ConfirmDialog
          title="키를 재발급하시겠습니까?"
          body="새 키를 발급하면 지금 쓰는 키는 바로 사용할 수 없습니다."
          confirm="재발급"
          working={working}
          onCancel={() => setReissuing(false)}
          onConfirm={() => void issue()}
        />
      )}
      {issued && <IssuedDialog apiKey={issued} onClose={() => setIssued(null)} />}
      {confirm && (
        <ConfirmDialog
          title={k.status === 'pending' ? '요청을 철회하시겠습니까?' : '이 키를 해지하시겠습니까?'}
          body={k.status === 'pending' ? '관리자에게 보낸 요청을 철회합니다.' : '이 키로 보내는 요청이 즉시 차단됩니다. 해지한 키는 다시 사용할 수 없습니다.'}
          confirm={k.status === 'pending' ? '철회' : '해지'}
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
  const ready = name.trim() && purpose.trim().length >= 10 && picked.length > 0

  useEffect(() => {
    track('api_key_request_open')
  }, [])

  async function submit() {
    if (!ready || working) return
    setWorking(true)
    setError('')
    const result = await requestKey({
      name: name.trim(),
      purpose: purpose.trim(),
      site: site.trim(),
      scopes: picked,
    })
    setWorking(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    track('api_key_request', { scopes: picked.length })
    showToast('요청을 보냈습니다. 승인되면 키를 발급받을 수 있습니다.')
    onCreated()
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} closeOnBackdrop={false} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6">
      <h2 id={titleId} className="text-[17px] font-semibold text-gray-900">
        새 API 키
      </h2>
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
          <legend className={`mb-2 ${labelText}`}>사용할 API</legend>
          <ul className="space-y-2.5">
            {scopes.map((s) => (
              <li key={s.value}>
                <Checkbox
                  checked={picked.includes(s.value)}
                  onChange={(on) => setPicked((list) => (on ? [...list, s.value] : list.filter((v) => v !== s.value)))}
                >
                  <span className="font-medium text-gray-900">{s.label}</span>
                </Checkbox>
                <p className="mt-0.5 pl-6 text-[12.5px] leading-relaxed text-gray-500">{s.description}</p>
              </li>
            ))}
          </ul>
        </fieldset>
        <label className="block">
          <span className={`mb-1.5 block ${labelText}`}>사유</span>
          <textarea
            className={textArea}
            rows={4}
            maxLength={2000}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="어떤 서비스에서 어떻게 사용할지 입력하십시오."
          />
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
            {working ? '요청 중' : '요청 보내기'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** 발급한 키를 한 번만 보여주는 창이에요. 닫으면 다시 볼 수 없어요. */
function IssuedDialog({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)

  async function copy() {
    const ok = await navigator.clipboard.writeText(apiKey).then(
      () => true,
      () => false,
    )
    if (!ok) showToast('복사하지 못했습니다.')
    else setCopied(true)
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} closeOnBackdrop={false} className="w-full max-w-lg p-6">
      <h2 id={titleId} className="text-[17px] font-semibold text-gray-900">
        키를 복사해 두십시오
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">이 창을 닫으면 키를 다시 볼 수 없습니다. 잃어버리면 재발급하십시오.</p>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3">
        <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all text-gray-900">{apiKey}</code>
        <button type="button" className={ghostButton} onClick={() => void copy()}>
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" className={primaryButton} onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  )
}
