import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, companyOf, type CompanyCategory, majorCompanies, familyName, fetchPostings, fitOf, sortPostings, useResume, type CareerLevel, type JobFamily, type JobPosting, type PostingSort, SEARCH_SUGGESTIONS, SUGGEST_MS } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { CategoryFilter, CompanyFilter, Failed, Notice, usePickConfirm } from './GapParts'
import { SearchIcon } from './Icons'
import { JobItem, jobsGrid, jobsList, LayoutToggle, readLayout, useJobBrowser, type Layout } from './JobCard'
import { SplitView } from './PostingBrowser'
import { loadCenter, LoadProgress, useShowMore } from './ui'

/**
 * 공고 탐색 화면이에요. 공고를 화면 가득 펼쳐 놓고 직군과 경력으로 걸러 보다가, 눌러서 진단을 시작해요.
 * 이력서를 올려 두었으면 카드마다 적합도가 보여요.
 */

const FAMILIES: JobFamily[] = ['backend', 'frontend', 'mobile', 'data', 'devops', 'other']
const CAREERS: CareerLevel[] = ['entry', 'junior', 'any']
const SORTS: PostingSort[] = ['fit', 'recent', 'deadline']

const TEXT = messages({
  ko: {
    title: '공고 탐색',
    label: '공고 찾기',
    all: '전체',
    family: '직군',
    career: '경력',
    sort: '정렬',
    sorts: { fit: '적합도순', recent: '최신순', deadline: '마감 임박순' } as Record<PostingSort, string>,
    items: (count: number) => `${count}개의 공고`,
    none: '맞는 공고가 없어요.',
    noneBody: '검색어나 걸러 둔 조건을 바꿔 보세요.',
    reset: '조건 초기화',
    location: '지역',
    category: '기업 분류',
    majors: '주요 기업',
  },
  en: {
    title: 'Explore jobs',
    label: 'Search postings',
    all: 'All',
    family: 'Role',
    career: 'Level',
    sort: 'Sort',
    sorts: { fit: 'Best fit', recent: 'Newest', deadline: 'Closing soon' },
    items: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    none: 'No postings match.',
    noneBody: 'Try a different search or filter.',
    reset: 'Clear filters',
    location: 'Location',
    category: 'Company type',
    majors: 'Major companies',
  },
})

type Loaded = JobPosting[] | 'failed'

/** company를 주면 그 기업 공고만 골라 둔 채로 열어요. 새 진단 화면의 기업 둘러보기에서 와요. */
export function Jobs({ onPick, initialCompany = null }: { onPick: (postingId: string) => void; initialCompany?: string | null }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<JobFamily | null>(null)
  const [career, setCareer] = useState<CareerLevel | null>(null)
  const [sort, setSort] = useState<PostingSort>(resume ? 'fit' : 'recent')
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const [suggestion, setSuggestion] = useState(0)
  const [company, setCompany] = useState<string | null>(initialCompany)
  const [category, setCategory] = useState<CompanyCategory | null>(null)
  const browser = useJobBrowser()
  const [layout, setLayout] = useState<Layout>(readLayout)
  const load = useLoadProgress()
  // 카드를 누르면 한 번 더 묻고, 분석 시작하기는 바로 진단해요.
  const confirmPick = usePickConfirm()
  function analyze(posting: JobPosting) {
    track('posting_select', { posting: posting.id, from: 'explore' })
    onPick(posting.id)
  }

  // 검색창이 비어 있는 동안 추천 검색어가 하나씩 아래에서 올라오며 바뀌어요.
  useEffect(() => {
    if (query) return
    const timer = window.setInterval(() => setSuggestion((value) => (value + 1) % SEARCH_SUGGESTIONS.length), SUGGEST_MS)
    return () => window.clearInterval(timer)
  }, [query])

  // 검색어는 잠깐 멈췄을 때 보내요.
  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    const onLoad = load.one()
    const timer = window.setTimeout(() => {
      void fetchPostings({ query, family, career }, onLoad).then(
        (list) => {
          if (!stale) setLoaded(list)
        },
        () => {
          if (!stale) setLoaded('failed')
        },
      )
    }, query ? 250 : 0)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [query, family, career, attempt, load.one])

  // 기업은 받아 온 공고에서 바로 걸러요. 기업마다 공고가 몇 개뿐이라 서버에 다시 묻지 않아요.
  const list = useMemo(
    () => (Array.isArray(loaded) ? sortPostings(
            loaded.filter((posting) => (!company || posting.companyId === company) && (!category || companyOf(posting.companyId).category === category)),
            sort, resume) : loaded),
    [loaded, company, category, sort, resume],
  )
  // 공고가 많아도 버벅이지 않게 조금씩 그려요. 검색어나 필터가 바뀌면 처음부터예요.
  const items = Array.isArray(list) ? list : []
  const { count: shownCount, more: showMore } = useShowMore(items.length, `${items.length}:${items[0]?.id ?? ''}:${items.at(-1)?.id ?? ''}`)
  const waiting = useLoadHold(list === undefined)

  return (
    <SplitView side={browser.side}>
      <ScrollPage header={<PageHeader title={L.title} />} className="@container">
        {/* 검색창 옆에 직군, 경력, 정렬을 드롭다운으로 나란히 둬요. 좁으면 검색창이 한 줄을 다 쓰고 메뉴는 아래로 내려가요. */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-11 min-w-0 flex-1 basis-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 transition-colors focus-within:border-brand @2xl:basis-0">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // 비어 있을 때 Enter를 누르면 지금 보이는 추천 검색어로 찾아요.
                if (event.key === 'Enter' && !query && !event.nativeEvent.isComposing) {
                  track('jobs_suggestion_use', { query: SEARCH_SUGGESTIONS[suggestion] })
                  setQuery(SEARCH_SUGGESTIONS[suggestion])
                }
              }}
              aria-label={L.label}
              data-search-input
              className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none sm:text-[14px] [&::-webkit-search-cancel-button]:hidden"
            />
            {/* 추천 검색어는 자리표시 글자처럼 옅게 보여서, 이런 걸 쳐 볼 수 있다는 것만 슬쩍 알려요. */}
            {!query && (
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-[42px] right-4 flex items-center overflow-hidden text-base whitespace-nowrap sm:text-[14px] text-gray-400">
                <span key={suggestion} className="animate-rise">
                  {SEARCH_SUGGESTIONS[suggestion]}
                </span>
              </span>
            )}
          </label>
          <Dropdown
            size="lg"
            active={family !== null}
            label={L.family}
            value={family ? familyName(family) : L.all}
            groups={[
              {
                items: [null, ...FAMILIES].map((value) => ({
                  label: value ? familyName(value) : L.all,
                  checked: family === value,
                  onSelect: () => {
                    track('jobs_family_select', { family: value ?? 'all' })
                    setFamily(value)
                  },
                })),
              },
            ]}
          />
          <Dropdown
            size="lg"
            active={career !== null}
            label={L.career}
            value={career ? careerName(career) : L.all}
            groups={[
              {
                items: [null, ...CAREERS].map((value) => ({
                  label: value ? careerName(value) : L.all,
                  checked: career === value,
                  onSelect: () => {
                    track('jobs_career_select', { career: value ?? 'all' })
                    setCareer(value)
                  },
                })),
              },
            ]}
          />
          <Dropdown
            size="lg"
            label={L.sort}
            value={L.sorts[sort]}
            groups={[
              {
                items: SORTS.filter((value) => value !== 'fit' || resume).map((value) => ({
                  label: L.sorts[value],
                  checked: sort === value,
                  onSelect: () => {
                    track('jobs_sort_change', { sort: value })
                    setSort(value)
                  },
                })),
              },
            ]}
          />
        </div>

        {/* 네카라쿠배당토는 로고로 바로 고르고, 나머지는 사업 분류로 골라요. 둘을 같이 고르면 비기 쉬워서 하나를 고르면 다른 하나는 풀려요. */}
        <div className="mt-4">
          <CompanyFilter
            oneLine
            companies={majorCompanies()}
            value={company}
            label={L.majors}
            onChange={(next) => {
              track('jobs_company_select', { company: next ?? 'all' })
              setCompany(next)
              setCategory(null)
            }}
          />
        </div>
        <div className="mt-2">
          <CategoryFilter
            postings={Array.isArray(loaded) ? loaded : []}
            value={category}
            label={L.category}
            allLabel={L.all}
            company={company && !majorCompanies().some((item) => item.id === company) ? companyOf(company) : null}
            onClearCompany={() => setCompany(null)}
            onChange={(next) => {
              track('jobs_category_select', { category: next ?? 'all' })
              setCategory(next)
              setCompany(null)
            }}
          />
        </div>

        <div className="mt-4 flex h-8 items-center justify-between gap-3">
          <p className="text-[13px] text-gray-500 tabular-nums">{Array.isArray(list) ? L.items(list.length) : ''}</p>
          <LayoutToggle value={layout} onChange={setLayout} />
        </div>

        <div className="mt-4">
          {waiting || list === undefined ? (
            <LoadProgress percent={load.percent} className={loadCenter} />
          ) : list === 'failed' ? (
            <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
          ) : list.length === 0 ? (
            <Notice
              title={L.none}
              body={L.noneBody}
              action={query || family || career || company || category ? L.reset : undefined}
              onAction={() => {
                track('jobs_filter_reset')
                setQuery('')
                setFamily(null)
                setCareer(null)
                setCompany(null)
                setCategory(null)
              }}
              className="mt-16"
            />
          ) : (
            <>
            <ul className={layout === 'gallery' ? jobsGrid : jobsList}>
              {list.slice(0, shownCount).map((posting, order) => (
                <JobItem
                  key={`${layout}:${sort}:${posting.id}`}
                  layout={layout}
                  posting={posting}
                  resume={resume}
                  onView={() => browser.view(posting)}
                  onCompany={() => browser.viewCompany(posting.companyId)}
                  fit={fitOf(posting, resume)}
                  order={order}
                  onOpen={() => confirmPick.ask(posting, () => browser.view(posting), 'view')}
                  onAnalyze={() => analyze(posting)}
                />
              ))}
            </ul>
            {showMore}
            </>
          )}
        </div>
        {confirmPick.dialog}
      </ScrollPage>
    </SplitView>
  )
}
