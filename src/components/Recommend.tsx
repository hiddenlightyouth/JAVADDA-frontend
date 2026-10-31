import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchPostings, fitOf, RECOMMEND_MIN_FIT, sortPostings, useResume, type JobPosting, type PostingSort } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { cardsGrid, Failed, Notice, PostingTile } from './GapParts'
import { loadCenter, LoadProgress } from './ui'

/**
 * 추천 공고 화면이에요. 올려 둔 이력서의 역량과 가까운 공고를 적합도 순서로 보여줘요.
 * 추천은 늘 대표 이력서(별을 누른 서류)로 해요. 대표를 바꾸는 것은 내 이력서 화면이 맡아요.
 * 추천 기준(적합도 필터)에 조금 못 미치는 공고(30%부터)는 아래 "조금 더 채우면 맞는 공고"에 따로 보여줘서, 추천이 비어도 무엇을 채우면 될지 보여요.
 * 이력서가 없으면 먼저 올리라고 안내해요.
 */

const SORTS: PostingSort[] = ['fit', 'recent', 'deadline']

const TEXT = messages({
  ko: {
    title: '추천 공고',
    sort: '정렬',
    sorts: { fit: '유사도순', recent: '최신순', deadline: '마감 임박순' } as Record<PostingSort, string>,
    threshold: '적합도',
    thresholds: { 50: '50% 이상', 70: '70% 이상' } as Record<number, string>,
    items: (count: number) => `${count}개의 공고`,
    noResume: '이력서를 올리면 공고를 추천해요',
    noResumeBody: '이력서나 포트폴리오를 올리면 역량을 읽어서, 지금 역량과 가까운 공고를 유사도 순서로 보여줘요.',
    upload: '이력서 올리기',
    none: '아직 잘 맞는 공고가 없어요.',
    noneBody: '적합도가 50% 이상인 공고만 추천해요. 내 이력서에서 역량을 보완하거나 공고 탐색에서 둘러보세요.',
    nearTitle: '조금 더 채우면 맞는 공고',
    nearBody: '나와 완전히 적합하진 않지만, 조금만 노력하면 적합할 수 있는 공고예요.',
  },
  en: {
    title: 'Recommended',
    sort: 'Sort',
    sorts: { fit: 'Most similar', recent: 'Newest', deadline: 'Closing soon' },
    threshold: 'Fit',
    thresholds: { 50: '50% and up', 70: '70% and up' },
    items: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    noResume: 'Upload a resume to get recommendations',
    noResumeBody: 'Once we read the skills in your resume or portfolio, we rank postings by how close they are to what you have now.',
    upload: 'Upload a resume',
    none: 'No good matches yet.',
    noneBody: 'We only recommend postings with a fit of 50% or more. Strengthen your resume or browse all postings.',
    nearTitle: 'Almost a match',
    nearBody: "Not a perfect fit yet, but a little effort could make these a good match.",
  },
})

/** 추천은 적합도가 중간(50%) 이상인 공고만이에요. 낮음은 추천이라고 할 수 없어서 고를 수도 없게 했어요. */
const THRESHOLDS = [RECOMMEND_MIN_FIT, 70]

/** 조금 더 채우면 맞는 공고의 최소 적합도예요. 이보다 낮으면 갭이 너무 커서 보여주지 않아요. */
const NEAR_MIN_FIT = 30

type Loaded = JobPosting[] | 'failed'

export function Recommend({ onPick, onResume }: { onPick: (postingId: string) => void; onResume: () => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [sort, setSort] = useState<PostingSort>('fit')
  const [threshold, setThreshold] = useState(RECOMMEND_MIN_FIT)
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
  // 추천 기준에 조금 못 미치는 공고예요. 추천이 비거나 적어도 무엇을 채우면 될지 보이게 아래에 따로 둬요. 늘 적합도가 높은 것부터예요.
  const near = useMemo(
    () =>
      Array.isArray(loaded) && resume
        ? sortPostings(loaded, 'fit', resume).filter((posting) => {
            const fit = fitOf(posting, resume) ?? 0
            return fit >= NEAR_MIN_FIT && fit < threshold
          })
        : [],
    [loaded, resume, threshold],
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
          // 아래에 조금 더 채우면 맞는 공고가 있으면 안내를 짧게 두고, 없으면 화면 가운데에 크게 둬요.
          <Notice title={L.none} body={L.noneBody} className={near.length > 0 ? 'mt-6' : 'mt-16'} />
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

      {Array.isArray(list) && near.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[16px] font-semibold text-gray-900">{L.nearTitle}</h2>
          <p className="mt-1 text-[13px] text-gray-500">{L.nearBody}</p>
          <ul className={`mt-4 ${cardsGrid}`}>
            {near.map((posting, order) => (
              <PostingTile
                key={`near:${threshold}:${posting.id}`}
                posting={posting}
                resume={resume}
                tag="fit"
                order={order}
                onOpen={() => {
                  track('posting_select', { posting: posting.id, from: 'recommend-near' })
                  onPick(posting.id)
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </ScrollPage>
  )
}
