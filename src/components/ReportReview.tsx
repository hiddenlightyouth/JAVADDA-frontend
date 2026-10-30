import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { docName, fetchReview, useResume, type DocType, type DocumentReview, type ParagraphTag, type ReviewParagraph } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { Failed, Panel, ScoreHero } from './GapParts'
import { RefreshIcon } from './Icons'
import { Bone } from './Skeleton'
import { Busy, NumberBadge, NumberedList, Segmented, toolButton } from './ui'

const DOCS: DocType[] = ['coverLetter', 'resume', 'portfolio']

const TEXT = messages({
  ko: {
    docs: '서류 종류',
    rerun: '재검증',
    reading: '서류를 읽고 있어요.',
    fitLabel: '부합도',
    verdict: (score: number): string => (score >= 70 ? '서류가 공고와 잘 이어져요!' : score >= 50 ? '좋아요! 몇 문단만 다듬으면 돼요.' : '공고에 맞춰 다시 써 볼까요?'),
    paragraphs: '원문과 코멘트',
    filter: '코멘트 거르기',
    all: '전체',
    appeal: '더 어필할 점',
    reviewedAt: (when: string) => `검증 ${when}`,
    tags: { good: '좋아요', fix: '고쳐요', missing: '빠졌어요', interview: '면접 예상' } as Record<ParagraphTag, string>,
  },
  en: {
    docs: 'Document type',
    rerun: 'Review again',
    reading: 'Reading your document.',
    fitLabel: 'Match',
    verdict: (score: number): string => (score >= 70 ? 'Your document lines up well!' : score >= 50 ? 'Nice! Just polish a few paragraphs.' : 'Try rewriting it for this posting?'),
    paragraphs: 'Document and comments',
    filter: 'Filter comments',
    all: 'All',
    appeal: 'Worth adding',
    reviewedAt: (when: string) => `Reviewed ${when}`,
    tags: { good: 'Good', fix: 'Revise', missing: 'Missing', interview: 'Likely asked' },
  },
})

const TAG_TONES: Record<ParagraphTag, string> = {
  good: 'bg-brand-soft text-brand-hover',
  fix: 'bg-gray-200/70 text-gray-700',
  missing: 'bg-gray-200/70 text-gray-500',
  interview: 'border border-brand text-brand',
}

const chip = 'flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors'

function ReviewSkeleton() {
  const L = useMessages(TEXT)
  return (
    <Busy label={L.reading} className="space-y-10">
      <div className="flex items-end justify-between gap-12">
        <div className="flex-1">
          <Bone className="h-5 w-3/5" />
          <Bone className="mt-3 h-3.5 w-4/5" />
        </div>
        <Bone className="hidden h-14 w-72 sm:block" />
      </div>
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 rounded-xl border border-gray-200 p-10">
          {[0, 1, 2].map((item) => (
            <div key={item}>
              <Bone className="h-3.5 w-full" />
              <Bone className="mt-2.5 h-3.5 w-11/12" />
              <Bone className="mt-2.5 h-3.5 w-2/3" />
            </div>
          ))}
        </div>
        <div className="hidden space-y-3 md:block">
          {[0, 1, 2].map((item) => (
            <Bone key={item} className="h-24 w-full rounded-xl!" />
          ))}
        </div>
      </div>
    </Busy>
  )
}

/** 문단 왼쪽의 세로 막대 색이에요. 좋은 문단은 메인 컬러, 고칠 문단은 짙은 회색, 빠진 내용은 점선이에요. */
const BARS: Record<ParagraphTag, string> = {
  good: 'border-brand',
  interview: 'border-brand',
  fix: 'border-gray-500',
  missing: 'border-dashed border-gray-400',
}
/** 문단에 마우스를 올렸을 때 깔리는 형광펜이에요. */
const TINTS: Record<ParagraphTag, string> = {
  good: 'bg-brand-soft',
  interview: 'bg-brand-soft',
  fix: 'bg-gray-100',
  missing: 'bg-gray-100',
}

function Tags({ tags }: { tags: ParagraphTag[] }) {
  const L = useMessages(TEXT)
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className={`inline-flex h-6 items-center rounded-md px-2 text-[11.5px] font-medium ${TAG_TONES[tag]}`}>
          {L.tags[tag]}
        </span>
      ))}
    </div>
  )
}

function Badge({ value, on }: { value: number; on: boolean }) {
  return <NumberBadge n={value} tone={on ? 'brand' : 'muted'} className="transition-colors" />
}

function Comment({ paragraph, index, on }: { paragraph: ReviewParagraph; index: number; on: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Badge value={index + 1} on={on} />
        <Tags tags={paragraph.tags} />
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-gray-700">{paragraph.feedback}</p>
    </>
  )
}

/** 코멘트끼리 띄우는 간격이에요. */
const NOTE_GAP = 12

interface Layout {
  /** 코멘트마다 위에서 떨어진 거리 */
  tops: number[]
  /** 문단마다 위에서 떨어진 거리 */
  anchors: number[]
  /** 선이 시작하는 문단 오른쪽 끝, 종이 밖으로 꺾이는 곳, 코멘트가 시작하는 곳 */
  startX: number
  bendX: number
  endX: number
  height: number
}

/**
 * 서류 원문을 한 장의 종이로 띄우고, 문단마다 오른쪽 여백에 코멘트를 달아요. 문단과 코멘트는 곡선으로 이어져요.
 * 코멘트는 문단 높이에 맞춰 붙고, 앞 코멘트와 겹치면 그 아래로 밀려나요. 위치는 그린 뒤에 재서 정해요.
 * 좁은 화면에서는 코멘트가 문단 바로 아래, 종이 안으로 들어가요.
 */
function DocumentView({ title, owner, paragraphs, filter }: { title: string; owner?: string; paragraphs: ReviewParagraph[]; filter: ParagraphTag | 'all' }) {
  const [active, setActive] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const marks = useRef(new Map<string, HTMLElement>())
  const notes = useRef(new Map<string, HTMLElement>())
  const [layout, setLayout] = useState<Layout | null>(null)

  useLayoutEffect(() => {
    const root = box.current
    if (!root || !sheet.current || !rail.current) return
    const measure = () => {
      if (!sheet.current || !rail.current) return
      const base = root.getBoundingClientRect()
      const railBox = rail.current.getBoundingClientRect()
      // 넓은 화면에서만 코멘트 칸이 보여요. 숨겨져 있으면 잴 것이 없어요.
      if (railBox.width === 0) return setLayout(null)
      const tops: number[] = []
      const anchors: number[] = []
      let bottom = 0
      let startX = 0
      for (const paragraph of paragraphs) {
        const mark = marks.current.get(paragraph.id)?.getBoundingClientRect()
        const note = notes.current.get(paragraph.id)
        if (!mark || !note) return
        const anchor = mark.top - base.top
        const top = Math.max(anchor, bottom)
        anchors.push(anchor)
        tops.push(top)
        bottom = top + note.offsetHeight + NOTE_GAP
        startX = mark.right - base.left
      }
      const sheetBox = sheet.current.getBoundingClientRect()
      setLayout({ tops, anchors, startX, bendX: sheetBox.right - base.left + 10, endX: railBox.left - base.left, height: Math.max(bottom, sheetBox.height) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    notes.current.forEach((note) => observer.observe(note))
    return () => observer.disconnect()
  }, [paragraphs])

  const dim = (paragraph: ReviewParagraph) => filter !== 'all' && !paragraph.tags.includes(filter)

  function focus(paragraph: ReviewParagraph) {
    setActive(paragraph.id)
    marks.current.get(paragraph.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  return (
    <div ref={box} className="relative md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-x-12" style={layout ? { minHeight: layout.height } : undefined}>
      <article ref={sheet} className="rounded-xl border border-gray-200 bg-white px-6 py-8 md:px-12 md:py-11">
        <header className="mb-6 border-b border-gray-100 pb-5">
          <p className="text-[19px] font-semibold text-gray-900">{title}</p>
          {owner && <p className="mt-1 truncate text-[12.5px] text-gray-400">{owner}</p>}
        </header>
        <ol className="space-y-7">
          {paragraphs.map((paragraph, index) => {
            const on = active === paragraph.id
            return (
              <li
                key={paragraph.id}
                onMouseEnter={() => setActive(paragraph.id)}
                onMouseLeave={() => setActive(null)}
                className={`transition-opacity ${dim(paragraph) ? 'opacity-30' : ''}`}
              >
                <div
                  ref={(element) => {
                    if (element) marks.current.set(paragraph.id, element)
                    else marks.current.delete(paragraph.id)
                  }}
                  className={`-mx-3 flex gap-3 rounded-r-lg border-l-2 py-2 pr-3 pl-3 transition-colors ${BARS[paragraph.tags[0]]} ${on ? TINTS[paragraph.tags[0]] : ''}`}
                >
                  <span className="mt-[5px]">
                    <Badge value={index + 1} on={on} />
                  </span>
                  <p className="min-w-0 flex-1 text-[15px] leading-[1.9] text-gray-800">{paragraph.text}</p>
                </div>
                <div className="mt-2 rounded-xl bg-gray-50 p-4 md:hidden">
                  <Comment paragraph={paragraph} index={index} on={on} />
                </div>
              </li>
            )
          })}
        </ol>
      </article>

      {/* 넓은 화면의 코멘트 칸이에요. 위치를 재기 전에는 보이지 않게 둬요. */}
      <div ref={rail} className="relative hidden self-stretch md:block">
        {paragraphs.map((paragraph, index) => {
          const on = active === paragraph.id
          return (
            <button
              key={paragraph.id}
              type="button"
              ref={(element) => {
                if (element) notes.current.set(paragraph.id, element)
                else notes.current.delete(paragraph.id)
              }}
              onMouseEnter={() => setActive(paragraph.id)}
              onMouseLeave={() => setActive(null)}
              onClick={() => focus(paragraph)}
              className={`absolute inset-x-0 rounded-xl p-4 text-left transition-[background-color,opacity,top] duration-200 ${on ? 'bg-gray-100' : 'bg-gray-50'} ${dim(paragraph) ? 'opacity-30' : ''} ${layout ? '' : 'invisible'}`}
              style={{ top: layout?.tops[index] ?? 0 }}
            >
              <Comment paragraph={paragraph} index={index} on={on} />
            </button>
          )
        })}
      </div>

      {layout && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 hidden size-full overflow-visible md:block">
          {paragraphs.map((paragraph, index) => {
            const on = active === paragraph.id
            const y1 = layout.anchors[index] + 22
            const y2 = layout.tops[index] + 26
            const middle = (layout.bendX + layout.endX) / 2
            return (
              <g key={paragraph.id} className={`transition-opacity ${dim(paragraph) ? 'opacity-30' : ''}`}>
                <path
                  d={`M ${layout.startX} ${y1} L ${layout.bendX} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${layout.endX} ${y2}`}
                  fill="none"
                  strokeWidth={on ? 1.5 : 1}
                  className={`transition-colors ${on ? 'stroke-brand' : 'stroke-gray-300'}`}
                />
                <circle cx={layout.endX} cy={y2} r={3} className={`transition-colors ${on ? 'fill-brand' : 'fill-gray-300'}`} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/**
 * 서류 검증 탭이에요. 자기소개서, 이력서, 포트폴리오를 공고에 맞춰 문단마다 읽고, 좋아요, 고쳐요, 빠졌어요, 면접 예상 태그와 피드백을 붙여요.
 * 면접 예상 태그가 붙은 문단은 예상 질문 탭의 질문으로 이어져요.
 */
export function ReviewTab({ reportId }: { reportId: string }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [doc, setDoc] = useState<DocType>('coverLetter')
  /** 서류 종류마다 받아 둔 결과. null은 실패, undefined는 아직 받지 않은 것이에요. */
  const [reviews, setReviews] = useState<Partial<Record<DocType, DocumentReview | null>>>({})
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<ParagraphTag | 'all'>('all')
  const review = reviews[doc]
  const counts = (Object.keys(L.tags) as ParagraphTag[])
    .map((tag) => ({ tag, count: review?.paragraphs.filter((paragraph) => paragraph.tags.includes(tag)).length ?? 0 }))
    .filter((item) => item.count > 0)

  async function load(target: DocType) {
    setLoading(true)
    const result = await fetchReview(reportId, target)
    setReviews((prev) => ({ ...prev, [target]: result }))
    setLoading(false)
  }

  useEffect(() => {
    track('review_view', { doc })
    setFilter('all')
    if (reviews[doc] === undefined) void load(doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, reportId])

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented size="md" label={L.docs} options={DOCS.map((item) => [item, docName(item)] as const)} value={doc} onChange={setDoc} />
        <div className="ml-auto flex items-center gap-3">
          {review && <span className="text-[12.5px] text-gray-400 tabular-nums">{L.reviewedAt(formatDateTime(review.reviewedAt))}</span>}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              track('review_rerun', { doc })
              void load(doc)
            }}
            className={`${toolButton} disabled:text-gray-400`}
          >
            <RefreshIcon />
            {L.rerun}
          </button>
        </div>
      </div>

      {loading || review === undefined ? (
        <ReviewSkeleton />
      ) : review === null ? (
        <Failed onRetry={() => void load(doc)} className="mt-16" />
      ) : (
        <>
          <ScoreHero score={review.fitScore} label={L.fitLabel} title={L.verdict(review.fitScore)} body={review.summary} />

          <section className="animate-rise [animation-delay:60ms]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <h2 className="text-[15px] font-semibold text-gray-900">{L.paragraphs}</h2>
              <div role="radiogroup" aria-label={L.filter} className="flex flex-wrap gap-1.5">
                {[{ tag: 'all' as const, count: review.paragraphs.length }, ...counts].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    role="radio"
                    aria-checked={filter === item.tag}
                    onClick={() => setFilter(item.tag)}
                    className={`${chip} ${filter === item.tag ? 'bg-brand-soft text-brand-hover' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    {item.tag === 'all' ? L.all : L.tags[item.tag]}
                    <span className="tabular-nums opacity-60">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <DocumentView title={docName(doc)} owner={resume?.name} paragraphs={review.paragraphs} filter={filter} />
          </section>

          <Panel title={L.appeal} className="animate-rise [animation-delay:120ms]">
            <NumberedList items={review.appealMore} onGray />
          </Panel>
        </>
      )}
    </div>
  )
}
