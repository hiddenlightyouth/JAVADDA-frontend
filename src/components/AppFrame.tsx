import { lazy, Suspense, useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { isWebApp } from '../lib/app'
import { messages, useMessages } from '../lib/i18n'
import { followLink } from '../lib/links'
import { readFlag, writeFlag } from '../lib/storage'
import { CloseIcon, MenuIcon, SidebarIcon } from './Icons'
import { ScriptMark } from './LofyScript'

// 앱에서만 쓰는 화면은 필요할 때만 받아요.
const AppGate = lazy(() => import('./AppGate').then((module) => ({ default: module.AppGate })))
const AppSidebar = lazy(() => import('./AppSidebar').then((module) => ({ default: module.AppSidebar })))

// 화면 공유 중에 화면을 가리는 막은 앱에서만 써요.
const CaptureShield = lazy(() => import('./CaptureShield').then((module) => ({ default: module.CaptureShield })))

// 설정 창은 앱에서만 쓰여서, 열 때만 받아요.
const Settings = lazy(() => import('./Settings').then((module) => ({ default: module.Settings })))

const SIDEBAR_CLOSED_KEY = 'javadda:app-sidebar-closed'

const TEXT = messages({
  ko: {
    closeSidebar: '사이드바 닫기',
    openSidebar: '사이드바 열기',
  },
  en: {
    closeSidebar: 'Close sidebar',
    openSidebar: 'Open sidebar',
  },
})

/** 웹의 /app에서 사이드바를 서랍으로 꺼내는 좁은 화면(768px 미만)인지 */
const NARROW = '(max-width: 767px)'

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => isWebApp && window.matchMedia(NARROW).matches)
  useEffect(() => {
    if (!isWebApp) return
    const query = window.matchMedia(NARROW)
    const onChange = () => setNarrow(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/** 앱의 사이드바를 펴 뒀는지와 접고 펴는 함수. 다음에 켰을 때도 그대로 둬요. */
export function useSidebarOpen() {
  const [open, setOpen] = useState(() => !readFlag(SIDEBAR_CLOSED_KEY))
  const toggle = useCallback((next: boolean) => {
    setOpen(next)
    writeFlag(SIDEBAR_CLOSED_KEY, !next)
  }, [])
  return [open, toggle] as const
}

/** 앱에서 로그인하지 않았을 때 다른 화면 대신 보여주는 로그인 화면이에요. */
export function AppSignedOut() {
  return (
    <Suspense fallback={<div data-app-drag className="h-dvh bg-white" />}>
      <AppGate />
      <CaptureShield />
    </Suspense>
  )
}

interface Props {
  sidebarOpen: boolean
  onToggleSidebar: (open: boolean) => void
  sidebar: Omit<ComponentProps<typeof AppSidebar>, 'onSettings' | 'settingsOpen'>
  children: ReactNode
}

/**
 * 앱에서는 왼쪽에 사이드바를 두고, 오른쪽에 웹과 같은 화면을 보여줘요. 설정 창과 화면 공유 중 가리는 막도 여기서 띄워요.
 * 웹의 /app도 같은 배치예요. 좁은 화면에서는 사이드바를 숨겨 두고, 왼쪽 위 버튼을 누르면 서랍처럼 화면 위로 꺼내요.
 */
export function AppFrame({ sidebarOpen, onToggleSidebar, sidebar, children }: Props) {
  const text = useMessages(TEXT)
  /** 앱의 설정 창이 떠 있는지. 보던 화면은 그대로 두고 그 위에 떠요. */
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => {
    track('settings_open')
    setSettingsOpen(true)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const narrow = useNarrow()
  /** 좁은 화면에서 서랍을 꺼내 뒀는지. 처음에는 넣어 둬요. */
  const [drawerOpen, setDrawerOpen] = useState(false)
  useDismiss(narrow && drawerOpen, null, () => setDrawerOpen(false))
  useEffect(() => {
    if (!narrow) setDrawerOpen(false)
  }, [narrow])
  const open = narrow ? drawerOpen : sidebarOpen
  const toggle = () => (narrow ? setDrawerOpen(!drawerOpen) : onToggleSidebar(!sidebarOpen))

  // 서랍에서 화면을 고르면 서랍을 닫고 그 화면을 보여줘요. 목록을 고치는 일(공유 취소, 지우기)과 설정 창은 서랍을 닫지 않아요.
  const closing = <T extends unknown[]>(action: ((...args: T) => void) | undefined) =>
    action && narrow
      ? (...args: T) => {
          setDrawerOpen(false)
          action(...args)
        }
      : action
  const panel = (
    <AppSidebar
      {...sidebar}
      drawer={narrow}
      onNew={closing(sidebar.onNew)!}
      onOpenReport={closing(sidebar.onOpenReport)!}
      onHistory={closing(sidebar.onHistory)!}
      onMe={closing(sidebar.onMe)!}
      onLogin={closing(sidebar.onLogin)}
      onResume={closing(sidebar.onResume)!}
      onExplore={closing(sidebar.onExplore)!}
      onRecommend={closing(sidebar.onRecommend)!}
      onCalendar={closing(sidebar.onCalendar)!}
      onMap={closing(sidebar.onMap)!}
      onBlogs={closing(sidebar.onBlogs)!}
      onContests={closing(sidebar.onContests)!}
      onLabs={closing(sidebar.onLabs)!}
      onAdmin={closing(sidebar.onAdmin)}
      onApiKeys={closing(sidebar.onApiKeys)!}
      onSettings={openSettings}
      settingsOpen={settingsOpen}
    />
  )

  return (
    // 사이드바가 옆에 없으면 화면의 제목 줄이 사이드바 버튼 옆, 같은 줄로 올라가요(index.css의 page-header 규칙).
    <div data-sidebar={narrow ? 'drawer' : sidebarOpen ? 'open' : 'closed'} data-shell={isWebApp ? 'web' : 'mac'} className="relative flex h-dvh bg-white">
      {/* 사이드바 접기 버튼은 늘 같은 자리에 있어서 접어도 펴도 움직이지 않아요. 앱에서는 창 버튼 바로 옆, 웹에서는 왼쪽 위예요. 좁은 화면에서는 서랍을 여는 햄버거 그림이에요. */}
      <button
        type="button"
        aria-label={open ? text.closeSidebar : text.openSidebar}
        aria-expanded={open}
        onClick={toggle}
        className={`absolute z-[31] flex size-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 ${isWebApp ? 'top-3.5 left-3' : 'top-0.5 left-[78px]'}`}
      >
        {narrow ? drawerOpen ? <CloseIcon className="size-4" /> : <MenuIcon /> : <SidebarIcon />}
      </button>
      {/* 휴대폰에서는 맨 위 줄의 사이드바 버튼 옆에 로고를 둬요. 서랍의 로고와 같은 자리, 같은 크기라 서랍을 열고 닫아도 움직이지 않아요.
          화면의 제목 줄은 이 줄 아래로 내려가요(index.css의 data-sidebar='drawer' 규칙). 바탕은 App이 늘 겹쳐 두는 반투명 블러 헤더(h-14)라, 로고만 그 위(z-21)에 얹어요. 헤더 아래에 두면 헤더의 블러에 로고가 뭉개져요. */}
      {narrow && (
        <div className="absolute top-0 left-0 z-[21] flex h-14 items-center pl-12">
          <a href="/app" onClick={followLink(sidebar.onNew)} className="inline-flex items-center">
            <ScriptMark className="h-6 w-auto" />
          </a>
        </div>
      )}
      {open &&
        (narrow ? (
          // 휴대폰에서는 서랍이 화면 전체를 덮어요. 바탕은 반투명이라 뒤의 화면이 흐리게 비쳐요. 빨리 떠야 빠릿하게 느껴져서 짧게 들어와요.
          <div className="fixed inset-0 z-30 flex animate-drawer-in">
            <Suspense fallback={<aside className="w-full bg-gray-50/75 backdrop-blur-2xl" />}>{panel}</Suspense>
          </div>
        ) : (
          <Suspense fallback={<aside data-app-drag className="w-72 shrink-0 border-r border-gray-200 bg-gray-50" />}>{panel}</Suspense>
        ))}
      {children}
      {settingsOpen && (
        <Suspense fallback={null}>
          <Settings onClose={closeSettings} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <CaptureShield />
      </Suspense>
    </div>
  )
}
