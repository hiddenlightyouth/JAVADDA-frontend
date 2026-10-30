import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchPostings, fitOf, sortPostings, useResume, type JobPosting, type PostingSort } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { cardsGrid, Failed, Notice, PostingTile } from './GapParts'
import { loadCenter, LoadProgress } from './ui'

/**
 * 추천 공고 화면이에요. 올려 둔 이력서의 역량과 가까운 공고를 적합도 순서로 보여줘요.
 * 추천은 늘 대표 이력서(별을 누른 서류)로 해요. 대표를 바꾸는 것은 내 이력서 화면이 맡아요.
 * 이력서가 없으면 먼저 올리라고 안내해요.
 */

const SORTS: PostingSort[] = ['fit', 'recent', 'deadline']

const TEXT = messages({
  ko: {
    title: '추천 공고',
    sort: '정렬',
    sorts: { fit: '유사도순', recent: '최신순', deadline: '마감 임박순' } as Record<PostingSort, string>,
    threshold: '적합도',
    thresholds: { 0: '전체', 50: '50% 이상', 70: '70% 이상' } as Record<number, string>,
    items: (count: number) => `${count}개의 공고`,
    noResume: '이력서를 올리면 공고를 추천해요',
    noResumeBody: '이력서나 포트폴리오를 올리면 역량을 읽어서, 지금 역량과 가까운 공고를 유사도 순서로 보여줘요.',
    upload: '이력서 올리기',
    none: '이 조건에 맞는 공고가 없어요.',
    noneBody: '적합도 조건을 낮춰 보세요.',
  },
  en: {
    title: 'Recommended',
    sort: 'Sort',
    sorts: { fit: 'Most similar', recent: 'Newest', deadline: 'Closing soon' },
    threshold: 'Fit',
    thresholds: { 0: 'All', 50: '50% and up', 70: '70% and up' },
    items: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    noResume: 'Upload a resume to get recommendations',
    noResumeBody: 'Once we read the skills in your resume or portfolio, we rank postings by how close they are to what you have now.',
    upload: 'Upload a resume',
    none: 'No postings match this filter.',
    noneBody: 'Try lowering the fit threshold.',
  },
})

const THRESHOLDS = [0, 50, 70]

type Loaded = JobPosting[] | 'failed'

export function Recommend({ onPick, onResume }: { onPick: (postingId: string) => void; onResume: () => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [sort, setSort] = useState<PostingSort>('fit')
  const [threshold, setThreshold] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const load = useLoadProgress()

  // 공고 목록은 서류와 상관없어서, 서류를 바꿔도 다시 받지 않아요.
  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    void fetchPostings({}, load.one()).then(
      (list) => {
        if (!stale) setLoaded(list)
      },
      () => {
        if (!stale) setLoaded('failed')
      },
    )
    return () => {
      stale = true
    }
  }, [attempt, load.one])

  const list = useMemo(
    () => (Array.isArray(loaded) && resume ? sortPostings(loaded, sort, resume).filter((posting) => (fitOf(posting, resume) ?? 0) >= threshold) : loaded),
    [loaded, sort, resume, threshold],
  )
  const waiting = useLoadHold(list === undefined)

  if (!resume) {
    return (
      <ScrollPage header={<PageHeader title={L.title} />} className="flex flex-col items-center justify-center">
        <Notice title={L.noResume} body={L.noResumeBody} action={L.upload} onAction={onResume} />
      </ScrollPage>
    )
  }

  return (
    <ScrollPage header={<PageHeader title={L.title} />}>
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          label={L.sort}
          value={L.sorts[sort]}
          groups={[
            {
              items: SORTS.map((value) => ({
                label: L.sorts[value],
                checked: sort === value,
                onSelect: () => {
                  track('recommend_sort_change', { sort: value })
                  setSort(value)
                },
              })),
            },
          ]}
        />
        <Dropdown
          label={L.threshold}
          value={L.thresholds[threshold]}
          groups={[
            {
              items: THRESHOLDS.map((value) => ({
                label: L.thresholds[value],
                checked: threshold === value,
                onSelect: () => {
                  track('recommend_threshold_change', { threshold: value })
                  setThreshold(value)
                },
              })),
            },
          ]}
        />
        {Array.isArray(list) && <p className="ml-auto text-[13px] text-gray-500 tabular-nums">{L.items(list.length)}</p>}
      </div>

      <div className="mt-4">
        {waiting || list === undefined ? (
          <LoadProgress percent={load.percent} className={loadCenter} />
        ) : list === 'failed' ? (
          <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
        ) : list.length === 0 ? (
          <Notice title={L.none} body={L.noneBody} className="mt-16" />
        ) : (
          <ul className={cardsGrid}>
            {list.map((posting, order) => (
              <PostingTile
                key={`${sort}:${threshold}:${posting.id}`}
                posting={posting}
                resume={resume}
                tag="fit"
                order={order}
                onOpen={() => {
                  track('posting_select', { posting: posting.id, from: 'recommend' })
                  onPick(posting.id)
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </ScrollPage>
  )
}
