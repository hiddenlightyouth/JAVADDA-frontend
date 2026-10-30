import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { companyOf, fetchQuestions, postingOf, submitAnswer, useReport, type InterviewQuestion, type PracticeFeedback } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { PageHeader, ScrollPage } from './AppPage'
import { Notice, Panel, ScoreRing } from './GapParts'
import { Probability, QUESTION_TEXT, QuestionDetail } from './ReportQuestions'
import { Bone } from './Skeleton'
import { Bullets, Busy, ghostButton, label, primaryButton, tag, textArea, toolButton } from './ui'

const TEXT = messages({
  ko: {
    title: '면접 연습',
    missing: '연습할 질문이 없어요',
    missingBody: '리포트가 지워졌거나 아직 질문을 만들지 못했어요.',
    back: '돌아가기',
    loading: '질문을 준비하고 있어요.',
    progress: (current: number, total: number) => `${current} / ${total}`,
    hint: '힌트 보기',
    hideHint: '힌트 접기',
    placeholder: '면접관 앞에서 말하듯이 적어 보세요. 상황, 내가 한 일, 결과 순서가 좋아요.',
    chars: (count: number) => `${count}자`,
    submit: '답변 제출',
    reading: '읽고 있어요',
    feedback: 'AI 피드백',
    good: '좋았어요',
    improve: '보완할 점',
    rephrase: '이렇게 말해 보세요',
    followUp: '꼬리 질문',
    again: '다시 답하기',
    next: '다음 질문',
    finish: '연습 마치기',
    doneTitle: '오늘 연습을 마쳤어요',
    doneBody: (count: number) => `${count}개의 질문에 답했어요. 보완할 점을 하나씩 다듬으면 다음 연습이 더 쉬워져요.`,
    average: '평균 점수',
    toReport: '리포트로 돌아가기',
  },
  en: {
    title: 'Interview practice',
    missing: 'Nothing to practice yet',
    missingBody: 'The report was deleted or questions are not ready.',
    back: 'Go back',
    loading: 'Preparing questions.',
    progress: (current: number, total: number) => `${current} / ${total}`,
    hint: 'Show hint',
    hideHint: 'Hide hint',
    placeholder: 'Write it like you would say it. Situation, what you did, then the result.',
    chars: (count: number) => `${count} chars`,
    submit: 'Submit answer',
    reading: 'Reading',
    feedback: 'AI feedback',
    good: 'What worked',
    improve: 'What to improve',
    rephrase: 'Try saying it like this',
    followUp: 'Follow-up',
    again: 'Answer again',
    next: 'Next question',
    finish: 'Finish',
    doneTitle: 'Practice complete',
    doneBody: (count: number) => `You answered ${count} ${count === 1 ? 'question' : 'questions'}. Work on one improvement at a time and the next round gets easier.`,
    average: 'Average score',
    toReport: 'Back to the report',
  },
})

/** 답이 이보다 짧으면 제출할 수 없어요. */
const MIN_CHARS = 10

/**
 * 면접 연습 화면이에요. 예상 질문에 글로 답하면 점수와 좋았던 점, 보완할 점, 다시 말해 볼 문장, 꼬리 질문을 돌려줘요.
 * 질문 하나부터 시작할 수도 있고, 전체를 차례로 연습할 수도 있어요. 음성 답변은 아직 없어요.
 */
export function Practice({ id, question: startId, onBack }: { id: string; question?: string; onBack: () => void }) {
  const L = useMessages(TEXT)
  const Q = useMessages(QUESTION_TEXT)
  const report = useReport(id)
  const [questions, setQuestions] = useState<InterviewQuestion[] | null | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [hint, setHint] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null)
  /** 지금까지 받은 점수 */
  const [scores, setScores] = useState<number[]>([])
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    let stale = false
    void fetchQuestions(id).then((list) => {
      if (stale) return
      // 질문 하나에서 시작하면 그 질문부터 뒤의 것들만 연습해요.
      const start = startId ? Math.max(0, list.findIndex((item) => item.id === startId)) : 0
      const sliced = list.slice(start)
      setQuestions(sliced.length > 0 ? sliced : null)
    })
    return () => {
      stale = true
    }
  }, [id, startId])

  const posting = report ? postingOf(report.postingId) : null
  const company = report ? companyOf(report.companyId) : null
  const current = questions?.[index]

  async function submit() {
    if (!current || answer.trim().length < MIN_CHARS) return
    setSending(true)
    const result = await submitAnswer(current, answer)
    setSending(false)
    setFeedback(result)
    setScores((prev) => [...prev, result.score])
    track('practice_submit', { score: result.score })
  }

  function next() {
    if (!questions) return
    if (index + 1 >= questions.length) {
      const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length))
      track('practice_finish', { average, count: scores.length })
      setFinished(true)
      return
    }
    track('practice_next')
    setIndex((value) => value + 1)
    setAnswer('')
    setHint(false)
    setFeedback(null)
  }

  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length))

  return (
    <ScrollPage header={<PageHeader title={L.title} owner={posting && company ? `${company.name} ${posting.title}` : undefined} onBack={onBack} />}>
      <div className="mx-auto w-full max-w-[720px]">
        {!report || questions === null ? (
          <Notice title={L.missing} body={L.missingBody} action={L.back} onAction={onBack} className="mt-16" />
        ) : questions === undefined || !current ? (
          <Busy label={L.loading} className="rounded-2xl bg-gray-50 p-5">
            <Bone className="h-3 w-16" />
            <Bone className="mt-5 h-5 w-4/5" />
            <Bone className="mt-6 h-40 w-full rounded-xl!" />
          </Busy>
        ) : finished ? (
          <Panel className="flex flex-col items-center py-10 text-center animate-rise">
            <ScoreRing score={average} />
            <p className="mt-2 text-[12.5px] text-gray-500">{L.average}</p>
            <h2 className="mt-5 text-[19px] font-semibold text-gray-900">{L.doneTitle}</h2>
            <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-gray-500">{L.doneBody(scores.length)}</p>
            <button type="button" onClick={onBack} className={`${primaryButton} mt-6`}>
              {L.toReport}
            </button>
          </Panel>
        ) : (
          <div className="space-y-4">
            {/* 진행 상황 */}
            <div className="flex items-center gap-3">
              <span className={`${label} tabular-nums`}>{L.progress(index + 1, questions.length)}</span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200/70" aria-hidden>
                <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%` }} />
              </div>
            </div>

            <Panel key={current.id} className="animate-rise">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={tag}>{Q.categories[current.category]}</span>
                <Probability value={current.probability} />
                <span className="text-[12px] text-gray-400">{Q.source(current.source.label)}</span>
              </div>
              <h2 className="mt-3 text-[18px] leading-snug font-semibold text-gray-900">{current.question}</h2>
              <button type="button" aria-expanded={hint} onClick={() => setHint((value) => !value)} className={`${ghostButton} -ml-2 mt-2`}>
                {hint ? L.hideHint : L.hint}
              </button>
              {hint && <QuestionDetail question={current} followUp={false} className="mt-2" />}

              <textarea
                value={answer}
                readOnly={feedback !== null || sending}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={L.placeholder}
                className={`mt-5 min-h-40 resize-y! read-only:bg-gray-50 ${textArea}`}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[12px] text-gray-400 tabular-nums">{L.chars(answer.length)}</span>
                {!feedback && (
                  <button type="button" disabled={sending || answer.trim().length < MIN_CHARS} onClick={() => void submit()} className={primaryButton}>
                    {sending ? L.reading : L.submit}
                  </button>
                )}
              </div>
            </Panel>

            {feedback && (
              <Panel title={L.feedback} className="animate-rise">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <ScoreRing score={feedback.score} size={88} />
                  <div className="min-w-0 flex-1 space-y-4">
                    <section>
                      <h3 className={label}>{L.good}</h3>
                      <Bullets items={feedback.good} brand className="mt-1" />
                    </section>
                    <section>
                      <h3 className={label}>{L.improve}</h3>
                      <Bullets items={feedback.improve} className="mt-1" />
                    </section>
                    <section>
                      <h3 className={label}>{L.rephrase}</h3>
                      <Bullets items={feedback.rephrase} className="mt-1" />
                    </section>
                    <section>
                      <h3 className={label}>{L.followUp}</h3>
                      <p className="mt-1 rounded-xl bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-gray-700">{feedback.followUp}</p>
                    </section>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(null)
                      setScores((prev) => prev.slice(0, -1))
                    }}
                    className={toolButton}
                  >
                    {L.again}
                  </button>
                  <button type="button" onClick={next} className={primaryButton}>
                    {index + 1 >= questions.length ? L.finish : L.next}
                  </button>
                </div>
              </Panel>
            )}
          </div>
        )}
      </div>
    </ScrollPage>
  )
}
