import type { AccountPage } from '../components/Account'
import type { AdminTab } from '../components/Admin'
import type { ReportTab } from '../components/Report'
import { currentPath } from './i18n'
import { appShell } from './shell'

// 주소에서 지금 보여줄 화면을 읽어요. 언어 앞머리(/en)는 떼고 봐요.

const ARTICLE_PATH = /^\/articles(?:\/([^/]+))?\/?$/

/** 아티클 주소면 보고 있는 글을 돌려줘요. slug가 null이면 목록이에요. */
function articleFromPath(): { slug: string | null } | null {
  const match = ARTICLE_PATH.exec(currentPath())
  return match ? { slug: match[1] ?? null } : null
}

const ABOUT_PATH = /^\/about\/?$/

/** 브라우저의 메인 주소(/)는 소개 화면이에요. 앱 화면(macOS 앱, 웹의 /app)의 메인 주소는 새 진단 화면이에요. */
export const aboutFromPath = () => ABOUT_PATH.test(currentPath()) || (!appShell && currentPath() === '/')

const ACCOUNT_PATH = /^\/(login|signup|me|history)\/?$/

const accountFromPath = () => (ACCOUNT_PATH.exec(currentPath())?.[1] as AccountPage | undefined) ?? null

const APP_LOGIN_PATH = /^\/app-login\/?$/

const appLoginFromPath = () => APP_LOGIN_PATH.test(currentPath())

const EXPLORE_PATH = /^\/explore\/?$/

const RECOMMEND_PATH = /^\/recommend\/?$/

const CALENDAR_PATH = /^\/calendar\/?$/

const MAP_PATH = /^\/map\/?$/

const RESUME_PATH = /^\/resume\/?$/

const BLOGS_PATH = /^\/blogs(?:\/([^/]+))?\/?$/

const COMPANY_PATH = /^\/company\/([^/]+)\/?$/

const DIAGNOSE_PATH = /^\/diagnose\/([^/]+)\/?$/

/** 진단 시작 주소면 고른 공고를 돌려줘요. */
const diagnoseFromPath = () => DIAGNOSE_PATH.exec(currentPath())?.[1] ?? null

const REPORT_PATH = /^\/r\/([^/]+)(?:\/(fit|review|questions|practice))?\/?$/

/** 리포트 주소면 리포트와 보고 있는 탭을 돌려줘요. practice는 면접 연습 화면이에요. */
export function reportFromPath(): { id: string; tab: ReportTab | 'practice' } | null {
  const match = REPORT_PATH.exec(currentPath())
  return match ? { id: match[1], tab: (match[2] as ReportTab | 'practice' | undefined) ?? 'summary' } : null
}

const ADMIN_PATH = /^\/admin(?:\/(users|chats|feedback|ai))?\/?$/

/** 관리자 화면 주소면 보고 있는 탭을 돌려줘요. */
function adminFromPath(): AdminTab | null {
  const match = ADMIN_PATH.exec(currentPath())
  return match ? ((match[1] as AdminTab | undefined) ?? 'overview') : null
}

/** 메인 화면(새 진단)을 뺀, 주소로 여는 화면. null이면 메인 화면이에요. */
export type Page =
  | { kind: 'about' }
  | { kind: 'app-login' }
  | { kind: 'explore'; company?: string }
  | { kind: 'recommend' }
  | { kind: 'calendar' }
  | { kind: 'map' }
  | { kind: 'resume' }
  | { kind: 'blogs'; company?: string }
  | { kind: 'company'; id: string }
  | { kind: 'diagnose'; postingId: string }
  | { kind: 'report'; id: string; tab: ReportTab }
  | { kind: 'practice'; id: string; question?: string }
  | { kind: 'admin'; tab: AdminTab }
  | { kind: 'account'; page: AccountPage }
  | { kind: 'article'; slug: string | null }

/** 공고 탐색, 추천 공고, 마감 달력, 채용 지도, 내 이력서, 기술 블로그, 기업 상세, 진단, 리포트, 면접 연습, 관리자 화면은 앱 화면(macOS 앱, 웹의 /app)에서만 써요. */
export const isAppOnly = (page: Page) =>
  page.kind === 'explore' ||
  page.kind === 'recommend' ||
  page.kind === 'calendar' ||
  page.kind === 'map' ||
  page.kind === 'resume' ||
  page.kind === 'blogs' ||
  page.kind === 'company' ||
  page.kind === 'diagnose' ||
  page.kind === 'report' ||
  page.kind === 'practice' ||
  page.kind === 'admin'

/** 주소에서 지금 보여줄 화면을 읽어요. 앱 전용 화면인지는 따지지 않아요. */
export function pageFromPath(): Page | null {
  const path = currentPath()
  if (aboutFromPath()) return { kind: 'about' }
  if (appLoginFromPath()) return { kind: 'app-login' }
  // 공고 탐색은 ?company=기업아이디로 그 기업 공고만 골라 둔 채 열 수 있어요.
  if (EXPLORE_PATH.test(path)) return { kind: 'explore', company: new URLSearchParams(window.location.search).get('company') ?? undefined }
  if (RECOMMEND_PATH.test(path)) return { kind: 'recommend' }
  if (CALENDAR_PATH.test(path)) return { kind: 'calendar' }
  if (MAP_PATH.test(path)) return { kind: 'map' }
  if (RESUME_PATH.test(path)) return { kind: 'resume' }
  // 기술 블로그는 /blogs/기업아이디로 그 기업의 분석을 바로 열어요.
  const blogs = BLOGS_PATH.exec(path)
  if (blogs) return { kind: 'blogs', company: blogs[1] ? decodeURIComponent(blogs[1]) : undefined }
  const company = COMPANY_PATH.exec(path)?.[1]
  if (company) return { kind: 'company', id: decodeURIComponent(company) }
  const postingId = diagnoseFromPath()
  if (postingId) return { kind: 'diagnose', postingId }
  const report = reportFromPath()
  if (report) {
    if (report.tab !== 'practice') return { kind: 'report', id: report.id, tab: report.tab }
    // 면접 연습은 ?q=질문ID로 어느 질문부터 연습할지 받아요.
    const question = new URLSearchParams(window.location.search).get('q') ?? undefined
    return { kind: 'practice', id: report.id, question }
  }
  const tab = adminFromPath()
  if (tab) return { kind: 'admin', tab }
  const account = accountFromPath()
  if (account) return { kind: 'account', page: account }
  const article = articleFromPath()
  if (article) return { kind: 'article', slug: article.slug }
  return null
}

/** 화면의 주소를 만들어요. 주소 모양은 여기서만 정해요. */
export function pathOf(page: Page | null): string {
  if (!page) return '/'
  switch (page.kind) {
    case 'about':
      return '/about'
    case 'app-login':
      return '/app-login'
    case 'explore':
      return `/explore${page.company ? `?company=${encodeURIComponent(page.company)}` : ''}`
    case 'recommend':
      return '/recommend'
    case 'calendar':
      return '/calendar'
    case 'map':
      return '/map'
    case 'resume':
      return '/resume'
    case 'blogs':
      return page.company ? `/blogs/${encodeURIComponent(page.company)}` : '/blogs'
    case 'company':
      return `/company/${encodeURIComponent(page.id)}`
    case 'diagnose':
      return `/diagnose/${page.postingId}`
    case 'report':
      return page.tab === 'summary' ? `/r/${page.id}` : `/r/${page.id}/${page.tab}`
    case 'practice':
      return `/r/${page.id}/practice${page.question ? `?q=${encodeURIComponent(page.question)}` : ''}`
    case 'admin':
      return page.tab === 'overview' ? '/admin' : `/admin/${page.tab}`
    case 'account':
      return `/${page.page}`
    case 'article':
      return page.slug ? `/articles/${page.slug}` : '/articles'
  }
}
