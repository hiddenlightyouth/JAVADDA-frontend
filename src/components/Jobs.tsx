import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, familyName, fetchPostings, fitOf, sortPostings, useResume, type CareerLevel, type JobFamily, type JobPosting, type PostingSort } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { PageHeader } from './AppPage'
import { MapMenu } from './DeepParts'
import { cardsGrid, Failed, Notice, PostingCard, PostingCardsSkeleton } from './GapParts'

/**
 * 공고 탐색 화면이에요. 공고를 화면 가득 펼쳐 놓고 직군과 경력으로 걸러 보다가, 눌러서 진단을 시작해요.
 * 이력서를 올려 두었으면 카드마다 적합도가 보여요.
 */

const FAMILIES: JobFamily[] = ['backend', 'frontend', 'mobile', 'data', 'devops']
const CAREERS: CareerLevel[] = ['entry', 'junior', 'any']
const SORTS: PostingSort[] = ['fit', 'recent', 'deadline']

const TEXT = messages({
  ko: {
    title: '공고 탐색',
    placeholder: '기업, 공고, 기술 이름으로 찾기',
    label: '공고 찾기',
    all: '전체',
    family: '직군',
    career: '경력',
    sort: '정렬',
    sorts: { fit: '적합도순', recent: '최신순', deadline: '마감 임박순' } as Record<PostingSort, string>,
    items: (count: number) => `${count}개의 공고`,
    none: '맞는 공고가 없어요.',
    noneBody: '검색어나 걸러 둔 조건을 바꿔 보세요.',
    sources: '워크넷과 기업 채용 페이지에서 하루 한 번 모아요.',
  },
  en: {
    title: 'Explore jobs',
    placeholder: 'Search companies, postings, or skills',
    label: 'Search postings',
    all: 'All',
    family: 'Role',
    career: 'Level',
    sort: 'Sort',
    sorts: { fit: 'Best fit', recent: 'Newest', deadline: 'Closing soon' },
    items: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    none: 'No postings match.',
    noneBody: 'Try a different search or filter.',
    sources: 'Collected once a day from Worknet and company career pages.',
  },
})

/** 직군 버튼의 모양이에요. 탐색의 동아리 버튼과 같은 크기예요. */
const chipButton = 'flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium transition-colors'
const chipTone = (active: boolean) => (active ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:text-gray-950')

type Loaded = JobPosting[] | 'failed'

export function Jobs({ onPick }: { onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<JobFamily | null>(null)
  const [career, setCareer] = useState<CareerLevel | null>(null)
  const [sort, setSort] = useState<PostingSort>(resume ? 'fit' : 'recent')
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)

  // 검색어는 잠깐 멈췄을 때 보내요.
  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    const timer = window.setTimeout(() => {
      void fetchPostings({ query, family, career }).then(
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
  }, [query, family, career, attempt])

  const list = Array.isArray(loaded) ? sortPostings(loaded, sort, resume) : loaded

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-6 pt-14 md:px-10">
        <PageHeader
          title={L.title}
          actions={
            <label className="flex h-9 w-64 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 focus-within:border-brand">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-gray-400" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={L.placeholder}
                aria-label={L.label}
                data-search-input
                className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-900 outline-none placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
          }
        />
        <div className="border-b border-gray-200" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 pt-4 pb-16 md:px-10">
        {/* 직군은 메뉴에 넣지 않고 한눈에 보이게 늘어놓아요. */}
        <div role="radiogroup" aria-label={L.family} className="flex flex-wrap gap-2">
          {[null, ...FAMILIES].map((value) => (
            <button
              key={value ?? 'all'}
              type="button"
              role="radio"
              aria-checked={family === value}
              onClick={() => {
                track('jobs_family_select', { family: value ?? 'all' })
                setFamily(value)
              }}
              className={`${chipButton} ${chipTone(family === value)}`}
            >
              {value ? familyName(value) : L.all}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MapMenu
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
          <MapMenu
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
          {Array.isArray(list) && <p className="ml-auto text-[13px] text-gray-500 tabular-nums">{L.items(list.length)}</p>}
        </div>

        <div className="mt-4">
          {list === undefined ? (
            <PostingCardsSkeleton />
          ) : list === 'failed' ? (
            <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
          ) : list.length === 0 ? (
            <Notice title={L.none} body={L.noneBody} className="mt-16" />
          ) : (
            <ul className={cardsGrid}>
              {list.map((posting, order) => (
                <PostingCard
                  key={`${sort}:${posting.id}`}
                  posting={posting}
                  fit={fitOf(posting, resume)}
                  order={order}
                  onOpen={() => {
                    track('posting_select', { posting: posting.id, from: 'explore' })
                    onPick(posting.id)
                  }}
                />
              ))}
            </ul>
          )}
        </div>
        <p className="mt-10 text-center text-[12px] text-gray-400">{L.sources}</p>
      </div>
    </main>
  )
}
