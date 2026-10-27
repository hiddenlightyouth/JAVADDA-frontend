import { lazy, Suspense } from 'react'
import type { AccountPage } from './Account'
import type { AdminTab } from './Admin'
import type { ReportTab } from './Report'
import type { Page } from '../lib/routes'

// 앱이 브라우저로 열어 주는 로그인 화면은 필요할 때만 받아요.
const AppLogin = lazy(() => import('./AppLogin').then((module) => ({ default: module.AppLogin })))

// 진단 화면들은 열 때만 받아요.
const Jobs = lazy(() => import('./Jobs').then((module) => ({ default: module.Jobs })))
const Recommend = lazy(() => import('./Recommend').then((module) => ({ default: module.Recommend })))
const MyResume = lazy(() => import('./MyResume').then((module) => ({ default: module.MyResume })))
const Diagnose = lazy(() => import('./Diagnose').then((module) => ({ default: module.Diagnose })))
const Report = lazy(() => import('./Report').then((module) => ({ default: module.Report })))
const Practice = lazy(() => import('./Practice').then((module) => ({ default: module.Practice })))

// 관리자 화면은 앱에서 관리자 계정만 쓰는 화면이라, 열 때만 받아요.
const Admin = lazy(() => import('./Admin').then((module) => ({ default: module.Admin })))

const Account = lazy(() => import('./Account').then((module) => ({ default: module.Account })))

// 소개 화면은 헤더의 소개 링크로 들어올 때만 받아요.
const About = lazy(() => import('./About').then((module) => ({ default: module.About })))

// 아티클 글과 마크다운 변환 코드는 아티클 화면을 열 때만 받아요.
const Articles = lazy(() => import('./Articles').then((module) => ({ default: module.Articles })))

interface Props {
  page: Page
  onHome: () => void
  /** 공고를 골라 진단을 시작하는 화면으로 가요. */
  onDiagnose: (postingId: string) => void
  /** 리포트를 열어요. 탭을 넘기면 그 탭으로 열어요. */
  onReport: (id: string, tab?: ReportTab, replace?: boolean) => void
  /** 면접 연습을 열어요. 질문 ID를 넘기면 그 질문부터 시작해요. */
  onPractice: (id: string, question?: string) => void
  onExplore: () => void
  onResume: () => void
  onAdmin: (tab?: AdminTab) => void
  onArticle: (slug: string | null) => void
  onAccount: (page: AccountPage, replace?: boolean) => void
  onSignedIn: () => void
  /** 내 리포트에서 리포트를 열어요. */
  onOpenReport: (id: string) => void
  /** 로그인 화면에 보여줄 안내와, 로그인한 뒤에 돌아갈 주소 */
  loginNotice?: string
  loginReturnTo?: string
  adminApi: boolean
  feedback: boolean
}

/** 메인 화면(새 진단)을 뺀, 주소로 여는 화면을 그려요. 화면 코드는 열 때만 받아요. */
export function PageView({ page, onHome, onDiagnose, onReport, onPractice, onExplore, onResume, onAdmin, onArticle, onAccount, onSignedIn, onOpenReport, loginNotice, loginReturnTo, adminApi, feedback }: Props) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      {page.kind === 'app-login' ? (
        <AppLogin onCancel={onHome} />
      ) : page.kind === 'explore' ? (
        <Jobs onPick={onDiagnose} />
      ) : page.kind === 'recommend' ? (
        <Recommend onPick={onDiagnose} onResume={onResume} />
      ) : page.kind === 'resume' ? (
        <MyResume onExplore={onExplore} />
      ) : page.kind === 'diagnose' ? (
        <Diagnose postingId={page.postingId} onBack={onHome} onReport={(id) => onReport(id, 'summary', true)} />
      ) : page.kind === 'report' ? (
        <Report id={page.id} tab={page.tab} onTab={(tab) => onReport(page.id, tab)} onBack={onHome} onPractice={onPractice} onPick={onDiagnose} />
      ) : page.kind === 'practice' ? (
        <Practice id={page.id} question={page.question} onBack={() => onReport(page.id, 'questions')} />
      ) : page.kind === 'admin' ? (
        <Admin tab={page.tab} onTab={onAdmin} full={adminApi} feedback={feedback} onOpenChat={() => undefined} />
      ) : page.kind === 'about' ? (
        <About onHome={onHome} />
      ) : page.kind === 'article' ? (
        <Articles slug={page.slug} onOpen={onArticle} onHome={onHome} />
      ) : (
        <Account page={page.page} onNavigate={onAccount} onSignedIn={onSignedIn} notice={loginNotice} returnTo={loginReturnTo} onOpenReport={onOpenReport} onHome={onHome} />
      )}
    </Suspense>
  )
}
