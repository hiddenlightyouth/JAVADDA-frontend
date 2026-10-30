import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import { LoadProgress } from './components/ui'
import { appShell } from './lib/app'
import { loadCatalog, startAccountSync } from './lib/gap'
import { currentPath } from './lib/i18n'
import { createLoadTracker, LOAD_HOLD_MS, LOAD_SHOW_AFTER_MS } from './lib/load'
import { aboutFromPath } from './lib/routes'
import './index.css'

const RELOADED_KEY = 'whoisloafing:chunk-reloaded'
const RELOAD_GAP_MS = 10_000

// 새로 배포하면 예전 코드 조각의 주소가 사라져요. 열어 둔 화면이 그 조각을 받으려다 실패하면 화면이 하얗게 비니,
// 새 코드로 한 번 새로 고쳐요. 새로 고쳐도 또 실패하면 되풀이하지 않아요.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY)) || 0
    if (Date.now() - last < RELOAD_GAP_MS) return
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

let root: Root | null = null

const mount = (): Root => {
  if (root) return root
  const element = document.getElementById('root')!
  // index.html에 미리 그려 둔 소개 화면을 다른 주소에서는 숨겨 뒀어요. 그 화면을 비우고 그려요.
  if (document.documentElement.dataset.shell !== undefined) {
    element.replaceChildren()
    delete document.documentElement.dataset.shell
  }
  root = createRoot(element)
  return root
}

const start = () => {
  mount().render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

/** 앱 화면을 그리기 전에 기업과 공고를 받는 동안, 화면 가운데에 받은 정도를 퍼센트로 보여줘요. */
const showBoot = (percent: number) => {
  mount().render(
    <StrictMode>
      <div className="flex min-h-dvh items-center justify-center bg-white px-6">
        <LoadProgress percent={percent} className="w-full max-w-xs" />
      </div>
    </StrictMode>,
  )
}

// 소개(브라우저의 메인 주소)와 아티클 주소로 들어오면 미리 그려 둔 화면이 이미 있어요. 그 화면의 코드를 먼저 받은 뒤에 그려서, 글이 잠깐 사라졌다 나타나지 않게 해요.
const path = currentPath()
if (/^\/articles(\/|$)/.test(path)) void import('./components/Articles').finally(start)
else if (aboutFromPath()) void import('./components/About').finally(start)
else if (appShell) {
  // 앱 화면은 기업과 공고를 받은 뒤에 그려요. 공고를 찾는 함수(postingOf, companyOf)가 바로 답할 수 있게요.
  // 받는 동안은 가운데에 받은 정도(퍼센트)를 보여주고, 서버에 닿지 못하면 적어 둔 목록으로 그려요. 로그인해 있으면 이력서와 리포트도 같이 받기 시작해요.
  // 막대가 보였으면(0.15초 넘게 걸렸으면) 100%를 0.2초 보여준 뒤에 그려요.
  startAccountSync()
  const began = performance.now()
  showBoot(0)
  void loadCatalog(createLoadTracker(showBoot)).finally(() => {
    if (performance.now() - began < LOAD_SHOW_AFTER_MS) start()
    else {
      showBoot(100)
      setTimeout(start, LOAD_HOLD_MS)
    }
  })
} else start()
