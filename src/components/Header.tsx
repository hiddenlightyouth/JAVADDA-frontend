import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN, MAC_SUPPORT } from '../lib/app'
import { LANG_NAMES, localizePath, messages, pick, setLang, useLang, useMessages } from '../lib/i18n'
import type { AccountPage } from './Account'
import { Logo } from './Logo'

interface Props {
  onHome: () => void
  /** 소개 화면으로 가요. 넘기지 않으면 링크가 보이지 않아요. 브라우저에서는 메인 주소가 소개 화면이라 로고가 대신해요. */
  onAbout?: () => void
  /** 아티클 화면으로 가요. 넘기지 않으면 링크가 보이지 않아요. */
  onArticles?: () => void
  signedIn?: boolean
  onAccount?: (page: AccountPage) => void
  /** 앱 안에서는 로고와 링크를 사이드바가 대신해서, 헤더는 비워 둬요. 빈 곳을 잡으면 창이 움직여요. */
  app?: boolean
  /** 메인 화면인지. 이때만 앱 다운로드 아래에 앱을 권하는 툴팁을 띄워요. */
  home?: boolean
  /** 웹의 /app으로 가는 시작하기 버튼을 보여줄지. 소개와 아티클 화면에서 계정 링크 대신 둬요. */
  tryApp?: boolean
}

const TEXT = messages({
  ko: {
    history: '내 리포트',
    me: '내 정보',
    login: '로그인',
    about: '소개',
    download: '앱 다운로드',
    appTip: '앱에서 더 많은 기능 사용하기',
    soon: '준비 중',
    articles: '아티클',
    closeMenu: '메뉴 닫기',
    openMenu: '메뉴 열기',
    language: '언어',
    tryApp: '시작하기',
  },
  en: {
    history: 'My reports',
    me: 'Account',
    login: 'Sign in',
    about: 'About',
    download: 'Get the app',
    appTip: 'Do more in the Mac app',
    soon: 'Coming soon',
    articles: 'Articles',
    closeMenu: 'Close menu',
    openMenu: 'Open menu',
    language: 'Language',
    tryApp: 'Get started',
  },
})

/** 다른 언어로 바꾸는 링크예요. 바꿀 언어의 이름을 그 언어로 적어요. */
function LangSwitch({ className, onSwitch }: { className: string; onSwitch?: () => void }) {
  const lang = useLang()
  const other = lang === 'ko' ? 'en' : 'ko'
  return (
    <button
      type="button"
      lang={other}
      aria-label={`${pick(TEXT).language}: ${LANG_NAMES[other]}`}
      onClick={() => {
        track('language_change', { lang: other, from: 'header' })
        setLang(other)
        onSwitch?.()
      }}
      className={className}
    >
      {LANG_NAMES[other]}
    </button>
  )
}

const quiet = 'h-8 rounded-full px-3 text-[13px] font-medium transition-colors'

export function Header({
  onHome,
  onAbout,
  onArticles,
  signedIn = false,
  onAccount,
  app = false,
  home = false,
  tryApp = false,
}: Props) {
  const text = useMessages(TEXT)

  const [downloadOpen, setDownloadOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileDownloadOpen, setMobileDownloadOpen] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)

  // 드롭다운이 열려 있을 때 바깥을 누르거나 Esc를 누르면 닫아요.
  useDismiss(downloadOpen, downloadRef, () => setDownloadOpen(false))
  useDismiss(menuOpen, null, () => setMenuOpen(false))

  // 메뉴를 닫으면 펼쳐 둔 앱 다운로드도 접어요.
  useEffect(() => {
    if (!menuOpen) setMobileDownloadOpen(false)
  }, [menuOpen])

  const accountLinks = onAccount
    ? signedIn
      ? ([
          ['history', text.history],
          ['me', text.me],
        ] as const)
      : ([['login', text.login]] as const)
    : []

  function goAbout(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setMenuOpen(false)
    setDownloadOpen(false)
    onAbout?.()
  }

  function goArticles(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setMenuOpen(false)
    onArticles?.()
  }

  function goAccount(event: MouseEvent<HTMLAnchorElement>, page: AccountPage) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setMenuOpen(false)
    track('account_nav_click', { page })
    onAccount?.(page)
  }

  function download() {
    setDownloadOpen(false)
    setMenuOpen(false)
    track('app_download_click', { os: 'macos', from: 'header' })
  }

  return (
    <>
      <header
        data-app-drag={app || undefined}
        className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between bg-white/70 px-4 backdrop-blur-md sm:px-6"
      >
        {app ? (
          <span />
        ) : (
          <Logo
            onClick={() => {
              setMenuOpen(false)
              setDownloadOpen(false)
              onHome()
            }}
          />
        )}

        <div className="relative flex items-center gap-1 sm:gap-2">
          <nav className={app ? 'hidden' : 'hidden items-center gap-1 sm:flex sm:gap-2'}>
            {onAbout && (
              <a href={localizePath('/about')} onClick={goAbout} className={`${quiet} inline-flex items-center text-gray-600 hover:text-gray-900`}>
                {text.about}
              </a>
            )}

            <div ref={downloadRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={downloadOpen}
                onClick={() => setDownloadOpen((open) => !open)}
                className={`${quiet} inline-flex items-center gap-1 text-gray-600 hover:text-gray-900`}
              >
                {text.download}
                <Caret open={downloadOpen} />
              </button>
              {MAC_DOWNLOAD_OPEN && home && !downloadOpen && (
                <p
                  className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 origin-top animate-pop rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap text-white"
                  style={{ animationDelay: '600ms' }}
                >
                  {/* 앱 다운로드를 가리키는 말풍선 꼬리 */}
                  <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-brand" aria-hidden="true" />
                  {text.appTip}
                </p>
              )}
              {downloadOpen && (
                <div
                  role="menu"
                  className="absolute top-full left-1/2 mt-2 w-52 -translate-x-1/2 origin-top animate-pop rounded-2xl border border-gray-200 bg-white/80 p-1.5 backdrop-blur-xl"
                >
                  {!MAC_DOWNLOAD_OPEN && (
                    <div role="menuitem" aria-disabled="true" className="flex cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2 text-gray-400">
                      <AppleLogo />
                      <span>
                        <span className="block text-[13px] font-medium">macOS</span>
                        <span className="block text-[11.5px]">{text.soon}</span>
                      </span>
                    </div>
                  )}
                  <a
                    hidden={!MAC_DOWNLOAD_OPEN}
                    href={MAC_DOWNLOAD}
                    download
                    role="menuitem"
                    onClick={download}
                    className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <AppleLogo />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">macOS</span>
                      <span className="block text-[11.5px] text-gray-400">{MAC_SUPPORT}</span>
                    </span>
                    {/* 마우스를 올리거나 키보드로 고르면, 누르면 받는다는 것을 아이콘으로 알려줘요. */}
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4 shrink-0 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    >
                      <path d="M8 2.5v7.5M4.75 7L8 10.25 11.25 7M3 13.5h10" />
                    </svg>
                  </a>
                  {/* 아직 받을 수 없어서 누를 수 없게 흐리게 둬요. */}
                  <div role="menuitem" aria-disabled="true" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-gray-400 cursor-not-allowed">
                    <WindowsLogo />
                    <span>
                      <span className="block text-[13px] font-medium">Windows</span>
                      <span className="block text-[11.5px]">{text.soon}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {onArticles && (
              <a href={localizePath('/articles')} onClick={goArticles} className={`${quiet} inline-flex items-center text-gray-600 hover:text-gray-900`}>
                {text.articles}
              </a>
            )}

            {accountLinks.map(([page, label]) => (
              <a
                key={page}
                href={`/${page}`}
                onClick={(event) => goAccount(event, page)}
                className={`${quiet} inline-flex items-center text-gray-600 hover:text-gray-900`}
              >
                {label}
              </a>
            ))}

            <LangSwitch className={`${quiet} inline-flex items-center text-gray-400 hover:text-gray-900`} onSwitch={() => setDownloadOpen(false)} />
          </nav>

          {tryApp && (
            <a href="/app" onClick={() => track('try_app_click', { from: 'header' })} className={`${quiet} inline-flex items-center bg-brand text-white hover:bg-brand-hover`}>
              {text.tryApp}
            </a>
          )}

          <button
            type="button"
            aria-label={menuOpen ? text.closeMenu : text.openMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={`relative ml-1 size-8 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 sm:hidden ${app ? 'hidden' : 'flex'}`}
          >
            <span
              className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ${menuOpen ? 'rotate-45' : '-translate-y-[5px]'}`}
            />
            <span className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span
              className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ${menuOpen ? '-rotate-45' : 'translate-y-[5px]'}`}
            />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="absolute inset-x-0 top-14 bottom-0 z-20 animate-fade bg-white/70 backdrop-blur-xl sm:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMenuOpen(false)
          }}
        >
          <nav className="flex flex-col px-4 pt-2 pb-6">
            {onAbout && (
              <a href={localizePath('/about')} onClick={goAbout} className={mobileItem}>
                {text.about}
              </a>
            )}

            <button
              type="button"
              aria-expanded={mobileDownloadOpen}
              onClick={() => setMobileDownloadOpen((open) => !open)}
              className={`${mobileItem} flex items-center justify-between`}
            >
              {text.download}
              <Caret open={mobileDownloadOpen} />
            </button>
            {mobileDownloadOpen && (
              <div className="animate-rise pb-2 pl-3">
                {!MAC_DOWNLOAD_OPEN && (
                  <div aria-disabled="true" className="flex cursor-not-allowed items-center gap-2.5 py-2.5 text-gray-400">
                    <AppleLogo />
                    <span>
                      <span className="block text-[15px]">macOS</span>
                      <span className="block text-[12px]">{text.soon}</span>
                    </span>
                  </div>
                )}
                <a hidden={!MAC_DOWNLOAD_OPEN} href={MAC_DOWNLOAD} download onClick={download} className="flex items-center gap-2.5 py-2.5 text-gray-600 transition-colors hover:text-gray-900">
                  <AppleLogo />
                  <span>
                    <span className="block text-[15px]">macOS</span>
                    <span className="block text-[12px] text-gray-400">{MAC_SUPPORT}</span>
                  </span>
                </a>
                <div aria-disabled="true" className="flex items-center gap-2.5 py-2.5 text-gray-400 cursor-not-allowed">
                  <WindowsLogo />
                  <span>
                    <span className="block text-[15px]">Windows</span>
                    <span className="block text-[12px]">{text.soon}</span>
                  </span>
                </div>
              </div>
            )}

            {onArticles && (
              <a href={localizePath('/articles')} onClick={goArticles} className={mobileItem}>
                {text.articles}
              </a>
            )}

            {accountLinks.map(([page, label]) => (
              <a key={page} href={`/${page}`} onClick={(event) => goAccount(event, page)} className={mobileItem}>
                {label}
              </a>
            ))}

            <LangSwitch className={`${mobileItem} text-gray-500`} onSwitch={() => setMenuOpen(false)} />
          </nav>
        </div>
      )}
    </>
  )
}


function WindowsLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
      <path d="M2 2h9.5v9.5H2zM12.5 2H22v9.5h-9.5zM2 12.5h9.5V22H2zM12.5 12.5H22V22h-9.5z" />
    </svg>
  )
}

export function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}

const mobileItem = 'block w-full border-b border-gray-200/70 py-3.5 text-left text-[16px] font-medium text-gray-800 transition-colors hover:text-gray-950'

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 6"
      className={`h-1.5 w-2.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  )
}
