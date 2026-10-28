import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { track } from '../lib/analytics'
import { COMPANIES, fitOf, POSTINGS, SEARCH_SUGGESTIONS, sortPostings, SUGGEST_MS, useReports, useResume, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { cardsRow, CompanyMark, FitBadge, PostingCard, RecentPostingCard } from './GapParts'
import { companyOf } from '../lib/gap'
import { LofyScript } from './LofyScript'

/**
 * 앱의 메인 화면, 새 진단이에요. 기업이나 공고를 찾아서 고르면 진단을 시작해요.
 * 레포 링크 입력창이 있던 자리에 검색창을 두고, 그 아래에 공고 줄을 탐색 맛보기처럼 늘어놓아요.
 */
const TEXT = messages({
  ko: {
    title: '어떤 기업에 맞춰 볼까요?',
    description: '기업 이름이나 공고를 찾아 고르면, 내 이력서와 공고 사이의 갭을 진단해요',
    descriptionNoResume: '기업 이름이나 공고를 찾아 고르면 진단을 시작해요. 첫 진단에서 이력서를 올려요',
    label: '기업과 공고 찾기',
    noResult: (query: string) => `"${query}"에 맞는 공고가 없어요.`,
    rows: { recent: '요즘 올라온 공고', fit: '나와 잘 맞는 공고', closing: '마감이 가까운 공고', again: '다시 볼 공고' },
    companies: '기업으로 둘러보기',
    seeAll: '전체 보기',
    results: (count: number) => `${count}개의 공고`,
  },
  en: {
    title: 'Which company should we measure against?',
    description: 'Search for a company or posting and pick one to see the gap between your resume and the role',
    descriptionNoResume: 'Search for a company or posting to start. You upload your resume in the first diagnosis',
    label: 'Search companies and postings',
    noResult: (query: string) => `No postings match "${query}".`,
    rows: { recent: 'Just posted', fit: 'Good fits for you', closing: 'Closing soon', again: 'Worth another look' },
    companies: 'Browse by company',
    seeAll: 'See all',
    results: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
  },
})

const WORD_STAGGER_MS = 80
const ROW_SIZE = 8

/** 타이틀을 어절 단위로 나눠요. 어절이 하나씩 흐릿하게 떠오르며 나타나요. */
function Title({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <h1 aria-label={text} className="text-balance text-center text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">
      {words.map((word, index) => (
        <span key={`${text}:${index}`} aria-hidden="true">
          <span className="inline-block animate-word" style={{ animationDelay: `${index * WORD_STAGGER_MS}ms` }}>
            {word}
          </span>
          {index < words.length - 1 && ' '}
        </span>
      ))}
    </h1>
  )
}

interface Props {
  /** 공고를 골라 진단을 시작해요. */
  onPick: (postingId: string) => void
  onExplore: () => void
  onRecommend: () => void
  onResume: () => void
  /** 기업을 골라 그 기업 공고만 공고 탐색에서 봐요. */
  onCompany: (companyId: string) => void
}

/** 검색어로 공고를 걸러요. 기업 이름, 공고 제목, 지역, 스킬에서 찾아요. */
function search(query: string): JobPosting[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return POSTINGS.filter((posting) => {
    const company = companyOf(posting.companyId)
    return [company.name, posting.title, posting.location, ...posting.required, ...posting.preferred].join(' ').toLowerCase().includes(needle)
  })
}

/** 공고가 하나라도 있는 기업이에요. */
const BROWSE_COMPANIES = COMPANIES.filter((company) => POSTINGS.some((posting) => posting.companyId === company.id))

export function Home({ onPick, onExplore, onRecommend, onCompany }: Props) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const reports = useReports()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [suggestion, setSuggestion] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => search(query), [query])

  // 검색 결과가 열려 있을 때 바깥을 누르거나 Esc를 누르면 닫아요.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 검색창이 비어 있는 동안 추천 검색어가 하나씩 아래에서 올라오며 바뀌어요. 공고 탐색과 같아요.
  useEffect(() => {
    if (query) return
    const timer = window.setInterval(() => setSuggestion((value) => (value + 1) % SEARCH_SUGGESTIONS.length), SUGGEST_MS)
    return () => window.clearInterval(timer)
  }, [query])

  function submit(event: FormEvent) {
    event.preventDefault()
    // 비어 있을 때 Enter를 누르면 지금 보이는 추천 검색어로 찾아요.
    if (!query) {
      track('home_suggestion_use', { query: SEARCH_SUGGESTIONS[suggestion] })
      setQuery(SEARCH_SUGGESTIONS[suggestion])
      setOpen(true)
      return
    }
    if (results.length === 1) pick(results[0])
  }

  function pick(posting: JobPosting) {
    track('posting_select', { posting: posting.id, from: 'home', query: query.length > 0 })
    setOpen(false)
    onPick(posting.id)
  }

  const recent = sortPostings(POSTINGS, 'recent', resume).slice(0, ROW_SIZE)
  const closing = sortPostings(POSTINGS.filter((posting) => posting.deadline), 'deadline', resume).slice(0, ROW_SIZE)
  const fit = resume ? sortPostings(POSTINGS, 'fit', resume).slice(0, ROW_SIZE) : []
  /** 진단해 둔 공고 중 적합도가 낮았던 것. 보완한 뒤에 다시 보라고 보여줘요. */
  const again = reports
    .filter((report) => report.status === 'done' && report.fitScore < 70)
    .map((report) => POSTINGS.find((posting) => posting.id === report.postingId))
    .filter((posting): posting is JobPosting => posting !== undefined)
    .slice(0, ROW_SIZE)

  const rows: { key: keyof typeof L.rows | 'companies'; list: JobPosting[]; more?: () => void }[] = [
    ...(fit.length > 0 ? [{ key: 'fit' as const, list: fit, more: onRecommend }] : []),
    { key: 'companies', list: [] },
    { key: 'recent', list: recent, more: onExplore },
    { key: 'closing', list: closing, more: onExplore },
    ...(again.length > 0 ? [{ key: 'again' as const, list: again }] : []),
  ]

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="relative h-full overflow-y-auto px-6 pb-10 md:px-10">
        <div className="mx-auto w-full max-w-lg pt-[max(6rem,16vh)] pb-14">
          <LofyScript className="mx-auto mb-5 h-16 w-auto sm:h-20" />
          <Title text={L.title} />
          <p className="mt-3 mb-7 animate-rise text-balance break-keep text-center text-[13px] leading-relaxed text-gray-500 sm:mb-8 sm:text-[14px]" style={{ animationDelay: '250ms' }}>
            {resume ? L.description : L.descriptionNoResume}
          </p>
          {/* 검색 결과가 아래의 공고 줄 위로 펼쳐지게, 검색창 덩어리를 한 칸 앞에 둬요. */}
          <div className="relative z-10 animate-rise" style={{ animationDelay: '350ms' }}>
            <form
              onSubmit={submit}
              role="search"
              className="relative flex h-[52px] w-full items-center rounded-full border border-gray-200/90 bg-white/55 pr-5 pl-5 backdrop-blur-md"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2.5 size-4 shrink-0 text-gray-400" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                data-search-input
                aria-label={L.label}
                aria-expanded={open && query.trim().length > 0}
                // 모바일에서 글자가 16px보다 작으면 입력창을 누를 때 화면이 확대돼서, 모바일에서는 16px로 둬요.
                className="h-full min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-[14px] [&::-webkit-search-cancel-button]:hidden"
              />
              {/* 추천 검색어는 자리표시 글자처럼 옅게 보여서, 이런 걸 쳐 볼 수 있다는 것만 슬쩍 알려요. */}
              {!query && (
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-[46px] right-5 flex items-center overflow-hidden text-base whitespace-nowrap text-gray-400 sm:text-[14px]">
                  <span key={suggestion} className="animate-rise">
                    {SEARCH_SUGGESTIONS[suggestion]}
                  </span>
                </span>
              )}
              {query && <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">{L.results(results.length)}</span>}
            </form>

            {open && query.trim() && (
              <>
                <div aria-hidden className="fixed inset-0 z-0" onClick={() => setOpen(false)} />
                <ul role="listbox" className="absolute top-full right-0 left-0 z-10 mt-2 max-h-[52dvh] origin-top animate-pop overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5">
                  {results.length === 0 ? (
                    <li className="px-3 py-3 text-[13px] text-gray-500">{L.noResult(query.trim())}</li>
                  ) : (
                    results.map((posting) => {
                      const company = companyOf(posting.companyId)
                      return (
                        <li key={posting.id}>
                          <button type="button" role="option" aria-selected={false} onClick={() => pick(posting)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50">
                            <CompanyMark company={company} className="size-9 text-[13px]" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-gray-900">{posting.title}</span>
                              <span className="block truncate text-[12px] text-gray-400">
                                {company.name}, {posting.location}
                              </span>
                            </span>
                            <FitBadge fit={fitOf(posting, resume)} compact />
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="flex animate-rise flex-col gap-9" style={{ animationDelay: '450ms' }}>
          {rows.map(({ key, list, more }) => (
            <section key={key} aria-labelledby={`home-${key}`}>
              <div className="flex items-center justify-between gap-4">
                <h2 id={`home-${key}`} className="text-[15px] font-semibold text-gray-900">
                  {key === 'companies' ? L.companies : L.rows[key]}
                </h2>
                {more && (
                  <button
                    type="button"
                    onClick={() => {
                      track('home_more_click', { row: key })
                      more()
                    }}
                    className="inline-flex h-8 items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand"
                  >
                    {L.seeAll}
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" />
                    </svg>
                  </button>
                )}
              </div>
              {key === 'companies' ? (
                // 기업을 누르면 그 기업 공고만 골라 둔 채로 공고 탐색을 열어요.
                <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2.5">
                  {BROWSE_COMPANIES.map((company, order) => (
                    <li key={company.id} className="animate-rise" style={{ animationDelay: `${Math.min(order, 8) * 30}ms` }}>
                      <button
                        type="button"
                        onClick={() => {
                          track('home_company_select', { company: company.id })
                          onCompany(company.id)
                        }}
                        className="group flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-brand"
                      >
                        <CompanyMark company={company} className="size-10 text-[15px]" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-gray-900 transition-colors group-hover:text-brand">{company.name}</span>
                          <span className="block truncate text-[12px] text-gray-400">{company.industry}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={`mt-3 ${cardsRow}`}>
                  {list.map((posting, order) =>
                    // 요즘 올라온 공고는 기업보다 공고를 앞에 세운 카드로 보여줘요.
                    key === 'recent' ? (
                      <RecentPostingCard key={posting.id} posting={posting} resume={resume} order={order} onOpen={pick} />
                    ) : (
                      <PostingCard key={posting.id} posting={posting} fit={fitOf(posting, resume)} order={order} onOpen={pick} />
                    ),
                  )}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
