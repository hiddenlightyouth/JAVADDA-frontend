import { useCallback, useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { isApp, openInBrowser } from '../lib/app'
import { addGithubProjects, connectGithub, createGithubResume, disconnectGithub, fetchGithubConnection, fetchGithubRepos, MAX_GITHUB_PROJECTS, MAX_GITHUB_REPOS, PROGRESS_START, type GithubConnection, type GithubRepo, type ProgressState, type Resume } from '../lib/gap'
import { appGithubConnect, isGithubReturn, onAppGithubReturn, startAppGithubConnect, startGithubConnect, takeGithubReturn, type GithubReturn } from '../lib/githubConnect'
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
    appWaiting: '브라우저에서 GitHub 권한을 허용하세요',
    reopen: '브라우저 다시 열기',
    openBrowser: '브라우저에서 연결하기',
    linkCopied: '주소를 복사했어요. 브라우저 주소창에 붙여 넣어 연결해 주세요.',
    recheck: '다시 확인',
    notReady: '알 수 없는 오류가 발생했습니다.',
    connected: '연결했어요. 이력서로 만들 레포를 골라 주세요.',
    canceled: 'GitHub 연결을 취소했어요.',
    invalid: '연결 요청을 확인하지 못했어요. 처음부터 다시 시도해 주세요.',
    privateAccess: '인증 됨',
    disconnect: '연결 해제',
    disconnectTitle: 'GitHub 연결을 끊을까요?',
    disconnectBody: 'GitHub에 준 권한도 함께 거둬요. 이미 만든 이력서는 그대로 남아요.',
    disconnected: 'GitHub 연결을 끊었어요.',
    search: '검색',
    hideForks: '포크 숨기기',
    private: 'Private',
    fork: '포크',
    archived: '보관됨',
    empty: '볼 수 있는 레포가 없어요',
    emptyBody: 'GitHub에 레포를 올리거나, 조직의 레포라면 조직에서 이 앱의 접근을 허락해 주세요.',
    noMatch: '찾는 레포가 없어요',
    pickHint: (count: number) => `${count}개 선택 됨`,
    make: '이력서 만들기',
    made: '레포를 읽어 이력서와 포트폴리오를 만들었어요. 프로젝트 경험과 역량을 확인해 주세요.',
    addRepos: 'GitHub에서 불러오기',
    added: 'GitHub에서 불러왔어요. 새 프로젝트와 포트폴리오를 확인해 주세요.',
    allAdded: '더할 수 있는 레포가 없어요',
    allAddedBody: '볼 수 있는 레포가 모두 이 이력서에 들어 있어요.',
    full: '더 고를 수 없어요',
  },
  en: {
    connectTitle: 'Connect your GitHub account',
    connectBody: 'We read your repositories, private ones included, and write resume projects and skills from your own commits and pull requests. We never store your code, and you can disconnect at any time.',
    connect: 'Connect GitHub',
    appConnectBody: 'Connecting happens in your browser. Come back and press Check again once you are done.',
    appWaiting: 'Allow access to GitHub in your browser',
    reopen: 'Open browser again',
    openBrowser: 'Connect in browser',
    linkCopied: 'Link copied. Paste it into your browser to connect.',
    recheck: 'Check again',
    notReady: 'An unknown error occurred.',
    connected: 'Connected. Pick the repositories to turn into a resume.',
    canceled: 'GitHub connection was canceled.',
    invalid: "We couldn't verify the request. Please start over.",
    privateAccess: 'Verified',
    disconnect: 'Disconnect',
    disconnectTitle: 'Disconnect GitHub?',
    disconnectBody: 'We also revoke the access you gave on GitHub. Resumes you made stay.',
    disconnected: 'GitHub disconnected.',
    search: 'Search',
    hideForks: 'Hide forks',
    private: 'Private',
    fork: 'Fork',
    archived: 'Archived',
    empty: 'No repositories to show',
    emptyBody: 'Push a repository to GitHub, or ask your organization to allow this app.',
    noMatch: 'No matching repositories',
    pickHint: (count: number) => `${count} selected`,
    make: 'Create resume',
    made: 'Done. Please check the projects, portfolio and skills we wrote.',
    addRepos: 'Import from GitHub',
    added: 'Imported. Please check the new projects and portfolio.',
    allAdded: 'No repositories left to add',
    allAddedBody: 'Every repository you can see is already in this resume.',
    full: 'You cannot pick more',
  },
})

/** 연결한 계정이에요. undefined는 묻는 중, null은 서버에 닿지 못한 것이에요. */
type ConnectionState = GithubConnection | null | undefined

/** addTo를 넘기면 새 이력서를 만들지 않고 그 GitHub 이력서에 레포를 더해요. 이미 들어 있는 레포는 목록에서 빼요. */
export function GithubResume({ addTo, onDone, onWorking }: { addTo?: Resume; onDone: (resume: Resume) => void; onWorking: (working: boolean) => void }) {
  const L = useMessages(TEXT)
  const config = useServerConfig()
  const [connection, setConnection] = useState<ConnectionState>(undefined)
  const [attempt, setAttempt] = useState(0)
  const disconnected = useCallback(() => setConnection({ connected: false }), [])
  const recheck = useCallback(() => setAttempt((value) => value + 1), [])
  /** 앱에서 브라우저로 GitHub 권한 화면을 열어 두고 돌아오기를 기다리는 중이에요. */
  const [browserOpen, setBrowserOpen] = useState(false)

  /** GitHub에서 돌아온 값으로 연결을 마쳐요. 브라우저의 서류 추가 화면과 앱이 같이 써요. */
  const finish = useCallback(async (back: GithubReturn): Promise<GithubConnection | null> => {
    if (!back.ok) {
      showToast(back.canceled ? pick(TEXT).canceled : pick(TEXT).invalid)
      return null
    }
    const connected = await connectGithub(back.code, back.redirectUri)
    track('github_connect', { success: !!connected })
    if (connected) showToast(pick(TEXT).connected)
    return connected
  }, [])

  // 앱에서는 브라우저에서 권한을 허용하면 앱이 다시 열리며 값을 넘겨 줘요. 받으면 바로 연결해요.
  useEffect(() => {
    if (!appGithubConnect) return
    return onAppGithubReturn((back) => {
      setBrowserOpen(false)
      setConnection(undefined)
      void finish(back).then((connected) => setConnection(connected ?? { connected: false }))
    })
  }, [finish])

  useEffect(() => {
    let stale = false
    setConnection(undefined)
    async function load() {
      // GitHub 권한 화면에서 돌아왔으면 받은 코드로 먼저 연결해요.
      if (isGithubReturn()) {
        const connected = await finish(takeGithubReturn())
        if (connected) {
          if (!stale) setConnection(connected)
          return
        }
      }
      const next = await fetchGithubConnection()
      if (!stale) setConnection(next)
    }
    void load()
    return () => {
      stale = true
    }
  }, [attempt, finish])

  const waiting = useLoadHold(connection === undefined || config === null)
  if (waiting) return <LoadProgress percent={connection === undefined ? 40 : 100} compact className="max-w-md" />
  if (connection === null) return <Failed onRetry={() => setAttempt((value) => value + 1)} className="mt-10" />
  if (!connection?.connected) {
    const clientId = config?.githubConnectClientId
    if (!clientId) return <Notice title={L.notReady} className="mt-10" />
    return (
      <ConnectCard
        clientId={clientId}
        waiting={browserOpen}
        onStart={() => {
          track('github_connect_click', { from: 'app' })
          startAppGithubConnect(clientId)
          setBrowserOpen(true)
        }}
        onRecheck={recheck}
      />
    )
  }
  return <RepoPicker connection={connection} addTo={addTo} onDone={onDone} onWorking={onWorking} onDisconnected={disconnected} />
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

/**
 * 연결하지 않았을 때의 칸이에요. 앱 2.4부터는 GitHub 권한 화면을 기본 브라우저로 열고, 허용하면 앱이 다시 열리며 바로 연결돼요(waiting 동안 기다려요).
 * 그 전 앱은 웹의 서류 추가 화면을 브라우저로 열어 그곳에서 연결하고, 앱으로 돌아오면(창이 다시 앞에 오면) 알아서 다시 확인해요.
 */
function ConnectCard({ clientId, waiting, onStart, onRecheck }: { clientId: string; waiting: boolean; onStart: () => void; onRecheck: () => void }) {
  const L = useMessages(TEXT)
  const legacyApp = isApp && !appGithubConnect

  // 예전 앱은 브라우저에서 연결하고 돌아오면 창이 다시 앞에 와서, 그때 연결됐는지 다시 물어요.
  useEffect(() => {
    if (!legacyApp) return
    window.addEventListener('focus', onRecheck)
    return () => window.removeEventListener('focus', onRecheck)
  }, [legacyApp, onRecheck])

  return (
    <div className="flex flex-col items-start rounded-2xl bg-gray-50 p-5 sm:p-7">
      <span className="flex size-14 items-center justify-center rounded-full bg-white text-gray-900">
        <GitHubMark className="size-6" />
      </span>
      <h2 className="mt-6 text-[17px] font-semibold text-gray-900">{L.connectTitle}</h2>
      <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-gray-500">{legacyApp ? L.appConnectBody : waiting ? L.appWaiting : L.connectBody}</p>
      <div className="mt-6 flex items-center gap-2">
        {legacyApp ? (
          <>
            <button type="button" onClick={openConnectInBrowser} className={primaryButton}>
              <GitHubMark className="size-4" />
              {L.openBrowser}
            </button>
            <button type="button" onClick={onRecheck} className={quietButton}>
              {L.recheck}
            </button>
          </>
        ) : appGithubConnect ? (
          <button type="button" onClick={onStart} className={waiting ? quietButton : primaryButton}>
            <GitHubMark className="size-4" />
            {waiting ? L.reopen : L.connect}
          </button>
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
function RepoPicker({ connection, addTo, onDone, onWorking, onDisconnected }: {
  connection: GithubConnection
  addTo?: Resume
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

  const added = useMemo(() => new Set((addTo?.projects ?? []).map((project) => project.repo.toLowerCase())), [addTo])
  const available = useMemo(() => (repos ?? []).filter((repo) => !added.has(repo.fullName.toLowerCase())), [repos, added])
  /** 한 번에 3개까지이고, 더할 때는 서류 하나에 6개를 넘지 않게 남은 자리만큼이에요. */
  const max = addTo ? Math.max(0, Math.min(MAX_GITHUB_REPOS, MAX_GITHUB_PROJECTS - added.size)) : MAX_GITHUB_REPOS
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase()
    return available.filter((repo) => {
      if (hideForks && repo.fork) return false
      if (!words) return true
      return `${repo.fullName} ${repo.description ?? ''} ${repo.language ?? ''}`.toLowerCase().includes(words)
    })
  }, [available, query, hideForks])
  const { count, more } = useShowMore(shown.length, `${query}|${hideForks}`)
  const full = picked.length >= max

  const toggle = (name: string) => setPicked((list) => (list.includes(name) ? list.filter((item) => item !== name) : list.length >= max ? list : [...list, name]))

  async function make() {
    if (picked.length === 0) return
    setWorking(PROGRESS_START)
    onWorking(true)
    const resume = addTo ? await addGithubProjects(addTo.id, picked, setWorking) : await createGithubResume(picked, setWorking)
    setWorking(null)
    onWorking(false)
    if (resume === 'disconnected') return onDisconnected()
    if (!resume) return
    if (addTo) track('resume_github_add', { repos: picked.length })
    else track('resume_upload', { source: 'github', skills: resume.skills.length, repos: picked.length })
    showToast(addTo ? pick(TEXT).added : pick(TEXT).made)
    onDone(resume)
  }

  // 레포마다 AI가 글을 써서 1분이 넘게 걸릴 수 있어요. 그동안은 고른 레포 이름과 진행 막대만 보여줘요.
  if (working) {
    return (
      <div className="rounded-2xl bg-gray-50 p-4 sm:p-6">
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
                <CheckIcon className="size-3 text-brand" />
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
        <label className="flex h-10 min-w-0 flex-1 basis-64 items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-4 transition-colors focus-within:border-brand">
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
        ) : available.length === 0 ? (
          <Notice title={L.allAdded} body={L.allAddedBody} className="mt-10" />
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

      {/* 고르는 동안 아래에 붙어 있어서, 목록이 길어도 만들기 버튼을 찾지 않아요. 스크롤 칸의 아래 여백(pb-16)만큼 붙는 자리가 올라가서, 그만큼 내려 화면 맨 아래에 붙여요. */}
      <div className="sticky bottom-[-4rem] mt-6 flex items-center gap-3 border-t border-gray-200 bg-white py-4">
        <p className="min-w-0 flex-1 text-[13px] text-gray-500">{L.pickHint(picked.length)}</p>
        <button type="button" disabled={picked.length === 0} onClick={() => void make()} className={primaryButton}>
          {addTo ? L.addRepos : L.make}
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
          {repo.language && <span className="mt-1.5 block text-[12px] text-gray-400">{repo.language}</span>}
        </span>
      </button>
    </li>
  )
}
