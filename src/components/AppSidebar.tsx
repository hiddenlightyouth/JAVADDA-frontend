import { useEffect, useRef, useState, type HTMLAttributes, type MouseEvent } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { isWebApp } from '../lib/app'
import { track } from '../lib/analytics'
import { signOut, useAuth, type Me } from '../lib/auth'
import { openBugReport, useFeedback } from '../lib/feedback'
import { companyOf, useReportPosting, useReports, useResume, useResumeShelf, type Report } from '../lib/gap'
import { byResume, byUrgency, DeleteReportDialog, removeReport, REPORT_LIST_TEXT, UrgencyLabel, type ResumeGroup, type Urgency } from './History'
import { Kbd } from './Shortcuts'
import { ScriptMark } from './LofyScript'
import { messages, useMessages } from '../lib/i18n'
import { readJson, writeJson } from '../lib/storage'
import { openPlans, percentOf, refreshUsage, useUsage, type PlanId } from '../lib/usage'
import { BookIcon, BugIcon, CalendarIcon, CheckIcon, ChevronDownIcon, ChevronUpDownIcon, DocumentIcon, DotsIcon, PersonIcon, PinIcon, PlusIcon, SearchIcon, SettingsIcon, ShieldIcon, SignOutIcon, StarIcon } from './Icons'
import { menuDangerItem, menuItem as menuRow, menuPanel, primaryButtonMd } from './ui'
import { fitColor, Tip } from './GapParts'

const TEXT = messages({
  ko: {
    new: '새 진단',
    explore: '공고 탐색',
    calendar: '마감 달력',
    recommend: '추천 공고',
    recommendLocked: '이력서를 먼저 등록하세요',
    resume: '내 이력서',
    resumeReady: '이력서 등록됨',
    blogs: '기술 블로그',
    me: '내 정보',
    admin: '관리자',
    signOut: '로그아웃',
    changePlan: '업그레이드',
    weekly: (percent: number) => `${percent}% 사용됨`,
    reset: (left: { days: number; hours: number }) => (left.days > 0 ? `${left.days}일 후 초기화` : `${Math.max(1, left.hours)}시간 후 초기화`),
    settings: '설정',
    bug: '버그 신고',
    login: '로그인',
  },
  en: {
    new: 'New diagnosis',
    explore: 'Explore jobs',
    calendar: 'Deadlines',
    recommend: 'Recommended',
    recommendLocked: 'Upload your resume first',
    resume: 'My resume',
    resumeReady: 'Resume added',
    blogs: 'Tech blogs',
    me: 'Account',
    admin: 'Admin',
    signOut: 'Sign out',
    changePlan: 'Upgrade',
    weekly: (percent: number) => `${percent}% used`,
    reset: (left: { days: number; hours: number }) =>
      left.days > 0 ? `Resets in ${left.days} ${left.days === 1 ? 'day' : 'days'}` : `Resets in ${Math.max(1, left.hours)} ${left.hours > 1 ? 'hours' : 'hour'}`,
    settings: 'Settings',
    bug: 'Report a bug',
    login: 'Sign in',
  },
})

/** 사용량이 다시 채워질 때까지 남은 날과 시간이에요. 하루가 넘게 남으면 날로, 하루 안이면 시간으로 적어요. */
function resetLeft(value: string): { days: number; hours: number } | null {
  const ms = new Date(value).getTime() - Date.now()
  if (Number.isNaN(ms) || ms <= 0) return null
  const hours = Math.ceil(ms / 3_600_000)
  return { days: hours >= 24 ? Math.ceil(ms / 86_400_000) : 0, hours }
}

type SidebarPage = 'explore' | 'recommend' | 'calendar' | 'resume' | 'blogs' | 'articles' | 'me' | 'history' | 'admin' | null

/** 접어 둔 이력서 폴더의 아이디예요. 이 기기에 기억해요. */
const CLOSED_FOLDERS_KEY = 'whoisloafing:sidebar-closed-resumes'
/** 폴더마다 끌어 옮겨 정한 리포트 순서예요. 서버에는 순서를 두지 않아서 이 기기에 기억해요. */
const REPORT_ORDER_KEY = 'whoisloafing:sidebar-report-order'
/** 고정한 리포트의 아이디예요. 고정한 리포트는 폴더 맨 위에 와요. 이 기기에 기억해요. */
const PINNED_REPORTS_KEY = 'whoisloafing:sidebar-pinned-reports'

interface Props {
  /** 지금 열려 있는 리포트. 목록에서 강조해요. */
  activeReportId: string | null
  /** 지금 보고 있는 화면. 위쪽 링크를 강조해요. */
  page: SidebarPage
  onNew: () => void
  onExplore: () => void
  onRecommend: () => void
  /** 마감 달력을 열어요. */
  onCalendar: () => void
  onResume: () => void
  /** 기술 블로그 요약을 열어요. */
  onBlogs: () => void
  onOpenReport: (id: string) => void
  /** 내 리포트 화면(전체 목록)을 열어요. */
  onHistory: () => void
  /** 목록에서 리포트를 지웠을 때 불러요. 열려 있는 리포트면 화면도 맞춰요. */
  onReportDeleted: (id: string) => void
  onMe: () => void
  /** 앱의 설정 창을 띄워요. */
  onSettings: () => void
  /** 설정 창이 떠 있는지. 떠 있는 동안 설정 버튼을 켜진 것으로 보여줘요. */
  settingsOpen: boolean
  /** 관리자 화면을 열어요. 관리자 계정일 때만 넘기고, 아니면 메뉴에 보여주지 않아요. */
  onAdmin?: () => void
  /** 로그인했는지. 로그인하지 않았으면 계정 버튼 자리에 로그인 버튼을 보여줘요. */
  signedIn: boolean
  onLogin?: () => void
}

const link = 'relative flex h-9 w-full items-center rounded-xl px-3 text-left text-[13px] font-medium transition-colors'
const tone = (active: boolean) => (active ? 'bg-gray-200/70 text-gray-900' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900')
/** 사이드바 아래의 아이콘 버튼이에요. 회색 사이드바 위라 한 단계 짙은 회색으로 깔려요. */
const sideIconButton = 'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-gray-200/50 hover:text-gray-700'

const plain = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)

/** 리포트 줄을 끌어 옮길 때 놓일 자리예요. 위로 옮기면 그 줄의 위, 아래로 옮기면 아래에 메인 컬러 선이 생겨요. */
type DropMark = 'before' | 'after' | null

function ReportRow({ report, urgency, active, menuOpen, pinned, drag, dragging, mark, onOpen, onToggleMenu, onCloseMenu, onTogglePin, onDelete }: {
  report: Report
  urgency: Urgency
  active: boolean
  menuOpen: boolean
  pinned: boolean
  /** 끌어 옮기기에 쓰는 이벤트예요. */
  drag: HTMLAttributes<HTMLLIElement>
  dragging: boolean
  mark: DropMark
  onOpen: () => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  const menuRef = useRef<HTMLLIElement>(null)
  const list = useMessages(REPORT_LIST_TEXT)
  const company = companyOf(report.companyId)
  const posting = useReportPosting(report.postingId)

  useDismiss(menuOpen, menuRef, onCloseMenu)

  return (
    <li
      ref={menuRef}
      draggable
      {...drag}
      className={`group relative flex items-center rounded-xl transition-colors ${tone(active || menuOpen)} ${dragging ? 'opacity-40' : urgency.kind === 'closed' && !active ? 'opacity-60' : ''} ${
        mark ? `before:absolute before:inset-x-2 before:h-0.5 before:rounded-full before:bg-brand ${mark === 'before' ? 'before:-top-px' : 'before:-bottom-px'}` : ''
      }`}
    >
      <a
        href={`/r/${report.id}`}
        aria-current={active ? 'page' : undefined}
        onClick={(event) => {
          if (!plain(event)) return
          event.preventDefault()
          onOpen()
        }}
        className="min-w-0 flex-1 px-3 py-2"
      >
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
          {pinned && <PinIcon className="size-3 shrink-0 text-gray-400" label={list.pinned} />}
          <span className="min-w-0 truncate">{company.name}</span>
          {report.status === 'done' && <span className={`shrink-0 text-[12px] font-medium tabular-nums ${fitColor(report.fitScore).text}`}>{report.fitScore}%</span>}
        </p>
        <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-gray-400">
          <span className="min-w-0 truncate">{posting?.title ?? ''}</span>
          {/* 만든 때 대신 마감까지 남은 날을 적어서, 무엇부터 챙길지 바로 보여요. */}
          <UrgencyLabel report={report} urgency={urgency} />
        </p>
      </a>

      {/* 평소에는 자리를 차지하지 않다가, 마우스를 올리면 시간 옆으로 부드럽게 밀고 들어와요. */}
      <div
        className={`flex shrink-0 items-center overflow-hidden transition-[width,opacity] duration-200 ease-out group-hover:w-8 group-hover:opacity-100 group-focus-within:w-8 group-focus-within:opacity-100 ${
          menuOpen ? 'w-8 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <button
          type="button"
          aria-label={list.manage(posting?.title ?? company.name)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
        >
          <DotsIcon />
        </button>
      </div>

      {menuOpen && (
        <div role="menu" className={`absolute top-full right-1 z-10 -mt-1 w-36 origin-top-right ${menuPanel}`}>
          <button type="button" role="menuitem" onClick={onTogglePin} className={menuRow}>
            {pinned ? list.unpin : list.pin}
          </button>
          <button type="button" role="menuitem" onClick={onDelete} className={menuDangerItem}>
            {list.delete}
          </button>
        </div>
      )}
    </li>
  )
}

/** 이력서 폴더의 머리 줄이에요. 서류 아이콘과 이름, 대표 이력서면 메인 컬러 별, 리포트 수가 있고, 누르면 접고 펴요. */
function ResumeFolder({ group, open, onToggle }: { group: ResumeGroup; open: boolean; onToggle: () => void }) {
  const list = useMessages(REPORT_LIST_TEXT)
  const name = group.resume?.name ?? list.deletedResume
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={list.toggle(name)}
      onClick={onToggle}
      className="flex h-8 w-full items-center gap-1.5 rounded-xl px-2 text-left text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-gray-200/50 hover:text-gray-900"
    >
      <ChevronDownIcon className={`size-3 shrink-0 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      <DocumentIcon className="size-3.5 shrink-0 text-gray-400" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {group.primary && <StarIcon filled className="size-3 shrink-0 text-brand" />}
      <span className="shrink-0 text-[11.5px] text-gray-400 tabular-nums">{group.items.length}</span>
    </button>
  )
}

function NavLink({ href, active, onClick, icon, label, shortcut, locked }: { href: string; active: boolean; onClick: () => void; icon: React.ReactNode; label: string; shortcut?: string; locked?: string }) {
  // 아직 쓸 수 없는 메뉴는 흐리게 두고, 마우스를 올리면 왜 쓸 수 없는지 알려줘요.
  if (locked)
    return (
      <Tip text={locked} side="right" className="mt-1.5 flex w-full">
        <span aria-disabled="true" className={`${link} cursor-not-allowed gap-2 text-gray-400`}>
          {icon}
          <span className="flex-1">{label}</span>
        </span>
      </Tip>
    )
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        if (!plain(event)) return
        event.preventDefault()
        onClick()
      }}
      className={`${link} mt-1.5 gap-2 ${tone(active)}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </a>
  )
}

/** 앱 화면 왼쪽의 사이드바예요. 새 진단, 공고 탐색, 추천 공고, 기술 블로그, 내 이력서, 내 리포트 목록과 관리, 내 정보로 가는 링크가 있어요. */
export function AppSidebar({ activeReportId, page, onNew, onExplore, onRecommend, onCalendar, onResume, onBlogs, onOpenReport, onHistory, onReportDeleted, onMe, onSettings, settingsOpen, onAdmin, signedIn, onLogin }: Props) {
  const { me } = useAuth()
  const list = useMessages(REPORT_LIST_TEXT)
  const text = useMessages(TEXT)
  const reports = useReports()
  // 리포트를 만든 이력서마다 폴더로 묶어서 전부 보여줘요. 길어지면 폴더를 접어요.
  const shelf = useResumeShelf()
  const folders = byResume(byUrgency(reports), shelf)
  const [closed, setClosed] = useState<string[]>(() => readJson<string[]>(CLOSED_FOLDERS_KEY, []))
  function toggleFolder(id: string) {
    const next = closed.includes(id) ? closed.filter((each) => each !== id) : [...closed, id]
    track('sidebar_folder_toggle', { open: closed.includes(id) })
    setClosed(next)
    writeJson(CLOSED_FOLDERS_KEY, next)
  }
  // 리포트를 열면 그 리포트가 든 폴더를 한 번 펼쳐요. 그 뒤로는 다시 접을 수 있어요.
  const activeFolder = folders.find((group) => group.items.some((item) => item.report.id === activeReportId))?.id
  useEffect(() => {
    if (!activeFolder) return
    setClosed((list) => {
      if (!list.includes(activeFolder)) return list
      const next = list.filter((each) => each !== activeFolder)
      writeJson(CLOSED_FOLDERS_KEY, next)
      return next
    })
  }, [activeReportId, activeFolder])
  // 폴더 안에서 리포트를 끌어 순서를 바꿔요. 옮긴 적 없는 새 리포트는 맨 위에 마감이 가까운 순서로 와요.
  const [order, setOrder] = useState<Record<string, string[]>>(() => readJson<Record<string, string[]>>(REPORT_ORDER_KEY, {}))
  const [drag, setDrag] = useState<{ folder: string; id: string; over: string | null } | null>(null)
  const [pinned, setPinned] = useState<string[]>(() => readJson<string[]>(PINNED_REPORTS_KEY, []))
  function togglePin(id: string) {
    const next = pinned.includes(id) ? pinned.filter((each) => each !== id) : [...pinned, id]
    track('sidebar_report_pin', { pinned: !pinned.includes(id) })
    setPinned(next)
    writeJson(PINNED_REPORTS_KEY, next)
  }
  function arranged(group: ResumeGroup) {
    const rank = new Map((order[group.id] ?? []).map((id, index) => [id, index]))
    const pin = (id: string) => (pinned.includes(id) ? 0 : 1)
    return [...group.items].sort((a, b) => pin(a.report.id) - pin(b.report.id) || (rank.get(a.report.id) ?? -1) - (rank.get(b.report.id) ?? -1))
  }
  function move(group: ResumeGroup, id: string, target: string) {
    const ids = arranged(group).map((item) => item.report.id)
    const from = ids.indexOf(id)
    const to = ids.indexOf(target)
    if (from < 0 || to < 0 || from === to) return
    ids.splice(to, 0, ...ids.splice(from, 1))
    const next = { ...order, [group.id]: ids }
    track('sidebar_report_move', {})
    setOrder(next)
    writeJson(REPORT_ORDER_KEY, next)
  }
  const resume = useResume()
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Report | null>(null)

  return (
    <aside className="relative z-30 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      {isWebApp ? (
        // 웹에서는 왼쪽 위의 사이드바 버튼 옆에 로고를 두고, 누르면 새 진단 화면으로 가요. 높이는 헤더와 맞춰요.
        <div className="flex h-14 shrink-0 items-center pl-12">
          <a
            href="/app"
            onClick={(event) => {
              if (!plain(event)) return
              event.preventDefault()
              onNew()
            }}
            className="inline-flex items-center"
          >
            <ScriptMark className="h-6 w-auto" />
          </a>
        </div>
      ) : (
        <div data-app-drag className="h-11 shrink-0" />
      )}

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex h-10 w-full items-center gap-2 rounded-xl bg-white px-3 text-[13px] font-semibold text-gray-900 ring-1 ring-gray-200 transition-colors hover:text-brand"
        >
          <PlusIcon className="size-4" />
          <span className="flex-1 text-left">{text.new}</span>
          <Kbd>N</Kbd>
        </button>
        <NavLink
          href="/explore"
          active={page === 'explore'}
          onClick={() => {
            track('explore_open', { from: 'sidebar' })
            onExplore()
          }}
          label={text.explore}
          shortcut="T"
          icon={
<SearchIcon className="size-4 shrink-0" strokeWidth={1.4} />
          }
        />
        <NavLink
          href="/recommend"
          active={page === 'recommend'}
          onClick={() => {
            track('recommend_open', { from: 'sidebar' })
            onRecommend()
          }}
          label={text.recommend}
          shortcut="R"
          locked={resume ? undefined : text.recommendLocked}
          icon={
<StarIcon className="size-4 shrink-0" />
          }
        />
        <NavLink
          href="/calendar"
          active={page === 'calendar'}
          onClick={() => {
            track('calendar_open', { from: 'sidebar' })
            onCalendar()
          }}
          label={text.calendar}
          shortcut="D"
          icon={<CalendarIcon className="size-4 shrink-0" />}
        />
        <NavLink
          href="/blogs"
          active={page === 'blogs'}
          onClick={() => {
            track('blogs_open', { from: 'sidebar' })
            onBlogs()
          }}
          label={text.blogs}
          shortcut="G"
          icon={
<BookIcon className="size-4 shrink-0" />
          }
        />
        <a
          href="/resume"
          aria-current={page === 'resume' ? 'page' : undefined}
          onClick={(event) => {
            if (!plain(event)) return
            event.preventDefault()
            track('resume_open', { from: 'sidebar' })
            onResume()
          }}
          className={`${link} mt-1.5 gap-2 ${tone(page === 'resume')}`}
        >
          <DocumentIcon />
          <span className="flex-1">{text.resume}</span>
          {/* 대표 이력서가 있으면 오른쪽 끝에 체크를 붙여서, 진단과 추천을 바로 쓸 수 있다는 걸 알려요. 서류 이름은 적지 않아요. */}
          {resume && <CheckIcon className="size-3.5 shrink-0 text-brand" label={text.resumeReady} />}
        </a>
      </div>

      <div className="mt-5 flex items-center justify-between px-6">
        <h2 className="text-xs font-medium text-gray-400">{list.title}</h2>
        {reports.length > 0 && (
          <a
            href="/history"
            aria-current={page === 'history' ? 'page' : undefined}
            onClick={(event) => {
              if (!plain(event)) return
              event.preventDefault()
              track('history_open', { from: 'sidebar' })
              onHistory()
            }}
            className={`text-xs font-medium transition-colors ${page === 'history' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-900'}`}
          >
            {list.all}
          </a>
        )}
      </div>

      <nav className="mt-1.5 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {reports.length === 0 ? (
          <p className="px-3 py-2 text-[13px] leading-relaxed text-gray-500">{list.none}</p>
        ) : (
          <ul className="space-y-1">
            {folders.map((group) => {
              const open = !closed.includes(group.id)
              return (
                <li key={group.id}>
                  <ResumeFolder group={group} open={open} onToggle={() => toggleFolder(group.id)} />
                  {open && (
                    <ul className="mt-0.5 ml-[18px] space-y-0.5 border-l border-gray-200 pl-1">
                      {arranged(group).map(({ report, urgency }, index, list) => (
                        <ReportRow
                          key={report.id}
                          report={report}
                          urgency={urgency}
                          active={report.id === activeReportId}
                          menuOpen={menuFor === report.id}
                          pinned={pinned.includes(report.id)}
                          dragging={drag?.id === report.id}
                          mark={
                            drag && drag.folder === group.id && drag.over === report.id && drag.id !== report.id
                              ? list.findIndex((item) => item.report.id === drag.id) < index
                                ? 'after'
                                : 'before'
                              : null
                          }
                          drag={{
                            onDragStart: (event) => {
                              event.dataTransfer.effectAllowed = 'move'
                              setMenuFor(null)
                              setDrag({ folder: group.id, id: report.id, over: null })
                            },
                            // 다른 이력서 폴더로는 옮기지 않아요.
                            onDragOver: (event) => {
                              if (drag?.folder !== group.id) return
                              event.preventDefault()
                              if (drag.over !== report.id) setDrag({ ...drag, over: report.id })
                            },
                            onDrop: (event) => {
                              event.preventDefault()
                              if (drag?.folder === group.id) move(group, drag.id, report.id)
                              setDrag(null)
                            },
                            onDragEnd: () => setDrag(null),
                          }}
                          onOpen={() => onOpenReport(report.id)}
                          onToggleMenu={() => setMenuFor((value) => (value === report.id ? null : report.id))}
                          onCloseMenu={() => setMenuFor(null)}
                          onTogglePin={() => {
                            setMenuFor(null)
                            togglePin(report.id)
                          }}
                          onDelete={() => {
                            setMenuFor(null)
                            setDeleting(report)
                          }}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <AccountMenu me={signedIn ? me : null} page={page} onMe={onMe} onSettings={onSettings} settingsOpen={settingsOpen} onAdmin={onAdmin} onLogin={signedIn ? undefined : onLogin} />

      {deleting && (
        <DeleteReportDialog
          report={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            removeReport(deleting, 'sidebar')
            onReportDeleted(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </aside>
  )
}

const menuIcon = 'size-4 shrink-0 text-gray-500'

const PLAN_NAMES: Record<PlanId, string> = { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' }

/**
 * 사이드바 맨 아래의 계정 버튼이에요. 누르면 위로 메뉴가 펼쳐져서 내 정보, 관리자 화면으로 가거나 로그아웃해요. 오른쪽에는 설정과 버그 신고 버튼이 있어요.
 * 바깥을 누르거나 Esc를 누르면 닫혀요.
 */
function AccountMenu({ me, page, onMe, onSettings, settingsOpen, onAdmin, onLogin }: {
  me: Me | null
  page: SidebarPage
  onMe: () => void
  onSettings: () => void
  settingsOpen: boolean
  onAdmin?: () => void
  /** 로그인하지 않았으면 넘겨요. 계정 버튼 대신 로그인 버튼을 보여줘요. */
  onLogin?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { ready: canReport } = useFeedback()
  const text = useMessages(TEXT)
  const name = me?.name || text.me
  const usage = useUsage()

  useDismiss(open, ref, () => setOpen(false))

  // 메뉴를 열 때마다 이번 주 사용량을 새로 받아요.
  useEffect(() => {
    if (open) void refreshUsage()
  }, [open])

  const go = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div ref={ref} className="relative flex shrink-0 items-center gap-1 border-t border-gray-200 p-2">
      {open && (
        <div role="menu" className={`absolute bottom-full left-2 mb-1 w-[272px] origin-bottom-left ${menuPanel}`}>
          {me?.email && <p className="truncate px-2.5 pt-1.5 pb-2 text-[12.5px] text-gray-500">{me.email}</p>}
          {usage && (
            <div className="px-2.5 pb-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="text-[12px] text-gray-500 tabular-nums">{text.weekly(percentOf(usage.used, usage.limit))}</p>
                <button type="button" onClick={go(() => openPlans('menu'))} className="shrink-0 text-[12px] font-medium text-brand hover:text-brand-hover">
                  {text.changePlan}
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                <div className="h-full bg-brand" style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }} />
              </div>
              {resetLeft(usage.resetAt) && <p className="mt-1.5 text-[11.5px] text-gray-400">{text.reset(resetLeft(usage.resetAt)!)}</p>}
            </div>
          )}

          <button type="button" role="menuitem" onClick={go(onMe)} className={menuRow}>
            <PersonIcon className={menuIcon} />
            {text.me}
          </button>
          {onAdmin && (
            <button type="button" role="menuitem" onClick={go(onAdmin)} className={menuRow}>
              <ShieldIcon className={menuIcon} />
              {text.admin}
            </button>
          )}

          <div className="my-1.5 border-t border-gray-100" />

          <button
            type="button"
            role="menuitem"
            onClick={go(() => {
              track('auth_logout', { from: 'menu' })
              void signOut()
            })}
            className={menuRow}
          >
            <SignOutIcon className={menuIcon} />
            {text.signOut}
          </button>
        </div>
      )}

      {onLogin ? (
        <button
          type="button"
          onClick={() => {
            track('account_nav_click', { page: 'login', from: 'sidebar' })
            onLogin()
          }}
          className={`${primaryButtonMd} min-w-0 flex-1`}
        >
          {text.login}
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            if (!open) track('app_menu_open')
            setOpen((value) => !value)
          }}
          className={`flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left transition-colors ${tone(open || page === 'me' || page === 'articles' || page === 'admin')}`}
        >
          {/* 프로필 사진 대신 이름의 첫 글자를 동그라미에 넣어요. */}
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-hover">
            {[...(me?.name?.trim() || '?')][0].toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-gray-900">{name}</span>
            {usage?.plan && <span className="block truncate text-[12px] text-gray-500">{PLAN_NAMES[usage.plan]}</span>}
          </span>
          <ChevronUpDownIcon />
        </button>
      )}
      <button
        type="button"
        aria-label={text.settings}
        title={text.settings}
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={onSettings}
        className={`${sideIconButton} ${settingsOpen ? 'bg-gray-200/70 text-gray-900' : 'text-gray-400'}`}
      >
        <SettingsIcon />
      </button>
      {canReport && (
        <button
          type="button"
          aria-label={text.bug}
          title={text.bug}
          onClick={openBugReport}
          className={`${sideIconButton} text-gray-400`}
        >
          <BugIcon />
        </button>
      )}
    </div>
  )
}
