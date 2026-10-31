import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { docName, fetchQuestions, fetchReview, PROGRESS_START, recheckParagraph, regenerateReview, useReports, useResume, useResumeShelf, type InterviewQuestion, type DocType, type ProgressState, type DocumentReview, type ParagraphTag, type ReviewParagraph } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { AiProgress, Delta, Failed, Panel, ScoreHero } from './GapParts'
import { RefreshIcon } from './Icons'
import { Badge, loadCenter, NumberBadge, primaryButton, quietButton, Segmented, stagger, textArea, toolButton } from './ui'

const DOCS: DocType[] = ['coverLetter', 'resume', 'portfolio']

const TEXT = messages({
  ko: {
    docs: '서류 종류',
    rerun: '재검증',
    fitLabel: '부합도',
    verdict: (score: number): string => (score >= 70 ? '서류가 공고와 잘 이어져요!' : score >= 50 ? '좋아요! 몇 문단만 다듬으면 돼요.' : '공고에 맞춰 다시 써 볼까요?'),
    paragraphs: '원문과 코멘트',
    filter: '코멘트 거르기',
    all: '전체',
    appeal: '더 어필할 점',
    reviewedAt: (when: string) => `검증 ${when}`,
    tags: { good: '좋아요', fix: '고쳐요', missing: '빠졌어요', interview: '면접 예상' } as Record<ParagraphTag, string>,
    rewrite: '고쳐 쓰기',
    recheck: '다시 보기',
    checking: '다시 보는 중',
    cancel: '취소',
    rewritePlaceholder: '이 문단을 고쳐 써 보세요. 빠진 내용이면 새로 써 넣어요.',
    rechecked: '방금 다시 봤어요',
    questionsFrom: (count: number) => `이 문단에서 나올 질문 ${count}개`,
    change: '직전보다',
    scoreChange: (before: number, after: number) => `부합도 ${before}% → ${after}%`,
    tagHints: {
      good: '공고와 잘 이어지는 문단',
      fix: '조금 다듬으면 좋은 문단',
      missing: '공고가 원하는데 빠진 내용',
      interview: '면접에서 물어볼 만한 문단',
    } as Record<ParagraphTag, string>,
    summary: '문단 요약',
    showAll: '전체 보기',
    count: (count: number) => `${count}개`,
  },
  en: {
    docs: 'Document type',
    rerun: 'Review again',
    fitLabel: 'Match',
    verdict: (score: number): string => (score >= 70 ? 'Your document lines up well!' : score >= 50 ? 'Nice! Just polish a few paragraphs.' : 'Try rewriting it for this posting?'),
    paragraphs: 'Document and comments',
    filter: 'Filter comments',
    all: 'All',
    appeal: 'Worth adding',
    reviewedAt: (when: string) => `Reviewed ${when}`,
    tags: { good: 'Good', fix: 'Revise', missing: 'Missing', interview: 'Likely asked' },
    rewrite: 'Rewrite',
    recheck: 'Check again',
    checking: 'Checking',
    cancel: 'Cancel',
    rewritePlaceholder: 'Rewrite this paragraph. If something is missing, write it in.',
    rechecked: 'Just rechecked',
    questionsFrom: (count: number) => `${count} questions from this paragraph`,
    change: 'Since last check',
    scoreChange: (before: number, after: number) => `Match ${before}% to ${after}%`,
    tagHints: {
      good: 'Lines up with the posting',
      fix: 'Worth polishing',
      missing: 'Wanted but not there',
      interview: 'Likely to come up in interviews',
    },
    summary: 'Paragraph summary',
    showAll: 'Show all',
    count: (count: number) => `${count}`,
  },
})

/** 서류 검증 태그의 색이에요. 좋아요는 메인 컬러, 면접 예상은 메인 컬러 테두리, 고쳐요는 회색, 빠졌어요는 옅은 회색이에요. */
const TAG_TONES = { good: 'brand', fix: 'gray', missing: 'muted', interview: 'outline' } as const satisfies Record<ParagraphTag, string>

/** 문단 요약 칸의 순서예요. 좋은 것, 고칠 것, 빠진 것, 면접에서 나올 것 순서로 읽혀요. */
const SUMMARY_TAGS: ParagraphTag[] = ['good', 'fix', 'missing', 'interview']
/** 문단 요약 칸의 숫자 색이에요. 좋아요와 면접 예상만 메인 컬러이고 나머지는 회색이에요. */
const SUMMARY_TONES: Record<ParagraphTag, string> = { good: 'text-brand', interview: 'text-brand', fix: 'text-gray-900', missing: 'text-gray-900' }

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
        <Badge key={tag} tone={TAG_TONES[tag]} strong>
          {L.tags[tag]}
        </Badge>
      ))}
    </div>
  )
}

/** 문단과 코멘트를 잇는 번호예요. 마우스를 올린 문단은 메인 컬러예요. */
function ParagraphNumber({ value, on }: { value: number; on: boolean }) {
  return <NumberBadge n={value} tone={on ? 'brand' : 'muted'} className="transition-colors" />
}

/** 문단을 고쳐 쓰고 다시 보는 일, 문단에서 나올 예상 질문으로 가는 일이에요. 종이와 코멘트가 같이 써요. */
interface ReviewActions {
  /** 고쳐 쓰는 중인 문단 */
  editing: string | null
  /** 다시 보는 중인 문단 */
  checking: string | null
  /** 이번에 다시 본 문단 */
  rechecked: Set<string>
  edit: (id: string | null) => void
  recheck: (id: string, text: string) => void
  /** 이 문단에서 나온 예상 질문 수예요. */
  questionsOf: (text: string) => number
  onQuestions?: () => void
}
const Actions = createContext<ReviewActions | null>(null)

function Comment({ paragraph, index, on }: { paragraph: ReviewParagraph; index: number; on: boolean }) {
  const L = useMessages(TEXT)
  const actions = useContext(Actions)
  const count = actions?.questionsOf(paragraph.text) ?? 0
  return (
    <>
      <div className="flex items-center gap-2">
        <ParagraphNumber value={index + 1} on={on} />
        <Tags tags={paragraph.tags} />
        {actions?.rechecked.has(paragraph.id) && <span className="ml-auto text-[11.5px] font-medium text-brand">{L.rechecked}</span>}
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-gray-700">{paragraph.feedback}</p>
      {actions && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {actions.editing !== paragraph.id && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                actions.edit(paragraph.id)
              }}
              className="text-[12.5px] font-medium text-brand transition-colors hover:text-brand-hover"
            >
              {L.rewrite}
            </button>
          )}
          {count > 0 && actions.onQuestions && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                track('review_questions_open', { count })
                actions.onQuestions?.()
              }}
              className="text-[12.5px] font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              {L.questionsFrom(count)}
            </button>
          )}
        </div>
      )}
    </>
  )
}

/** 종이 위에서 문단을 고쳐 쓰는 칸이에요. 빠졌어요 문단은 빈 칸에서 새로 써요. 다시 보기를 누르면 그 문단만 다시 검증해요. */
function ParagraphEditor({ paragraph }: { paragraph: ReviewParagraph }) {
  const L = useMessages(TEXT)
  const actions = useContext(Actions)!
  const [text, setText] = useState(paragraph.tags.includes('missing') ? '' : paragraph.text)
  const checking = actions.checking === paragraph.id
  return (
    <div className="min-w-0 flex-1">
      <textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={paragraph.tags.includes('missing') ? `${paragraph.text}. ${L.rewritePlaceholder}` : L.rewritePlaceholder}
        rows={Math.min(10, Math.max(4, Math.ceil(text.length / 60)))}
        disabled={checking}
        className={`${textArea} w-full text-[14.5px] leading-[1.8]`}
      />
      <div className="mt-2 flex items-center justify-end gap-1">
        <button type="button" disabled={checking} onClick={() => actions.edit(null)} className={quietButton}>
          {L.cancel}
        </button>
        <button type="button" disabled={checking || text.trim().length < 10} onClick={() => actions.recheck(paragraph.id, text.trim())} className={primaryButton}>
          {checking ? L.checking : L.recheck}
        </button>
      </div>
    </div>
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
  const editing = useContext(Actions)?.editing ?? null

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
                    <ParagraphNumber value={index + 1} on={on} />
                  </span>
                  {editing === paragraph.id ? <ParagraphEditor paragraph={paragraph} /> : <p className="min-w-0 flex-1 text-[15px] leading-[1.9] text-gray-800">{paragraph.text}</p>}
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
            // 안에 고쳐 쓰기 버튼이 있어서 바깥은 버튼이 아니라 누를 수 있는 칸이에요.
            <div
              key={paragraph.id}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  focus(paragraph)
                }
              }}
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
            </div>
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
export function ReviewTab({ reportId, onQuestions }: { reportId: string; onQuestions?: () => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [doc, setDoc] = useState<DocType>('coverLetter')
  /** 서류 종류마다 받아 둔 결과. null은 실패, undefined는 아직 받지 않은 것이에요. */
  const [reviews, setReviews] = useState<Partial<Record<DocType, DocumentReview | null>>>({})
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<ProgressState>(PROGRESS_START)
  /** 마지막으로 보낸 요청이에요. 서류 종류를 바꿔도 앞의 요청이 진행 막대를 움직이지 않게 해요. */
  const latest = useRef(0)
  const [filter, setFilter] = useState<ParagraphTag | 'all'>('all')
  const review = reviews[doc]
  const countOf = (tag: ParagraphTag) => review?.paragraphs.filter((paragraph) => paragraph.tags.includes(tag)).length ?? 0
  /** 재검증이나 고쳐 쓰기 전의 결과예요. 점수와 태그 수가 얼마나 바뀌었는지 보여줘요. 이번 접속 동안만 기억해요. */
  const [previous, setPrevious] = useState<Partial<Record<DocType, DocumentReview>>>({})
  const before = previous[doc]
  const beforeCount = (tag: ParagraphTag) => before?.paragraphs.filter((paragraph) => paragraph.tags.includes(tag)).length ?? 0
  const [editing, setEditing] = useState<string | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const [rechecked, setRechecked] = useState<Set<string>>(new Set())

  /** 고쳐 쓴 문단 하나만 다시 검증해요. 다 되면 결과를 바꾸고 바뀌기 전 결과를 남겨 변화를 보여줘요. */
  async function recheck(id: string, text: string) {
    if (!review) return
    const target = doc
    setChecking(id)
    track('review_paragraph_recheck', { doc: target })
    const next = await recheckParagraph(reportId, target, id, text)
    setChecking(null)
    if (!next) return
    setPrevious((prev) => ({ ...prev, [target]: review }))
    setReviews((prev) => ({ ...prev, [target]: next }))
    setRechecked((prev) => new Set(prev).add(id))
    setEditing(null)
  }

  // 예상 질문 중 서류 문단에서 나온 질문("서류 2문단")을 그 문단과 맞춰요. 검증 문단은 이력서 문단을 그대로 옮긴 글이라 글로 찾아요.
  const report = useReports().find((item) => item.id === reportId)
  const sourceParagraphs = useResumeShelf().list.find((item) => item.id === report?.resumeId)?.paragraphs ?? resume?.paragraphs ?? []
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  useEffect(() => {
    let stale = false
    void fetchQuestions(reportId, undefined, true).then((list) => {
      if (!stale) setQuestions(list)
    })
    return () => {
      stale = true
    }
  }, [reportId])
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
  function questionsOf(text: string) {
    const target = normalize(text)
    const index = sourceParagraphs.findIndex((paragraph) => {
      const source = normalize(paragraph)
      return source === target || source.startsWith(target.slice(0, 40)) || target.startsWith(source.slice(0, 40))
    })
    if (index < 0 || target.length < 20) return 0
    return questions.filter((question) => question.source.type === 'paragraph' && Number(/(\d+)\s*문단/.exec(question.source.label)?.[1]) === index + 1).length
  }
  const actions: ReviewActions = { editing, checking, rechecked, edit: setEditing, recheck: (id, text) => void recheck(id, text), questionsOf, onQuestions }

  /** 서류 검증을 받아요. fresh(재검증)면 저장된 결과를 지우고 다시 읽어요. */
  async function load(target: DocType, fresh = false) {
    const request = ++latest.current
    setLoading(true)
    setProgress(PROGRESS_START)
    const onProgress = (next: ProgressState) => {
      if (request === latest.current) setProgress(next)
    }
    const current = reviews[target]
    const result = fresh ? await regenerateReview(reportId, target, onProgress) : await fetchReview(reportId, target, onProgress)
    // 재검증이면 바뀌기 전 결과를 남겨 두고, 고쳐 쓰던 칸과 다시 본 표시는 비워요.
    if (fresh && current) setPrevious((prev) => ({ ...prev, [target]: current }))
    if (fresh) {
      setEditing(null)
      setRechecked(new Set())
    }
    setReviews((prev) => ({ ...prev, [target]: result }))
    if (request === latest.current) setLoading(false)
  }

  useEffect(() => {
    track('review_view', { doc })
    setFilter('all')
    if (reviews[doc] === undefined) void load(doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, reportId])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="md" label={L.docs} options={DOCS.map((item) => [item, docName(item)] as const)} value={doc} onChange={setDoc} />
        <div className="ml-auto flex items-center gap-3">
          {review && <span className="text-[13px] text-gray-500 tabular-nums">{L.reviewedAt(formatDateTime(review.reviewedAt))}</span>}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              track('review_rerun', { doc })
              void load(doc, true)
            }}
            className={`${toolButton} disabled:text-gray-400`}
          >
            <RefreshIcon />
            {L.rerun}
          </button>
        </div>
      </div>

      {loading || review === undefined ? (
        // AI가 문단마다 읽는 동안은 진행 정도를 막대로 보여줘요. 이미 읽어 둔 서류면 금방 지나가요.
        <AiProgress progress={progress.progress} stage={progress.stage} className={loadCenter} />
      ) : review === null ? (
        <Failed onRetry={() => void load(doc)} className="mt-16" />
      ) : (
        <>
          <ScoreHero score={review.fitScore} label={L.fitLabel} title={L.verdict(review.fitScore)} body={review.summary} />
          {/* 재검증이나 고쳐 쓰기를 했으면 직전보다 부합도가 얼마나 바뀌었는지 적어요. */}
          {before && (
            <p className="-mt-3 flex items-center gap-2 px-1 text-[13px] text-gray-500 tabular-nums">
              {L.change}
              <span className="font-medium text-gray-800">{L.scoreChange(before.fitScore, review.fitScore)}</span>
              <Delta value={review.fitScore - before.fitScore} />
            </p>
          )}

          {/* 문단 요약이에요. 칸을 누르면 그 태그의 문단만 걸러 보고, 한 번 더 누르면 전체로 돌아가요. */}
          <section aria-label={L.summary} className="grid animate-rise grid-cols-2 gap-2 [animation-delay:40ms] lg:grid-cols-4">
            {SUMMARY_TAGS.map((tag) => {
              const count = countOf(tag)
              const on = filter === tag
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  disabled={count === 0}
                  onClick={() => {
                    track('review_filter', { tag: on ? 'all' : tag })
                    setFilter(on ? 'all' : tag)
                  }}
                  className={`flex flex-col items-start rounded-2xl p-4 text-left transition-colors disabled:cursor-default disabled:opacity-50 ${on ? 'bg-brand-soft' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <span className={`text-[13px] font-medium ${on ? 'text-brand-hover' : 'text-gray-700'}`}>{L.tags[tag]}</span>
                  <span className={`mt-1.5 text-[26px] leading-none font-semibold tabular-nums ${SUMMARY_TONES[tag]}`}>
                    {count}
                    <span className="ml-0.5 text-[13px] font-medium text-gray-400">/ {review.paragraphs.length}</span>
                    {before && count !== beforeCount(tag) && (
                      <span className="ml-1.5 text-[12.5px] font-medium text-gray-500">
                        {count > beforeCount(tag) ? '+' : ''}
                        {count - beforeCount(tag)}
                      </span>
                    )}
                  </span>
                  <span className="mt-2 text-[12px] text-gray-500">{L.tagHints[tag]}</span>
                </button>
              )
            })}
          </section>

          <section className="animate-rise [animation-delay:80ms]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <h2 className="text-[15px] font-semibold text-gray-900">
                {L.paragraphs}
                {filter !== 'all' && <span className="ml-2 text-[13px] font-medium text-brand">{L.tags[filter]}</span>}
              </h2>
              {filter !== 'all' && (
                <button type="button" onClick={() => setFilter('all')} className="text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900">
                  {L.showAll}
                </button>
              )}
            </div>
            <Actions.Provider value={actions}>
              <DocumentView title={docName(doc)} owner={resume?.name} paragraphs={review.paragraphs} filter={filter} />
            </Actions.Provider>
          </section>

          {review.appealMore.length > 0 && (
            <Panel title={L.appeal} action={<span className="text-[12.5px] text-gray-500 tabular-nums">{L.count(review.appealMore.length)}</span>} className="animate-rise [animation-delay:120ms]">
              <ol className="grid gap-2 md:grid-cols-2">
                {review.appealMore.map((item, index) => (
                  <li key={item} className="flex animate-rise gap-3 rounded-xl bg-white p-4" style={stagger(index)}>
                    <NumberBadge n={index + 1} tone="brand" />
                    <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-gray-700">{item}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
