import { useCallback, useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { isApp, openInBrowser } from '../lib/app'
import { connectGithub, createGithubResume, disconnectGithub, fetchGithubConnection, fetchGithubRepos, MAX_GITHUB_REPOS, PROGRESS_START, type GithubConnection, type GithubRepo, type ProgressState, type Resume } from '../lib/gap'
import { isGithubReturn, startGithubConnect, takeGithubReturn } from '../lib/githubConnect'
import { formatWhen } from '../lib/format'
import { messages, pick, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { SITE } from '../lib/meta'
import { showToast } from '../lib/toast'
import { useServerConfig } from '../hooks/useServerConfig'
import { ConfirmDialog } from './Dialog'
import { AiProgress, Failed, Notice } from './GapParts'
import { CheckIcon, LockIcon, SearchIcon } from './Icons'
import { GitHubMark } from './Social'
import { Badge, Checkbox, ghostButton, LoadProgress, loadCenter, primaryButton, quietButton, useShowMore } from './ui'

/**
 * GitHub 레포로 이력서와 포트폴리오를 만드는 칸이에요. 서류 추가 화면에서 GitHub를 고르면 나와요.
 * 먼저 GitHub 계정을 연결하고(repo 권한이라 비공개 레포도 돼요), 내 레포를 3개까지 고르면 레포마다 AI가 내 커밋과 PR로 프로젝트 경험과 역량을 써요.
 * 예전 Lofy(WhoIsLoafing)의 이력서 만들기를 옮겨 온 거예요.
 */

const TEXT = messages({
  ko: {
    connectTitle: 'GitHub 계정을 연결해 주세요',
    connectBody: '연결하면 비공개 레포까지 읽어서, 내가 남긴 커밋과 PR로 이력서의 프로젝트 경험과 역량을 써 드려요. 코드는 저장하지 않고, 연결은 언제든 끊을 수 있어요.',
    connect: 'GitHub 연결하기',
    appConnectBody: '연결은 브라우저에서 해요. 연결한 뒤에 돌아와서 다시 확인을 눌러 주세요.',
    openBrowser: '브라우저에서 연결하기',
    linkCopied: '주소를 복사했어요. 브라우저 주소창에 붙여 넣어 연결해 주세요.',
    recheck: '다시 확인',
    notReady: '알 수 없는 오류가 발생했습니다.',
    connected: '연결했어요. 이력서로 만들 레포를 골라 주세요.',
    canceled: 'GitHub 연결을 취소했어요.',
    invalid: '연결 요청을 확인하지 못했어요. 처음부터 다시 시도해 주세요.',
    privateAccess: '비공개 레포 포함',
    disconnect: '연결 해제',
    disconnectTitle: 'GitHub 연결을 끊을까요?',
    disconnectBody: 'GitHub에 준 권한도 함께 거둬요. 이미 만든 이력서는 그대로 남아요.',
    disconnected: 'GitHub 연결을 끊었어요.',
    search: '레포 찾기',
    hideForks: '포크 숨기기',
    private: '비공개',
    fork: '포크',
    archived: '보관됨',
    pushed: (when: string) => `${when} 푸시`,
    empty: '볼 수 있는 레포가 없어요',
    emptyBody: 'GitHub에 레포를 올리거나, 조직의 레포라면 조직에서 이 앱의 접근을 허락해 주세요.',
    noMatch: '찾는 레포가 없어요',
    pickHint: (count: number) => `레포를 ${MAX_GITHUB_REPOS}개까지 골라요. ${count}개 골랐어요.`,
    full: `${MAX_GITHUB_REPOS}개까지 고를 수 있어요`,
    make: '이력서 만들기',
    made: '레포를 읽어 이력서를 만들었어요. 프로젝트 경험과 역량을 확인해 주세요.',
  },
  en: {
    connectTitle: 'Connect your GitHub account',
    connectBody: 'We read your repositories, private ones included, and write resume projects and skills from your own commits and pull requests. We never store your code, and you can disconnect at any time.',
    connect: 'Connect GitHub',
    appConnectBody: 'Connecting happens in your browser. Come back and press Check again once you are done.',
    openBrowser: 'Connect in browser',
    linkCopied: 'Link copied. Paste it into your browser to connect.',
    recheck: 'Check again',
    notReady: 'An unknown error occurred.',
    connected: 'Connected. Pick the repositories to turn into a resume.',
    canceled: 'GitHub connection was canceled.',
    invalid: "We couldn't verify the request. Please start over.",
    privateAccess: 'Private repos included',
    disconnect: 'Disconnect',
    disconnectTitle: 'Disconnect GitHub?',
    disconnectBody: 'We also revoke the access you gave on GitHub. Resumes you made stay.',
    disconnected: 'GitHub disconnected.',
    search: 'Find a repository',
    hideForks: 'Hide forks',
    private: 'Private',
    fork: 'Fork',
    archived: 'Archived',
    pushed: (when: string) => `Pushed ${when}`,
    empty: 'No repositories to show',
    emptyBody: 'Push a repository to GitHub, or ask your organization to allow this app.',
    noMatch: 'No matching repositories',
    pickHint: (count: number) => `Pick up to ${MAX_GITHUB_REPOS}. ${count} picked.`,
    full: `You can pick up to ${MAX_GITHUB_REPOS}`,
    make: 'Create resume',
    made: 'Done. Please check the projects and skills we wrote.',
  },
})

/** 연결한 계정이에요. undefined는 묻는 중, null은 서버에 닿지 못한 것이에요. */
type ConnectionState = GithubConnection | null | undefined

export function GithubResume({ onDone, onWorking }: { onDone: (resume: Resume) => void; onWorking: (working: boolean) => void }) {
  const L = useMessages(TEXT)
  const config = useServerConfig()
  const [connection, setConnection] = useState<ConnectionState>(undefined)
  const [attempt, setAttempt] = useState(0)
  const disconnected = useCallback(() => setConnection({ connected: false }), [])

  useEffect(() => {
    let stale = false
    setConnection(undefined)
    async function load() {
      // GitHub 권한 화면에서 돌아왔으면 받은 코드로 먼저 연결해요.
      if (isGithubReturn()) {
        const back = takeGithubReturn()
        if (back.ok) {
          const connected = await connectGithub(back.code, back.redirectUri)
          track('github_connect', { success: !!connected })
          if (connected) {
            showToast(pick(TEXT).connected)
            if (!stale) setConnection(connected)
            return
          }
        } else {
          showToast(back.canceled ? pick(TEXT).canceled : pick(TEXT).invalid)
        }
      }
      const next = await fetchGithubConnection()
      if (!stale) setConnection(next)
    }
    void load()
    return () => {
      stale = true
    }
  }, [attempt])

  const waiting = useLoadHold(connection === undefined || config === null)
  if (waiting) return <LoadProgress percent={connection === undefined ? 40 : 100} compact className="max-w-md" />
  if (connection === null) return <Failed onRetry={() => setAttempt((value) => value + 1)} className="mt-10" />
  if (!connection?.connected) {
    const clientId = config?.githubConnectClientId
    if (!clientId) return <Notice title={L.notReady} className="mt-10" />
    return <ConnectCard clientId={clientId} onRecheck={() => setAttempt((value) => value + 1)} />
  }
  return <RepoPicker connection={connection} onDone={onDone} onWorking={onWorking} onDisconnected={disconnected} />
}

/** 앱에서 연결하라고 브라우저로 여는 주소예요. 웹의 서류 추가 화면이 GitHub 단계로 바로 열려요. */
const CONNECT_IN_BROWSER = `${SITE}/app/resume/new?github=1`

/** 앱이 브라우저로 넘겨 주게 해요. 넘길 수 없는 예전 앱(2.2까지)이면 주소를 복사해서 붙여 넣게 해요. */
function openConnectInBrowser() {
  track('github_connect_click', { from: 'app' })
  if (openInBrowser(CONNECT_IN_BROWSER)) return
  void navigator.clipboard
    .writeText(CONNECT_IN_BROWSER)
    .then(() => showToast(pick(TEXT).linkCopied))
    .catch(() => showToast(CONNECT_IN_BROWSER))
}

/** 연결하지 않았을 때의 칸이에요. 앱은 우리 주소를 앱 안에서 열어서, open 메시지로 기본 브라우저에 넘기고 연결한 뒤 돌아와 다시 확인해요. */
function ConnectCard({ clientId, onRecheck }: { clientId: string; onRecheck: () => void }) {
  const L = useMessages(TEXT)
  return (
    <div className="flex flex-col items-start rounded-2xl bg-gray-50 p-7">
      <span className="flex size-14 items-center justify-center rounded-full bg-white text-gray-900">
        <GitHubMark className="size-6" />
      </span>
      <h2 className="mt-6 text-[17px] font-semibold text-gray-900">{L.connectTitle}</h2>
      <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-gray-500">{isApp ? L.appConnectBody : L.connectBody}</p>
      <div className="mt-6 flex items-center gap-2">
        {isApp ? (
          <>
            <button type="button" onClick={openConnectInBrowser} className={primaryButton}>
              <GitHubMark className="size-4" />
              {L.openBrowser}
            </button>
            <button type="button" onClick={onRecheck} className={quietButton}>
              {L.recheck}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              track('github_connect_click', { from: 'web' })
              startGithubConnect(clientId)
            }}
            className={primaryButton}
          >
            <GitHubMark className="size-4" />
            {L.connect}
          </button>
        )}
      </div>
    </div>
  )
}

/** 연결한 계정의 레포를 골라 이력서를 만드는 칸이에요. 고르는 동안 아래에 만들기 버튼이 붙어 있어요. */
function RepoPicker({ connection, onDone, onWorking, onDisconnected }: {
  connection: GithubConnection
  onDone: (resume: Resume) => void
  onWorking: (working: boolean) => void
  onDisconnected: () => void
}) {
  const L = useMessages(TEXT)
  const load = useLoadProgress()
  /** undefined는 받는 중, null은 실패예요. */
  const [repos, setRepos] = useState<GithubRepo[] | null | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [hideForks, setHideForks] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState<ProgressState | null>(null)
  const waiting = useLoadHold(repos === undefined)

  useEffect(() => {
    let stale = false
    setRepos(undefined)
    void fetchGithubRepos(load.one()).then((result) => {
      if (stale) return
      if (result === 'disconnected') onDisconnected()
      else setRepos(result)
    })
    return () => {
      stale = true
    }
  }, [attempt, load.one, onDisconnected])

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase()
    return (repos ?? []).filter((repo) => {
      if (hideForks && repo.fork) return false
      if (!words) return true
      return `${repo.fullName} ${repo.description ?? ''} ${repo.language ?? ''}`.toLowerCase().includes(words)
    })
  }, [repos, query, hideForks])
  const { count, more } = useShowMore(shown.length, `${query}|${hideForks}`)
  const full = picked.length >= MAX_GITHUB_REPOS

  const toggle = (name: string) => setPicked((list) => (list.includes(name) ? list.filter((item) => item !== name) : list.length >= MAX_GITHUB_REPOS ? list : [...list, name]))

  async function make() {
    if (picked.length === 0) return
    setWorking(PROGRESS_START)
    onWorking(true)
    const resume = await createGithubResume(picked, setWorking)
    setWorking(null)
    onWorking(false)
    if (resume === 'disconnected') return onDisconnected()
    if (!resume) return
    track('resume_upload', { source: 'github', skills: resume.skills.length, repos: picked.length })
    showToast(pick(TEXT).made)
    onDone(resume)
  }

  // 레포마다 AI가 글을 써서 1분이 넘게 걸릴 수 있어요. 그동안은 고른 레포 이름과 진행 막대만 보여줘요.
  if (working) {
    return (
      <div className="rounded-2xl bg-gray-50 p-6">
        <AiProgress progress={working.progress} stage={working.stage} title={picked.map((name) => name.split('/')[1]).join(', ')} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-5 py-4">
        {connection.avatarUrl ? (
          <img src={connection.avatarUrl} alt="" className="size-10 shrink-0 rounded-full bg-white" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-900">
            <GitHubMark className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold text-gray-900">{connection.name || connection.login}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-gray-500">
            @{connection.login}
            {connection.privateAccess && (
              <Badge tone="white" className="gap-1">
                <LockIcon className="size-3" />
                {L.privateAccess}
              </Badge>
            )}
          </p>
        </div>
        <button type="button" onClick={() => setConfirming(true)} className={ghostButton}>
          {L.disconnect}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-1 basis-64 items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 transition-colors focus-within:border-brand">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={L.search}
            aria-label={L.search}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-[14px]"
          />
        </label>
        <Checkbox checked={hideForks} onChange={setHideForks}>
          {L.hideForks}
        </Checkbox>
      </div>

      <div className="mt-4">
        {waiting ? (
          <LoadProgress percent={load.percent} className={loadCenter} />
        ) : repos === null ? (
          <Failed onRetry={() => setAttempt((value) => value + 1)} className="mt-10" />
        ) : (repos ?? []).length === 0 ? (
          <Notice title={L.empty} body={L.emptyBody} className="mt-10" />
        ) : shown.length === 0 ? (
          <Notice title={L.noMatch} className="mt-10" />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {shown.slice(0, count).map((repo) => (
                <RepoRow key={repo.fullName} repo={repo} mine={repo.owner.toLowerCase() === connection.login?.toLowerCase()} picked={picked.includes(repo.fullName)} locked={full} onToggle={() => toggle(repo.fullName)} />
              ))}
            </ul>
            {more}
          </>
        )}
      </div>

      {/* 고르는 동안 아래에 붙어 있어서, 목록이 길어도 만들기 버튼을 찾지 않아요. */}
      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-gray-200 bg-white py-4">
        <p className="min-w-0 flex-1 text-[13px] text-gray-500">{L.pickHint(picked.length)}</p>
        <button type="button" disabled={picked.length === 0} onClick={() => void make()} className={primaryButton}>
          {L.make}
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title={L.disconnectTitle}
          body={L.disconnectBody}
          confirm={L.disconnect}
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            void disconnectGithub().then((ok) => {
              if (!ok) return
              track('github_disconnect')
              showToast(pick(TEXT).disconnected)
              onDisconnected()
            })
          }}
        />
      )}
    </div>
  )
}

/** 레포 한 줄이에요. 누르면 고르고 다시 누르면 풀어요. 다 골랐으면 나머지 줄은 흐려지고 눌리지 않아요. */
function RepoRow({ repo, mine, picked, locked, onToggle }: { repo: GithubRepo; mine: boolean; picked: boolean; locked: boolean; onToggle: () => void }) {
  const L = useMessages(TEXT)
  const disabled = locked && !picked
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={picked}
        title={disabled ? L.full : undefined}
        className={`flex w-full items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
          picked ? 'bg-brand-soft' : disabled ? 'bg-gray-50 opacity-50' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border ${picked ? 'border-brand bg-brand' : 'border-gray-300 bg-white'}`}>
          {picked && <CheckIcon className="size-3 text-white" strokeWidth={2.2} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={`truncate text-[14px] font-semibold ${picked ? 'text-brand-hover' : 'text-gray-900'}`}>{mine ? repo.name : repo.fullName}</span>
            {repo.privateRepo && (
              <Badge tone="white" className="gap-1">
                <LockIcon className="size-3" />
                {L.private}
              </Badge>
            )}
            {repo.fork && <Badge tone="white">{L.fork}</Badge>}
            {repo.archived && <Badge tone="white">{L.archived}</Badge>}
          </span>
          {repo.description && <span className="mt-1 line-clamp-1 block text-[12.5px] text-gray-500">{repo.description}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-400">
            {repo.language && <span>{repo.language}</span>}
            {repo.pushedAt && <span>{L.pushed(formatWhen(repo.pushedAt))}</span>}
          </span>
        </span>
      </button>
    </li>
  )
}
