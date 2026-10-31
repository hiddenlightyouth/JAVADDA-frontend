import { useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, companyOf, type CompanyCategory, majorCompanies, familyName, sortPostings, useResume, type CareerLevel, type JobFamily, type JobPosting, type PostingSort } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { CategoryFilter, CompanyFilter, Notice } from './GapParts'
import { SearchIcon } from './Icons'
import { PostingCountBar, PostingList, readLayout, useJobBrowser, type Layout } from './JobCard'
import { SplitView } from './PostingBrowser'
import { LoadGate, SuggestionHint, usePostings, useSuggestion } from './ScreenParts'

/**
 * 공고 탐색 화면이에요. 공고를 화면 가득 펼쳐 놓고 직군과 경력으로 걸러 보다가, 눌러서 원문을 보거나 분석하기로 진단을 시작해요.
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
    none: '맞는 공고가 없어요.',
    noneBody: '검색어나 걸러 둔 조건을 바꿔 보세요.',
    reset: '조건 초기화',
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
    none: 'No postings match.',
    noneBody: 'Try a different search or filter.',
    reset: 'Clear filters',
    category: 'Company type',
    majors: 'Major companies',
  },
})

/** company를 주면 그 기업 공고만 골라 둔 채로 열어요. 기업 상세의 공고 탐색에서 보기와 기술 블로그의 공고 보기에서 와요. */
export function Jobs({ onPick, initialCompany = null }: { onPick: (postingId: string) => void; initialCompany?: string | null }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<JobFamily | null>(null)
  const [career, setCareer] = useState<CareerLevel | null>(null)
  const [sort, setSort] = useState<PostingSort>(resume ? 'fit' : 'recent')
  const [company, setCompany] = useState<string | null>(initialCompany)
  const [category, setCategory] = useState<CompanyCategory | null>(null)
  const browser = useJobBrowser()
  const [layout, setLayout] = useState<Layout>(readLayout)
  // 검색어는 잠깐 멈췄을 때 보내요.
  const { loaded, postings, waiting, percent, retry } = usePostings({ query, family, career })
  // 검색창이 비어 있는 동안 추천 검색어가 하나씩 아래에서 올라오며 바뀌어요.
  const suggestion = useSuggestion(!query)
  const majors = useMemo(majorCompanies, [])

  function analyze(posting: JobPosting) {
    track('posting_select', { posting: posting.id, from: 'explore' })
    onPick(posting.id)
  }

  // 기업은 받아 온 공고에서 바로 걸러요. 기업마다 공고가 몇 개뿐이라 서버에 다시 묻지 않아요. 거른 뒤에 정렬해서 정렬할 공고를 줄여요.
  const list = useMemo(
    () =>
      postings &&
      sortPostings(
        postings.filter((posting) => (!company || posting.companyId === company) && (!category || companyOf(posting.companyId).category === category)),
        sort,
        resume,
      ),
    [postings, company, category, sort, resume],
  )

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
                  track('jobs_suggestion_use', { query: suggestion.text })
                  setQuery(suggestion.text)
                }
              }}
              aria-label={L.label}
              data-search-input
              className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none sm:text-[14px] [&::-webkit-search-cancel-button]:hidden"
            />
            {!query && <SuggestionHint {...suggestion} className="right-4 left-[42px]" />}
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
            companies={majors}
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
            postings={postings ?? []}
            value={category}
            label={L.category}
            allLabel={L.all}
            company={company && !majors.some((item) => item.id === company) ? companyOf(company) : null}
            onClearCompany={() => setCompany(null)}
            onChange={(next) => {
              track('jobs_category_select', { category: next ?? 'all' })
              setCategory(next)
              setCompany(null)
            }}
          />
        </div>

        <PostingCountBar count={list ? list.length : null} layout={layout} onLayout={setLayout} />

        <div className="mt-4">
          <LoadGate waiting={waiting} failed={loaded === 'failed'} percent={percent} onRetry={retry}>
            {() =>
              list && list.length > 0 ? (
                <PostingList postings={list} layout={layout} resume={resume} browser={browser} onAnalyze={analyze} animateKey={sort} />
              ) : (
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
              )
            }
          </LoadGate>
        </div>
      </ScrollPage>
    </SplitView>
  )
}
