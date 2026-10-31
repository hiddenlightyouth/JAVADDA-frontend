import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchAnswers, fetchQuestions, PROGRESS_START, regenerateQuestions, type InterviewQuestion, type PracticeRecord, type ProgressState, type QuestionCategory } from '../lib/gap'
import { formatDate, formatDateTime, parseServerTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { AiProgress, Failed, Notice, Tip } from './GapParts'
import { ConfirmDialog, panelBody, SidePanel } from './Dialog'
import { ClockIcon, MicIcon, RefreshIcon } from './Icons'
import { Bullets, ghostButton, label, loadCenter, primaryButton, Segmented, stagger, toolButton } from './ui'

const CATEGORIES: QuestionCategory[] = ['tech', 'project', 'cs', 'culture']

export const QUESTION_TEXT = messages({
  ko: {
    categories: { tech: '기술', project: '프로젝트', cs: 'CS 기초', culture: '컬처핏' } as Record<QuestionCategory, string>,
    all: '전체',
    type: '유형',
    practiceAll: '전체 연습',
    practiceOne: '이 질문 연습',
    probability: (value: number) => `나올 확률 ${value}%`,
    source: (label: string) => `출처: ${label}`,
    show: '답변 포인트 보기',
    hide: '접기',
    intent: '의도',
    points: '답변 포인트',
    followUp: '꼬리 질문',
    count: (count: number) => `${count}개의 질문`,
    history: (count: number) => `지난 답변 ${count}개`,
    hideHistory: '지난 답변 접기',
    myAnswer: '내 답변',
    modelAnswer: '이렇게 답했으면 좋았어요',
    rephrase: '이렇게 말해 보세요',
    score: (value: number) => `${value}점`,
    practiced: (value: number) => `연습함 ${value}점`,
    likelihood: '나올 확률',
    regenerate: '새 질문 받기',
    pastRecords: '지난 기록',
    pastTitle: '지난 질문과 답변',
    pastSummary: (count: number, average: number) => `답변 ${count}개, 평균 ${average}점`,
    pastFilter: '보기',
    pastAll: '전체',
    pastOld: '예전 질문만',
    oldQuestion: '예전 질문',
    noQuestionText: '질문 글이 남아 있지 않은 예전 답변이에요',
    pastEmpty: '아직 연습한 답변이 없어요',
    pastEmptyBody: '질문을 연습하면 내 답과 피드백이 여기에 쌓여요.',
    pastOldEmpty: '예전 질문의 답변이 없어요',
    showFeedback: '피드백 보기',
    hideFeedback: '피드백 접기',
    good: '좋았어요',
    improve: '보완할 점',
    close: '닫기',
    regenerateTitle: '새 질문을 받을까요?',
    regenerateBody: '지금 질문과 겹치지 않는 질문을 새로 만들어요. 지금 질문은 사라지고, 지난 답변 기록은 남아요.',
    allDone: '질문을 모두 연습했어요',
    allDoneBody: '새 질문을 받아서 다른 관점으로 더 연습해 볼까요?',
    percent: (value: number) => `${value}%`,
    progress: '연습 현황',
    progressCount: (done: number, total: number) => `${total}개 중 ${done}개 연습했어요`,
    average: (value: number) => `평균 ${value}점`,
    notYet: '아직 연습한 질문이 없어요',
  },
  en: {
    categories: { tech: 'Technical', project: 'Project', cs: 'CS basics', culture: 'Culture fit' },
    all: 'All',
    type: 'Type',
    practiceAll: 'Practice all',
    practiceOne: 'Practice this',
    probability: (value: number) => `${value}% likely`,
    source: (label: string) => `Source: ${label}`,
    show: 'Show answer points',
    hide: 'Hide',
    intent: 'What they look for',
    points: 'Answer points',
    followUp: 'Follow-up',
    history: (count: number) => `${count} past ${count === 1 ? 'answer' : 'answers'}`,
    hideHistory: 'Hide past answers',
    myAnswer: 'Your answer',
    modelAnswer: 'A stronger answer',
    rephrase: 'Try saying it like this',
    score: (value: number) => `${value} pts`,
    count: (count: number) => `${count} ${count === 1 ? 'question' : 'questions'}`,
    practiced: (value: number) => `Practiced ${value} pts`,
    likelihood: 'Likelihood',
    regenerate: 'New questions',
    pastRecords: 'History',
    pastTitle: 'Past questions and answers',
    pastSummary: (count: number, average: number) => `${count} answers, avg ${average} pts`,
    pastFilter: 'Show',
    pastAll: 'All',
    pastOld: 'Earlier questions',
    oldQuestion: 'Earlier question',
    noQuestionText: 'An earlier answer without its question text',
    pastEmpty: 'No practice yet',
    pastEmptyBody: 'Your answers and feedback will collect here as you practice.',
    pastOldEmpty: 'No answers to earlier questions',
    showFeedback: 'Show feedback',
    hideFeedback: 'Hide feedback',
    good: 'What went well',
    improve: 'To improve',
    close: 'Close',
    regenerateTitle: 'Get new questions?',
    regenerateBody: "We'll write questions that don't repeat these. Current questions go away, your past answers stay.",
    allDone: 'You practiced every question',
    allDoneBody: 'Get new questions to practice from another angle?',
    percent: (value: number) => `${value}%`,
    progress: 'Practice progress',
    progressCount: (done: number, total: number) => `${done} of ${total} practiced`,
    average: (value: number) => `Avg ${value} pts`,
    notYet: 'No practice yet',
  },
})

/** 나올 확률을 짧은 막대와 숫자로 보여줘요. */
export function Probability({ value }: { value: number }) {
  const L = useMessages(QUESTION_TEXT)
  const percent = Math.round(value * 100)
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-gray-600 tabular-nums" aria-label={L.probability(percent)}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-200/70" aria-hidden>
        <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </span>
      {L.probability(percent)}
    </span>
  )
}

/** 질문의 의도와 답변 포인트, 꼬리 질문이에요. 회색 카드 안의 흰 칸으로 펼쳐져요. 면접 연습의 힌트도 같은 칸이에요. */
export function QuestionDetail({ question, followUp = true, className = '' }: { question: InterviewQuestion; followUp?: boolean; className?: string }) {
  const L = useMessages(QUESTION_TEXT)
  return (
    <div className={`animate-rise space-y-3 rounded-xl bg-white p-4 ${className}`}>
      <div>
        <h3 className={label}>{L.intent}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-gray-700">{question.intent}</p>
      </div>
      <div>
        <h3 className={label}>{L.points}</h3>
        <Bullets items={question.answerPoints} brand className="mt-1" />
      </div>
      {followUp && (
        <div>
          <h3 className={label}>{L.followUp}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-gray-700">{question.followUp}</p>
        </div>
      )}
    </div>
  )
}

/**
 * 이 질문에 예전에 한 답변이에요. 최근 것부터 내 답, 점수, 이렇게 말해 보세요, 모범 답변(이렇게 답했으면 좋았어요)을 보여줘요.
 * 답변은 서버에 남아 있어서(`fetchAnswers`) 다른 기기에서도 보여요.
 */
function PastAnswers({ records }: { records: PracticeRecord[] }) {
  const L = useMessages(QUESTION_TEXT)
  return (
    <ol className="mt-4 animate-rise space-y-3">
      {records.map((record) => (
        <li key={record.id} className="rounded-xl bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-gray-400 tabular-nums">{formatDateTime(record.createdAt)}</span>
            <span className="text-[13px] font-semibold text-brand tabular-nums">{L.score(record.feedback.score)}</span>
          </div>
          <h3 className={`mt-2 ${label}`}>{L.myAnswer}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-gray-700">{record.answer}</p>
          {record.feedback.rephrase.length > 0 && (
            <>
              <h3 className={`mt-3 ${label}`}>{L.rephrase}</h3>
              <Bullets items={record.feedback.rephrase} className="mt-1" />
            </>
          )}
          {record.feedback.modelAnswer && (
            <div className="mt-3 rounded-lg bg-brand-soft p-3">
              <h3 className="text-[12.5px] font-semibold text-brand-hover">{L.modelAnswer}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-gray-800">{record.feedback.modelAnswer}</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

/**
 * 질문 한 줄이에요. 프로그래머스나 LeetCode의 문제 목록처럼 왼쪽에 연습 상태(체크와 점수), 가운데에 질문과 출처, 오른쪽에 유형, 나올 확률, 연습 버튼을 한 줄에 둬요.
 * 줄을 누르면 그 자리에서 의도, 답변 포인트, 꼬리 질문과 지난 답변이 펼쳐져요.
 */
function Row({ question, index, order, records, onPractice }: { question: InterviewQuestion; index: number; order: number; records: PracticeRecord[]; onPractice: () => void }) {
  const L = useMessages(QUESTION_TEXT)
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState(false)
  const last = records[0]
  return (
    <li className="animate-rise" style={stagger(order)}>
      <div className={`group flex items-start gap-3 px-4 py-3.5 transition-colors ${open ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
        {/* 왼쪽은 번호예요. 연습한 질문은 메인 컬러 체크와 가장 최근 점수로 바뀌어요. */}
        <span className="flex w-9 shrink-0 flex-col items-center gap-0.5 pt-0.5" aria-label={last ? L.practiced(last.feedback.score) : undefined}>
          {last ? (
            <>
              <span className="flex size-6 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
                <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              </span>
              <span className="text-[11px] font-medium text-brand tabular-nums">{L.score(last.feedback.score)}</span>
            </>
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-[12px] font-semibold text-gray-500 tabular-nums">{index}</span>
          )}
        </span>
        {/* 질문 글은 읽기 좋은 폭(약 70자)에서 줄을 바꿔요. 화면 끝까지 늘어지면 눈이 길을 잃어요. */}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            if (!open) track('question_expand', { id: question.id })
            setOpen((value) => !value)
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block max-w-[68ch] text-[14.5px] leading-relaxed text-gray-900 transition-colors group-hover:text-brand">{question.question}</span>
          <span className="mt-1 block max-w-[68ch] truncate text-[12px] text-gray-400">{question.source.label}</span>
        </button>
        <Tip text={L.likelihood} className="mt-1 hidden shrink-0 sm:inline-flex">
          <span className="w-10 text-right text-[13px] font-medium text-gray-500 tabular-nums">{L.percent(Math.round(question.probability * 100))}</span>
        </Tip>
        <Tip text={L.practiceOne} className="inline-flex shrink-0">
          <button type="button" onClick={onPractice} aria-label={L.practiceOne} className="flex size-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-brand-soft hover:text-brand">
            <MicIcon className="size-4" />
          </button>
        </Tip>
      </div>
      {open && (
        <div className="bg-gray-50 px-4 pb-4 pl-[4.75rem]">
          <QuestionDetail question={question} />
          {records.length > 0 && (
            <button
              type="button"
              aria-expanded={history}
              onClick={() => {
                if (!history) track('practice_history_open', { count: records.length })
                setHistory((value) => !value)
              }}
              className={`${ghostButton} -ml-2 mt-2`}
            >
              {history ? L.hideHistory : L.history(records.length)}
            </button>
          )}
          {history && <PastAnswers records={records} />}
        </div>
      )}
    </li>
  )
}

/** 지난 기록 칸의 답변 하나예요. 점수, 시각, 질문, 내 답(세 줄까지)이 있고 피드백은 눌러야 펼쳐져요. */
function PastItem({ record, old }: { record: PracticeRecord; old: boolean }) {
  const L = useMessages(QUESTION_TEXT)
  const [open, setOpen] = useState(false)
  const { feedback } = record
  return (
    <li className="rounded-xl bg-gray-50 p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[12px] font-semibold text-brand-hover tabular-nums">{L.score(feedback.score)}</span>
        {old && <span className="rounded-md bg-gray-200/70 px-2 py-0.5 text-[11.5px] font-medium text-gray-600">{L.oldQuestion}</span>}
        <span className="ml-auto text-[12px] text-gray-400 tabular-nums">{formatDateTime(record.createdAt)}</span>
      </div>
      <p className={`mt-2.5 text-[14px] leading-relaxed font-semibold ${record.question ? 'text-gray-900' : 'text-gray-400'}`}>{record.question || L.noQuestionText}</p>
      <p className={`mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-gray-600 ${open ? '' : 'line-clamp-3'}`}>{record.answer}</p>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`${ghostButton} -ml-2 mt-1`}>
        {open ? L.hideFeedback : L.showFeedback}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-xl bg-white p-4">
          {feedback.good.length > 0 && (
            <div>
              <h3 className={label}>{L.good}</h3>
              <Bullets items={feedback.good} brand className="mt-1" />
            </div>
          )}
          {feedback.improve.length > 0 && (
            <div>
              <h3 className={label}>{L.improve}</h3>
              <Bullets items={feedback.improve} className="mt-1" />
            </div>
          )}
          {feedback.rephrase.length > 0 && (
            <div>
              <h3 className={label}>{L.rephrase}</h3>
              <Bullets items={feedback.rephrase} className="mt-1" />
            </div>
          )}
          {feedback.modelAnswer && (
            <div className="rounded-lg bg-brand-soft p-3">
              <h3 className="text-[12.5px] font-semibold text-brand-hover">{L.modelAnswer}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-gray-800">{feedback.modelAnswer}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * 지난 질문과 답변을 오른쪽에서 여는 칸에 모아 보여줘요. 예상 질문을 새로 뽑기 전의 예전 질문 답변도 여기서 봐요.
 * 맨 위에 답변 수와 평균 점수, 전체와 예전 질문만 고르는 칸이 있고, 답변은 날짜별로 묶여 최근 것부터 와요.
 */
function PastPanel({ records, current, onClose }: { records: PracticeRecord[]; current: Set<string>; onClose: () => void }) {
  const L = useMessages(QUESTION_TEXT)
  const [onlyOld, setOnlyOld] = useState(false)
  const list = onlyOld ? records.filter((record) => !current.has(record.questionId)) : records
  const average = records.length === 0 ? 0 : Math.round(records.reduce((sum, record) => sum + record.feedback.score, 0) / records.length)
  // 날짜별로 묶어요. 답변은 최근 것부터 와서 묶음도 최근 날짜부터예요.
  const days: { day: string; items: PracticeRecord[] }[] = []
  for (const record of list) {
    const date = parseServerTime(record.createdAt)
    const day = date ? formatDate(date) : ''
    const last = days[days.length - 1]
    if (last && last.day === day) last.items.push(record)
    else days.push({ day, items: [record] })
  }
  return (
    <SidePanel
      onClose={onClose}
      closeLabel={L.close}
      labelledBy="past-panel-title"
      className="max-w-[520px]"
      header={
        <div>
          <h2 id="past-panel-title" className="text-[20px] font-semibold text-gray-900">
            {L.pastTitle}
          </h2>
          {records.length > 0 && <p className="mt-1 text-[13px] text-gray-500 tabular-nums">{L.pastSummary(records.length, average)}</p>}
        </div>
      }
    >
      <div className={panelBody}>
        {records.length === 0 ? (
          <Notice title={L.pastEmpty} body={L.pastEmptyBody} className="mt-16" />
        ) : (
          <>
            <Segmented
              label={L.pastFilter}
              options={[
                ['all', L.pastAll],
                ['old', L.pastOld],
              ] as const}
              value={onlyOld ? 'old' : 'all'}
              onChange={(value) => setOnlyOld(value === 'old')}
            />
            {list.length === 0 ? (
              <Notice title={L.pastOldEmpty} className="mt-12" />
            ) : (
              <div className="mt-5 space-y-6">
                {days.map(({ day, items }) => (
                  <section key={day}>
                    <h3 className="mb-2 text-[12.5px] font-medium text-gray-500">{day}</h3>
                    <ol className="space-y-2">
                      {items.map((record) => (
                        <PastItem key={record.id} record={record} old={!current.has(record.questionId)} />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SidePanel>
  )
}

/**
 * 예상 면접 질문 탭이에요. 서류 문단, 갭과 강점, 기업 기술 블로그, 기출 코퍼스에서 나온 질문을 나올 확률 순서로 보여줘요.
 * 질문마다 의도와 답변 포인트, 꼬리 질문을 펼쳐 보고, 하나씩 또는 전부 연습하러 가요.
 */
export function QuestionsTab({ reportId, onPractice }: { reportId: string; onPractice: (question?: string) => void }) {
  const L = useMessages(QUESTION_TEXT)
  const [questions, setQuestions] = useState<InterviewQuestion[] | null | undefined>(undefined)
  const [category, setCategory] = useState<QuestionCategory | null>(null)
  const [progress, setProgress] = useState<ProgressState>(PROGRESS_START)
  /** 질문마다 예전에 한 답변이에요. 질문 목록과 따로 받아서, 못 받아도 질문은 그대로 보여요. */
  const [records, setRecords] = useState<Record<string, PracticeRecord[]>>({})
  /** 이 리포트에서 한 답변 전부예요. 새로 뽑기 전의 예전 질문 답변도 들어 있어요. 최근 것부터예요. */
  const [allRecords, setAllRecords] = useState<PracticeRecord[]>([])
  const [showPast, setShowPast] = useState(false)
  /** 마지막으로 보낸 요청이에요. 앞의 요청이 늦게 끝나도 화면을 덮지 않게 해요. */
  const latest = useRef(0)

  /** 질문을 받아요. fresh면 새로 뽑아요. 받는 동안은 진행 막대를 보여줘요. */
  async function load(fresh = false) {
    const request = ++latest.current
    setQuestions(undefined)
    setCategory(null)
    setProgress(PROGRESS_START)
    const onProgress = (next: ProgressState) => {
      if (request === latest.current) setProgress(next)
    }
    const list = fresh ? await regenerateQuestions(reportId, onProgress) : await fetchQuestions(reportId, onProgress)
    if (request === latest.current) setQuestions(list.length > 0 ? list : null)
  }
  const [asking, setAsking] = useState(false)
  function askRegenerate(from: 'header' | 'done') {
    track('questions_regenerate_open', { from })
    setAsking(true)
  }

  useEffect(() => {
    void load()
    let stale = false
    void fetchAnswers(reportId).then((list) => {
      if (stale) return
      const grouped: Record<string, PracticeRecord[]> = {}
      for (const record of list) (grouped[record.questionId] ??= []).push(record)
      setRecords(grouped)
      setAllRecords(list)
    })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  const list = questions ? questions.filter((question) => !category || question.category === category) : []
  // 연습한 질문과 질문마다 가장 최근 점수의 평균이에요. 답변 기록은 최근 것부터 와요.
  const practiced = questions ? questions.filter((question) => (records[question.id]?.length ?? 0) > 0) : []
  const average = practiced.length === 0 ? 0 : Math.round(practiced.reduce((sum, question) => sum + records[question.id][0].feedback.score, 0) / practiced.length)

  return (
    <div className="space-y-4">
      {/* 맨 위 한 줄에 유형 탭(수와 함께)과 연습 현황, 전체 연습 버튼을 둬요. 질문을 받기 전에는 비워 둬요. */}
      {questions && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div role="radiogroup" aria-label={L.type} className="flex flex-wrap gap-1.5">
            {[null, ...CATEGORIES].map((value) => {
              const count = value ? questions.filter((question) => question.category === value).length : questions.length
              const on = category === value
              return (
                <button
                  key={value ?? 'all'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={count === 0}
                  onClick={() => {
                    track('questions_filter', { category: value ?? 'all' })
                    setCategory(value)
                  }}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors disabled:opacity-40 ${on ? 'bg-brand-soft text-brand-hover' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  {value ? L.categories[value] : L.all}
                  <span className="tabular-nums opacity-60">{count}</span>
                </button>
              )
            })}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[12.5px] text-gray-500 tabular-nums">{practiced.length > 0 ? L.progressCount(practiced.length, questions.length) : L.notYet}</span>
            {practiced.length > 0 && <span className="text-[12.5px] font-medium text-brand tabular-nums">{L.average(average)}</span>}
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200/70" aria-label={L.progress}>
              <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${(practiced.length / Math.max(1, questions.length)) * 100}%` }} />
            </span>
            <button
              type="button"
              onClick={() => {
                track('questions_history_open', { count: allRecords.length })
                setShowPast(true)
              }}
              className={toolButton}
            >
              <ClockIcon />
              {L.pastRecords}
              {allRecords.length > 0 && <span className="text-gray-400 tabular-nums">{allRecords.length}</span>}
            </button>
            <button type="button" onClick={() => askRegenerate('header')} className={toolButton}>
              <RefreshIcon />
              {L.regenerate}
            </button>
            <button
              type="button"
              onClick={() => {
                track('practice_start', { from: 'all' })
                onPractice()
              }}
              className={primaryButton}
            >
              {L.practiceAll}
            </button>
          </div>
        </div>
      )}

      {questions === undefined ? (
        // AI가 질문을 만드는 동안은 진행 정도를 막대로 보여줘요. 이미 만들어 둔 질문이면 금방 지나가요.
        <AiProgress progress={progress.progress} stage={progress.stage} className={loadCenter} />
      ) : questions === null ? (
        <Failed onRetry={() => void load()} className="mt-16" />
      ) : (
        // 유형별로 묶어 묶음 제목만 두고, 줄에는 유형 이름표를 되풀이하지 않아요. 묶음 안은 나올 확률이 높은 것부터예요.
        <div className="space-y-5">
          {CATEGORIES.filter((value) => list.some((question) => question.category === value)).map((value) => {
            const group = list.filter((question) => question.category === value)
            return (
              <section key={value}>
                <h3 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-gray-800">
                  {L.categories[value]}
                  <span className="font-normal text-gray-400 tabular-nums">{group.length}</span>
                  <span className="ml-auto text-[11.5px] font-normal text-gray-400">{L.likelihood}</span>
                </h3>
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
                  {group.map((question, index) => (
                    <Row
                      key={question.id}
                      question={question}
                      index={index + 1}
                      order={index}
                      records={records[question.id] ?? []}
                      onPractice={() => {
                        track('practice_start', { from: 'question' })
                        onPractice(question.id)
                      }}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      {questions && list.length === 0 && <Notice title={L.count(0)} className="mt-16" />}
      {/* 질문을 모두 연습했으면 목록 아래에서 새 질문을 받자고 권해요. */}
      {questions && practiced.length === questions.length && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-brand-soft px-5 py-4">
          <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
            <p className="font-semibold text-gray-900">{L.allDone}</p>
            <p className="mt-0.5 text-gray-700">{L.allDoneBody}</p>
          </div>
          <button type="button" onClick={() => askRegenerate('done')} className={primaryButton}>
            {L.regenerate}
          </button>
        </div>
      )}
      {showPast && <PastPanel records={allRecords} current={new Set((questions ?? []).map((question) => question.id))} onClose={() => setShowPast(false)} />}
      {asking && (
        <ConfirmDialog
          title={L.regenerateTitle}
          body={L.regenerateBody}
          confirm={L.regenerate}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false)
            track('questions_regenerate', {})
            void load(true)
          }}
        />
      )}
    </div>
  )
}
