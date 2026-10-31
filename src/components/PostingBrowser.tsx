import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { canEmbed, careerName, companyOf, familyName, POSTINGS, type Company, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { useLoadHold } from '../lib/load'
import { readItem, writeItem } from '../lib/storage'
import { CompanyMark, SkillChip } from './GapParts'
import { CloseButton, ExternalLinkIcon, RefreshIcon } from './Icons'
import { iconButton, label, loadCenter, LoadProgress, primaryButton } from './ui'

/**
 * 공고 원문이나 기업 소개 사이트를 새 탭 대신 앱 안에서 보는 미니 브라우저예요. 화면을 가리지 않고 오른쪽에 나란히 붙어서, 공고 목록을 보면서 원문을 같이 봐요.
 * 왼쪽 가장자리를 끌어서 폭을 바꾸고(방향키도 돼요, 두 번 누르면 처음 폭으로), 바꾼 폭은 이 기기에 기억해요. 좁은 화면에서는 화면 전체를 덮어요.
 * 사이트가 다른 서비스 안에 보이지 않게 막아 두었으면(`canEmbed`) 원문 대신 공고 요약이나 기업 정보와 열려 있는 공고를 보여주고, 새 탭은 마지막 방법으로만 둬요.
 * 감싸는 줄(`SplitView`)이 왼쪽 화면과 이 칸을 나란히 놓아요.
 */

const TEXT = messages({
  ko: {
    title: (company: string) => `${company} 채용 공고 원문`,
    reload: '새로 고침',
    external: '새 탭에서 열기',
    close: '닫기',
    blocked: '이 채용 사이트는 다른 서비스 안에서 열 수 없게 막아 두었어요.',
    blockedBody: '공고의 핵심은 아래에 정리해 두었어요. 원문을 꼭 봐야 할 때만 새 탭으로 열어 주세요.',
    companyTitle: (company: string) => `${company} 기업 소개`,
    companyBlocked: '이 기업 사이트는 다른 서비스 안에서 열 수 없게 막아 두었어요.',
    companyBlockedBody: '기업 정보와 열려 있는 공고를 아래에 정리해 두었어요. 사이트를 꼭 봐야 할 때만 새 탭으로 열어 주세요.',
    openings: (count: number) => `열려 있는 공고 ${count}개`,
    required: '필수 역량',
    preferred: '우대 역량',
    loading: '원문을 불러오고 있어요',
    resize: '원문 칸 크기 조절',
  },
  en: {
    title: (company: string) => `${company} original posting`,
    reload: 'Reload',
    external: 'Open in new tab',
    close: 'Close',
    blocked: "This careers site doesn't allow being shown inside other services.",
    blockedBody: "We've summarized the posting below. Open it in a new tab only if you need the original.",
    companyTitle: (company: string) => `About ${company}`,
    companyBlocked: "This company's site doesn't allow being shown inside other services.",
    companyBlockedBody: "We've summarized the company and its open postings below. Open the site in a new tab only if you need it.",
    openings: (count: number) => `${count} open ${count === 1 ? 'posting' : 'postings'}`,
    required: 'Required',
    preferred: 'Preferred',
    loading: 'Loading the original',
    resize: 'Resize the original pane',
  },
})

const WIDTH_KEY = 'whoisloafing:posting-browser-width'
const DEFAULT_WIDTH = 560
const MIN_WIDTH = 360
// 왼쪽 화면이 이보다 좁아지지 않게 해요.
const MIN_MAIN = 360

function clampWidth(width: number, total: number) {
  return Math.round(Math.min(Math.max(width, MIN_WIDTH), Math.max(MIN_WIDTH, total - MIN_MAIN)))
}

/** 왼쪽 화면과 원문 칸을 나란히 놓는 줄이에요. 원문 칸이 없으면 왼쪽 화면만 가득 채워요. */
export function SplitView({ children, side }: { children: ReactNode; side: ReactNode }) {
  return (
    <div data-split className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      {side}
    </div>
  )
}

const toolbarButton = iconButton.md

/** 공고나 기업이 아닌 글 하나예요. 기술 블로그의 글과 블로그 첫 화면을 열 때 써요. 앱 안에 띄울 수 있는 주소(`canEmbed`)만 넘겨요. 막힌 곳은 화면이 바로 새 탭으로 열어요. */
export interface BrowserPage {
  url: string
  title: string
  companyId: string
}

/**
 * 공고(`posting`), 기업(`company`), 글(`page`) 중 하나를 받아요. 기업 사이트가 막혀 있으면 대신 보여주는 공고를 눌러 그 공고로 바꿔요(`onPosting`).
 */
export function PostingBrowser({ posting, company: about, page, onClose, onPosting }: {
  posting?: JobPosting
  company?: Company
  page?: BrowserPage
  onClose: () => void
  onPosting?: (posting: JobPosting) => void
}) {
  const L = useMessages(TEXT)
  const company = posting ? companyOf(posting.companyId) : page ? companyOf(page.companyId) : about!
  const url = posting ? posting.url : page ? page.url : company.site
  const title = posting ? L.title(company.name) : page ? page.title : L.companyTitle(company.name)
  const embeddable = canEmbed(url)
  const [loaded, setLoaded] = useState(false)
  // 다른 사이트의 화면은 받은 바이트를 알 수 없어요. 주소를 열기 시작하면 30%, load 이벤트가 오면 100%로 보여줘요.
  const waiting = useLoadHold(!loaded)
  const [version, setVersion] = useState(0)
  const [width, setWidth] = useState(() => Number(readItem(WIDTH_KEY)) || DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const pane = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  // 감싸는 줄의 폭을 넘지 않게 맞춰요. 창 크기가 바뀌어도 다시 맞춰요.
  const total = () => pane.current?.closest('[data-split]')?.clientWidth ?? window.innerWidth
  useEffect(() => {
    const fit = () => setWidth((value) => clampWidth(value, total()))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  function resizeTo(next: number) {
    const value = clampWidth(next, total())
    setWidth(value)
    writeItem(WIDTH_KEY, String(value))
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const right = pane.current!.getBoundingClientRect().right
    setDragging(true)
    const move = (moved: PointerEvent) => resizeTo(right - moved.clientX)
    const stop = () => {
      setDragging(false)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  function resizeByKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 80 : 24
    if (event.key === 'ArrowLeft') resizeTo(width + step)
    else if (event.key === 'ArrowRight') resizeTo(width - step)
    else return
    event.preventDefault()
  }

  useEffect(() => {
    if (posting) track('posting_browser_open', { posting: posting.id, embedded: embeddable })
    else if (page) track('blog_browser_open', { company: company.id, embedded: embeddable })
    else track('company_browser_open', { company: company.id, embedded: embeddable })
  }, [posting, page, company.id, embeddable])

  // 다른 창이나 메뉴가 열려 있으면 그쪽이 먼저 Esc를 받아요.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[aria-modal="true"], [aria-haspopup][aria-expanded="true"]')) return
      close.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const host = (() => {
    try {
      return new URL(url).host.replace(/^www\./, '')
    } catch {
      return url
    }
  })()

  return (
    <aside
      ref={pane}
      aria-label={title}
      style={{ '--pane': `${width}px` } as CSSProperties}
      className="fixed inset-0 z-40 flex animate-fade flex-col bg-white md:relative md:inset-auto md:z-auto md:w-(--pane) md:shrink-0 md:pt-9 md:border-l md:border-gray-200"
    >
      {/* 왼쪽 가장자리의 손잡이예요. 끌거나 방향키로 폭을 바꾸고, 두 번 누르면 처음 폭으로 돌아가요. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={L.resize}
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={resizeByKey}
        onDoubleClick={() => resizeTo(DEFAULT_WIDTH)}
        className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize outline-none md:block"
      >
        <span className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-brand group-focus-visible:bg-brand ${dragging ? 'bg-brand' : ''}`} />
      </div>
      {/* 끄는 동안 원문 칸이 마우스를 가져가지 않게 덮어 둬요. */}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}

      {/* 주소 줄처럼 생긴 머리글이에요. 어느 사이트를 보고 있는지 알 수 있게 주소를 적어요. */}
      {/* 닫기는 다른 칸(갭 상세, 서류 상세)처럼 오른쪽 끝에 둬요. */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-3">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-gray-100 px-3">
          <CompanyMark company={company} className="size-5 rounded-md! text-[9px]" />
          <span className="truncate text-[13px] text-gray-600">{host}</span>
        </div>
        {embeddable && (
          <button
            type="button"
            aria-label={L.reload}
            title={L.reload}
            onClick={() => {
              setLoaded(false)
              setVersion((value) => value + 1)
            }}
            className={toolbarButton}
          >
            <RefreshIcon className="size-4" />
          </button>
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={L.external} title={L.external} className={toolbarButton}>
          <ExternalLinkIcon strokeWidth={1.5} />
        </a>
        <CloseButton label={L.close} size="md" onClick={onClose} />
      </div>

      {embeddable ? (
        <div className="relative min-h-0 flex-1">
          {waiting && (
            <div className="absolute inset-0 px-8">
              <LoadProgress percent={loaded ? 100 : 30} text={L.loading} className={loadCenter} />
            </div>
          )}
          <iframe
            key={version}
            src={url}
            title={title}
            onLoad={() => setLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            className={`size-full bg-white transition-opacity ${waiting ? 'opacity-0' : 'opacity-100'}`}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
          <div className="mx-auto max-w-[560px]">
            <p className="text-[15px] font-semibold text-gray-900">{posting ? L.blocked : L.companyBlocked}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">{posting ? L.blockedBody : L.companyBlockedBody}</p>

            {posting ? (
              <section className="mt-6 rounded-2xl bg-gray-50 p-5">
                <div className="flex items-center gap-3">
                  <CompanyMark company={company} className="size-10 text-[15px]" />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-gray-900">{company.name}</p>
                    <p className="truncate text-[12px] text-gray-400">{posting.location}</p>
                  </div>
                </div>
                <h2 className="mt-4 text-[18px] leading-snug font-semibold text-gray-900">{posting.title}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600">{posting.summary}</p>
                <h3 className={`mt-5 ${label}`}>{L.required}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {posting.required.map((skill) => (
                    <SkillChip key={skill} name={skill} />
                  ))}
                </div>
                <h3 className={`mt-4 ${label}`}>{L.preferred}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {posting.preferred.map((skill) => (
                    <SkillChip key={skill} name={skill} />
                  ))}
                </div>
              </section>
            ) : (
              <CompanySummary company={company} postings={POSTINGS.filter((item) => item.companyId === company.id)} onPosting={onPosting} />
            )}

            <a href={url} target="_blank" rel="noopener noreferrer" className={`${primaryButton} mt-6 inline-flex items-center`}>
              {L.external}
            </a>
          </div>
        </div>
      )}
    </aside>
  )
}

/** 기업 사이트를 띄울 수 없을 때 대신 보여주는 기업 정보와 열려 있는 공고예요. 공고를 누르면 그 공고의 원문으로 바꿔요. */
function CompanySummary({ company, postings, onPosting }: { company: Company; postings: JobPosting[]; onPosting?: (posting: JobPosting) => void }) {
  const L = useMessages(TEXT)
  return (
    <section className="mt-6 rounded-2xl bg-gray-50 p-5">
      <div className="flex items-center gap-3">
        <CompanyMark company={company} className="size-10 text-[15px]" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-gray-900">{company.name}</p>
          <p className="truncate text-[12.5px] text-gray-400">{company.industry}</p>
        </div>
      </div>
      <h3 className={`mt-5 ${label}`}>{L.openings(postings.length)}</h3>
      <ul className="mt-2 space-y-1.5">
        {postings.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onPosting?.(item)} className="flex w-full flex-col rounded-xl bg-white px-4 py-3 text-left transition-colors hover:text-brand-hover">
              <span className="text-[14px] font-medium">{item.title}</span>
              <span className="mt-0.5 text-[12px] text-gray-400">
                {familyName(item.family)}, {careerName(item.career)}, {item.location}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
