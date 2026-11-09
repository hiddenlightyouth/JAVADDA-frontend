/**
 * 앱 화면의 탭 제목에 넣을 지금 화면의 이름이에요. "공고 탐색 | 잡아따"처럼 서비스 이름 앞에 붙여요.
 * 소개, 아티클, 계정, 앱 로그인 화면은 스스로 제목을 정해서 여기서 다루지 않아요.
 */
import { companyOf, postingOf, type Report } from './gap'
import { messages, type Lang } from './i18n'
import type { Page } from './routes'

const NAMES = messages({
  ko: {
    home: '탐색',
    explore: '공고 탐색',
    recommend: '추천 공고',
    calendar: '마감 달력',
    map: '채용 지도',
    resume: '내 이력서',
    resumeAdd: '서류 추가',
    blogs: '기술 블로그',
    companyBlog: (name: string) => `${name} 기술 블로그`,
    contests: '공모전',
    labs: '실험실',
    techInterview: '기술 면접',
    diagnose: '진단 시작',
    report: '리포트',
    companyReport: (name: string) => `${name} 리포트`,
    practice: '면접 연습',
    companyPractice: (name: string) => `${name} 면접 연습`,
    admin: '관리자',
    apiKeys: 'API 키',
  },
  en: {
    home: 'Discover',
    explore: 'Explore jobs',
    recommend: 'Recommended',
    calendar: 'Deadlines',
    map: 'Job map',
    resume: 'My resume',
    resumeAdd: 'Add document',
    blogs: 'Tech blogs',
    companyBlog: (name: string) => `${name} tech blog`,
    contests: 'Contests',
    labs: 'Lab',
    techInterview: 'Tech interview',
    diagnose: 'Start diagnosis',
    report: 'Report',
    companyReport: (name: string) => `${name} report`,
    practice: 'Interview practice',
    companyPractice: (name: string) => `${name} interview practice`,
    admin: 'Admin',
    apiKeys: 'API keys',
  },
})

/** 지금 화면의 이름. 스스로 제목을 정하는 화면이면 null이에요. */
export function pageTitle(page: Page | null, lang: Lang, reports: readonly Report[]): string | null {
  const t = NAMES[lang]
  const companyOfReport = (id: string) => {
    const report = reports.find((item) => item.id === id)
    return report ? companyOf(report.companyId).name : null
  }
  if (!page) return t.home
  switch (page.kind) {
    case 'explore':
      return t.explore
    case 'recommend':
      return t.recommend
    case 'calendar':
      return t.calendar
    case 'map':
      return t.map
    case 'resume':
      return page.add ? t.resumeAdd : t.resume
    case 'blogs':
      return page.company ? t.companyBlog(companyOf(page.company).name) : t.blogs
    case 'contests':
      return t.contests
    case 'labs':
      return page.id === 'tech-interview' ? t.techInterview : t.labs
    case 'company':
      return companyOf(page.id).name
    case 'diagnose':
      return postingOf(page.postingId)?.title ?? t.diagnose
    case 'report': {
      const name = companyOfReport(page.id)
      return name ? t.companyReport(name) : t.report
    }
    case 'practice': {
      const name = companyOfReport(page.id)
      return name ? t.companyPractice(name) : t.practice
    }
    case 'admin':
      return t.admin
    case 'api-keys':
      return t.apiKeys
    default:
      return null
  }
}
