import { useEffect, useId, useState, type ReactNode, type FormEvent } from 'react'
import {
  getManage,
  listManage,
  updateManage,
  manageRequest,
  type AiGroup,
  type AiTotals,
  type AiUsage,
  type Overview,
  type Member,
  type MemberDetail,
  type Posting,
  type Business,
  type Call,
  type CallDetail,
  type Source,
} from '../lib/adminManage'
import type { Result } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { showToast } from '../lib/toast'
import type { AdminTab } from './Admin'
import {
  BarChart,
  card,
  compact,
  Empty,
  Failed,
  full,
  InfoGrid,
  openableRow,
  PagedTable,
  PanelContent,
  SearchBox,
  Stat,
  StatsLoading,
  tableRow,
  td,
  th,
  useAdminData,
  useDebounced,
  usePaged,
  type Bar,
} from './AdminParts'
import { ConfirmDialog, Modal, SidePanel } from './Dialog'
import { Dropdown } from './Dropdown'
import { Panel, Tip } from './GapParts'
import { RefreshIcon } from './Icons'
import {
  Badge,
  Checkbox,
  FormError,
  ghostButton,
  ghostDangerButton,
  iconButton,
  label as labelText,
  loadCenter,
  LoadProgress,
  primaryButton,
  quietButton,
  dangerButton,
  Segmented,
  textArea,
  textFieldSm,
  toolButton,
  toolDangerButton,
} from './ui'

const date = (value: string | null) => (value ? formatDateTime(value) : '없음')
const pathId = (id: string | number) => encodeURIComponent(id)

/** 달러는 1센트 아래면 네 자리까지 적어요. */
export function usd(value: number) {
  if (value === 0) return '$0'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const krw = (value: number, rate: number) => `${Math.round(value * rate).toLocaleString('ko-KR')}원`
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`
const rate = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%')

function useMutation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{
    title: string
    body: string
    run: () => Promise<Result<null>>
    after: () => void
    done?: string
  } | null>(null)
  async function execute(run: () => Promise<Result<null>>, after: () => void, done = '저장했어요.') {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await run()
      if (!result.ok) {
        setError(result.message)
        return
      }
      setPending(null)
      after()
      showToast(done)
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    execute,
    ask: (title: string, body: string, run: () => Promise<Result<null>>, after: () => void, done?: string) => {
      setError('')
      setPending({ title, body, run, after, done })
    },
    notice: <FormError className="mt-3">{!pending && error}</FormError>,
    dialog: pending && (
      <ConfirmDialog
        title={pending.title}
        body={
          <>
            {pending.body}
            {error && <span className="mt-2 block text-red-500">{error}</span>}
          </>
        }
        confirm="확인"
        working={busy}
        onCancel={() => {
          if (!busy) setPending(null)
        }}
        onConfirm={() => void execute(pending.run, pending.after, pending.done)}
      />
    ),
  }
}

/** 탭 맨 위의 거르는 줄이에요. 오른쪽 끝에 새로고침 아이콘을 둬요. */
function Toolbar({ children, refresh }: { children?: ReactNode; refresh: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <button type="button" aria-label="새로고침" title="새로고침" className={`${iconButton.md} ml-auto size-10`} onClick={refresh}>
        <RefreshIcon />
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={`mb-1.5 block ${labelText}`}>{label}</span>
      {children}
    </label>
  )
}

/** 거르는 줄과 수정 칸이 같이 쓰는 고르기 메뉴예요. */
function Pick({
  label,
  value,
  options,
  onChange,
  active = false,
}: {
  label?: string
  value: string
  options: [string, string][]
  onChange: (value: string) => void
  active?: boolean
}) {
  return (
    <Dropdown
      label={label}
      value={options.find(([key]) => key === value)?.[1]}
      active={active}
      groups={[{ items: options.map(([key, name]) => ({ label: name, checked: key === value, onSelect: () => onChange(key) })) }]}
    />
  )
}

function Head({ columns }: { columns: string[] }) {
  return (
    <>
      {columns.map((t) => (
        <th key={t} className={th}>
          {t}
        </th>
      ))}
    </>
  )
}

function EditPanel({ title, close, busy = false, children }: { title: string; close: () => void; busy?: boolean; children: ReactNode }) {
  return (
    <SidePanel
      label={title}
      closeLabel="닫기"
      onClose={() => {
        if (!busy) close()
      }}
      dismissable={!busy}
      closeOnOutside={false}
      className="max-w-[560px]"
      header={<h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
    >
      {children}
    </SidePanel>
  )
}

// ── 운영 현황 ─────────────────────────────────────────

export function ManagementOverview({ onTab }: { onTab: (tab: AdminTab) => void }) {
  const state = useAdminData(async (onLoad) => {
    const [overview, usage] = await Promise.all([
      manageRequest<Overview>('/admin/manage/overview'),
      manageRequest<AiUsage>('/admin/manage/ai-usage?days=30'),
    ])
    onLoad(1)
    if (!overview.ok) return overview
    return { ok: true as const, data: { o: overview.data, usage: usage.ok ? usage.data : null } }
  }, 'overview')
  if (!state.data)
    return state.error ? <Failed message={state.error} onRetry={state.reload} /> : <LoadProgress percent={state.percent} className={loadCenter} />
  const { o, usage } = state.data
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-gray-900">서비스</h2>
        <button type="button" aria-label="새로고침" title="새로고침" className={`${iconButton.md} size-10`} onClick={state.reload}>
          <RefreshIcon />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="회원" value={full(o.users)} note={`관리자 ${full(o.admins)}명`} />
        <Stat label="공개 공고" value={full(o.openPostings)} note={`전체 ${full(o.postings)}개`} />
        <Stat label="진단 리포트" value={full(o.reports)} note={`이력서 ${full(o.resumes)}개`} />
        <Stat label="기업" value={full(o.companies)} note={`글 ${full(o.blogs)}개, 공모전 ${full(o.contests)}개`} />
      </dl>
      {usage && (
        <>
          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-gray-900">AI, 최근 30일</h2>
            <button type="button" className={ghostButton} onClick={() => onTab('ai')}>
              자세히
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="비용" value={usd(usage.total.cost)} note={`약 ${krw(usage.total.cost, usage.krwPerUsd)}`} />
            <Stat label="호출" value={full(usage.total.calls)} note={`실패 ${full(usage.total.failures)}번`} />
            <Stat label="토큰" value={compact(usage.total.inputTokens + usage.total.outputTokens)} note={`입력 ${compact(usage.total.inputTokens)}, 출력 ${compact(usage.total.outputTokens)}`} />
            <Stat label="전체 기간 호출" value={full(o.aiCalls)} note={`실패 ${full(o.aiFailures)}번`} />
          </dl>
        </>
      )}
    </>
  )
}

// ── 회원 ──────────────────────────────────────────────

export function ManagementUsers() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [selected, setSelected] = useState<Member | null>(null)
  const keyword = useDebounced(query)
  const list = usePaged((page) => listManage<Member>('/users', keyword, { role, status }, page), `${keyword}:${role}:${status}`)
  return (
    <>
      <Toolbar refresh={list.refresh}>
        <SearchBox value={query} onChange={setQuery} placeholder="이름이나 이메일" />
        <Pick
          value={role}
          onChange={setRole}
          active={role !== 'ALL'}
          options={[
            ['ALL', '전체 회원'],
            ['USER', '일반 회원'],
            ['ADMIN', '관리자'],
          ]}
        />
        <Pick
          value={status}
          onChange={setStatus}
          active={status !== 'ALL'}
          options={[
            ['ALL', '전체 상태'],
            ['ACTIVE', '이용 중'],
            ['SUSPENDED', '정지'],
          ]}
        />
      </Toolbar>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable list={list} empty="조건에 맞는 회원이 없어요." head={<Head columns={['회원', '권한', '상태', '가입일']} />}>
        {(u) => (
          <tr key={u.id} className={openableRow(selected?.id === u.id)} onClick={() => setSelected(u)}>
            <td className={td}>
              <p className="font-medium text-gray-900">{u.name}</p>
              <p className="text-[12px] text-gray-500">{u.email}</p>
            </td>
            <td className={td}>{u.role === 'ADMIN' ? <Badge tone="brand">관리자</Badge> : <Badge tone="white">일반</Badge>}</td>
            <td className={td}>
              {u.suspendedAt ? <Badge tone="red">정지</Badge> : u.passwordChangeRequired ? <Badge tone="amber">비밀번호 변경 대기</Badge> : <Badge tone="white">이용 중</Badge>}
            </td>
            <td className={`${td} whitespace-nowrap`}>{date(u.registeredAt)}</td>
          </tr>
        )}
      </PagedTable>
      {selected && <MemberPanel key={selected.id} member={selected} close={() => setSelected(null)} changed={list.refresh} />}
    </>
  )
}

function MemberPanel({ member, close, changed }: { member: Member; close: () => void; changed: () => void }) {
  const { me } = useAuth()
  const state = useAdminData(() => getManage<MemberDetail>(`/users/${member.id}`), member.id, true)
  const mutation = useMutation()
  const [tempPassword, setTempPassword] = useState('')
  /** 정지 사유를 적는 창이 떠 있는지 */
  const [suspending, setSuspending] = useState(false)
  const self = member.id === me?.id
  const reload = () => {
    state.reload()
    changed()
  }
  async function resetPassword(id: number): Promise<Result<null>> {
    const result = await manageRequest<{ password: string }>(`/admin/manage/users/${id}/password`, 'POST')
    if (!result.ok) return result
    setTempPassword(result.data.password)
    return { ok: true, data: null }
  }
  return (
    <>
      <EditPanel title={member.name} close={close} busy={mutation.busy}>
        <PanelContent state={state}>
          {({ user, sessions, logins }) => (
            <>
              <InfoGrid
                rows={[
                  ['이메일', user.email],
                  ['권한', user.role === 'ADMIN' ? '관리자' : '일반 회원'],
                  ['가입일', date(user.registeredAt)],
                  ['로그인 기기', `${sessions.length}개`],
                  ['상태', user.suspendedAt ? `정지 (${date(user.suspendedAt)})` : user.passwordChangeRequired ? '비밀번호 변경 대기' : '이용 중'],
                  ...(user.suspendedAt && user.suspendReason ? [['정지 사유', user.suspendReason] as [string, string]] : []),
                ]}
              />
              {!self && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={mutation.busy}
                    className={toolButton}
                    onClick={() =>
                      mutation.ask(
                        '권한을 바꿀까요?',
                        `${user.name} 님을 ${user.role === 'ADMIN' ? '일반 회원으로' : '관리자로'} 바꾸고 모든 기기에서 로그아웃해요.`,
                        () => updateManage(`/users/${user.id}/role`, 'PATCH', { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' }),
                        reload,
                      )
                    }
                  >
                    {user.role === 'ADMIN' ? '일반 회원으로' : '관리자로 지정'}
                  </button>
                  <button
                    type="button"
                    disabled={mutation.busy || !sessions.length}
                    className={toolDangerButton}
                    onClick={() =>
                      mutation.ask(
                        '모든 기기에서 로그아웃할까요?',
                        '이 회원은 모든 기기에서 다시 로그인해야 해요.',
                        () => updateManage(`/users/${user.id}/sessions`, 'DELETE'),
                        reload,
                      )
                    }
                  >
                    모든 기기 로그아웃
                  </button>
                  {!user.socialOnly && (
                    <button
                      type="button"
                      disabled={mutation.busy}
                      className={toolDangerButton}
                      onClick={() =>
                        mutation.ask(
                          '비밀번호를 초기화할까요?',
                          `${user.name} 님의 비밀번호를 임시 비밀번호로 바꾸고 모든 기기에서 로그아웃해요. 지금 비밀번호로는 더 이상 로그인할 수 없어요.`,
                          () => resetPassword(user.id),
                          reload,
                          '비밀번호를 초기화했어요.',
                        )
                      }
                    >
                      비밀번호 초기화
                    </button>
                  )}
                  {user.suspendedAt ? (
                    <button
                      type="button"
                      disabled={mutation.busy}
                      className={toolButton}
                      onClick={() =>
                        mutation.ask(
                          '이용 정지를 풀까요?',
                          `${user.name} 님이 다시 로그인해서 서비스를 쓸 수 있어요.`,
                          () => updateManage(`/users/${user.id}/suspension`, 'PATCH', { suspended: false }),
                          reload,
                          '이용 정지를 풀었어요.',
                        )
                      }
                    >
                      정지 해제
                    </button>
                  ) : (
                    <button type="button" disabled={mutation.busy} className={toolDangerButton} onClick={() => setSuspending(true)}>
                      이용 정지
                    </button>
                  )}
                </div>
              )}
              {mutation.notice}
              <h3 className="mt-8 text-[14px] font-semibold text-gray-900">로그인 중인 기기</h3>
              {!sessions.length && <p className="mt-3 text-[13px] text-gray-500">없어요.</p>}
              <ul className="mt-2">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-gray-900">{s.name || '알 수 없는 기기'}</p>
                      <p className="text-[12px] text-gray-500 tabular-nums">
                        {s.ipAddress || '주소 없음'}, {date(s.lastUsedAt)}
                      </p>
                    </div>
                    {!self && (
                      <button
                        type="button"
                        disabled={mutation.busy}
                        className={ghostDangerButton}
                        onClick={() =>
                          mutation.ask(
                            '이 기기에서 로그아웃할까요?',
                            s.name || '고른 기기의 로그인을 풀어요.',
                            () => updateManage(`/users/${user.id}/sessions/${pathId(s.id)}`, 'DELETE'),
                            reload,
                          )
                        }
                      >
                        로그아웃
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <h3 className="mt-8 text-[14px] font-semibold text-gray-900">최근 로그인</h3>
              {!logins.length && <p className="mt-3 text-[13px] text-gray-500">없어요.</p>}
              <ul className="mt-2">
                {logins.map((l) => (
                  <li key={l.id} className="border-b border-gray-100 py-3 last:border-0">
                    <p className="truncate text-[13.5px] text-gray-900">{l.deviceName || '알 수 없는 기기'}</p>
                    <p className="text-[12px] text-gray-500 tabular-nums">
                      {l.ipAddress || '주소 없음'}, {date(l.loggedInAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </PanelContent>
      </EditPanel>
      {mutation.dialog}
      {tempPassword && <TempPasswordDialog password={tempPassword} onClose={() => setTempPassword('')} />}
      {suspending && (
        <SuspendDialog
          name={member.name}
          working={mutation.busy}
          onCancel={() => setSuspending(false)}
          onConfirm={(reason) =>
            void mutation.execute(
              () => updateManage(`/users/${member.id}/suspension`, 'PATCH', { suspended: true, reason }),
              () => {
                setSuspending(false)
                reload()
              },
              '이용을 정지했어요.',
            )
          }
        />
      )}
    </>
  )
}

/** 이용 정지를 묻는 창이에요. 사유는 적지 않아도 되고, 회원에게는 보이지 않아요. */
function SuspendDialog({ name, working, onCancel, onConfirm }: { name: string; working: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const titleId = useId()
  const [reason, setReason] = useState('')
  return (
    <Modal onClose={onCancel} labelledBy={titleId} alert className="w-full max-w-sm p-5">
      <h2 id={titleId} className="text-[15px] font-semibold text-gray-900">
        이용을 정지할까요?
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
        {name} 님을 모든 기기에서 로그아웃하고, 정지를 풀 때까지 로그인할 수 없게 해요.
      </p>
      <label className="mt-4 block">
        <span className={labelText}>사유 (선택)</span>
        <input
          value={reason}
          maxLength={200}
          onChange={(event) => setReason(event.target.value)}
          placeholder="관리자만 볼 수 있어요"
          className={`mt-1.5 ${textFieldSm}`}
        />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={quietButton}>
          취소
        </button>
        <button type="button" disabled={working} onClick={() => onConfirm(reason.trim())} className={dangerButton}>
          {working ? '처리 중' : '정지하기'}
        </button>
      </div>
    </Modal>
  )
}

/** 초기화한 임시 비밀번호를 한 번만 보여줘요. 닫으면 다시 볼 수 없어요. */
function TempPasswordDialog({ password, onClose }: { password: string; onClose: () => void }) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  async function copy() {
    const ok = await navigator.clipboard.writeText(password).then(
      () => true,
      () => false,
    )
    if (ok) setCopied(true)
    else showToast('복사하지 못했어요.')
  }
  return (
    <Modal onClose={onClose} labelledBy={titleId} closeOnBackdrop={false} className="w-full max-w-md p-6">
      <h2 id={titleId} className="text-[17px] font-semibold text-gray-900">
        임시 비밀번호를 전달해 주세요
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
        이 창을 닫으면 다시 볼 수 없어요. 회원은 이 비밀번호로 다시 로그인해요.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3">
        <code className="min-w-0 flex-1 font-mono text-[15px] tracking-wide break-all text-gray-900">{password}</code>
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

// ── 채용공고 ──────────────────────────────────────────

const families: [string, string][] = [
  ['backend', '백엔드'],
  ['frontend', '프론트엔드'],
  ['mobile', '모바일'],
  ['data', '데이터'],
  ['devops', 'DevOps'],
  ['other', '기타'],
]
const careers: [string, string][] = [
  ['entry', '신입'],
  ['junior', '주니어'],
  ['any', '경력 무관'],
]
const categories: [string, string][] = [
  ['', '미분류'],
  ['service', '자체 서비스'],
  ['saas', 'B2B SaaS'],
  ['commerce', '커머스'],
  ['finance', '핀테크와 금융'],
  ['ai', 'AI와 데이터'],
  ['it-service', 'IT 서비스와 SI'],
  ['manufacturing', '제조와 산업'],
  ['public', '공공기관'],
  ['other', '기타'],
]
const nameOf = (options: [string, string][], key: string) => options.find(([k]) => k === key)?.[1] ?? key

export function ManagementPostings() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selected, setSelected] = useState<Posting | null>(null)
  const keyword = useDebounced(query)
  const list = usePaged((page) => listManage<Posting>('/postings', keyword, { status }, page), `${keyword}:${status}`)
  return (
    <>
      <Toolbar refresh={list.refresh}>
        <SearchBox value={query} onChange={setQuery} placeholder="공고 제목이나 기업" />
        <Pick
          value={status}
          onChange={setStatus}
          active={status !== 'ALL'}
          options={[
            ['ALL', '전체 공고'],
            ['OPEN', '공개'],
            ['CLOSED', '내림'],
          ]}
        />
      </Toolbar>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable list={list} empty="조건에 맞는 공고가 없어요." head={<Head columns={['공고', '직군', '경력', '마감', '상태']} />}>
        {(p) => (
          <tr key={p.id} className={openableRow(selected?.id === p.id)} onClick={() => setSelected(p)}>
            <td className={`${td} max-w-[360px]`}>
              <p className="text-[12px] text-gray-500">{p.company}</p>
              <p className="truncate font-medium text-gray-900">{p.title}</p>
            </td>
            <td className={`${td} whitespace-nowrap`}>{nameOf(families, p.family)}</td>
            <td className={`${td} whitespace-nowrap`}>{nameOf(careers, p.career)}</td>
            <td className={`${td} whitespace-nowrap`}>{p.deadline ? date(p.deadline) : '상시'}</td>
            <td className={td}>{p.closedAt ? <Badge tone="gray">내림</Badge> : <Badge tone="brand">공개</Badge>}</td>
          </tr>
        )}
      </PagedTable>
      {selected && <PostingPanel key={selected.id} posting={selected} close={() => setSelected(null)} changed={list.refresh} />}
    </>
  )
}

function PostingPanel({ posting, close, changed }: { posting: Posting; close: () => void; changed: () => void }) {
  const [draft, setDraft] = useState({
    ...posting,
    deadline: posting.deadline?.slice(0, 16) ?? '',
    required: posting.required.join(', '),
    preferred: posting.preferred.join(', '),
    closed: !!posting.closedAt,
  })
  const mutation = useMutation()
  const set = (key: keyof typeof draft, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }))
  const save = (e: FormEvent) => {
    e.preventDefault()
    const split = (value: string) => [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))]
    void mutation.execute(
      () =>
        updateManage(`/postings/${pathId(posting.id)}`, 'PUT', {
          ...draft,
          deadline: draft.deadline ? `${draft.deadline}:00` : null,
          required: split(draft.required),
          preferred: split(draft.preferred),
        }),
      () => {
        changed()
        close()
      },
    )
  }
  return (
    <EditPanel title={posting.company} close={close} busy={mutation.busy}>
      <form onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
        <Field label="제목">
          <input required maxLength={255} className={textFieldSm} value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <div className="flex gap-4">
          <Field label="직군">
            <Pick value={draft.family} options={families} onChange={(v) => set('family', v)} />
          </Field>
          <Field label="경력">
            <Pick value={draft.career} options={careers} onChange={(v) => set('career', v)} />
          </Field>
        </div>
        <Field label="지역">
          <input required maxLength={100} className={textFieldSm} value={draft.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="마감 (비우면 상시)">
          <input type="datetime-local" className={textFieldSm} value={draft.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </Field>
        <Field label="필수 역량">
          <input className={textFieldSm} value={draft.required} onChange={(e) => set('required', e.target.value)} placeholder="쉼표로 나눠요" />
        </Field>
        <Field label="우대 역량">
          <input className={textFieldSm} value={draft.preferred} onChange={(e) => set('preferred', e.target.value)} placeholder="쉼표로 나눠요" />
        </Field>
        <Field label="요약">
          <textarea required rows={5} maxLength={1000} className={textArea} value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
        </Field>
        <Field label="원문 주소">
          <input required type="url" maxLength={1000} className={textFieldSm} value={draft.url} onChange={(e) => set('url', e.target.value)} />
        </Field>
        <Checkbox checked={draft.closed} onChange={(v) => set('closed', v)}>
          공고 내리기
        </Checkbox>
        {mutation.notice}
        <div>
          <button disabled={mutation.busy} className={primaryButton}>
            {mutation.busy ? '저장하고 있어요' : '저장'}
          </button>
        </div>
      </form>
    </EditPanel>
  )
}

// ── 기업 ──────────────────────────────────────────────

export function ManagementCompanies() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Business | null>(null)
  const keyword = useDebounced(query)
  const list = usePaged((page) => listManage<Business>('/companies', keyword, {}, page), keyword)
  return (
    <>
      <Toolbar refresh={list.refresh}>
        <SearchBox value={query} onChange={setQuery} placeholder="기업 이름" />
      </Toolbar>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable list={list} empty="조건에 맞는 기업이 없어요." head={<Head columns={['기업', '업종', '분류', '노출 순서']} />}>
        {(c) => (
          <tr key={c.id} className={openableRow(selected?.id === c.id)} onClick={() => setSelected(c)}>
            <td className={td}>
              <p className="font-medium text-gray-900">{c.name}</p>
              <p className="text-[12px] text-gray-500">{c.id}</p>
            </td>
            <td className={`${td} max-w-[240px] truncate`}>{c.industry}</td>
            <td className={`${td} whitespace-nowrap`}>{nameOf(categories, c.category ?? '')}</td>
            <td className={td}>{c.displayOrder < 1000 ? c.displayOrder : <Badge tone="gray">숨김</Badge>}</td>
          </tr>
        )}
      </PagedTable>
      {selected && <CompanyPanel key={selected.id} company={selected} close={() => setSelected(null)} changed={list.refresh} />}
    </>
  )
}

function CompanyPanel({ company, close, changed }: { company: Business; close: () => void; changed: () => void }) {
  const [draft, setDraft] = useState({ ...company, techBlog: company.techBlog ?? '', category: company.category ?? '' })
  const mutation = useMutation()
  const set = (key: keyof typeof draft, value: string | number) => setDraft((d) => ({ ...d, [key]: value }))
  return (
    <EditPanel title={company.name} close={close} busy={mutation.busy}>
      <form
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6"
        onSubmit={(e) => {
          e.preventDefault()
          void mutation.execute(
            () =>
              updateManage(`/companies/${pathId(company.id)}`, 'PUT', {
                ...draft,
                category: draft.category || null,
                techBlog: draft.techBlog || null,
              }),
            () => {
              changed()
              close()
            },
          )
        }}
      >
        {(
          [
            ['name', '이름', 255],
            ['initial', '로고 대신 쓰는 글자', 10],
            ['industry', '업종', 255],
            ['site', '홈페이지', 500],
            ['techBlog', '기술 블로그', 500],
          ] as const
        ).map(([key, name, max]) => (
          <Field key={key} label={name}>
            <input
              required={key !== 'techBlog'}
              type={key === 'site' || key === 'techBlog' ? 'url' : 'text'}
              maxLength={max}
              className={textFieldSm}
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </Field>
        ))}
        <Field label="분류">
          <Pick value={draft.category} options={categories} onChange={(v) => set('category', v)} />
        </Field>
        <Field label="노출 순서 (1000 이상은 숨김)">
          <input
            required
            type="number"
            min={0}
            step={1}
            max={2147483647}
            className={textFieldSm}
            value={draft.displayOrder}
            onChange={(e) => set('displayOrder', Number(e.target.value))}
          />
        </Field>
        {mutation.notice}
        <div>
          <button disabled={mutation.busy} className={primaryButton}>
            {mutation.busy ? '저장하고 있어요' : '저장'}
          </button>
        </div>
      </form>
    </EditPanel>
  )
}

// ── 데이터 수집 ───────────────────────────────────────

const targets: [string, string][] = [
  ['all', '전체'],
  ['postings', '채용공고'],
  ['blogs', '블로그'],
  ['contests', '공모전'],
]

export function ManagementCrawl() {
  const state = useAdminData(
    async () => {
      const [sources, status] = await Promise.all([
        manageRequest<Source[]>('/admin/crawl/sources'),
        manageRequest<{ running: boolean }>('/admin/crawl/status'),
      ])
      if (!sources.ok) return sources
      if (!status.ok) return status
      return { ok: true as const, data: { sources: sources.data, running: status.data.running } }
    },
    'sources',
    true,
  )
  const { reload } = state
  useEffect(() => {
    if (!state.data?.running) return
    const timer = window.setInterval(reload, 5000)
    return () => window.clearInterval(timer)
  }, [state.data?.running, reload])
  const mutation = useMutation()
  const [target, setTarget] = useState('all')
  const running = !!state.data?.running
  return (
    <>
      <Toolbar refresh={state.reload}>
        <Pick label="대상" value={target} onChange={setTarget} options={targets} />
        <button
          type="button"
          disabled={mutation.busy || running}
          className={primaryButton}
          onClick={() =>
            mutation.ask(
              `${nameOf(targets, target)} 수집을 시작할까요?`,
              '외부 사이트를 읽고 새 자료를 모아요. AI 요약 비용이 들 수 있어요.',
              () => manageRequest<null>(`/admin/crawl?target=${target}`, 'POST'),
              state.reload,
            )
          }
        >
          {running ? '수집하고 있어요' : '지금 수집'}
        </button>
      </Toolbar>
      {mutation.notice}
      {!state.data ? (
        state.error ? (
          <Failed message={state.error} onRetry={state.reload} />
        ) : (
          <LoadProgress percent={state.percent} className={loadCenter} />
        )
      ) : (
        <>
          {state.error && <Failed message={state.error} onRetry={state.reload} />}
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="수집처" value={full(state.data.sources.length)} />
            <Stat label="켜짐" value={full(state.data.sources.filter((s) => s.enabled).length)} />
            <Stat label="최근 오류" value={full(state.data.sources.filter((s) => s.lastError).length)} />
          </dl>
          {!state.data.sources.length ? (
            <Empty>수집처가 없어요.</Empty>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl bg-gray-50">
              <table className="w-full min-w-[760px] text-[13px] text-gray-700 tabular-nums">
                <thead>
                  <tr>
                    <Head columns={['수집처', '최근 실행', '새 자료', '상태', '']} />
                  </tr>
                </thead>
                <tbody>
                  {state.data.sources.map((s) => (
                    <tr key={s.id} className={`${tableRow} align-top`}>
                      <td className={`${td} max-w-[360px]`}>
                        <p className="font-medium text-gray-900">
                          {s.companyId} <span className="font-normal text-gray-500">{s.kind}</span>
                        </p>
                        <p className="truncate text-[12px] text-gray-500" title={s.target ?? undefined}>
                          {s.target || '기본 주소'}
                        </p>
                        {s.lastError && <p className="mt-1 text-[12px] leading-relaxed break-words text-red-500">{s.lastError}</p>}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{date(s.lastRunAt)}</td>
                      <td className={td}>{full(s.lastAdded)}개</td>
                      <td className={td}>{s.enabled ? <Badge tone="brand">켜짐</Badge> : <Badge tone="gray">꺼짐</Badge>}</td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          disabled={mutation.busy}
                          className={s.enabled ? ghostDangerButton : ghostButton}
                          onClick={() =>
                            mutation.ask(
                              s.enabled ? '이 수집처를 끌까요?' : '이 수집처를 켤까요?',
                              '다음 수집부터 적용돼요.',
                              () => updateManage(`/sources/${s.id}`, 'PATCH', { enabled: !s.enabled }),
                              state.reload,
                            )
                          }
                        >
                          {s.enabled ? '끄기' : '켜기'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {mutation.dialog}
    </>
  )
}

// ── AI 사용량 ─────────────────────────────────────────

type Period = 7 | 30 | 90 | 365 | 0
const periods: [Period, string][] = [
  [7, '7일'],
  [30, '30일'],
  [90, '90일'],
  [365, '1년'],
  [0, '전체'],
]
type Metric = 'cost' | 'calls' | 'tokens'
const metrics: [Metric, string][] = [
  ['cost', '비용'],
  ['calls', '호출'],
  ['tokens', '토큰'],
]

/** 서버가 남기는 용도 이름을 화면 말로 바꿔요. 모르는 값은 그대로 적어요. */
const PURPOSES: Record<string, string> = {
  resume: '이력서 읽기',
  report: '진단 리포트',
  review: '서류 검증',
  questions: '예상 질문',
  answer: '답변 채점',
  posting: '공고 정리',
  company: '기업 소개',
  'blog-post': '블로그 글 요약',
  'blog-digest': '블로그 기업 요약',
  'blog-outlook': '블로그 총정리',
  'github-project': 'GitHub 프로젝트',
  'github-problem': 'GitHub 문제 해결 경험',
  portfolio: '포트폴리오',
  'portfolio-revise': '포트폴리오 고치기',
}
const purposeName = (key: string) => PURPOSES[key] ?? key
const PROVIDERS: Record<string, string> = { OPENAI: 'OpenAI', CLAUDE: 'Claude' }

function change(now: number, before: number) {
  if (before <= 0) return null
  const diff = ((now - before) / before) * 100
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`
}

export function ManagementAi() {
  const [days, setDays] = useState<Period>(30)
  const [metric, setMetric] = useState<Metric>('cost')
  const [failed, setFailed] = useState<'all' | 'failed'>('all')
  const [opened, setOpened] = useState<Call | null>(null)
  const state = useAdminData(() => getManage<AiUsage>(`/ai-usage?days=${days}`), days, true)
  const list = usePaged((page) => listManage<Call>('/ai-calls', '', { failed: String(failed === 'failed') }, page), failed)
  const refresh = () => {
    state.reload()
    list.refresh()
  }
  return (
    <>
      <Toolbar refresh={refresh}>
        <Segmented label="기간" size="md" options={periods} value={days} onChange={setDays} />
      </Toolbar>
      {!state.data ? (
        state.error ? <Failed message={state.error} onRetry={state.reload} /> : <StatsLoading percent={state.percent} />
      ) : (
        <UsageView usage={state.data} metric={metric} onMetric={setMetric} />
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-gray-900">최근 호출</h2>
        <Segmented
          label="호출 결과"
          options={[
            ['all', '전체'],
            ['failed', '실패만'],
          ]}
          value={failed}
          onChange={setFailed}
        />
      </div>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable
        list={list}
        empty={failed === 'failed' ? '실패한 호출이 없어요.' : '호출 기록이 없어요.'}
        minWidth="min-w-[880px]"
        head={<Head columns={['시각', '용도', '모델', '입력', '출력', '처리 시간', '비용']} />}
      >
        {(a) => (
          <tr key={a.id} className={`${openableRow(opened?.id === a.id)} align-top`} onClick={() => setOpened(a)}>
            <td className={`${td} whitespace-nowrap`}>{date(a.createdAt)}</td>
            <td className={`${td} max-w-[280px]`}>
              <p className="flex items-center gap-1.5 text-gray-900">
                {purposeName(a.purpose)}
                {!a.success && <Badge tone="red">실패</Badge>}
              </p>
              {a.error && (
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed break-words text-red-500" title={a.error}>
                  {a.error}
                </p>
              )}
            </td>
            <td className={`${td} whitespace-nowrap text-gray-500`}>{a.model}</td>
            <td className={td}>{full(a.inputTokens)}</td>
            <td className={td}>{full(a.outputTokens)}</td>
            <td className={td}>{seconds(a.latencyMs)}</td>
            <td className={`${td} whitespace-nowrap`}>{a.cost === null ? <span className="text-gray-400">단가 없음</span> : usd(a.cost)}</td>
          </tr>
        )}
      </PagedTable>
      {opened && <CallPanel key={opened.id} call={opened} close={() => setOpened(null)} />}
    </>
  )
}

/** 호출 하나에 보낸 입력과 받은 답이에요. JSON이면 읽기 좋게 줄을 바꿔 보여줘요. */
function CallPanel({ call, close }: { call: Call; close: () => void }) {
  const state = useAdminData(() => getManage<CallDetail>(`/ai-calls/${call.id}`), call.id)
  return (
    <SidePanel
      label={purposeName(call.purpose)}
      closeLabel="닫기"
      onClose={close}
      className="max-w-[760px]"
      header={
        <>
          <p className="text-[13px] text-gray-500">{date(call.createdAt)}</p>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            {purposeName(call.purpose)}
            {!call.success && <Badge tone="red">실패</Badge>}
          </h2>
        </>
      }
    >
      <PanelContent state={state}>
        {({ call: c, system, input, output, retentionDays }) => (
          <>
            <InfoGrid
              wide
              rows={[
                ['모델', c.model],
                ['처리 시간', seconds(c.latencyMs)],
                ['토큰', `${full(c.inputTokens)}, ${full(c.outputTokens)}`],
                ['비용', c.cost === null ? '단가 없음' : usd(c.cost)],
              ]}
            />
            {c.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-[12.5px] leading-relaxed break-words text-red-600">{c.error}</p>}
            {input === null && output === null && (
              <p className="mt-6 text-[13px] text-gray-500">보낸 입력과 받은 답이 남아 있지 않아요. {retentionDays}일이 지났거나 기록을 남기기 전의 호출이에요.</p>
            )}
            {input !== null && <Content title="입력" text={input} />}
            {output !== null && <Content title="출력" text={output} />}
            {system !== null && <Content title="시스템 프롬프트" text={system} note="지금 파일" folded />}
          </>
        )}
      </PanelContent>
    </SidePanel>
  )
}

function Content({ title, text, note, folded = false }: { title: string; text: string; note?: string; folded?: boolean }) {
  const [open, setOpen] = useState(!folded)
  const [copied, setCopied] = useState(false)
  const shown = pretty(text)
  async function copy() {
    const ok = await navigator.clipboard.writeText(shown).then(
      () => true,
      () => false,
    )
    if (!ok) {
      showToast('복사하지 못했어요.')
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-gray-900">
          {title}
          <span className="ml-2 text-[12px] font-normal text-gray-400 tabular-nums">
            {note ? `${note}, ` : ''}
            {full(text.length)}자
          </span>
        </h3>
        <div className="flex items-center gap-1">
          {folded && (
            <button type="button" className={ghostButton} onClick={() => setOpen((v) => !v)}>
              {open ? '접기' : '펼치기'}
            </button>
          )}
          <button type="button" className={ghostButton} onClick={() => void copy()}>
            {copied ? '복사했어요' : '복사'}
          </button>
        </div>
      </div>
      {open && (
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-xl bg-gray-50 p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-gray-800">
          {shown}
        </pre>
      )}
    </section>
  )
}

function pretty(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return text
  }
}

function UsageView({ usage, metric, onMetric }: { usage: AiUsage; metric: Metric; onMetric: (metric: Metric) => void }) {
  const { total, previous } = usage
  const span = usage.daily.length
  const perCall = total.calls > 0 ? total.cost / (total.calls - total.unpricedCalls || 1) : 0
  const costChange = previous && change(total.cost, previous.cost)
  const callChange = previous && change(total.calls, previous.calls)
  if (!total.calls) return <Empty>이 기간에는 AI를 쓰지 않았어요.</Empty>
  return (
    <>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <div className={card}>
          <dt className="text-[12.5px] text-gray-500">비용</dt>
          <dd className="mt-1.5 text-[22px] leading-tight font-semibold text-gray-900 tabular-nums">{usd(total.cost)}</dd>
          <dd className="mt-1 text-[12px] text-gray-400 tabular-nums">
            약 {krw(total.cost, usage.krwPerUsd)}
            {total.unpricedCalls > 0 && (
              <Tip text={`단가를 모르는 모델의 호출 ${full(total.unpricedCalls)}번은 빠졌어요.`}>
                <span className="ml-1 text-amber-600">*</span>
              </Tip>
            )}
          </dd>
        </div>
        <Stat label="호출" value={full(total.calls)} note={`하루 ${(total.calls / Math.max(1, span)).toFixed(1)}번`} />
        <Stat label="호출당 비용" value={usd(perCall)} note={`약 ${krw(perCall, usage.krwPerUsd)}`} />
        <Stat label="입력 토큰" value={compact(total.inputTokens)} note={`호출당 ${compact(total.inputTokens / total.calls)}`} />
        <Stat label="출력 토큰" value={compact(total.outputTokens)} note={`호출당 ${compact(total.outputTokens / total.calls)}`} />
        <Stat label="실패율" value={rate(total.failures, total.calls)} note={`${full(total.failures)}번, 평균 ${seconds(total.latencyMs / total.calls)}`} />
      </dl>
      {previous && (costChange || callChange) && (
        <p className="mt-3 text-[12.5px] text-gray-500 tabular-nums">
          직전 {usage.days}일보다 비용 {costChange ?? '0%'}, 호출 {callChange ?? '0%'}
        </p>
      )}
      <Panel
        className="mt-5"
        title="날짜별"
        action={<Segmented label="그래프 값" options={metrics} value={metric} onChange={onMetric} />}
      >
        <UsageChart usage={usage} metric={metric} />
      </Panel>
      <div className="mt-5 grid grid-cols-1 gap-5 2xl:grid-cols-2">
        <GroupTable title="모델별" groups={usage.models} total={total} rate={usage.krwPerUsd} model />
        <GroupTable title="용도별" groups={usage.purposes} total={total} rate={usage.krwPerUsd} />
      </div>
    </>
  )
}

function UsageChart({ usage, metric }: { usage: AiUsage; metric: Metric }) {
  const monthly = usage.daily.length > 120
  const value = (d: AiUsage['daily'][number]) => (metric === 'cost' ? d.cost : metric === 'calls' ? d.calls : d.inputTokens + d.outputTokens)
  const show = (n: number) => (metric === 'cost' ? usd(n) : metric === 'calls' ? `${full(n)}번` : `${full(n)} 토큰`)
  const buckets = new Map<string, number>()
  for (const d of usage.daily) {
    const key = monthly ? d.date.slice(0, 7) : d.date
    buckets.set(key, (buckets.get(key) ?? 0) + value(d))
  }
  const label = (key: string) => {
    const [y, m, day] = key.split('-').map(Number)
    return monthly ? `${y}년 ${m}월` : `${m}월 ${day}일`
  }
  const bars: Bar[] = [...buckets].map(([key, n]) => ({ key, value: n, title: `${label(key)}, ${show(n)}` }))
  if (!bars.length) return null
  return <BarChart bars={bars} label={`${monthly ? '달별' : '날짜별'} ${nameOf(metrics, metric)}`} first={label(bars[0].key)} last={label(bars[bars.length - 1].key)} />
}

function GroupTable({ title, groups, total, rate: krwRate, model = false }: { title: string; groups: AiGroup[]; total: AiTotals; rate: number; model?: boolean }) {
  return (
    <Panel title={title} className="min-w-0">
      {!groups.length ? (
        <p className="text-[13px] text-gray-500">없어요.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] text-[13px] text-gray-700 tabular-nums">
            <thead>
              <tr>
                <Head columns={[model ? '모델' : '용도', '호출', '실패', '토큰 (입력, 출력)', '평균 시간', '비용']} />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const t = g.total
                const share = total.cost > 0 ? t.cost / total.cost : 0
                return (
                  <tr key={g.key} className={tableRow}>
                    <td className={`${td} max-w-[220px]`}>
                      <p className="truncate font-medium text-gray-900">{model ? g.label : purposeName(g.key)}</p>
                      {model && (
                        <p className="truncate text-[12px] text-gray-500">
                          {g.provider ? PROVIDERS[g.provider] ?? g.provider : '모르는 모델'}
                          {g.inputPrice !== null && g.outputPrice !== null && (
                            <Tip text="토큰 100만 개당 입력, 출력 값이에요.">
                              <span>{`, $${g.inputPrice} / $${g.outputPrice}`}</span>
                            </Tip>
                          )}
                        </p>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{full(t.calls)}</td>
                    <td className={`${td} whitespace-nowrap ${t.failures ? 'text-red-500' : 'text-gray-400'}`}>{full(t.failures)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {compact(t.inputTokens)}, {compact(t.outputTokens)}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{seconds(t.latencyMs / Math.max(1, t.calls))}</td>
                    <td className={`${td} w-48`}>
                      {t.unpricedCalls === t.calls ? (
                        <span className="text-gray-400">단가 없음</span>
                      ) : (
                        <Tip text={`약 ${krw(t.cost, krwRate)}, 전체의 ${(share * 100).toFixed(1)}%`} className="flex w-full">
                          <span className="flex w-full items-center gap-2">
                            <span className="w-16 shrink-0 font-medium text-gray-900">{usd(t.cost)}</span>
                            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200/70">
                              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%` }} />
                            </span>
                          </span>
                        </Tip>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
