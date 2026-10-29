import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { AdminTab } from './components/Admin'
import type { ReportTab } from './components/Report'
import { AppFrame, AppSignedOut, useSidebarOpen } from './components/AppFrame'
import { Header } from './components/Header'
import { PageView } from './components/PageView'
import { ShortcutTip } from './components/Shortcuts'
import { Toast } from './components/Toast'
import { useScreen } from './hooks/useScreen'
import { useServerConfig } from './hooks/useServerConfig'
import { initAnalytics, track } from './lib/analytics'
import { appShell, isApp } from './lib/app'
import './lib/theme'
import { isAdmin, loadMe, useAuth } from './lib/auth'
import { socialFromPath } from './lib/social'
import { useFeedback } from './lib/feedback'
import { useShortcuts } from './lib/shortcuts'
import { messages, pick, useLang } from './lib/i18n'
import { applyMeta, HOME_META } from './lib/meta'
import { reportFromPath } from './lib/routes'
import { closePlans, refreshUsage, usePlansOpen } from './lib/usage'
import type { AccountPage } from './components/Account'

// 소셜 로그인에서 돌아온 화면과 새 진단 화면은 필요할 때만 받아요.
const SocialCallback = lazy(() => import('./components/Social').then((module) => ({ default: module.SocialCallback })))
const PlansModal = lazy(() => import('./components/Plans').then((module) => ({ default: module.PlansModal })))
const Home = lazy(() => import('./components/Home').then((module) => ({ default: module.Home })))
const BugReport = lazy(() => import('./components/Feedback').then((module) => ({ default: module.BugReport })))

const TEXT = messages({
  ko: { loginToSave: '로그인하면 보던 리포트로 바로 돌아가요.' },
  en: { loginToSave: "Sign in and we'll bring you right back to your report." },
})

export default function App() {
  const plansOpen = usePlansOpen()

  // 화면을 처음 맞추기 전에 분석 도구를 켜 둬요.
  useEffect(() => {
    initAnalytics()
    void loadMe()
  }, [])

  const config = useServerConfig()
  const { page, loginReturn, open, goHome, openArticle, openAbout, openAccount } = useScreen()
  const account = page?.kind === 'account' ? page.page : null
  const article = page?.kind === 'article'

  /** 소셜 로그인에서 돌아온 주소면 어느 서비스인지. 이 화면은 끝나면 페이지를 새로 여니, 처음 한 번만 읽어요. */
  const [social] = useState(socialFromPath)
  const [sidebarOpen, toggleSidebar] = useSidebarOpen()
  const { tokens, me } = useAuth()
  const feedback = useFeedback()
  const lang = useLang()

  // 소개와 아티클, 계정 화면은 스스로 제목과 미리보기 태그를 정하고, 그 밖의 화면은 메인 화면의 값을 언어에 맞춰 써요.
  const ownMeta = page?.kind === 'about' || article || account !== null
  useEffect(() => {
    if (!ownMeta) applyMeta(HOME_META[lang], lang, '/')
  }, [ownMeta, lang])

  // 로그인하거나 로그아웃하면 한도가 바뀌어서, 이번 주 사용량을 새로 받아요.
  useEffect(() => {
    if (appShell) void refreshUsage()
  }, [tokens])

  const openDiagnose = useCallback((postingId: string) => open({ kind: 'diagnose', postingId }), [open])
  const openReport = useCallback((id: string, tab: ReportTab = 'summary', replace = false) => open({ kind: 'report', id, tab }, replace), [open])
  const openPractice = useCallback((id: string, question?: string) => open({ kind: 'practice', id, question }), [open])
  const openExplore = useCallback(() => open({ kind: 'explore' }), [open])
  const openRecommend = useCallback(() => open({ kind: 'recommend' }), [open])
  const openCompany = useCallback((company: string) => open({ kind: 'explore', company }), [open])
  const openResume = useCallback(() => open({ kind: 'resume' }), [open])
  const openAdmin = useCallback((tab: AdminTab = 'overview') => open({ kind: 'admin', tab }), [open])

  // 로그인 화면에서 로그인하면, 보던 리포트가 있으면 그리로 돌아가고 아니면 새 진단 화면으로 가요.
  const handleSignedIn = useCallback(() => {
    const path = loginReturn.current?.path
    loginReturn.current = null
    if (path) {
      window.history.replaceState(null, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
      return
    }
    if (appShell) goHome()
    else openAccount('history', true)
  }, [goHome, loginReturn, openAccount])

  /** 리포트를 보다가 로그인하러 가요. 로그인하면 보던 리포트로 돌아와요. */
  const loginFromPage = useCallback(() => {
    const report = reportFromPath()
    if (report) loginReturn.current = { path: window.location.pathname, notice: pick(TEXT).loginToSave }
    openAccount('login')
  }, [loginReturn, openAccount])

  const go = useCallback(
    (target: 'home' | 'about' | 'articles' | AccountPage) => {
      if (target === 'home') goHome()
      else if (target === 'about') openAbout()
      else if (target === 'articles') openArticle(null)
      else if (target === 'login') loginFromPage()
      else openAccount(target)
    },
    [goHome, loginFromPage, openAbout, openAccount, openArticle],
  )

  // 앱에서는 로그인부터 해요. 로그인하지 않았으면 다른 화면 대신 로그인 화면만 보여줘요. 앱의 로그인 화면에서는 단축키를 받지 않아요.
  useShortcuts(
    {
      KeyN: goHome,
      Slash: () => document.querySelector<HTMLInputElement>('input[data-search-input]')?.focus(),
      KeyT: appShell ? openExplore : undefined,
      KeyR: appShell ? openRecommend : undefined,
      KeyB: appShell ? () => toggleSidebar(!sidebarOpen) : undefined,
    },
    !(isApp && tokens === null) && page?.kind !== 'app-login',
  )

  // GitHub나 카카오에서 돌아온 주소면 다른 화면 대신 로그인을 마무리하는 화면만 보여줘요.
  if (social) {
    return (
      <Suspense fallback={<div className="h-dvh bg-white" />}>
        <SocialCallback provider={social} />
      </Suspense>
    )
  }

  if (isApp && tokens === null) return <AppSignedOut />

  const navFrom = account ?? (article ? 'articles' : page?.kind ?? 'home')

  const screen = (
    <div className={appShell ? 'relative flex min-w-0 flex-1 flex-col bg-white' : 'relative flex h-dvh flex-col bg-white'}>
      <Header
        app={appShell}
        // 브라우저의 메인 주소는 소개 화면이라, 로고를 누르면 소개 화면으로 가요.
        onHome={appShell ? goHome : openAbout}
        tryApp={!appShell}
        // 브라우저의 메인 화면(소개)에서만 앱 다운로드 아래에 앱을 권하는 툴팁을 띄워요.
        home={!appShell && page?.kind === 'about'}
        onAbout={
          appShell
            ? () => {
                if (page?.kind === 'about') return
                track('about_nav_click', { from: navFrom })
                go('about')
              }
            : undefined
        }
        signedIn={tokens !== null}
        // 계정 화면은 웹의 /app 안에 있어요. 소개와 아티클 화면에서는 시작하기 버튼이 대신해요.
        onAccount={appShell ? (next) => go(next) : undefined}
      />
      {page ? (
        <PageView
          page={page}
          onHome={goHome}
          onDiagnose={openDiagnose}
          onReport={openReport}
          onPractice={openPractice}
          onExplore={openExplore}
          onResume={openResume}
          onAdmin={openAdmin}
          onArticle={openArticle}
          onAccount={openAccount}
          onSignedIn={handleSignedIn}
          onOpenReport={(id) => openReport(id)}
          loginNotice={loginReturn.current?.notice}
          loginReturnTo={loginReturn.current?.path}
          adminApi={config?.admin === true}
          feedback={feedback.ready}
        />
      ) : (
        <Suspense fallback={<main className="flex-1" />}>
          <Home onPick={openDiagnose} onExplore={openExplore} onRecommend={openRecommend} onResume={openResume} onCompany={openCompany} />
        </Suspense>
      )}
      {feedback.bugOpen && (
        <Suspense fallback={null}>
          <BugReport chatId={null} />
        </Suspense>
      )}
      {isApp && <ShortcutTip />}
      {plansOpen && (
        <Suspense fallback={null}>
          <PlansModal onClose={closePlans} />
        </Suspense>
      )}
      <Toast />
    </div>
  )

  if (!appShell) return screen

  const activeReportId = page?.kind === 'report' || page?.kind === 'practice' ? page.id : null

  return (
    <AppFrame
      sidebarOpen={sidebarOpen}
      onToggleSidebar={toggleSidebar}
      sidebar={{
        activeReportId,
        page:
          page?.kind === 'explore' || page?.kind === 'recommend' || page?.kind === 'resume' || page?.kind === 'admin'
            ? page.kind
            : account === 'me'
              ? 'me'
              : article
                ? 'articles'
                : null,
        onNew: goHome,
        onExplore: openExplore,
        onRecommend: openRecommend,
        onResume: openResume,
        onOpenReport: (id) => {
          track('history_report_open', { from: 'sidebar' })
          openReport(id)
        },
        onReportDeleted: (id) => {
          // 열려 있던 리포트를 지웠으면 새 진단 화면으로 가요.
          if (id === activeReportId) goHome()
        },
        onAdmin: isAdmin(me) ? () => openAdmin() : undefined,
        onMe: () => {
          if (account !== 'me') go('me')
        },
        signedIn: tokens !== null,
        onLogin: () => {
          if (account !== 'login') go('login')
        },
      }}
    >
      {screen}
    </AppFrame>
  )
}
