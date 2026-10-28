import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { docName, fetchReview, type DocType, type DocumentReview, type ParagraphTag } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { toolButton } from './DeepParts'
import { Failed, Panel, ScoreRing } from './GapParts'
import { RefreshIcon } from './Icons'
import { Bone } from './Skeleton'

const DOCS: DocType[] = ['coverLetter', 'resume', 'portfolio']

const TEXT = messages({
  ko: {
    docs: '서류 종류',
    rerun: '재검증',
    reading: '서류를 읽고 있어요.',
    summary: '부합도 요약',
    paragraphs: '문단별 피드백',
    appeal: '더 어필할 점',
    reviewedAt: (when: string) => `검증 ${when}`,
    tags: { good: '좋아요', fix: '고쳐요', missing: '빠졌어요', interview: '면접 예상' } as Record<ParagraphTag, string>,
  },
  en: {
    docs: 'Document type',
    rerun: 'Review again',
    reading: 'Reading your document.',
    summary: 'Fit summary',
    paragraphs: 'Paragraph feedback',
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

const docButton = 'flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium transition-colors'

function Loading() {
  const L = useMessages(TEXT)
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">{L.reading}</span>
      <div aria-hidden className="flex items-center gap-5 rounded-2xl bg-gray-50 p-5">
        <Bone className="size-[88px] shrink-0" />
        <div className="flex-1">
          <Bone className="h-3.5 w-3/5" />
          <Bone className="mt-2.5 h-3.5 w-4/5" />
        </div>
      </div>
      <div aria-hidden className="space-y-6 rounded-2xl bg-gray-50 p-5">
        {[0, 1, 2].map((item) => (
          <div key={item}>
            <Bone className="h-5 w-16" />
            <Bone className="mt-3 h-3.5 w-full" />
            <Bone className="mt-2 h-3.5 w-11/12" />
            <Bone className="mt-3 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 서류 검증 탭이에요. 자기소개서, 이력서, 포트폴리오를 공고에 맞춰 문단마다 읽고, 좋아요, 고쳐요, 빠졌어요, 면접 예상 태그와 피드백을 붙여요.
 * 면접 예상 태그가 붙은 문단은 예상 질문 탭의 질문으로 이어져요.
 */
export function ReviewTab({ reportId }: { reportId: string }) {
  const L = useMessages(TEXT)
  const [doc, setDoc] = useState<DocType>('coverLetter')
  /** 서류 종류마다 받아 둔 결과. null은 실패, undefined는 아직 받지 않은 것이에요. */
  const [reviews, setReviews] = useState<Partial<Record<DocType, DocumentReview | null>>>({})
  const [loading, setLoading] = useState(false)
  const review = reviews[doc]

  async function load(target: DocType) {
    setLoading(true)
    const result = await fetchReview(reportId, target)
    setReviews((prev) => ({ ...prev, [target]: result }))
    setLoading(false)
  }

  useEffect(() => {
    track('review_view', { doc })
    if (reviews[doc] === undefined) void load(doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, reportId])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={L.docs} className="flex flex-wrap gap-2">
          {DOCS.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={doc === item}
              onClick={() => setDoc(item)}
              className={`${docButton} ${doc === item ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:text-gray-950'}`}
            >
              {docName(item)}
            </button>
          ))}
        </div>
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
        <Loading />
      ) : review === null ? (
        <Failed onRetry={() => void load(doc)} className="mt-16" />
      ) : (
        <>
          <Panel className="flex items-center gap-5 animate-rise">
            <ScoreRing score={review.fitScore} size={88} />
            <div className="min-w-0">
              <h2 className="text-[12.5px] font-medium text-gray-500">{L.summary}</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-gray-800">{review.summary}</p>
            </div>
          </Panel>

          <Panel title={L.paragraphs} className="animate-rise [animation-delay:60ms]">
            <ol className="space-y-6">
              {review.paragraphs.map((paragraph, index) => (
                <li key={paragraph.id} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                  <div className="flex flex-wrap gap-1.5">
                    {paragraph.tags.map((tag) => (
                      <span key={tag} className={`inline-flex h-6 items-center rounded-md px-2 text-[11.5px] font-medium ${TAG_TONES[tag]}`}>
                        {L.tags[tag]}
                      </span>
                    ))}
                  </div>
                  <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-[13.5px] leading-relaxed text-gray-700">{paragraph.text}</blockquote>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600">{paragraph.feedback}</p>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title={L.appeal} className="animate-rise [animation-delay:120ms]">
            <ul className="space-y-2">
              {review.appealMore.map((item) => (
                <li key={item} className="flex gap-2 text-[13.5px] leading-relaxed text-gray-700">
                  <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  )
}
