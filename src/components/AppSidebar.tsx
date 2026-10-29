import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { isWebApp } from '../lib/app'
import { track } from '../lib/analytics'
import { signOut, useAuth, type Me } from '../lib/auth'
import { openBugReport, useFeedback } from '../lib/feedback'
import { formatWhen } from '../lib/format'
import { companyOf, postingOf, useReports, useResume, type Report } from '../lib/gap'
import { DeleteReportDialog, removeReport, REPORT_LIST_TEXT } from './History'
import { Kbd } from './Shortcuts'
import { ScriptMark } from './LofyScript'
import { messages, useMessages } from '../lib/i18n'
import { openPlans, percentOf, refreshUsage, useUsage, type PlanId } from '../lib/usage'
import { PlusIcon } from './Icons'
import { Tip } from './GapParts'

const TEXT = messages({
  ko: {
    new: '새 진단',
    explore: '공고 탐색',
    recommend: '추천 공고',
    recommendLocked: '이력서를 먼저 등록하세요',
    resume: '내 이력서',
    resumeNone: '아직 올리지 않았어요',
    me: '내 정보',
    admin: '관리자',
    signOut: '로그아웃',
    changePlan: '업그레이드',
    weekly: (percent: number) => `${percent}% 사용됨`,
    reset: (left: { days: number; hours: number }) => (left.days > 0 ? `${left.days}일 후 초기화` : `${Math.max(1, left.hours)}시간 후 초기화`),
    settings: '설정',
    bug: '버그 신고',
    login: '로그인',
    pending: '진단 중',
  },
  en: {
    new: 'New diagnosis',
    explore: 'Explore jobs',
    recommend: 'Recommended',
    recommendLocked: 'Upload your resume first',
    resume: 'My resume',
    resumeNone: 'Not uploaded yet',
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
    pending: 'Analyzing',
  },
})

/** 사용량이 다시 채워질 때까지 남은 날과 시간이에요. 하루가 넘게 남으면 날로, 하루 안이면 시간으로 적어요. */
function resetLeft(value: string): { days: number; hours: number } | null {
  const ms = new Date(value).getTime() - Date.now()
  if (Number.isNaN(ms) || ms <= 0) return null
  const hours = Math.ceil(ms / 3_600_000)
  return { days: hours >= 24 ? Math.ceil(ms / 86_400_000) : 0, hours }
}

export type SidebarPage = 'explore' | 'recommend' | 'resume' | 'articles' | 'me' | 'admin' | null

interface Props {
  /** 지금 열려 있는 리포트. 목록에서 강조해요. */
  activeReportId: string | null
  /** 지금 보고 있는 화면. 위쪽 링크를 강조해요. */
  page: SidebarPage
  onNew: () => void
  onExplore: () => void
  onRecommend: () => void
  onResume: () => void
  onOpenReport: (id: string) => void
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
const menuItem = 'block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-gray-50 disabled:text-gray-400'

const plain = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)

function ReportRow({ report, active, menuOpen, onOpen, onToggleMenu, onCloseMenu, onDelete }: {
  report: Report
  active: boolean
  menuOpen: boolean
  onOpen: () => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onDelete: () => void
}) {
  const menuRef = useRef<HTMLLIElement>(null)
  const list = useMessages(REPORT_LIST_TEXT)
  const text = useMessages(TEXT)
  const company = companyOf(report.companyId)
  const posting = postingOf(report.postingId)

  useDismiss(menuOpen, menuRef, onCloseMenu)

  return (
    <li ref={menuRef} className={`group relative flex items-center rounded-xl transition-colors ${tone(active || menuOpen)}`}>
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
          <span className="min-w-0 truncate">{company.name}</span>
          {report.status === 'done' && <span className="shrink-0 text-[12px] font-medium text-brand tabular-nums">{report.fitScore}%</span>}
        </p>
        <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-gray-400">
          <span className="min-w-0 truncate">{posting?.title ?? ''}</span>
          <span className="shrink-0">{report.status === 'pending' ? text.pending : formatWhen(report.createdAt)}</span>
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
          className="flex size-7 shrink-0 items-center justify-center gap-[3px] rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
        >
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </button>
      </div>

      {menuOpen && (
        <div role="menu" className="absolute top-full right-1 z-10 -mt-1 w-36 origin-top-right animate-pop rounded-2xl border border-gray-200 bg-white p-1.5">
          <button type="button" role="menuitem" onClick={onDelete} className={`${menuItem} text-red-500`}>
            {list.delete}
          </button>
        </div>
      )}
    </li>
  )
}

function NavLink({ href, active, onClick, icon, label, shortcut, locked }: { href: string; active: boolean; onClick: () => void; icon: React.ReactNode; label: string; shortcut?: string; locked?: string }) {
  // 아직 쓸 수 없는 메뉴는 흐리게 두고, 마우스를 올리면 왜 쓸 수 없는지 알려줘요.
  if (locked)
    return (
      <Tip text={locked} className="mt-1.5 flex w-full">
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

/** 앱 화면 왼쪽의 사이드바예요. 새 진단, 공고 탐색, 추천 공고, 내 이력서, 내 리포트 목록과 관리, 내 정보로 가는 링크가 있어요. */
export function AppSidebar({ activeReportId, page, onNew, onExplore, onRecommend, onResume, onOpenReport, onReportDeleted, onMe, onSettings, settingsOpen, onAdmin, signedIn, onLogin }: Props) {
  const { me } = useAuth()
  const list = useMessages(REPORT_LIST_TEXT)
  const text = useMessages(TEXT)
  const reports = useReports()
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
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
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
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z" />
            </svg>
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
          className={`${link} mt-1.5 h-auto gap-2 py-2 ${tone(page === 'resume')}`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" className="size-4 shrink-0" aria-hidden="true">
            <path d="M4 1.75h5.5L12.5 4.75v9a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V2.5a.75.75 0 0 1 .75-.75Z" />
            <path d="M6 7.5h4.5M6 10h4.5M6 5h2" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block">{text.resume}</span>
            {/* 올려 둔 서류의 이름을 옅게 같이 적어서, 어떤 서류 기준으로 진단하는지 보여줘요. */}
            <span className="block truncate text-[11.5px] font-normal text-gray-400">{resume ? resume.name : text.resumeNone}</span>
          </span>
        </a>
      </div>

      <h2 className="mt-5 px-6 text-xs font-medium text-gray-400">{list.title}</h2>

      <nav className="mt-1.5 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {reports.length === 0 ? (
          <p className="px-3 py-2 text-[13px] leading-relaxed text-gray-500">{list.none}</p>
        ) : (
          <ul className="space-y-0.5">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                active={report.id === activeReportId}
                menuOpen={menuFor === report.id}
                onOpen={() => onOpenReport(report.id)}
                onToggleMenu={() => setMenuFor((open) => (open === report.id ? null : report.id))}
                onCloseMenu={() => setMenuFor(null)}
                onDelete={() => {
                  setMenuFor(null)
                  setDeleting(report)
                }}
              />
            ))}
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

const menuRow = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] text-gray-800 transition-colors hover:bg-gray-100'
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
        <div role="menu" className="absolute bottom-full left-2 mb-1 w-[272px] origin-bottom-left animate-pop rounded-2xl border border-gray-200 bg-white p-1.5">
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
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className={menuIcon} aria-hidden="true">
              <circle cx="8" cy="5.5" r="2.5" />
              <path d="M3 13.5c.6-2.2 2.6-3.5 5-3.5s4.4 1.3 5 3.5" strokeLinecap="round" />
            </svg>
            {text.me}
          </button>
          {onAdmin && (
            <button type="button" role="menuitem" onClick={go(onAdmin)} className={menuRow}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className={menuIcon} aria-hidden="true">
                <path d="M8 2l4.5 1.7v3.6c0 2.9-1.8 5.3-4.5 6.4-2.7-1.1-4.5-3.5-4.5-6.4V3.7z" />
              </svg>
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
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={menuIcon} aria-hidden="true">
              <path d="M6.5 2.5h-2a1.5 1.5 0 0 0-1.5 1.5v8a1.5 1.5 0 0 0 1.5 1.5h2M10 5l3 3-3 3M13 8H6.5" />
            </svg>
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
          className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl bg-brand px-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-hover"
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
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 shrink-0 text-gray-400" aria-hidden="true">
            <path d="M5 6.5L8 3.5l3 3M5 9.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <button
        type="button"
        aria-label={text.settings}
        title={text.settings}
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={onSettings}
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-gray-200/50 hover:text-gray-700 ${settingsOpen ? 'bg-gray-200/70 text-gray-900' : 'text-gray-400'}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {canReport && (
        <button
          type="button"
          aria-label={text.bug}
          title={text.bug}
          onClick={openBugReport}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-200/50 hover:text-gray-700"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M5.5 5.5a2.5 2.5 0 0 1 5 0M5 6.5h6a1 1 0 0 1 1 1v2a4 4 0 0 1-8 0v-2a1 1 0 0 1 1-1zM8 8v5.5M4 9H2M14 9h-2M4.5 12L3 13.5M11.5 12l1.5 1.5M4.3 6.8L3 5.5M11.7 6.8L13 5.5" />
          </svg>
        </button>
      )}
    </div>
  )
}
