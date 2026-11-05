import { lazy } from 'react'
import { LoadProgress, loadCenter } from './ui'
import { PageHeader } from './AppPage'
import { pick } from '../lib/i18n'
import type { AccountPage } from './Account'
import type { AdminTab } from './Admin'
import type { ReportTab } from './Report'
import type { Page } from '../lib/routes'

/** 화면마다 코드를 받는 함수예요. 화면을 열 때 받고, 앱 화면에서는 처음 그린 뒤 쉬는 틈에 미리 받아 둬요(preloadScreens). */
const load = {
  AppLogin: () => import('./AppLogin'),
  Jobs: () => import('./Jobs'),
  Recommend: () => import('./Recommend'),
  JobMap: () => import('./JobMap'),
  DeadlineCalendar: () => import('./DeadlineCalendar'),
  Blogs: () => import('./Blogs'),
  Labs: () => import('./Labs'),
  Contests: () => import('./labs/Contests'),
  MyResume: () => import('./MyResume'),
  Company: () => import('./Company'),
  Diagnose: () => import('./Diagnose'),
  Report: () => import('./Report'),
  Practice: () => import('./Practice'),
  Admin: () => import('./Admin'),
  ApiKeys: () => import('./ApiKeys'),
  Account: () => import('./Account'),
  About: () => import('./About'),
  Articles: () => import('./Articles'),
}

/** 처음 그린 뒤에 자주 여는 화면 코드를 쉬는 틈에 하나씩 미리 받아 둬요. 앱에서 화면을 처음 열 때 빈 화면으로 기다리지 않아요. */
export function preloadScreens() {
  const queue = [load.Jobs, load.Report, load.Practice, load.MyResume, load.Recommend, load.Company, load.Diagnose, load.DeadlineCalendar, load.Blogs, load.Contests, load.Labs, load.JobMap, load.Account]
  const idle = (run: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(run, { timeout: 2000 }) : window.setTimeout(run, 300))
  const next = () => {
    const task = queue.shift()
    if (!task) return
    // 받지 못한 것은 화면을 열 때 다시 받아요.
    void task()
      .catch(() => undefined)
      .finally(() => idle(next))
  }
  idle(next)
}

/** 화면 코드를 받는 동안의 자리예요. 바이트를 알 수 없어서 미니 브라우저처럼 30%로 두고, 금방 오면 보이지 않아요. 처음 그릴 때만 보이고, 화면을 옮길 때는 보던 화면을 그대로 둬요(useScreen의 startTransition). */
export const screenFallback = (
  <main className="flex min-w-0 flex-1 flex-col pt-[20vh]">
    <LoadProgress percent={30} className={loadCenter} />
  </main>
)

/** 소개 화면 코드를 받는 동안의 자리예요. 첫 화면과 같은 검은 바탕이라, 흰 화면이 끼었다가 검게 바뀌며 깜빡이지 않아요. */
export const aboutFallback = <main className="h-[100svh] min-h-[540px] bg-[#0f1012]" />

// 앱이 브라우저로 열어 주는 로그인 화면은 필요할 때만 받아요.
const AppLogin = lazy(() => load.AppLogin().then((module) => ({ default: module.AppLogin })))

// 진단 화면들은 열 때만 받아요.
const Jobs = lazy(() => load.Jobs().then((module) => ({ default: module.Jobs })))
const Recommend = lazy(() => load.Recommend().then((module) => ({ default: module.Recommend })))
const JobMap = lazy(() => load.JobMap().then((module) => ({ default: module.JobMap })))
const DeadlineCalendar = lazy(() => load.DeadlineCalendar().then((module) => ({ default: module.DeadlineCalendar })))
const Blogs = lazy(() => load.Blogs().then((module) => ({ default: module.Blogs })))
const Contests = lazy(() => load.Contests().then((module) => ({ default: module.Contests })))
const Labs = lazy(() => load.Labs().then((module) => ({ default: module.Labs })))
const MyResume = lazy(() => load.MyResume().then((module) => ({ default: module.MyResume })))
const Company = lazy(() => load.Company().then((module) => ({ default: module.Company })))
const Diagnose = lazy(() => load.Diagnose().then((module) => ({ default: module.Diagnose })))
const Report = lazy(() => load.Report().then((module) => ({ default: module.Report })))
const Practice = lazy(() => load.Practice().then((module) => ({ default: module.Practice })))

// 관리자 화면은 앱에서 관리자 계정만 쓰는 화면이라, 열 때만 받아요.
const Admin = lazy(() => load.Admin().then((module) => ({ default: module.Admin })))
const ApiKeys = lazy(() => load.ApiKeys().then((module) => ({ default: module.ApiKeys })))

const Account = lazy(() => load.Account().then((module) => ({ default: module.Account })))

// 소개 화면은 헤더의 소개 링크로 들어올 때만 받아요.
const About = lazy(() => load.About().then((module) => ({ default: module.About })))

// 아티클 글과 마크다운 변환 코드는 아티클 화면을 열 때만 받아요.
const Articles = lazy(() => load.Articles().then((module) => ({ default: module.Articles })))

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
  /** 내 이력서의 서류 추가 화면을 열어요. */
  onResumeAdd: () => void
  /** 서류 추가 화면에서 목록으로 돌아가요. 뒤로 가기 기록을 남기지 않아요. */
  onResumeList: () => void
  /** 서류 하나의 상세 화면을 열어요. replace면 뒤로 가기 기록을 남기지 않아요. */
  onResumeDoc: (id: string, replace?: boolean) => void
  /** 기술 블로그를 열어요. 기업을 넘기면 그 기업의 분석으로 가요. */
  onBlogs: (company: string | null) => void
  /** 잡아따 Labs를 열어요. 실험 아이디를 넘기면 그 실험을 열어요. */
  onLabs: (id: string | null) => void
  /** 그 기업 공고만 골라 둔 공고 탐색으로 가요. */
  onCompany: (company: string) => void
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

/** 메인 화면(새 진단)을 뺀, 주소로 여는 화면을 그려요. 화면 코드는 열 때만 받아요. 받는 동안의 자리(Suspense)는 메인 화면과 같이 App이 한 번 둘러요. */
export function PageView({ page, onHome, onDiagnose, onReport, onPractice, onExplore, onResume, onResumeAdd, onResumeList, onResumeDoc, onBlogs, onLabs, onCompany, onAdmin, onArticle, onAccount, onSignedIn, onOpenReport, loginNotice, loginReturnTo, adminApi, feedback }: Props) {
  return page.kind === 'app-login' ? (
        <AppLogin onCancel={onHome} />
      ) : page.kind === 'explore' ? (
        <Jobs key={page.company ?? 'all'} onPick={onDiagnose} initialCompany={page.company ?? null} />
      ) : page.kind === 'recommend' ? (
        <Recommend onPick={onDiagnose} onResume={onResume} onExplore={onExplore} />
      ) : page.kind === 'calendar' ? (
        <DeadlineCalendar onPick={onDiagnose} />
      ) : page.kind === 'map' ? (
        <JobMap onPick={onDiagnose} />
      ) : page.kind === 'resume' ? (
        <MyResume add={page.add ?? false} docId={page.id ?? null} onAdd={onResumeAdd} onList={onResumeList} onDoc={onResumeDoc} onExplore={onExplore} />
      ) : page.kind === 'blogs' ? (
        <Blogs company={page.company ?? null} onCompany={onBlogs} onJobs={onCompany} />
      ) : page.kind === 'contests' ? (
        <Contests header={<PageHeader title={pick({ ko: '공모전', en: 'Contests' })} />} />
      ) : page.kind === 'labs' ? (
        <Labs id={page.id ?? null} onOpen={onLabs} />
      ) : page.kind === 'company' ? (
        <Company key={page.id} id={page.id} onBack={onHome} onPick={onDiagnose} onPostings={onCompany} onBlogs={onBlogs} />
      ) : page.kind === 'diagnose' ? (
        <Diagnose postingId={page.postingId} onBack={onHome} onReport={(id) => onReport(id, 'summary', true)} />
      ) : page.kind === 'report' ? (
        <Report id={page.id} tab={page.tab} onTab={(tab) => onReport(page.id, tab)} onBack={onHome} onPractice={onPractice} onPick={onDiagnose} />
      ) : page.kind === 'practice' ? (
        <Practice id={page.id} question={page.question} onBack={() => onReport(page.id, 'questions')} />
      ) : page.kind === 'api-keys' ? (
        <ApiKeys />
      ) : page.kind === 'admin' ? (
        <Admin tab={page.tab} onTab={onAdmin} full={adminApi} feedback={feedback} onOpenChat={() => undefined} />
      ) : page.kind === 'about' ? (
        <About onHome={onHome} />
      ) : page.kind === 'article' ? (
        <Articles slug={page.slug} onOpen={onArticle} onHome={onHome} />
      ) : (
        <Account page={page.page} onNavigate={onAccount} onSignedIn={onSignedIn} notice={loginNotice} returnTo={loginReturnTo} onOpenReport={onOpenReport} onHome={onHome} />
      )
}
