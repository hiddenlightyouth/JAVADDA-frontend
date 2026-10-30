import { useEffect, useRef, useState } from 'react'
import { VOICES, voiceOf } from '../../shared/voices'
import { track } from '../lib/analytics'
import { companyOf, fetchQuestions, postingOf, PROGRESS_START, submitAnswer, useReport, type InterviewQuestion, type PracticeFeedback, type ProgressState } from '../lib/gap'
import { messages, useLang, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { canDictate, canSpeak, joinSpeech, useDictation, useSpeak } from '../lib/speech'
import { readItem, writeItem } from '../lib/storage'
import { showToast } from '../lib/toast'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { AiProgress, Notice, Panel, ScoreRing } from './GapParts'
import { MicIcon, SpeakerIcon } from './Icons'
import { Probability, QUESTION_TEXT, QuestionDetail } from './ReportQuestions'
import { Bullets, ghostButton, loadCenter, LoadProgress, label, primaryButton, tag, textArea, toolButton } from './ui'

const TEXT = messages({
  ko: {
    title: '면접 연습',
    missing: '연습할 질문이 없어요',
    missingBody: '리포트가 지워졌거나 아직 질문을 만들지 못했어요.',
    back: '돌아가기',
    progress: (current: number, total: number) => `${current} / ${total}`,
    hint: '힌트 보기',
    hideHint: '힌트 접기',
    listen: '질문 듣기',
    stopListen: '그만 듣기',
    preparing: '목소리 준비 중',
    voice: '목소리',
    speak: '말로 답하기',
    stopSpeak: '말하기 멈추기',
    hearing: '듣고 있어요. 면접관 앞이라고 생각하고 말해 보세요.',
    micDenied: '마이크 권한을 허용하면 말로 답할 수 있어요.',
    micMissing: '마이크를 찾지 못했어요. 연결을 확인해 주세요.',
    micFailed: '음성을 알아듣지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    placeholder: '면접관 앞에서 말하듯이 적어 보세요. 상황, 내가 한 일, 결과 순서가 좋아요.',
    chars: (count: number) => `${count}자`,
    submit: '답변 제출',
    grading: '채점 중',
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
    progress: (current: number, total: number) => `${current} / ${total}`,
    hint: 'Show hint',
    hideHint: 'Hide hint',
    listen: 'Hear question',
    stopListen: 'Stop',
    preparing: 'Preparing voice',
    voice: 'Voice',
    speak: 'Answer by voice',
    stopSpeak: 'Stop speaking',
    hearing: "Listening. Answer as if you're in the interview.",
    micDenied: 'Allow microphone access to answer by voice.',
    micMissing: "We couldn't find a microphone. Please check the connection.",
    micFailed: "We couldn't recognize your voice. Please try again in a moment.",
    placeholder: 'Write it like you would say it. Situation, what you did, then the result.',
    chars: (count: number) => `${count} chars`,
    submit: 'Submit answer',
    grading: 'Grading',
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

/** 고른 목소리는 이 기기에 기억해요. */
const VOICE_KEY = 'whoisloafing:practice-voice'
const readVoice = () => {
  const key = readItem(VOICE_KEY)
  return key && voiceOf(key) ? key : null
}

/** 답이 이보다 짧으면 제출할 수 없어요. */
const MIN_CHARS = 10

/**
 * 면접 연습 화면이에요. 예상 질문에 글로 답하면 점수와 좋았던 점, 보완할 점, 다시 말해 볼 문장, 꼬리 질문을 돌려줘요.
 * 질문 하나부터 시작할 수도 있고, 전체를 차례로 연습할 수도 있어요.
 * 브라우저가 지원하면 질문을 소리로 듣고 말로 답할 수 있어요. 말한 내용은 답변 칸에 글자로 들어가서 고쳐서 낼 수 있어요.
 */
export function Practice({ id, question: startId, onBack }: { id: string; question?: string; onBack: () => void }) {
  const L = useMessages(TEXT)
  const Q = useMessages(QUESTION_TEXT)
  const lang = useLang()
  const reportLoad = useLoadProgress()
  const report = useReport(id, reportLoad.one)
  // 리포트 상세는 자료를 받는 것이라 받은 바이트로, 질문은 AI가 만드는 것이라 서버의 단계로 퍼센트를 보여줘요.
  const waitingReport = useLoadHold(report === undefined)
  const [questions, setQuestions] = useState<InterviewQuestion[] | null | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [hint, setHint] = useState(false)
  const [sending, setSending] = useState(false)
  /** 질문을 받는 동안과 답을 채점하는 동안의 진행 상황이에요. */
  const [loadProgress, setLoadProgress] = useState<ProgressState>(PROGRESS_START)
  const [gradeProgress, setGradeProgress] = useState<ProgressState>(PROGRESS_START)
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null)
  /** 지금까지 받은 점수 */
  const [scores, setScores] = useState<number[]>([])
  const [finished, setFinished] = useState(false)
  /** 이번 답을 말로 했는지. 분석에서 글로 쓴 답과 나눠 봐요. */
  const spoken = useRef(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const voice = useSpeak()
  /** 사용자가 고른 목소리. null이면 기본 목소리예요. */
  const [speaker, setSpeaker] = useState(readVoice)
  const dictation = useDictation(
    lang === 'ko' ? 'ko-KR' : 'en-US',
    (text) => setAnswer((prev) => joinSpeech(prev, text)),
    (code) => {
      track('practice_voice_error', { code })
      showToast(code === 'not-allowed' || code === 'service-not-allowed' ? L.micDenied : code === 'audio-capture' ? L.micMissing : L.micFailed)
    },
  )
  /** 말하는 동안에는 아직 확정되지 않은 글자까지 칸에 보여줘요. */
  const shown = joinSpeech(answer, dictation.interim)

  // 글자가 늘어나도 방금 말한 부분이 보이게 칸을 끝까지 내려요.
  useEffect(() => {
    if (dictation.listening && field.current) field.current.scrollTop = field.current.scrollHeight
  }, [dictation.listening, shown])

  useEffect(() => {
    let stale = false
    setLoadProgress(PROGRESS_START)
    void fetchQuestions(id, (next) => {
      if (!stale) setLoadProgress(next)
    }).then((list) => {
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
    // 말하는 중에 내면 듣기를 멈추고, 칸에 보이던 글자 그대로 내요.
    const text = joinSpeech(answer, dictation.finish())
    setAnswer(text)
    if (!current || text.trim().length < MIN_CHARS) return
    voice.stop()
    setSending(true)
    setGradeProgress(PROGRESS_START)
    const result = await submitAnswer(id, current, text, setGradeProgress)
    setSending(false)
    if (!result) return
    setFeedback(result)
    setScores((prev) => [...prev, result.score])
    track('practice_submit', { score: result.score, voice: spoken.current })
  }

  function toggleSpeaking() {
    if (dictation.listening) {
      const rest = dictation.finish()
      setAnswer((prev) => joinSpeech(prev, rest))
      return
    }
    voice.stop()
    spoken.current = true
    track('practice_voice_start')
    dictation.start()
  }

  function toggleListen(question: string) {
    if (voice.speaking) return voice.stop()
    track('practice_question_listen')
    void voice.speak(question, speaker)
  }

  /** 목소리를 고르면 지금 질문을 그 목소리로 바로 들려줘요. 말하는 중에는 소리가 답변에 섞이지 않게 틀지 않아요. */
  function pickVoice(key: string, question: string) {
    setSpeaker(key)
    writeItem(VOICE_KEY, key)
    track('practice_voice_select', { voice: key })
    if (!dictation.listening) void voice.speak(question, key)
  }

  function next() {
    if (!questions) return
    voice.stop()
    if (index + 1 >= questions.length) {
      const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length))
      track('practice_finish', { average, count: scores.length })
      setFinished(true)
      return
    }
    track('practice_next')
    setIndex((value) => value + 1)
    setAnswer('')
    spoken.current = false
    setHint(false)
    setFeedback(null)
  }

  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length))

  return (
    <ScrollPage header={<PageHeader title={L.title} owner={posting && company ? `${company.name} ${posting.title}` : undefined} onBack={onBack} />}>
      <div className="mx-auto w-full max-w-[720px]">
        {report === null || questions === null ? (
          <Notice title={L.missing} body={L.missingBody} action={L.back} onAction={onBack} className="mt-16" />
        ) : waitingReport || report === undefined ? (
          <LoadProgress percent={reportLoad.percent} className={loadCenter} />
        ) : questions === undefined || !current ? (
          // AI가 질문을 만드는 동안은 진행 정도를 막대로 보여줘요. 이미 만들어 둔 질문이면 금방 지나가요.
          <AiProgress progress={loadProgress.progress} stage={loadProgress.stage} className={loadCenter} />
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
              <div className="-ml-2 mt-2 flex flex-wrap items-center gap-1">
                <button type="button" aria-expanded={hint} onClick={() => setHint((value) => !value)} className={ghostButton}>
                  {hint ? L.hideHint : L.hint}
                </button>
                {canSpeak() && (
                  <button type="button" aria-pressed={voice.speaking} onClick={() => toggleListen(current.question)} className={`${ghostButton} flex items-center gap-1.5`}>
                    <SpeakerIcon className="size-3.5" />
                    {voice.preparing ? L.preparing : voice.speaking ? L.stopListen : L.listen}
                  </button>
                )}
                {canSpeak() && voice.remote && (
                  <Dropdown
                    label={L.voice}
                    value={(voiceOf(speaker ?? '') ?? VOICES[0]).name[lang]}
                    className="h-8! rounded-md! border-transparent! bg-transparent! px-2! text-[12.5px]! text-gray-600! hover:bg-gray-100!"
                    groups={[
                      {
                        items: VOICES.map((item) => ({
                          label: item.name[lang],
                          hint: item.hint[lang],
                          checked: (speaker ?? VOICES[0].key) === item.key,
                          onSelect: () => pickVoice(item.key, current.question),
                        })),
                      },
                    ]}
                  />
                )}
              </div>
              {hint && <QuestionDetail question={current} followUp={false} className="mt-2" />}

              <textarea
                ref={field}
                value={shown}
                readOnly={feedback !== null || sending || dictation.listening}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={dictation.listening ? L.hearing : L.placeholder}
                className={`mt-5 min-h-40 resize-y! read-only:bg-gray-50 ${textArea}`}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[12px] text-gray-400 tabular-nums">{L.chars(shown.length)}</span>
                {!feedback && (
                  <div className="flex items-center gap-2">
                    {canDictate() && (
                      <button
                        type="button"
                        aria-pressed={dictation.listening}
                        disabled={sending}
                        onClick={toggleSpeaking}
                        className={`${toolButton} ${dictation.listening ? 'border-brand! text-brand-hover!' : ''} disabled:text-gray-400`}
                      >
                        <MicIcon className={`size-4 ${dictation.listening ? 'motion-safe:animate-pulse' : ''}`} />
                        {dictation.listening ? L.stopSpeak : L.speak}
                      </button>
                    )}
                    <button type="button" disabled={sending || shown.trim().length < MIN_CHARS} onClick={() => void submit()} className={primaryButton}>
                      {sending ? L.grading : L.submit}
                    </button>
                  </div>
                )}
              </div>
              {/* 채점하는 동안 답을 적는 칸 아래에 진행 정도를 보여줘요. 회색 칸 위라 막대의 빈 부분도 보여요. */}
              {sending && <AiProgress progress={gradeProgress.progress} stage={gradeProgress.stage} className="mt-4" />}
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
                      spoken.current = false
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
