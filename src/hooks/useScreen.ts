import { useCallback, useEffect, useRef, useState } from 'react'
import type { AccountPage } from '../components/Account'
import { trackPageView } from '../lib/analytics'
import { appShell } from '../lib/app'
import { localizePath } from '../lib/i18n'
import { isAppOnly, pageFromPath, pathOf, type Page } from '../lib/routes'

/** 로그인 화면으로 갔을 때, 로그인한 뒤에 돌아올 화면과 로그인 화면에 보여줄 안내 */
interface LoginReturn {
  path: string
  notice: string
}

/** 앱 화면이 아니면 앱 전용 화면을 열지 않아요. */
function initialPage(): Page | null {
  const page = pageFromPath()
  return page && isAppOnly(page) && !appShell ? null : page
}

function trackPage(page: Page | null) {
  if (!page) return trackPageView('home')
  switch (page.kind) {
    case 'about':
    case 'app-login':
    case 'explore':
    case 'recommend':
    case 'calendar':
    case 'map':
    case 'resume':
      return trackPageView(page.kind)
    case 'blogs':
      return trackPageView('blogs', { company: page.company ?? 'all' })
    case 'company':
      return trackPageView('company', { company: page.id })
    case 'diagnose':
      return trackPageView('diagnose', { posting: page.postingId })
    case 'report':
      return trackPageView('report', { tab: page.tab })
    case 'practice':
      return trackPageView('practice')
    case 'admin':
      return trackPageView('admin', { tab: page.tab })
    case 'account':
      return trackPageView(page.page)
    case 'article':
      return trackPageView(page.slug ? 'article' : 'articles', { slug: page.slug ?? undefined })
  }
}

/**
 * 지금 보여줄 화면을 들고 있어요.
 * 처음 들어왔을 때와 뒤로 가기, 앞으로 가기에서 주소를 읽어 화면을 맞추고, 화면을 옮기는 함수를 돌려줘요.
 */
export function useScreen() {
  /** 주소로 여는 화면. null이면 메인 화면(새 진단)이에요. */
  const [page, setPage] = useState(initialPage)
  const loginReturn = useRef<LoginReturn | null>(null)

  // 주소에 맞는 화면을 준비해요. 처음 들어왔을 때와 뒤로 가기, 앞으로 가기에서 불러요.
  const openFromLocation = useCallback(() => {
    let next = pageFromPath()
    // 앱 전용 화면은 앱 화면에서만 써요. 앱 화면이 아닌데 이 주소로 들어오면 메인 화면으로 보내요.
    if (next && isAppOnly(next) && !appShell) {
      window.history.replaceState(null, '', '/')
      next = null
    }
    setPage(next)
    trackPage(next)
  }, [])

  useEffect(() => {
    openFromLocation()
    const onPopState = () => openFromLocation()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [openFromLocation])

  /** 화면을 열어요. replace면 뒤로 가기 기록을 남기지 않아요. */
  const open = useCallback(
    (next: Page | null, replace = false) => {
      if (next?.kind !== 'account' || next.page === 'me' || next.page === 'history') loginReturn.current = null
      // 브라우저의 메인 주소는 소개 화면이라, 앱 화면은 /app에서 열어요. 앱 화면인지는 처음 열 때 정해져서 페이지를 새로 열어요.
      if (!appShell && (next === null || isAppOnly(next))) {
        window.location.assign(next ? `/app${pathOf(next)}` : '/app')
        return
      }
      const path = localizePath(pathOf(next))
      if (replace) window.history.replaceState(null, '', path)
      else if (window.location.pathname !== path) window.history.pushState(null, '', path)
      setPage(next)
      trackPage(next)
    },
    [],
  )

  const goHome = useCallback(() => open(null), [open])

  const openArticle = useCallback((slug: string | null) => open({ kind: 'article', slug }), [open])

  const openAbout = useCallback(() => {
    // 브라우저의 소개 화면은 메인 주소(/)에 있어요.
    if (!appShell) {
      window.history.pushState(null, '', localizePath('/'))
      openFromLocation()
      return
    }
    open({ kind: 'about' })
  }, [open, openFromLocation])

  const openAccount = useCallback((next: AccountPage, replace = false) => open({ kind: 'account', page: next }, replace), [open])

  return { page, loginReturn, open, goHome, openArticle, openAbout, openAccount }
}
