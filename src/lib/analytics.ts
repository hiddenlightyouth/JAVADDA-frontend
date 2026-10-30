/**
 * Google Analytics 4 연동이에요. VITE_GA_MEASUREMENT_ID가 있을 때만 켜져요.
 * 화면 곳곳에서 track으로 사용자 행동을 이벤트로 남겨요. 이벤트 이름과 값은 CLAUDE.md에 정리되어 있어요.
 */
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

type Params = Record<string, string | number | boolean | undefined>

export function initAnalytics(): void {
  if (!MEASUREMENT_ID || window.gtag) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer ?? []
  // gtag는 배열이 아니라 arguments 객체를 그대로 쌓아야 해요.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  // 한 페이지 앱이라 화면 전환은 trackPageView로 직접 보내요.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
}

export function track(event: string, params: Params = {}): void {
  if (!MEASUREMENT_ID || !window.gtag) return
  window.gtag('event', event, params)
}

const PAGE_TITLES = {
  home: 'Javadda',
  articles: 'Javadda 아티클',
  article: 'Javadda 아티클',
  login: 'Javadda 로그인',
  signup: 'Javadda 회원가입',
  me: 'Javadda 내 정보',
  history: 'Javadda 내 리포트',
  'app-login': 'Javadda 앱 로그인',
  explore: 'Javadda 공고 탐색',
  recommend: 'Javadda 추천 공고',
  resume: 'Javadda 내 이력서',
  blogs: 'Javadda 기술 블로그',
  company: 'Javadda 기업 상세',
  diagnose: 'Javadda 진단 시작',
  report: 'Javadda 리포트',
  practice: 'Javadda 면접 연습',
  admin: 'Javadda 관리자',
  about: 'Javadda 소개',
}

type Screen = keyof typeof PAGE_TITLES

/** 주소에 ID가 들어가는 화면이에요. 보고서의 경로가 흩어지지 않게 ID 자리를 [id]로 적어요. */
const ID_PATHS: Partial<Record<Screen, string>> = { company: '/company/[id]', diagnose: '/diagnose/[id]', report: '/r/[id]', practice: '/r/[id]/practice' }

/** 화면이 바뀔 때마다 불러요. 리포트 ID는 경로에 넣지 않고 따로 보내서 보고서의 경로가 흩어지지 않게 해요. */
export function trackPageView(
  screen: Screen,
  params: Params = {},
): void {
  const path =
    screen === 'home'
      ? '/'
      : screen === 'articles'
        ? '/articles'
        : screen === 'article'
          ? `/articles/${params.slug}`
          : ID_PATHS[screen] ?? `/${screen}`
  track('page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: PAGE_TITLES[screen],
    screen,
    ...params,
  })
}
