import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { track } from '../lib/analytics'
import { COMPANIES, companyOf, fitOf, POSTINGS, postingOf, RECOMMEND_MIN_FIT, SEARCH_SUGGESTIONS, sortPostings, SUGGEST_MS, useReports, useResume, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { cardsRow, CompanyMark, DiagnosedTag, FitBadge, PostingTile } from './GapParts'
import { ChevronRightIcon, SearchIcon } from './Icons'
import { stagger } from './ui'
import { LofyScript } from './LofyScript'

/**
 * 앱의 메인 화면, 새 진단이에요. 기업이나 공고를 찾아서 고르면 진단을 시작해요.
 * 레포 링크 입력창이 있던 자리에 검색창을 두고, 그 아래에 공고 줄을 탐색 맛보기처럼 늘어놓아요.
 */
const TEXT = messages({
  ko: {
    title: '어떤 기업에 맞춰 볼까요?',
    description: '기업 이름이나 공고를 찾아 고르면, 내 이력서와 공고 사이의 갭을 진단해요',
    descriptionNoResume: '어떤 회사나 직무를 목표로 하고 있나요?',
    label: '기업과 공고 찾기',
    noResult: (query: string) => `"${query}"에 맞는 공고가 없어요.`,
    rows: { recent: '따끈따끈 공고', fit: '나와 잘 맞는 공고', closing: '마감이 가까운 공고', again: '다시 볼 공고' },
    companies: '기업으로 둘러보기',
    seeAll: '전체 보기',
    results: (count: number) => `${count}개의 공고`,
  },
  en: {
    title: 'Which company should we measure against?',
    description: 'Search for a company or posting and pick one to see the gap between your resume and the role',
    descriptionNoResume: 'Which company or role are you aiming for?',
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
  /** 방향키로 고른 검색 결과의 순서. 고른 게 없으면 -1이에요. */
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const results = useMemo(() => search(query), [query])

  // 방향키로 고른 결과가 목록 밖에 있으면 보이는 곳까지 스크롤해요.
  useEffect(() => {
    if (active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

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
    if (active >= 0 && results[active]) pick(results[active])
    else if (results.length === 1) pick(results[0])
  }

  /** 검색 결과가 보일 때 위아래 방향키로 결과를 하나씩 옮겨 다녀요. 끝에서 누르면 반대쪽 끝으로 돌아가요. */
  function moveActive(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    // 한글을 조합하는 중에는 방향키가 글자를 마무리하는 데 쓰여서 넘겨요.
    if (event.nativeEvent.isComposing || !query.trim() || results.length === 0) return
    event.preventDefault()
    setOpen(true)
    const last = results.length - 1
    if (event.key === 'ArrowDown') setActive((index) => (index >= last ? 0 : index + 1))
    else setActive((index) => (index <= 0 ? last : index - 1))
  }

  function pick(posting: JobPosting) {
    track('posting_select', { posting: posting.id, from: 'home', query: query.length > 0 })
    setOpen(false)
    onPick(posting.id)
  }

  // 올라온 순서와 마감 순서는 이력서와 상관없어서 처음 한 번만 정해요.
  const recent = useMemo(() => sortPostings(POSTINGS, 'recent', null).slice(0, ROW_SIZE), [])
  const closing = useMemo(() => sortPostings(POSTINGS.filter((posting) => posting.deadline), 'deadline', null).slice(0, ROW_SIZE), [])
  // 나와 잘 맞는 공고는 추천 공고와 같이 적합도 50% 이상만이에요. 낮음은 이 줄에 넣지 않아요.
  const fit = useMemo(
    () => (resume ? sortPostings(POSTINGS, 'fit', resume).filter((posting) => posting.family !== 'other' && (fitOf(posting, resume) ?? 0) >= RECOMMEND_MIN_FIT).slice(0, ROW_SIZE) : []),
    [resume],
  )
  /** 진단해 둔 공고 중 적합도가 낮았던 것. 보완한 뒤에 다시 보라고 보여줘요. */
  const again = useMemo(
    () =>
      reports
        .filter((report) => report.status === 'done' && report.fitScore < 70)
        .map((report) => postingOf(report.postingId))
        .filter((posting): posting is JobPosting => !!posting)
        .slice(0, ROW_SIZE),
    [reports],
  )

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
              <SearchIcon className="mr-2.5 size-4 shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(-1)
                  setOpen(true)
                }}
                onKeyDown={moveActive}
                onFocus={() => setOpen(true)}
                data-search-input
                aria-label={L.label}
                role="combobox"
                aria-controls="home-search-results"
                aria-expanded={open && query.trim().length > 0}
                aria-activedescendant={open && active >= 0 && results[active] ? `home-result-${results[active].id}` : undefined}
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
                <ul ref={listRef} id="home-search-results" role="listbox" className="absolute top-full right-0 left-0 z-10 mt-2 max-h-[52dvh] origin-top animate-pop overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5">
                  {results.length === 0 ? (
                    <li className="px-3 py-3 text-[13px] text-gray-500">{L.noResult(query.trim())}</li>
                  ) : (
                    results.map((posting, index) => {
                      const company = companyOf(posting.companyId)
                      return (
                        <li key={posting.id}>
                          {/* 스크롤로 목록이 마우스 아래를 지나갈 때는 고른 줄이 바뀌지 않게, 마우스를 실제로 움직였을 때만 따라가요. */}
                          <button
                            type="button"
                            role="option"
                            id={`home-result-${posting.id}`}
                            data-index={index}
                            aria-selected={index === active}
                            onClick={() => pick(posting)}
                            onMouseMove={() => index !== active && setActive(index)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${index === active ? 'bg-gray-100' : ''}`}
                          >
                            <CompanyMark company={company} className="size-9 text-[13px]" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-gray-900">{posting.title}</span>
                              <span className="block truncate text-[12px] text-gray-400">
                                {company.name}, {posting.location}
                              </span>
                            </span>
                            <DiagnosedTag postingId={posting.id} />
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
                    <ChevronRightIcon className="size-3.5" />
                  </button>
                )}
              </div>
              {key === 'companies' ? (
                // 기업을 누르면 그 기업 공고만 골라 둔 채로 공고 탐색을 열어요.
                // 테두리 없이 로고와 이름만 늘어놓아서, 공고 카드 사이에서 가볍게 보여요.
                <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1">
                  {BROWSE_COMPANIES.map((company, order) => (
                    <li key={company.id} className="animate-rise" style={stagger(order)}>
                      <button
                        type="button"
                        onClick={() => {
                          track('home_company_select', { company: company.id })
                          onCompany(company.id)
                        }}
                        className="group flex w-full flex-col items-center gap-2 rounded-2xl px-2 py-3 transition-colors hover:bg-gray-50"
                      >
                        <CompanyMark company={company} className="size-12 rounded-2xl! text-[17px]" />
                        <span className="w-full truncate text-center text-[12.5px] text-gray-700 transition-colors group-hover:text-gray-950">{company.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={`mt-3 ${cardsRow}`}>
                  {/* 모든 줄이 같은 카드를 쓰고, 왼쪽 위 태그만 줄에 맞게 달라요. 올라온 때, 마감까지 남은 날, 얼마나 맞는지예요. */}
                  {list.map((posting, order) => (
                    <PostingTile key={posting.id} posting={posting} resume={resume} tag={key === 'recent' ? 'posted' : key === 'closing' ? 'deadline' : 'fit'} order={order} onOpen={pick} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
