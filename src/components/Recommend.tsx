import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchPostings, fitOf, sortPostings, useResume, type JobPosting, type PostingSort } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { PageHeader } from './AppPage'
import { MapMenu } from './DeepParts'
import { cardsGrid, Failed, Notice, PostingCard, PostingCardsSkeleton, SkillChip } from './GapParts'

/**
 * 추천 공고 화면이에요. 올려 둔 이력서의 역량과 가까운 공고를 적합도 순서로 보여줘요.
 * 이력서가 없으면 먼저 올리라고 안내해요.
 */

const SORTS: PostingSort[] = ['fit', 'recent', 'deadline']

const TEXT = messages({
  ko: {
    title: '추천 공고',
    basis: (name: string, when: string) => `${when}에 올린 ${name} 기준이에요.`,
    basisHint: '이력서를 고치면 추천도 바뀌어요.',
    change: '이력서 바꾸기',
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
    skills: '추천에 쓴 역량',
  },
  en: {
    title: 'Recommended',
    basis: (name: string, when: string) => `Based on ${name}, uploaded ${when}.`,
    basisHint: 'Edit your resume and the recommendations follow.',
    change: 'Change resume',
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
    skills: 'Skills used for matching',
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

  useEffect(() => {
    if (!resume) return
    let stale = false
    setLoaded(undefined)
    void fetchPostings().then(
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
  }, [resume, attempt])

  if (!resume) {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-6 pt-14 md:px-10 md:pt-9">
          <PageHeader title={L.title} />
                  </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          <Notice title={L.noResume} body={L.noResumeBody} action={L.upload} onAction={onResume} />
        </div>
      </main>
    )
  }

  const list = Array.isArray(loaded) ? sortPostings(loaded, sort, resume).filter((posting) => (fitOf(posting, resume) ?? 0) >= threshold) : loaded
  const top = [...resume.skills].sort((a, b) => b.level - a.level).slice(0, 8)

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-6 pt-14 md:px-10 md:pt-9">
        <PageHeader title={L.title} />
              </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10">
        {/* 어떤 이력서를 기준으로 추천하는지 먼저 알려줘요. */}
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-gray-50 p-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-gray-900">{L.basis(resume.name, formatDateTime(resume.uploadedAt))}</p>
            <p className="mt-0.5 text-[12.5px] text-gray-500">{L.basisHint}</p>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label={L.skills}>
              {top.map((skill) => (
                <SkillChip key={skill.name} name={skill.name} hint={`Lv.${skill.level}`} />
              ))}
            </div>
          </div>
          <button type="button" onClick={onResume} className="h-9 shrink-0 rounded-lg border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-gray-800 transition-colors hover:border-gray-300 hover:text-gray-950">
            {L.change}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MapMenu
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
          <MapMenu
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
                  key={`${sort}:${threshold}:${posting.id}`}
                  posting={posting}
                  fit={fitOf(posting, resume)}
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
      </div>
    </main>
  )
}
