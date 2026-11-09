import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { track } from '../lib/analytics'
import { CONTEST_CATEGORIES, contestDaysLeft, fetchContests, type Contest, type ContestCategory } from '../lib/contests'
import { COMPANIES, companyOf, fitOf, majorCompanies, POSTINGS, postingOf, RECOMMEND_MIN_FIT, sortPostings, useReports, useResume, type Company, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { readItem, writeItem } from '../lib/storage'
import { gutter } from './AppPage'
import { Carousel } from './Carousel'
import { CompanyMark, DiagnosedTag, FitBadge, filterChip, filterRow } from './GapParts'
import { CONTEST_TEXT, ContestCard } from './labs/Contests'
import { JobCard, useJobBrowser } from './JobCard'
import { ChevronRightIcon, SearchIcon } from './Icons'
import { SplitView } from './PostingBrowser'
import { SuggestionHint, useSuggestion } from './ScreenParts'
import { menuPanel } from './ui'

/**
 * 앱의 메인 화면, 새 진단이에요. 기업이나 공고를 찾아서 고르면 진단을 시작해요.
 * 레포 링크 입력창이 있던 자리에 검색창을 두고, 그 아래에 공고 줄을 탐색 맛보기처럼 늘어놓아요.
 */
const TEXT = messages({
  ko: {
    label: '기업과 공고 찾기',
    noResult: (query: string) => `"${query}"에 맞는 공고가 없어요.`,
    rows: { recent: '따끈따끈 공고', fit: '나와 잘 맞는 공고', closing: '마감이 가까운 공고', again: '다시 볼 공고' },
    companies: '기업으로 둘러보기',
    hot: '요즘 뜨는 기업',
    open: (count: number) => `채용 중 ${count}개`,
    seeAll: '전체 보기',
    results: (count: number) => `${count}개의 공고`,
    contests: '공모전',
    contestRows: { closing: '마감이 가까운 공모전', roomy: '준비할 기간이 충분한 공모전' },
    contestEmpty: '이 분야에는 지금 열린 공모전이 없어요.',
  },
  en: {
    label: 'Search companies and postings',
    noResult: (query: string) => `No postings match "${query}".`,
    rows: { recent: 'Just posted', fit: 'Good fits for you', closing: 'Closing soon', again: 'Worth another look' },
    companies: 'Browse by company',
    hot: 'Trending companies',
    open: (count: number) => `${count} open`,
    seeAll: 'See all',
    results: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    contests: 'Contests',
    contestRows: { closing: 'Contests closing soon', roomy: 'Contests with time to prepare' },
    contestEmpty: 'No open contests in this category right now.',
  },
})

const ROW_SIZE = 8
/** 공고 줄은 공고 탐색과 같은 카드를 화면 폭에 들어가는 만큼만 한 줄로 늘어놓아요. 넘치는 카드는 아래 줄로 가서 가려져요. */
const cardsLine = 'grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] auto-rows-[0px] grid-rows-[auto] gap-x-4 overflow-hidden'


interface Props {
  /** 공고를 골라 진단을 시작해요. */
  onPick: (postingId: string) => void
  onExplore: () => void
  onRecommend: () => void
  onResume: () => void
  /** 기업 상세(`/company/기업아이디`)를 열어요. */
  onCompany: (companyId: string) => void
  /** 공모전 화면(`/contests`)을 열어요. */
  onContests: () => void
}

/** 마감이 가까운 공모전은 마감까지 이만큼(일) 남은 것까지예요. 오늘 마감도 넣어요. */
const CONTEST_CLOSING_DAYS = 7
/** 준비할 기간이 충분한 공모전은 마감까지 이만큼(일) 넘게 남은 것이에요. 한 달이면 팀을 꾸리고 결과물을 만들 수 있어요. */
const CONTEST_ROOMY_DAYS = 30
/** 마지막으로 고른 공모전 분야예요. 공모전 화면의 분야(`javadda:contests-category`)와 따로 기억해요. */
const CONTEST_CATEGORY_KEY = 'javadda:home-contest-category'

function savedContestCategory(): ContestCategory | null {
  const value = readItem(CONTEST_CATEGORY_KEY)
  return CONTEST_CATEGORIES.includes(value as ContestCategory) ? (value as ContestCategory) : null
}

/**
 * 공모전 줄 두 개예요. 마감이 가까운 공모전과 준비할 기간이 충분한 공모전을 공모전 화면과 같은 카드(`ContestCard`)로 한 줄씩 늘어놓아요.
 * 위의 분야 버튼으로 두 줄을 같이 거르고, 고른 분야는 이 기기에 기억해요. 받지 못했거나 공모전이 없으면 덩어리째 두지 않아요.
 */
function ContestRows({ onOpen, onAll }: { onOpen: (contest: Contest) => void; onAll: () => void }) {
  const L = useMessages(TEXT)
  const C = useMessages(CONTEST_TEXT)
  const [contests, setContests] = useState<Contest[] | null>(null)
  const [category, setCategory] = useState<ContestCategory | null>(savedContestCategory)

  useEffect(() => {
    let alive = true
    fetchContests()
      .then((list) => alive && setContests(list))
      .catch(() => alive && setContests([]))
    return () => {
      alive = false
    }
  }, [])

  // 마감을 모르는 공모전은 어느 줄에도 넣지 않아서, 분야 버튼도 마감이 있는 공모전으로 세요.
  const dated = useMemo(
    () =>
      (contests ?? [])
        .map((contest) => ({ contest, left: contestDaysLeft(contest) }))
        .filter((each): each is { contest: Contest; left: number } => each.left !== null)
        .sort((a, b) => a.left - b.left),
    [contests],
  )
  const present = useMemo(() => new Set(dated.flatMap(({ contest }) => contest.categories)), [dated])
  const rows = useMemo(() => {
    const inCategory = dated.filter(({ contest }) => !category || contest.categories.includes(category))
    return [
      { key: 'closing' as const, list: inCategory.filter(({ left }) => left <= CONTEST_CLOSING_DAYS).slice(0, ROW_SIZE) },
      { key: 'roomy' as const, list: inCategory.filter(({ left }) => left > CONTEST_ROOMY_DAYS).slice(0, ROW_SIZE) },
    ].filter((row) => row.list.length > 0)
  }, [dated, category])

  if (dated.length === 0) return null

  const choose = (next: ContestCategory | null) => {
    track('home_contest_category', { category: next ?? 'all' })
    setCategory(next)
    writeItem(CONTEST_CATEGORY_KEY, next ?? '')
  }

  return (
    <section aria-labelledby="home-contests" className="flex flex-col gap-9">
      <div>
        <h2 id="home-contests" className="text-[15px] font-semibold text-gray-900">
          {L.contests}
        </h2>
        <div role="radiogroup" aria-label={C.category} className={`mt-3 ${filterRow}`}>
          <button type="button" role="radio" aria-checked={!category} onClick={() => choose(null)} className={`${filterChip(!category)} px-5`}>
            {C.all}
          </button>
          {CONTEST_CATEGORIES.filter((each) => present.has(each) || each === category).map((each) => (
            <button
              key={each}
              type="button"
              role="radio"
              aria-checked={category === each}
              onClick={() => choose(category === each ? null : each)}
              className={`${filterChip(category === each)} px-5`}
            >
              {C.categories[each]}
            </button>
          ))}
        </div>
        {rows.length === 0 && <p className="mt-4 text-[13px] text-gray-500">{L.contestEmpty}</p>}
      </div>
      {rows.map(({ key, list }) => (
        <section key={key} aria-labelledby={`home-contest-${key}`}>
          <div className="flex items-center justify-between gap-4">
            <h3 id={`home-contest-${key}`} className="text-[15px] font-semibold text-gray-900">
              {L.contestRows[key]}
            </h3>
            <button
              type="button"
              onClick={() => {
                track('home_more_click', { row: `contest-${key}` })
                onAll()
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand"
            >
              {L.seeAll}
              <ChevronRightIcon className="size-3.5" />
            </button>
          </div>
          <ul className={`mt-3 ${cardsLine}`}>
            {list.map(({ contest }, order) => (
              <ContestCard
                key={`${category}:${contest.id}`}
                contest={contest}
                order={order}
                onOpen={(picked) => {
                  track('home_contest_open', { row: key, category: picked.categories[0] ?? 'etc' })
                  onOpen(picked)
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

/** 공고마다 찾을 글자(기업 이름, 공고 제목, 지역, 스킬)를 한 번만 만들어 두어서, 글자를 칠 때마다 다시 잇지 않아요. */
const haystacks = new WeakMap<JobPosting, string>()
const haystackOf = (posting: JobPosting) => {
  let text = haystacks.get(posting)
  if (text === undefined) {
    text = [companyOf(posting.companyId).name, posting.title, posting.location, ...posting.required, ...posting.preferred].join(' ').toLowerCase()
    haystacks.set(posting, text)
  }
  return text
}

/** 검색어로 공고를 걸러요. 기업 이름, 공고 제목, 지역, 스킬에서 찾아요. */
function search(query: string): JobPosting[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return POSTINGS.filter((posting) => haystackOf(posting).includes(needle))
}

/**
 * 기업으로 둘러보기에 놓을 기업이에요. 공고가 있는 기업을 유명 기업, 로고가 있는 기업, 로고가 없는 기업 순서로 두고
 * 같은 묶음 안에서는 공고가 많은 순서예요. 공공기관과 중소기업이 수백 곳이 되어도 화면에는 한 줄만 보여요.
 */
function browseCompanies() {
  const counts = new Map<string, number>()
  for (const posting of POSTINGS) counts.set(posting.companyId, (counts.get(posting.companyId) ?? 0) + 1)
  const majors = majorCompanies().filter((company) => counts.has(company.id))
  const rest = COMPANIES.filter((company) => counts.has(company.id) && !majors.includes(company)).sort(
    (a, b) => Number(!!b.logo) - Number(!!a.logo) || (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
  )
  return [...majors, ...rest]
}

/** 기업 칸 하나의 폭과 칸 사이 간격(px)이에요. 칸을 늘이지 않아서 화면이 넓어도 로고 사이가 벌어지지 않아요. */
const CAROUSEL_ITEM = 96
const CAROUSEL_GAP = 4

/** 기업으로 둘러보기 줄이에요. 한 줄에 들어가는 만큼 보여주고, 기업이 더 있으면 잠깐마다 한 칸씩 밀려나며 돌아요(`Carousel`). */
function CompanyCarousel({ companies, onSelect }: { companies: Company[]; onSelect: (company: Company) => void }) {
  return (
    <Carousel
      className={`mt-2 ${phoneBleed}`}
      items={companies}
      itemWidth={CAROUSEL_ITEM}
      gap={CAROUSEL_GAP}
      keyOf={(company) => company.id}
      render={(company, hidden) => (
        <button
          type="button"
          tabIndex={hidden ? -1 : undefined}
          onClick={() => onSelect(company)}
          className="group flex w-full flex-col items-center gap-2.5 rounded-2xl px-2 py-3.5 transition-colors hover:bg-gray-50"
        >
          <CompanyMark company={company} className="size-14 rounded-2xl! text-[19px]" />
          <span className="w-full truncate text-center text-[13px] text-gray-700 transition-colors group-hover:text-gray-950">{company.name}</span>
        </button>
      )}
    />
  )
}

/**
 * 휴대폰에서 움직이는 줄(요즘 뜨는 기업, 기업으로 둘러보기)을 화면 가장자리까지 넓혀요.
 * 바깥 칸만 좌우 여백만큼 넓히고 같은 만큼 안쪽 여백을 둬서, 처음 자리는 그대로이고 잘리는 자리만 화면 끝으로 가요.
 * 그 위 화면은 내용 폭이 좁아서 여백 안에서 잘려도 어색하지 않아요.
 */
const phoneBleed = '-mx-4 px-4 sm:mx-0 sm:px-0'

/** 요즘 뜨는 기업 카드 하나의 폭과 카드 사이 간격(px)이에요. */
const HOT_CARD = 236
const HOT_GAP = 12

/** 요즘 뜨는 기업이에요. 네카라쿠배당토 같은 유명 기업(`majorCompanies`) 열다섯 곳만, 정해 둔 순서 그대로 두고 채용 중인 공고 수를 세요. */
function hotCompanies(): { company: Company; open: number }[] {
  return majorCompanies().map((company) => ({ company, open: POSTINGS.filter((posting) => posting.companyId === company.id).length }))
}

/**
 * 요즘 뜨는 기업 줄이에요. 왼쪽에 로고, 오른쪽에 기업 이름과 채용 중인 공고 수를 적은 회색 카드가
 * 기업으로 둘러보기처럼 잠깐마다 한 칸씩 왼쪽으로 넘어가요(`Carousel`). 누르면 기업 상세로 가요.
 */
function HotCompanies({ companies, onSelect }: { companies: { company: Company; open: number }[]; onSelect: (company: Company) => void }) {
  const L = useMessages(TEXT)
  return (
    <Carousel
      className={`mt-3 ${phoneBleed}`}
      items={companies}
      itemWidth={HOT_CARD}
      gap={HOT_GAP}
      keyOf={({ company }) => company.id}
      render={({ company, open }, hidden) => (
        <button
          type="button"
          tabIndex={hidden ? -1 : undefined}
          onClick={() => onSelect(company)}
          className="group flex w-full items-center gap-3.5 rounded-2xl bg-gray-50 p-3.5 pr-4 text-left transition-colors hover:bg-gray-100"
        >
          <CompanyMark company={company} className="size-12 shrink-0 rounded-xl! text-[16px]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-brand">{company.name}</span>
            <span className="mt-0.5 block text-[12.5px] text-gray-500 tabular-nums">{L.open(open)}</span>
          </span>
          <ChevronRightIcon className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-brand" />
        </button>
      )}
    />
  )
}

export function Home({ onPick, onExplore, onRecommend, onCompany, onContests }: Props) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const reports = useReports()
  const browser = useJobBrowser()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  /** 방향키로 고른 검색 결과의 순서. 고른 게 없으면 -1이에요. */
  const [active, setActive] = useState(-1)
  // 검색창이 비어 있는 동안 추천 검색어가 하나씩 아래에서 올라오며 바뀌어요. 공고 탐색과 같아요.
  const suggestion = useSuggestion(!query)
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

  function submit(event: FormEvent) {
    event.preventDefault()
    // 비어 있을 때 Enter를 누르면 지금 보이는 추천 검색어로 찾아요.
    if (!query) {
      track('home_suggestion_use', { query: suggestion.text })
      setQuery(suggestion.text)
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
  const browse = useMemo(browseCompanies, [])
  const hot = useMemo(hotCompanies, [])
  const recent = useMemo(() => sortPostings(POSTINGS, 'recent', null).slice(0, ROW_SIZE), [])
  const closing = useMemo(() => sortPostings(POSTINGS.filter((posting) => posting.deadline), 'deadline', null).slice(0, ROW_SIZE), [])
  // 나와 잘 맞는 공고는 추천 공고와 같이 적합도 50% 이상만이에요. 낮음은 이 줄에 넣지 않아요.
  const fit = useMemo(
    () => (resume ? sortPostings(POSTINGS.filter((posting) => posting.family !== 'other' && (fitOf(posting, resume) ?? 0) >= RECOMMEND_MIN_FIT), 'fit', resume).slice(0, ROW_SIZE) : []),
    [resume],
  )
  /** 진단해 둔 공고 중 적합도가 낮았던 것. 보완한 뒤에 다시 보라고 보여줘요. 같은 공고를 다른 이력서로 여러 번 진단했어도 한 번만 넣어요. */
  const again = useMemo(
    () =>
      [
        ...new Set(
          reports
            .filter((report) => report.status === 'done' && report.fitScore < 70)
            .map((report) => postingOf(report.postingId))
            .filter((posting): posting is JobPosting => !!posting),
        ),
      ].slice(0, ROW_SIZE),
    [reports],
  )

  const rows: { key: keyof typeof L.rows | 'companies'; list: JobPosting[]; more?: () => void }[] = [
    ...(fit.length > 0 ? [{ key: 'fit' as const, list: fit, more: onRecommend }] : []),
    { key: 'companies', list: [], more: onExplore },
    { key: 'recent', list: recent, more: onExplore },
    { key: 'closing', list: closing, more: onExplore },
    ...(again.length > 0 ? [{ key: 'again' as const, list: again }] : []),
  ]

  return (
    <SplitView side={browser.side}>
      <main className="relative flex-1 overflow-hidden">
        <div className={`relative h-full overflow-y-auto ${gutter} pb-10`}>
          {/* 로고, 타이틀, 설명은 두지 않고 검색창 하나만 맨 위에 둬서 공고와 기업이 한 화면에 더 많이 보여요.
              휴대폰에서는 검색창도 두지 않고 바로 공고 줄부터 보여줘요. 검색은 공고 탐색에서 해요. */}
          <div className="mx-auto w-full max-w-lg pt-12 pb-10 max-sm:hidden">
            {/* 검색 결과가 아래의 공고 줄 위로 펼쳐지게, 검색창 덩어리를 한 칸 앞에 둬요. */}
            <div className="relative z-10 animate-rise">
              <form
                onSubmit={submit}
                role="search"
                className="relative flex h-[52px] w-full items-center rounded-full border border-gray-200/90 bg-white/55 pr-5 pl-5 backdrop-blur-md"
              >
                <SearchIcon className="mr-2.5 size-4 shrink-0 text-gray-400" />
                <input
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
                {!query && <SuggestionHint {...suggestion} className="right-5 left-[46px]" />}
                {query && <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">{L.results(results.length)}</span>}
              </form>

              {open && query.trim() && (
                <>
                  <div aria-hidden className="fixed inset-0 z-0" onClick={() => setOpen(false)} />
                  <ul ref={listRef} id="home-search-results" role="listbox" className={`${menuPanel} absolute top-full right-0 left-0 z-10 mt-2 max-h-[52dvh] origin-top overflow-y-auto`}>
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
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${index === active ? 'bg-gray-100' : ''}`}
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

          {/* 휴대폰에서는 위의 덩어리가 없어서, 맨 위 로고 줄(AppFrame) 아래 16px에서 기다리지 않고 바로 떠올라요. */}
          <div className="flex animate-rise flex-col gap-9 max-sm:pt-[72px] sm:[animation-delay:120ms]">
            <section aria-labelledby="home-hot">
              <h2 id="home-hot" className="text-[15px] font-semibold text-gray-900">
                {L.hot}
              </h2>
              <HotCompanies
                companies={hot}
                onSelect={(company) => {
                  track('home_company_select', { company: company.id, from: 'hot' })
                  onCompany(company.id)
                }}
              />
            </section>
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
                  <CompanyCarousel
                    companies={browse}
                    onSelect={(company) => {
                      track('home_company_select', { company: company.id, from: 'browse' })
                      onCompany(company.id)
                    }}
                  />
                ) : (
                  <ul className={`mt-3 ${cardsLine}`}>
                    {/* 모든 줄이 공고 탐색과 같은 카드를 써요. 카드를 누르면 원문을 옆에 열고, 분석하기는 바로 진단해요. */}
                    {list.map((posting, order) => (
                      <JobCard
                        key={posting.id}
                        posting={posting}
                        resume={resume}
                        fit={fitOf(posting, resume)}
                        order={order}
                        onOpen={() => browser.view(posting)}
                        onCompany={() => browser.viewCompany(posting.companyId)}
                        onAnalyze={() => pick(posting)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <ContestRows
              onAll={onContests}
              onOpen={(contest) => {
                const main = contest.links[0]
                if (main) browser.viewPage({ url: main.url, title: contest.title })
              }}
            />
          </div>
        </div>
      </main>
    </SplitView>
  )
}
