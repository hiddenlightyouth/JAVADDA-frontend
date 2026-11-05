import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import {
  getManage,
  listManage,
  updateManage,
  manageRequest,
  type Overview,
  type Member,
  type MemberDetail,
  type Posting,
  type Business,
  type Call,
  type Source,
} from '../lib/adminManage'
import type { Result } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { showToast } from '../lib/toast'
import type { AdminTab } from './Admin'
import {
  card,
  cardTitle,
  Empty,
  Failed,
  full,
  InfoGrid,
  PagedTable,
  PanelContent,
  SearchBox,
  Stat,
  td,
  th,
  useAdminData,
  useDebounced,
  usePaged,
} from './AdminParts'
import { ConfirmDialog, SidePanel } from './Dialog'
import { fieldBase, primaryButton, quietButton, tag, loadCenter, LoadProgress } from './ui'

const date = (value: string | null) => (value ? formatDateTime(value) : '없음')
const row = 'border-t border-gray-100'
const input = `${fieldBase} w-full px-3 py-2 text-sm`
const pathId = (id: string | number) => encodeURIComponent(id)

function useMutation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{
    title: string
    body: string
    run: () => Promise<Result<null>>
    after: () => void
  } | null>(null)
  async function execute(run: () => Promise<Result<null>>, after: () => void) {
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
      showToast('처리했어요.')
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    execute,
    ask: (title: string, body: string, run: () => Promise<Result<null>>, after: () => void) => {
      setError('')
      setPending({ title, body, run, after })
    },
    notice: error && (
      <p role="alert" className="my-3 text-sm text-red-600">
        {error}
      </p>
    ),
    dialog: pending && (
      <ConfirmDialog
        title={pending.title}
        body={
          <>
            {pending.body}
            {error && <span className="mt-2 block text-red-600">{error}</span>}
          </>
        }
        confirm="확인"
        working={busy}
        onCancel={() => {
          if (!busy) setPending(null)
        }}
        onConfirm={() => void execute(pending.run, pending.after)}
      />
    ),
  }
}
function Toolbar({ children, refresh }: { children?: ReactNode; refresh: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      <button type="button" className={`${quietButton} ml-auto`} onClick={refresh}>
        새로고침
      </button>
    </div>
  )
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-gray-600">
      <span>{label}</span>
      {children}
    </label>
  )
}
function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldBase} px-3 py-2 text-sm`}
    >
      {options.map(([key, name]) => (
        <option key={key} value={key}>
          {name}
        </option>
      ))}
    </select>
  )
}
function Panel({
  title,
  close,
  busy = false,
  children,
}: {
  title: string
  close: () => void
  busy?: boolean
  children: ReactNode
}) {
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

export function ManagementOverview({ onTab }: { onTab: (tab: AdminTab) => void }) {
  const state = useAdminData(() => getManage<Overview>('/overview'), 'overview')
  if (!state.data)
    return state.error ? (
      <Failed message={state.error} onRetry={state.reload} />
    ) : (
      <LoadProgress percent={state.percent} className={loadCenter} />
    )
  const o = state.data
  return (
    <>
      <Toolbar refresh={state.reload}>
        <p className="text-sm text-gray-500">서비스 데이터와 운영 상태를 한눈에 확인해요.</p>
      </Toolbar>
      {state.error && <Failed message={state.error} onRetry={state.reload} />}
      <dl className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="전체 회원" value={full(o.users)} note={`관리자 ${full(o.admins)}명`} />
        <Stat
          label="공개 채용공고"
          value={full(o.openPostings)}
          note={`전체 ${full(o.postings)}개, 마감일 경과 포함`}
        />
        <Stat label="진단 리포트" value={full(o.reports)} note={`이력서 ${full(o.resumes)}개`} />
        <Stat label="AI 호출" value={full(o.aiCalls)} note={`실패 ${full(o.aiFailures)}회, 누적 기록`} />
      </dl>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="기업" value={full(o.companies)} />
        <Stat label="기술 블로그 글" value={full(o.blogs)} />
        <Stat label="공모전" value={full(o.contests)} />
      </dl>
      <h2 className="mt-8 text-base font-semibold text-gray-900">관리 바로가기</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(
          [
            ['users', '회원과 로그인', '회원 검색, 관리자 권한 변경, 기기별 로그인 해제'],
            ['postings', '채용공고', '직군, 경력, 역량, 마감일과 공개 상태 수정'],
            ['companies', '기업 정보', '기업 분류, 홈페이지, 기술 블로그, 노출 순서 수정'],
            ['crawl', '데이터 수집', '수집처 활성화, 최근 결과와 오류 확인, 즉시 수집'],
            ['ai', 'AI 호출 기록', '모델과 용도, 토큰 사용량, 지연 시간과 실패 확인'],
          ] as [AdminTab, string, string][]
        ).map(([key, title, note]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTab(key)}
            className={`${card} text-left transition-colors hover:bg-gray-100`}
          >
            <span className={`block ${cardTitle}`}>{title}</span>
            <span className="mt-2 block text-xs leading-5 text-gray-500">{note}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export function ManagementUsers() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('ALL')
  const [selected, setSelected] = useState<Member | null>(null)
  const keyword = useDebounced(query)
  const list = usePaged((page) => listManage<Member>('/users', keyword, { role }, page), `${keyword}:${role}`)
  return (
    <>
      <Toolbar refresh={list.refresh}>
        <SearchBox value={query} onChange={setQuery} placeholder="이름이나 이메일로 검색" />
        <Filter
          label="회원 권한"
          value={role}
          onChange={setRole}
          options={[
            ['ALL', '전체 권한'],
            ['USER', '일반 회원'],
            ['ADMIN', '관리자'],
          ]}
        />
      </Toolbar>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable
        list={list}
        empty="조건에 맞는 회원이 없어요."
        head={
          <>
            {['회원', '권한', '가입일', '관리'].map((t) => (
              <th key={t} className={th}>
                {t}
              </th>
            ))}
          </>
        }
      >
        {(u) => (
          <tr key={u.id} className={row}>
            <td className={td}>
              <p className="font-medium text-gray-900">{u.name}</p>
              <p className="text-xs text-gray-500">{u.email}</p>
            </td>
            <td className={td}>
              <span className={tag}>{u.role === 'ADMIN' ? '관리자' : '일반 회원'}</span>
            </td>
            <td className={td}>{date(u.registeredAt)}</td>
            <td className={td}>
              <button type="button" className={quietButton} onClick={() => setSelected(u)}>
                상세 관리
              </button>
            </td>
          </tr>
        )}
      </PagedTable>
      {selected && (
        <MemberPanel key={selected.id} member={selected} close={() => setSelected(null)} changed={list.refresh} />
      )}
    </>
  )
}
function MemberPanel({ member, close, changed }: { member: Member; close: () => void; changed: () => void }) {
  const { me } = useAuth()
  const state = useAdminData(() => getManage<MemberDetail>(`/users/${member.id}`), member.id, true)
  const mutation = useMutation()
  const self = member.id === me?.id
  const reload = () => {
    state.reload()
    changed()
  }
  return (
    <>
      <Panel title={`${member.name}, 회원 관리`} close={close} busy={mutation.busy}>
        <PanelContent state={state}>
          {({ user, sessions, logins }) => (
            <>
              <InfoGrid
                rows={[
                  ['이메일', user.email],
                  ['권한', user.role === 'ADMIN' ? '관리자' : '일반 회원'],
                  ['가입일', date(user.registeredAt)],
                  ['로그인 기기', `${sessions.length}개`],
                ]}
              />
              {mutation.notice}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={self || mutation.busy}
                  className={quietButton}
                  onClick={() =>
                    mutation.ask(
                      '회원 권한을 변경할까요?',
                      `${user.name} 님을 ${user.role === 'ADMIN' ? '일반 회원으로' : '관리자로'} 변경하고 모든 로그인 기기를 해제해요.`,
                      () =>
                        updateManage(`/users/${user.id}/role`, 'PATCH', {
                          role: user.role === 'ADMIN' ? 'USER' : 'ADMIN',
                        }),
                      reload,
                    )
                  }
                >
                  {user.role === 'ADMIN' ? '일반 회원으로 변경' : '관리자 지정'}
                </button>
                <button
                  type="button"
                  disabled={self || mutation.busy}
                  className={quietButton}
                  onClick={() =>
                    mutation.ask(
                      '모든 기기를 로그아웃할까요?',
                      '이 회원의 모든 기기에서 다시 로그인해야 해요.',
                      () => updateManage(`/users/${user.id}/sessions`, 'DELETE'),
                      reload,
                    )
                  }
                >
                  모든 기기 로그아웃
                </button>
              </div>
              {self && (
                <p className="mt-2 text-xs text-gray-500">내 계정의 권한과 로그인은 이 화면에서 변경할 수 없어요.</p>
              )}
              <h3 className="mt-8 font-semibold text-gray-900">로그인 중인 기기</h3>
              {!sessions.length && <p className="mt-3 text-sm text-gray-500">로그인 중인 기기가 없어요.</p>}
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b border-gray-100 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{s.name || '알 수 없는 기기'}</p>
                    <p className="text-xs text-gray-500">
                      {s.ipAddress || '주소 없음'}, 최근 사용 {date(s.lastUsedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={self || mutation.busy}
                    className={quietButton}
                    onClick={() =>
                      mutation.ask(
                        '이 기기를 로그아웃할까요?',
                        s.name || '선택한 기기의 로그인을 해제해요.',
                        () => updateManage(`/users/${user.id}/sessions/${pathId(s.id)}`, 'DELETE'),
                        reload,
                      )
                    }
                  >
                    해제
                  </button>
                </div>
              ))}
              <h3 className="mt-8 font-semibold text-gray-900">최근 로그인 20건</h3>
              {!logins.length && <p className="mt-3 text-sm text-gray-500">로그인 기록이 없어요.</p>}
              {logins.map((l) => (
                <div key={l.id} className="border-b border-gray-100 py-3 text-sm">
                  <p className="text-gray-900">{l.deviceName || '알 수 없는 기기'}</p>
                  <p className="text-xs text-gray-500">
                    {l.ipAddress || '주소 없음'}, {date(l.loggedInAt)}
                  </p>
                </div>
              ))}
            </>
          )}
        </PanelContent>
      </Panel>
      {mutation.dialog}
    </>
  )
}

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
  ['service', '서비스'],
  ['saas', 'SaaS'],
  ['commerce', '커머스'],
  ['finance', '금융'],
  ['ai', 'AI'],
  ['it-service', 'IT 서비스'],
  ['manufacturing', '제조'],
  ['public', '공공'],
  ['other', '기타'],
]
export function ManagementPostings() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selected, setSelected] = useState<Posting | null>(null)
  const keyword = useDebounced(query)
  const list = usePaged((page) => listManage<Posting>('/postings', keyword, { status }, page), `${keyword}:${status}`)
  return (
    <>
      <Toolbar refresh={list.refresh}>
        <SearchBox value={query} onChange={setQuery} placeholder="공고 제목이나 기업으로 검색" />
        <Filter
          label="공고 상태"
          value={status}
          onChange={setStatus}
          options={[
            ['ALL', '전체 상태'],
            ['OPEN', '공개'],
            ['CLOSED', '내림'],
          ]}
        />
      </Toolbar>
      <p className="mt-3 text-xs text-gray-500">
        내린 공고는 탐색 목록에서 숨겨지고, 기존 진단 리포트는 유지돼요. 수집한 공고는 다음 수집 때 원문 정보로 갱신될
        수 있어요.
      </p>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable
        list={list}
        empty="조건에 맞는 공고가 없어요."
        head={
          <>
            {['공고', '직군 / 경력', '상태', '마감일', '관리'].map((t) => (
              <th key={t} className={th}>
                {t}
              </th>
            ))}
          </>
        }
      >
        {(p) => (
          <tr key={p.id} className={row}>
            <td className={`${td} max-w-[320px]`}>
              <p className="text-xs text-gray-500">{p.company}</p>
              <p className="truncate font-medium text-gray-900">{p.title}</p>
            </td>
            <td className={td}>
              {families.find(([k]) => k === p.family)?.[1]} / {careers.find(([k]) => k === p.career)?.[1]}
            </td>
            <td className={td}>{p.closedAt ? '내림' : '공개'}</td>
            <td className={td}>{date(p.deadline)}</td>
            <td className={td}>
              <button type="button" className={quietButton} onClick={() => setSelected(p)}>
                수정
              </button>
            </td>
          </tr>
        )}
      </PagedTable>
      {selected && (
        <PostingPanel key={selected.id} posting={selected} close={() => setSelected(null)} changed={list.refresh} />
      )}
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
    const split = (value: string) => [
      ...new Set(
        value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ]
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
    <Panel title="채용공고 수정" close={close} busy={mutation.busy}>
      <form onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
        <p className="text-xs text-gray-500">
          {posting.company}, {posting.id}
        </p>
        <Field label="공고 제목">
          <input
            required
            maxLength={255}
            className={input}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <div className="flex gap-4">
          <Field label="직군">
            <Filter label="직군" value={draft.family} options={families} onChange={(v) => set('family', v)} />
          </Field>
          <Field label="경력">
            <Filter label="경력" value={draft.career} options={careers} onChange={(v) => set('career', v)} />
          </Field>
        </div>
        <Field label="근무 지역">
          <input
            required
            maxLength={100}
            className={input}
            value={draft.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </Field>
        <Field label="마감일 (한국 시각, 비우면 상시 채용)">
          <input
            type="datetime-local"
            className={input}
            value={draft.deadline}
            onChange={(e) => set('deadline', e.target.value)}
          />
        </Field>
        <Field label="필수 역량 (쉼표로 구분)">
          <input className={input} value={draft.required} onChange={(e) => set('required', e.target.value)} />
        </Field>
        <Field label="우대 역량 (쉼표로 구분)">
          <input className={input} value={draft.preferred} onChange={(e) => set('preferred', e.target.value)} />
        </Field>
        <Field label="공고 요약">
          <textarea
            required
            rows={5}
            maxLength={1000}
            className={input}
            value={draft.summary}
            onChange={(e) => set('summary', e.target.value)}
          />
        </Field>
        <Field label="원문 주소">
          <input
            required
            type="url"
            maxLength={1000}
            className={input}
            value={draft.url}
            onChange={(e) => set('url', e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={draft.closed} onChange={(e) => set('closed', e.target.checked)} />
          공고 내리기
        </label>
        {mutation.notice}
        <button disabled={mutation.busy} className={primaryButton}>
          {mutation.busy ? '저장 중…' : '저장'}
        </button>
      </form>
    </Panel>
  )
}

export function ManagementCompanies() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Business | null>(null)
  const keyword = useDebounced(query)
  const list = usePaged((page) => listManage<Business>('/companies', keyword, {}, page), keyword)
  return (
    <>
      <Toolbar refresh={list.refresh}>
        <SearchBox value={query} onChange={setQuery} placeholder="기업 이름으로 검색" />
      </Toolbar>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable
        list={list}
        empty="조건에 맞는 기업이 없어요."
        head={
          <>
            {['기업', '산업', '분류', '노출 순서', '관리'].map((t) => (
              <th key={t} className={th}>
                {t}
              </th>
            ))}
          </>
        }
      >
        {(c) => (
          <tr key={c.id} className={row}>
            <td className={td}>
              <p className="font-medium text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-500">{c.id}</p>
            </td>
            <td className={td}>{c.industry}</td>
            <td className={td}>{categories.find(([k]) => k === (c.category ?? ''))?.[1]}</td>
            <td className={td}>{c.displayOrder < 1000 ? c.displayOrder : '추천 기업에서 숨김'}</td>
            <td className={td}>
              <button type="button" className={quietButton} onClick={() => setSelected(c)}>
                수정
              </button>
            </td>
          </tr>
        )}
      </PagedTable>
      {selected && (
        <CompanyPanel key={selected.id} company={selected} close={() => setSelected(null)} changed={list.refresh} />
      )}
    </>
  )
}
function CompanyPanel({ company, close, changed }: { company: Business; close: () => void; changed: () => void }) {
  const [draft, setDraft] = useState({
    ...company,
    techBlog: company.techBlog ?? '',
    category: company.category ?? '',
  })
  const mutation = useMutation()
  const set = (key: keyof typeof draft, value: string | number) => setDraft((d) => ({ ...d, [key]: value }))
  return (
    <Panel title="기업 정보 수정" close={close} busy={mutation.busy}>
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
        <p className="text-xs text-gray-500">{company.id}</p>
        {(
          [
            ['name', '기업명', 255],
            ['initial', '로고 대체 글자', 10],
            ['industry', '산업', 255],
            ['site', '홈페이지', 500],
            ['techBlog', '기술 블로그 (선택)', 500],
          ] as const
        ).map(([key, label, max]) => (
          <Field key={key} label={label}>
            <input
              required={key !== 'techBlog'}
              type={key === 'site' || key === 'techBlog' ? 'url' : 'text'}
              maxLength={max}
              className={input}
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </Field>
        ))}
        <Field label="기업 분류">
          <Filter label="기업 분류" value={draft.category} options={categories} onChange={(v) => set('category', v)} />
        </Field>
        <Field label="노출 순서 (0~999는 추천 기업, 1000 이상은 숨김)">
          <input
            required
            type="number"
            min={0}
            step={1}
            max={2147483647}
            className={input}
            value={draft.displayOrder}
            onChange={(e) => set('displayOrder', Number(e.target.value))}
          />
        </Field>
        {mutation.notice}
        <button disabled={mutation.busy} className={primaryButton}>
          {mutation.busy ? '저장 중…' : '저장'}
        </button>
      </form>
    </Panel>
  )
}

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
  const [started, setStarted] = useState(false)
  return (
    <>
      <Toolbar refresh={state.reload}>
        <Filter
          label="수집 대상"
          value={target}
          onChange={setTarget}
          options={[
            ['all', '전체'],
            ['postings', '채용공고'],
            ['blogs', '블로그'],
            ['contests', '공모전'],
          ]}
        />
        <button
          type="button"
          disabled={mutation.busy || state.data?.running}
          className={primaryButton}
          onClick={() =>
            mutation.ask(
              '수집을 시작할까요?',
              '선택한 대상의 외부 사이트를 읽고 새 자료를 수집해요. AI 요약이 실행될 수 있어요.',
              () => manageRequest<null>(`/admin/crawl?target=${target}`, 'POST'),
              () => {
                setStarted(true)
                state.reload()
              },
            )
          }
        >
          지금 수집
        </button>
      </Toolbar>
      <p className="mt-3 text-xs leading-5 text-gray-500">
        수집처 설정은 다음 수집부터 반영돼요. 공모전과 공공 채용 API는 서버 설정에 따라 별도로 수집되며, 아래 목록은
        기업별 수집처예요.
      </p>
      {state.data?.running && (
        <p role="status" className="mt-3 text-sm text-gray-700">
          수집 중이에요. 5초마다 상태를 갱신해요.
        </p>
      )}
      {started && !state.data?.running && (
        <p role="status" className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          현재 수집 중인 작업이 없어요. 아래의 최근 실행 결과를 확인해 주세요.
        </p>
      )}
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
          <dl className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="전체 수집처" value={full(state.data.sources.length)} />
            <Stat label="활성 수집처" value={full(state.data.sources.filter((s) => s.enabled).length)} />
            <Stat label="최근 오류" value={full(state.data.sources.filter((s) => s.lastError).length)} />
          </dl>
          {!state.data.sources.length ? (
            <Empty>등록된 수집처가 없어요.</Empty>
          ) : (
            <div className="mt-5 space-y-3">
              {state.data.sources.map((s) => (
                <section key={s.id} className={card}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className={cardTitle}>
                        {s.companyId}, {s.kind}
                      </h3>
                      <p className="mt-1 break-all text-xs text-gray-500">{s.target || '기본 수집 주소'}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={s.enabled}
                      disabled={mutation.busy}
                      className={quietButton}
                      onClick={() =>
                        mutation.ask(
                          s.enabled ? '수집처를 비활성화할까요?' : '수집처를 활성화할까요?',
                          '다음 수집부터 적용돼요.',
                          () =>
                            updateManage(`/sources/${s.id}`, 'PATCH', {
                              enabled: !s.enabled,
                            }),
                          state.reload,
                        )
                      }
                    >
                      {s.enabled ? '활성, 끄기' : '비활성, 켜기'}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    최근 실행 {date(s.lastRunAt)}, 새 자료 {full(s.lastAdded)}개
                  </p>
                  {s.lastError && <p className="mt-2 break-words text-xs leading-5 text-red-600">{s.lastError}</p>}
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {mutation.dialog}
    </>
  )
}

export function ManagementAi() {
  const [failed, setFailed] = useState('all')
  const list = usePaged(
    (page) => listManage<Call>('/ai-calls', '', { failed: String(failed === 'failed') }, page),
    failed,
  )
  return (
    <>
      <Toolbar refresh={list.refresh}>
        <Filter
          label="호출 결과"
          value={failed}
          onChange={setFailed}
          options={[
            ['all', '모든 호출'],
            ['failed', '실패한 호출'],
          ]}
        />
      </Toolbar>
      <p className="mt-3 text-xs text-gray-500">
        최근 호출부터 표시해요. 토큰 수와 처리 시간을 확인할 수 있어요. 서류 원문과 AI 응답은 저장하지 않아요.
      </p>
      {list.error && list.items !== null && <Failed message={list.error} onRetry={list.retry} />}
      <PagedTable
        list={list}
        empty="호출 기록이 없어요."
        minWidth="min-w-[900px]"
        head={
          <>
            {['호출 시각', '용도 / 모델', '결과', '입력 / 출력 토큰', '처리 시간', '오류'].map((t) => (
              <th key={t} className={th}>
                {t}
              </th>
            ))}
          </>
        }
      >
        {(a) => (
          <tr key={a.id} className={row}>
            <td className={`${td} whitespace-nowrap`}>{date(a.createdAt)}</td>
            <td className={td}>
              <p className="font-medium text-gray-900">{a.purpose}</p>
              <p className="text-xs text-gray-500">{a.model}</p>
            </td>
            <td className={`${td} ${a.success ? 'text-gray-700' : 'text-red-600'}`}>{a.success ? '성공' : '실패'}</td>
            <td className={td}>
              {full(a.inputTokens)} / {full(a.outputTokens)}
            </td>
            <td className={td}>{(a.latencyMs / 1000).toFixed(1)}초</td>
            <td className={`${td} max-w-[260px] break-words text-xs text-red-600`}>{a.error || '없음'}</td>
          </tr>
        )}
      </PagedTable>
    </>
  )
}
