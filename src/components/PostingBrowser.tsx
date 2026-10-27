import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { track } from '../lib/analytics'
import { canEmbed, companyOf, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { primaryButton } from './Dialog'
import { CompanyMark, SkillChip } from './GapParts'
import { CloseButton, RefreshIcon } from './Icons'
import { Bone } from './Skeleton'

/**
 * 공고 원문을 새 탭 대신 앱 안에서 보는 미니 브라우저예요. 오른쪽에서 미끄러져 들어오고, 바깥을 누르거나 Esc를 누르면 닫혀요.
 * 채용 사이트가 다른 서비스 안에 보이지 않게 막아 두었으면(`canEmbed`) 원문 대신 공고 요약을 보여주고, 새 탭은 마지막 방법으로만 둬요.
 * 갭 상세 칸처럼 화면 맨 바깥(body)에 그려요.
 */

const TEXT = messages({
  ko: {
    title: (company: string) => `${company} 채용 공고 원문`,
    reload: '새로 고침',
    external: '새 탭에서 열기',
    close: '닫기',
    blocked: '이 채용 사이트는 다른 서비스 안에서 열 수 없게 막아 두었어요.',
    blockedBody: '공고의 핵심은 아래에 정리해 두었어요. 원문을 꼭 봐야 할 때만 새 탭으로 열어 주세요.',
    required: '필수 역량',
    preferred: '우대 역량',
    loading: '원문을 불러오고 있어요.',
  },
  en: {
    title: (company: string) => `${company} original posting`,
    reload: 'Reload',
    external: 'Open in new tab',
    close: 'Close',
    blocked: "This careers site doesn't allow being shown inside other services.",
    blockedBody: "We've summarized the posting below. Open it in a new tab only if you need the original.",
    required: 'Required',
    preferred: 'Preferred',
    loading: 'Loading the original.',
  },
})

const toolbarButton = 'flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900'

export function PostingBrowser({ posting, onClose }: { posting: JobPosting; onClose: () => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const embeddable = canEmbed(posting.url)
  const [loaded, setLoaded] = useState(false)
  const [version, setVersion] = useState(0)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    track('posting_browser_open', { posting: posting.id, embedded: embeddable })
  }, [posting.id, embeddable])

  // 아래 화면의 칸이나 메뉴가 같은 Esc로 또 닫히지 않게 여기서 멈춰요.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close.current()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const host = (() => {
    try {
      return new URL(posting.url).host.replace(/^www\./, '')
    } catch {
      return posting.url
    }
  })()

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div aria-hidden className="absolute inset-0 animate-fade bg-gray-900/25" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={L.title(company.name)}
        className="absolute inset-y-0 right-0 flex w-full max-w-[920px] animate-slide-in flex-col border-l border-gray-200 bg-white md:w-[72vw]"
      >
        {/* 주소 줄처럼 생긴 머리글이에요. 어느 사이트를 보고 있는지 알 수 있게 주소를 적어요. */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-3">
          <CloseButton label={L.close} size="md" onClick={onClose} />
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
          <a href={posting.url} target="_blank" rel="noopener noreferrer" aria-label={L.external} title={L.external} className={toolbarButton}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
            </svg>
          </a>
        </div>

        {embeddable ? (
          <div className="relative min-h-0 flex-1">
            {!loaded && (
              <div aria-busy="true" className="absolute inset-0 p-8">
                <span className="sr-only">{L.loading}</span>
                <Bone className="h-6 w-1/2" />
                <Bone className="mt-6 h-3.5 w-full" />
                <Bone className="mt-3 h-3.5 w-5/6" />
                <Bone className="mt-3 h-3.5 w-2/3" />
                <Bone className="mt-8 h-40 w-full rounded-xl!" />
              </div>
            )}
            <iframe
              key={version}
              src={posting.url}
              title={L.title(company.name)}
              onLoad={() => setLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              className={`size-full bg-white transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-8 md:px-10">
            <div className="mx-auto max-w-[560px]">
              <p className="text-[15px] font-semibold text-gray-900">{L.blocked}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">{L.blockedBody}</p>

              <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <CompanyMark company={company} className="size-10 text-[15px]" />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-gray-900">{company.name}</p>
                    <p className="truncate text-[12px] text-gray-400">{posting.location}</p>
                  </div>
                </div>
                <h2 className="mt-4 text-[18px] leading-snug font-semibold text-gray-900">{posting.title}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600">{posting.summary}</p>
                <h3 className="mt-5 text-[12.5px] font-medium text-gray-400">{L.required}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {posting.required.map((skill) => (
                    <SkillChip key={skill} name={skill} />
                  ))}
                </div>
                <h3 className="mt-4 text-[12.5px] font-medium text-gray-400">{L.preferred}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {posting.preferred.map((skill) => (
                    <SkillChip key={skill} name={skill} />
                  ))}
                </div>
              </section>

              <a href={posting.url} target="_blank" rel="noopener noreferrer" className={`${primaryButton} mt-6 inline-flex items-center`}>
                {L.external}
              </a>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  )
}
