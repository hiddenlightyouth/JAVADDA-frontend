import { appAtLeast, isApp, openInBrowser } from './app'
import { localizePath } from './i18n'
import { pathOf } from './routes'

// 이력서 만들기에서 GitHub 계정을 연결하는 흐름이에요. 소셜 로그인(social.ts)과 따로인 OAuth App을 써요.
// repo 권한을 받아서 비공개 레포까지 읽어요. 돌아오는 곳은 서류 추가 화면(/resume/new)이에요.

const STORAGE = 'javadda:github-connect'
const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
/** 비공개 레포를 읽는 repo와, 계정 이름과 사진을 읽는 read:user예요. */
const SCOPE = 'repo read:user'

interface Pending {
  state: string
  redirectUri: string
}

/** 돌아올 주소. OAuth App에 등록한 콜백 주소(사이트 주소)의 아래여야 해요. */
const redirectUri = () => `${window.location.origin}${localizePath(pathOf({ kind: 'resume', add: true }))}`

/** GitHub의 권한 화면으로 보내요. 돌아왔을 때 내가 보낸 요청인지 확인하려고 무작위 값(state)을 이 탭에 적어 둬요. */
export function startGithubConnect(clientId: string): void {
  const pending: Pending = { state: crypto.randomUUID(), redirectUri: redirectUri() }
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify(pending))
  } catch {
    // 적어 두지 못하면 돌아왔을 때 확인할 수 없어서, 그때 다시 시도하라고 안내해요.
  }
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: pending.redirectUri, scope: SCOPE, state: pending.state, allow_signup: 'false' })
  window.location.assign(`${AUTHORIZE_URL}?${params}`)
}

/** 지금 주소가 GitHub 권한 화면에서 돌아온 주소인지예요. 서류 추가 화면이 GitHub 단계를 바로 열어요. */
export function isGithubReturn(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.has('state') && (params.has('code') || params.has('error'))
}

export type GithubReturn = { ok: true; code: string; redirectUri: string } | { ok: false; canceled: boolean }

/** 돌아온 주소의 코드를 꺼내고, 보낸 요청이 맞는지 확인해요. 주소의 코드는 지워서 새로 고쳐도 다시 쓰지 않아요. */
export function takeGithubReturn(): GithubReturn {
  const params = new URLSearchParams(window.location.search)
  let pending: Pending | null = null
  try {
    pending = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null') as Pending | null
    sessionStorage.removeItem(STORAGE)
  } catch {
    pending = null
  }
  window.history.replaceState(window.history.state, '', window.location.pathname)
  const code = params.get('code')
  if (params.get('error') || !code) return { ok: false, canceled: true }
  if (!pending || pending.state !== params.get('state')) return { ok: false, canceled: false }
  return { ok: true, code, redirectUri: pending.redirectUri }
}

// macOS 앱(2.4부터)에서는 웹뷰 안에서 GitHub 권한 화면을 열 수 없어서 기본 브라우저로 열어요. 브라우저에서 따로 로그인하지 않도록,
// GitHub는 /github/callback으로 돌려보내고 그 화면이 javadda://github로 앱을 다시 열어요. 앱이 받은 값을 웹뷰에 이벤트로 넘기면
// 웹뷰가 이 탭에 적어 둔 state와 맞춰 보고 서버에 코드를 보내 연결해요.

/** 브라우저가 앱을 다시 여는 주소예요. 앱의 AppConfig.githubCallbackHost와 같아요. */
const APP_CALLBACK = 'javadda://github'
/** 앱이 받은 값을 웹뷰에 넘기는 이벤트예요. 앱의 AppConfig.githubEventName과 같아요. */
const APP_EVENT = 'javadda:github-connect'
const APP_CALLBACK_PATH = /^\/github\/callback\/?$/

/** 앱 안에서 GitHub 권한 화면을 브라우저로 열고 앱으로 바로 돌아오는 흐름을 쓸 수 있는지예요. */
export const appGithubConnect = isApp && appAtLeast('2.4')

/** 지금 주소가 브라우저에서 앱으로 돌려보내는 화면(/github/callback)인지예요. */
export const isAppGithubCallback = () => APP_CALLBACK_PATH.test(window.location.pathname)

/** 브라우저의 /github/callback에서 받은 값을 그대로 붙여 앱을 다시 여는 주소예요. */
export function appGithubLink(): string {
  const params = new URLSearchParams(window.location.search)
  const pass = new URLSearchParams()
  for (const key of ['code', 'state', 'error']) {
    const value = params.get(key)
    if (value) pass.set(key, value)
  }
  return `${APP_CALLBACK}?${pass}`
}

/** 앱에서 GitHub 권한 화면을 기본 브라우저로 열어요. 돌아올 주소는 /github/callback이에요. */
export function startAppGithubConnect(clientId: string): void {
  const pending: Pending = { state: crypto.randomUUID(), redirectUri: `${window.location.origin}/github/callback` }
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify(pending))
  } catch {
    // 적어 두지 못하면 돌아왔을 때 확인할 수 없어서, 그때 다시 시도하라고 안내해요.
  }
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: pending.redirectUri, scope: SCOPE, state: pending.state, allow_signup: 'false' })
  openInBrowser(`${AUTHORIZE_URL}?${params}`)
}

/** 앱이 넘겨 준 값을 이 탭에 적어 둔 요청과 맞춰 봐요. 한 번 쓰면 지워요. */
function checkAppReturn(detail: { code?: string; state?: string; error?: string }): GithubReturn {
  let pending: Pending | null = null
  try {
    pending = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null') as Pending | null
    sessionStorage.removeItem(STORAGE)
  } catch {
    pending = null
  }
  if (detail.error || !detail.code) return { ok: false, canceled: true }
  if (!pending || pending.state !== detail.state) return { ok: false, canceled: false }
  return { ok: true, code: detail.code, redirectUri: pending.redirectUri }
}

/** 앱이 GitHub에서 돌아온 값을 넘겨 주면 알려줘요. 돌려준 함수로 그만 들어요. */
export function onAppGithubReturn(listener: (result: GithubReturn) => void): () => void {
  const handle = (event: Event) => listener(checkAppReturn((event as CustomEvent<{ code?: string; state?: string; error?: string }>).detail ?? {}))
  window.addEventListener(APP_EVENT, handle)
  return () => window.removeEventListener(APP_EVENT, handle)
}
