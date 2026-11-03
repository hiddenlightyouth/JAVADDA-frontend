import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { companyOf, COMPANY_CATEGORIES, COMPANY_SIZES, type CompanySize, type CompanyCategory, majorCompanies, sortPostings, useResume, type CareerLevel, type JobPosting, type PostingSort } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { readFlag, readJson, writeFlag, writeJson } from '../lib/storage'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { CategoryFilter, CompanyFilter, Notice } from './GapParts'
import { PostingCountBar, PostingList, readLayout, useJobBrowser, type Layout } from './JobCard'
import { SplitView } from './PostingBrowser'
import { CAREERS, FAMILIES, matchesFilters, pickOption, PostingFilterBar, serverFamily, type FamilyFilter } from './PostingFilters'
import { LoadGate, usePostings } from './ScreenParts'
import { Checkbox, primaryButton, quietButton } from './ui'

/**
 * 공고 탐색 화면이에요. 공고를 화면 가득 펼쳐 놓고 직군과 경력으로 걸러 보다가, 눌러서 원문을 보거나 분석하기로 진단을 시작해요.
 * 이력서를 올려 두었으면 카드마다 적합도가 보여요.
 */

const SORTS: PostingSort[] = ['fit', 'recent', 'deadline']
/** 상시 채용 숨기기를 켰는지 이 기기에 기억해요. */
const HIDE_ROLLING_KEY = 'javadda:jobs-hide-rolling'
/** 고른 직군, 경력, 기업 규모, 정렬, 기업 분류를 이 기기에 기억해서 다음에 열 때도 그대로예요. */
const FILTERS_KEY = 'javadda:jobs-filters'
/** 개발 직군만 볼지 묻는 칸을 닫았는지 이 기기에 기억해요. */
const DEV_ASKED_KEY = 'javadda:jobs-dev-asked'

interface SavedFilters {
  family: FamilyFilter
  career: CareerLevel | null
  size: CompanySize | null
  sort: PostingSort | null
  category: CompanyCategory | null
}

/** 저장해 둔 값 중 지금 메뉴에 있는 것만 써요. 메뉴가 바뀌어 없어진 값은 처음 값으로 둬요. */
function readFilters(): SavedFilters {
  const saved = readJson<Partial<Record<keyof SavedFilters, unknown>>>(FILTERS_KEY, {})
  return {
    family: pickOption<FamilyFilter>(saved.family, ['dev', ...FAMILIES]),
    career: pickOption(saved.career, CAREERS),
    size: pickOption(saved.size, COMPANY_SIZES),
    sort: pickOption(saved.sort, SORTS),
    category: pickOption(saved.category, COMPANY_CATEGORIES),
  }
}

const TEXT = messages({
  ko: {
    title: '공고 탐색',
    all: '전체',
    askTitle: '개발자이신가요?',
    askBody: '개발 직군만 따로 모아볼 수 있어요. 필터를 설정할까요?',
    askYes: '개발 직군만 보기',
    askClose: '닫기',
    sort: '정렬',
    sorts: { fit: '적합도순', recent: '최신순', deadline: '마감 임박순' } as Record<PostingSort, string>,
    none: '맞는 공고가 없어요.',
    noneBody: '검색어나 걸러 둔 조건을 바꿔 보세요.',
    reset: '조건 초기화',
    category: '기업 분류',
    majors: '주요 기업',
    hideRolling: '상시 채용 숨기기',
  },
  en: {
    title: 'Explore jobs',
    all: 'All',
    askTitle: 'Are you a developer?',
    askBody: 'You can see only developer roles. Set the filter?',
    askYes: 'Show dev roles only',
    askClose: 'Close',
    sort: 'Sort',
    sorts: { fit: 'Best fit', recent: 'Newest', deadline: 'Closing soon' },
    none: 'No postings match.',
    noneBody: 'Try a different search or filter.',
    reset: 'Clear filters',
    category: 'Company type',
    majors: 'Major companies',
    hideRolling: 'Hide rolling postings',
  },
})

/** company를 주면 그 기업 공고만 골라 둔 채로 열어요. 기업 상세의 공고 탐색에서 보기와 기술 블로그의 공고 보기에서 와요. */
export function Jobs({ onPick, initialCompany = null }: { onPick: (postingId: string) => void; initialCompany?: string | null }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [query, setQuery] = useState('')
  const [saved] = useState(readFilters)
  const [family, setFamily] = useState<FamilyFilter>(saved.family)
  const [asked, setAsked] = useState(() => readFlag(DEV_ASKED_KEY))
  const closeAsk = () => {
    setAsked(true)
    writeFlag(DEV_ASKED_KEY, true)
  }
  const [career, setCareer] = useState<CareerLevel | null>(saved.career)
  // 적합도순은 이력서가 있을 때만 메뉴에 있어요.
  // 정렬은 직접 고른 것만 기억해요. 고르지 않았으면 이력서를 올린 뒤에 적합도순으로 열려요.
  const [chosenSort, setChosenSort] = useState(saved.sort)
  const [sort, setSort] = useState<PostingSort>(chosenSort && (chosenSort !== 'fit' || resume) ? chosenSort : resume ? 'fit' : 'recent')
  const [company, setCompany] = useState<string | null>(initialCompany)
  // 기업을 골라 둔 채로 들어오면 분류는 풀어요. 기업과 분류는 같이 고르지 않아요.
  const [category, setCategory] = useState<CompanyCategory | null>(initialCompany ? null : saved.category)
  const [size, setSize] = useState<CompanySize | null>(saved.size)
  useEffect(() => writeJson(FILTERS_KEY, { family, career, size, sort: chosenSort, category } satisfies SavedFilters), [family, career, size, chosenSort, category])
  const browser = useJobBrowser()
  const [layout, setLayout] = useState<Layout>(readLayout)
  const [hideRolling, setHideRolling] = useState(() => readFlag(HIDE_ROLLING_KEY))
  // 검색어는 잠깐 멈췄을 때 보내요.
  const { loaded, postings, waiting, percent, retry } = usePostings({ query, family: serverFamily(family), career })
  const majors = useMemo(majorCompanies, [])

  function analyze(posting: JobPosting) {
    track('posting_select', { posting: posting.id, from: 'explore' })
    onPick(posting.id)
  }

  // 직군을 고르지 않았으면 모든 공고를, 개발 직군 전체면 기타를 뺀 공고를 보여줘요. 기업과 상시 채용 숨기기는 받아 온 공고에서 바로 걸러요. 기업마다 공고가 몇 개뿐이라 서버에 다시 묻지 않아요. 거른 뒤에 정렬해서 정렬할 공고를 줄여요.
  const list = useMemo(
    () =>
      postings &&
      sortPostings(
        postings.filter(
          (posting) =>
            matchesFilters(posting, { family, size, hideRolling }) &&
            (!company || posting.companyId === company) &&
            (!category || companyOf(posting.companyId).category === category),
        ),
        sort,
        resume,
      ),
    [postings, family, company, category, size, hideRolling, sort, resume],
  )

  return (
    <SplitView side={browser.side}>
      <ScrollPage header={<PageHeader title={L.title} />} className="@container">
        {/* 검색창 옆에 직군, 경력, 기업 규모, 정렬을 드롭다운으로 나란히 둬요. */}
        <PostingFilterBar
          from="jobs"
          query={query}
          onQuery={setQuery}
          family={family}
          onFamily={(value) => {
            setFamily(value)
            if (value) closeAsk()
          }}
          career={career}
          onCareer={setCareer}
          size={size}
          onSize={setSize}
          postings={postings}
        >
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
                    setChosenSort(value)
                  },
                })),
              },
            ]}
          />
        </PostingFilterBar>

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

        <PostingCountBar count={list ? list.length : null} layout={layout} onLayout={setLayout}>
          <Checkbox
            checked={hideRolling}
            onChange={(next) => {
              track('jobs_hide_rolling', { hidden: next })
              setHideRolling(next)
              writeFlag(HIDE_ROLLING_KEY, next)
            }}
          >
            {L.hideRolling}
          </Checkbox>
        </PostingCountBar>

        <div className="mt-4">
          <LoadGate waiting={waiting} failed={loaded === 'failed'} percent={percent} onRetry={retry}>
            {() =>
              list && list.length > 0 ? (
                <PostingList postings={list} layout={layout} resume={resume} browser={browser} onAnalyze={analyze} animateKey={sort} />
              ) : (
                <Notice
                  title={L.none}
                  body={L.noneBody}
                  action={query || family || career || size || company || category || hideRolling ? L.reset : undefined}
                  onAction={() => {
                    track('jobs_filter_reset')
                    setQuery('')
                    setFamily(null)
                    setCareer(null)
                    setSize(null)
                    setCompany(null)
                    setCategory(null)
                    setHideRolling(false)
                    writeFlag(HIDE_ROLLING_KEY, false)
                  }}
                  className="mt-16"
                />
              )
            }
          </LoadGate>
        </div>
      </ScrollPage>
      {/* 모든 공고를 보고 있으면 오른쪽 아래에서 개발 직군만 볼지 한 번 물어요. 고르거나 닫으면 다시 묻지 않아요. 원문 칸이 열려 있으면 가리지 않게 두지 않아요. */}
      {!asked && family === null && !browser.side && (
        <div role="dialog" aria-labelledby="jobs-dev-ask" className="fixed right-4 bottom-4 z-30 sm:right-6 sm:bottom-6 w-[min(320px,calc(100vw-32px))] animate-rise rounded-2xl border border-gray-200 bg-white p-5">
          <p id="jobs-dev-ask" className="text-[15px] font-semibold text-gray-900">{L.askTitle}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{L.askBody}</p>
          <div className="mt-4 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                track('jobs_dev_ask', { accepted: false })
                closeAsk()
              }}
              className={quietButton}
            >
              {L.askClose}
            </button>
            <button
              type="button"
              onClick={() => {
                track('jobs_dev_ask', { accepted: true })
                setFamily('dev')
                closeAsk()
              }}
              className={primaryButton}
            >
              {L.askYes}
            </button>
          </div>
        </div>
      )}
    </SplitView>
  )
}
