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
