import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { track } from '../lib/analytics'
import { fetchAnswers, fetchQuestions, PROGRESS_START, regenerateQuestions, type InterviewQuestion, type PracticeRecord, type ProgressState, type QuestionCategory } from '../lib/gap'
import { formatDate, formatDateTime, parseServerTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { AiProgress, Failed, Notice, ScoreRing, Tip } from './GapParts'
import { ConfirmDialog } from './Dialog'
import { isApp } from '../lib/app'
import { useDismiss } from '../hooks/useDismiss'
import { CheckIcon, ChevronDownIcon, ClockIcon, CloseIcon, RefreshIcon } from './Icons'
import { Callout, ModelAnswer, ResultCard } from './ReportParts'
import { Bullets, ghostButton, label, loadCenter, primaryButton, Segmented, stagger, toolButton } from './ui'

const CATEGORIES: QuestionCategory[] = ['tech', 'project', 'cs', 'culture']

const TEXT = messages({
  ko: {
    categories: { tech: '기술', project: '프로젝트', cs: 'CS 기초', culture: '컬처핏' } as Record<QuestionCategory, string>,
    all: '전체',
    type: '유형',
    practiceAll: '전체 연습',
    practiceOne: '이 질문 연습',
    showDetail: '답변 포인트 보기',
    hideDetail: '답변 포인트 접기',
    fromStrength: (skill: string) => `내 강점인 ${skill} 역량을 깊이 묻는 질문`,
    fromGap: (skill: string) => `부족한 ${skill} 역량을 어떻게 채울지 묻는 질문`,
    fromParagraph: (label: string) => `${label}에서 나온 질문`,
    intent: '의도',
    points: '답변 포인트',
    followUp: '꼬리 질문',
    count: (count: number) => `${count}개의 질문`,
    history: (count: number) => `지난 답변 ${count}개`,
    hideHistory: '지난 답변 접기',
    myAnswer: '내 답변',
    rephrase: '이렇게 말해 보세요',
    score: (value: number) => `${value}점`,
    practiced: (value: number) => `연습함 ${value}점`,
    likelihood: '나올 확률',
    regenerate: '새 질문 받기',
    pastRecords: '지난 기록',
    pastTitle: '지난 질문과 답변',
    pastSummary: (count: number) => `답변 ${count}개`,
    pastFilter: '보기',
    pastAll: '전체',
    pastOld: '예전 질문만',
    oldQuestion: '예전 질문',
    noQuestionText: '질문 글이 남아 있지 않은 예전 답변이에요',
    pastEmpty: '아직 연습한 답변이 없어요',
    pastEmptyBody: '질문을 연습하면 내 답과 피드백이 여기에 쌓여요.',
    pastOldEmpty: '예전 질문의 답변이 없어요',
    averageScore: '평균 점수',
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
    showDetail: 'Show answer points',
    hideDetail: 'Hide answer points',
    fromStrength: (skill: string) => `Digs into your strength, ${skill}`,
    fromGap: (skill: string) => `Asks how you'd fill the ${skill} gap`,
    fromParagraph: (label: string) => `From ${label}`,
    intent: 'What they look for',
    points: 'Answer points',
    followUp: 'Follow-up',
    history: (count: number) => `${count} past ${count === 1 ? 'answer' : 'answers'}`,
    hideHistory: 'Hide past answers',
    myAnswer: 'Your answer',
    rephrase: 'Try saying it like this',
    score: (value: number) => `${value} pts`,
    count: (count: number) => `${count} ${count === 1 ? 'question' : 'questions'}`,
    practiced: (value: number) => `Practiced ${value} pts`,
    likelihood: 'Likelihood',
    regenerate: 'New questions',
    pastRecords: 'History',
    pastTitle: 'Past questions and answers',
    pastSummary: (count: number) => `${count} ${count === 1 ? 'answer' : 'answers'}`,
    pastFilter: 'Show',
    pastAll: 'All',
    pastOld: 'Earlier questions',
    oldQuestion: 'Earlier question',
    noQuestionText: 'An earlier answer without its question text',
    pastEmpty: 'No practice yet',
    pastEmptyBody: 'Your answers and feedback will collect here as you practice.',
    pastOldEmpty: 'No answers to earlier questions',
    averageScore: 'Average score',
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

/**
 * 질문 아래의 출처 한 줄이에요. 서버는 "강점 MySQL", "부족 Kafka"처럼 짧게 줘서 뜻을 알기 어려워요.
 * 강점과 갭에서 나온 질문은 무엇을 묻는 질문인지 풀어 쓰고, 서류 문단은 그 문단에서 나왔다고 적어요.
 */
function sourceText(source: InterviewQuestion['source'], L: (typeof TEXT)['ko']): string {
  const skill = source.label.replace(/^(강점|부족|보완|strength|gap)\s*/i, '').trim() || source.label
  if (source.type === 'strength') return L.fromStrength(skill)
  if (source.type === 'gap') return L.fromGap(skill)
  if (source.type === 'paragraph') return L.fromParagraph(source.label)
  return source.label
}

/** 질문의 의도와 답변 포인트, 꼬리 질문이에요. 회색 줄 안의 흰 칸으로 펼쳐져요. */
function QuestionDetail({ question }: { question: InterviewQuestion }) {
  const L = useMessages(TEXT)
  return (
    <div className="animate-rise space-y-3 rounded-xl bg-white p-4">
      <div>
        <h3 className={label}>{L.intent}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-gray-700">{question.intent}</p>
      </div>
      <div>
        <h3 className={label}>{L.points}</h3>
        <Bullets items={question.answerPoints} brand className="mt-1" />
      </div>
      <div>
        <h3 className={label}>{L.followUp}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-gray-700">{question.followUp}</p>
      </div>
    </div>
  )
}

/**
 * 이 질문에 예전에 한 답변이에요. 최근 것부터 내 답, 점수, 이렇게 말해 보세요, 모범 답변(이렇게 답했으면 좋았어요)을 보여줘요.
 * 답변은 서버에 남아 있어서(`fetchAnswers`) 다른 기기에서도 보여요.
 */
function PastAnswers({ records }: { records: PracticeRecord[] }) {
  const L = useMessages(TEXT)
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
          {record.feedback.modelAnswer && <ModelAnswer text={record.feedback.modelAnswer} className="mt-3" />}
        </li>
      ))}
    </ol>
  )
}

/**
 * 질문 한 줄이에요. 프로그래머스나 LeetCode의 문제 목록처럼 왼쪽에 연습 상태(체크와 점수), 가운데에 질문과 출처, 오른쪽에 나올 확률과 펼치기 꺾쇠를 한 줄에 둬요.
 * 질문을 누르면 그 질문으로 면접 연습을 시작하고, 꺾쇠를 누르면 그 자리에서 의도, 답변 포인트, 꼬리 질문과 지난 답변이 펼쳐져요.
 */
function Row({ question, index, order, records, onPractice }: { question: InterviewQuestion; index: number; order: number; records: PracticeRecord[]; onPractice: () => void }) {
  const L = useMessages(TEXT)
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
                <CheckIcon className="size-3" strokeWidth={2.2} />
              </span>
              <span className="text-[11px] font-medium text-brand tabular-nums">{L.score(last.feedback.score)}</span>
            </>
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-[12px] font-semibold text-gray-500 tabular-nums">{index}</span>
          )}
        </span>
        {/* 질문을 누르면 바로 그 질문 하나로 면접 연습을 시작해요. 질문 글은 읽기 좋은 폭(약 70자)에서 줄을 바꿔요. */}
        <button type="button" onClick={onPractice} className="min-w-0 flex-1 text-left">
          <span className="block max-w-[68ch] text-[14.5px] leading-relaxed text-gray-900 transition-colors group-hover:text-brand">{question.question}</span>
          <span className="mt-1 block max-w-[68ch] truncate text-[12px] text-gray-400">{sourceText(question.source, L)}</span>
        </button>
        <Tip text={L.likelihood} className="mt-1 hidden shrink-0 sm:inline-flex">
          <span className="w-10 text-right text-[13px] font-medium text-gray-500 tabular-nums">{L.percent(Math.round(question.probability * 100))}</span>
        </Tip>
        {/* 의도와 답변 포인트, 지난 답변은 오른쪽 꺾쇠로 그 자리에서 펼쳐요. */}
        <Tip text={open ? L.hideDetail : L.showDetail} className="inline-flex shrink-0">
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? L.hideDetail : L.showDetail}
            onClick={() => {
              if (!open) track('question_expand', { id: question.id })
              setOpen((value) => !value)
            }}
            className="flex size-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700"
          >
            <ChevronDownIcon className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
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

/**
 * 지난 질문과 답변을 면접 연습의 결과 화면과 같은 검은 화면으로 보여줘요. 예상 질문을 새로 뽑기 전의 예전 질문 답변도 여기서 봐요.
 * 맨 위에 평균 점수 고리와 답변 수, 전체와 예전 질문만 고르는 칸이 있고, 답변은 날짜별로 묶어 최근 날짜부터 결과 카드(`ResultCard`)로 놓여요.
 */
function PastScreen({ records, current, onClose }: { records: PracticeRecord[]; current: Set<string>; onClose: () => void }) {
  const L = useMessages(TEXT)
  const [onlyOld, setOnlyOld] = useState(false)
  useDismiss(true, null, onClose)
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
  return createPortal(
    // 면접 연습처럼 검은 화면 안은 다크 모드 색으로 그려요.
    <div role="dialog" aria-modal="true" aria-labelledby="past-screen-title" className="dark fixed inset-0 z-[45] flex animate-fade flex-col overflow-hidden bg-[#000] text-white">
      <div aria-hidden className="interview-glow interview-glow-a opacity-50" />
      <div aria-hidden className="interview-glow interview-glow-b opacity-50" />
      <header data-app-drag={isApp || undefined} className={`relative flex shrink-0 items-center gap-3 px-4 sm:gap-4 sm:px-5 md:px-8 ${isApp ? 'pt-11' : 'pt-4 sm:pt-5'}`}>
        <button type="button" onClick={onClose} aria-label={L.close} className="flex size-10 items-center justify-center rounded-full bg-[#fff]/10 text-white transition-colors hover:bg-[#fff]/20">
          <CloseIcon className="size-4" strokeWidth={1.8} />
        </button>
      </header>
      <main className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-12 sm:px-6 md:px-12">
        <div className="mx-auto w-full max-w-3xl animate-rise pt-10">
          <div className="flex flex-col items-center text-center">
            {records.length > 0 && <ScoreRing score={average} />}
            {records.length > 0 && <p className="mt-2 text-[12.5px] text-[#fff]/50">{L.averageScore}</p>}
            <h1 id="past-screen-title" className="mt-5 text-[28px] font-bold tracking-tight text-white">
              {L.pastTitle}
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#fff]/55">{records.length > 0 ? L.pastSummary(records.length) : L.pastEmptyBody}</p>
            {records.length > 0 && (
              <div className="mt-6">
                <Segmented
                  label={L.pastFilter}
                  options={[
                    ['all', L.pastAll],
                    ['old', L.pastOld],
                  ] as const}
                  value={onlyOld ? 'old' : 'all'}
                  onChange={(value) => setOnlyOld(value === 'old')}
                />
              </div>
            )}
          </div>
          {records.length > 0 && list.length === 0 && <p className="mt-16 text-center text-[14px] text-[#fff]/45">{L.pastOldEmpty}</p>}
          <div className="mt-12 space-y-10">
            {days.map(({ day, items }) => (
              <section key={day}>
                <h2 className="mb-3 text-[13px] font-medium text-[#fff]/45">{day}</h2>
                <ol className="space-y-4">
                  {items.map((record, index) => (
                    <ResultCard
                      key={record.id}
                      order={index + 1}
                      question={record.question || <span className="text-[#fff]/45">{L.noQuestionText}</span>}
                      meta={
                        <>
                          <span>{formatDateTime(record.createdAt)}</span>
                          {!current.has(record.questionId) && <span className="rounded-full bg-[#fff]/10 px-2 py-0.5 text-[11.5px] font-medium text-[#fff]/70">{L.oldQuestion}</span>}
                        </>
                      }
                      answer={record.answer}
                      feedback={record.feedback}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>,
    document.body,
  )
}

/**
 * 예상 면접 질문 탭이에요. 서류 문단, 갭과 강점, 기업 기술 블로그, 기출 코퍼스에서 나온 질문을 나올 확률 순서로 보여줘요.
 * 질문마다 의도와 답변 포인트, 꼬리 질문을 펼쳐 보고, 하나씩 또는 전부 연습하러 가요.
 */
export function QuestionsTab({ reportId, onPractice }: { reportId: string; onPractice: (question?: string) => void }) {
  const L = useMessages(TEXT)
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

  /** 지금 목록에 있는 질문이에요. 지난 기록 칸이 예전 질문을 가려내요. */
  const currentIds = useMemo(() => new Set((questions ?? []).map((question) => question.id)), [questions])
  const list = questions ? questions.filter((question) => !category || question.category === category) : []
  // 연습한 질문과 질문마다 가장 최근 점수의 평균이에요. 답변 기록은 최근 것부터 와요.
  const practiced = questions ? questions.filter((question) => (records[question.id]?.length ?? 0) > 0) : []
  const average = practiced.length === 0 ? 0 : Math.round(practiced.reduce((sum, question) => sum + records[question.id][0].feedback.score, 0) / practiced.length)

  return (
    <div className="space-y-4">
      {/* 맨 위 한 줄에 유형 탭(수와 함께)과 연습 현황, 전체 연습 버튼을 둬요. 질문을 받기 전에는 비워 둬요. */}
      {questions && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* 휴대폰에서는 두 줄로 꺾지 않고 화면 가장자리까지 옆으로 넘겨요. */}
          <div role="radiogroup" aria-label={L.type} className="flex gap-1.5 [scrollbar-width:none] max-sm:-mx-4 max-sm:basis-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 sm:flex-wrap [&>*]:shrink-0">
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
          {/* 좁으면 아래 줄로 내려가요. 버튼 글자는 꺾이지 않게 해요. */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <span className="whitespace-nowrap text-[12.5px] text-gray-500 tabular-nums">{practiced.length > 0 ? L.progressCount(practiced.length, questions.length) : L.notYet}</span>
            {practiced.length > 0 && <span className="whitespace-nowrap text-[12.5px] font-medium text-brand tabular-nums">{L.average(average)}</span>}
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200/70" aria-label={L.progress}>
              <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${(practiced.length / Math.max(1, questions.length)) * 100}%` }} />
            </span>
            <button
              type="button"
              onClick={() => {
                track('questions_history_open', { count: allRecords.length })
                setShowPast(true)
              }}
              className={`${toolButton} whitespace-nowrap`}
            >
              <ClockIcon />
              {L.pastRecords}
              {allRecords.length > 0 && <span className="text-gray-400 tabular-nums">{allRecords.length}</span>}
            </button>
            <button type="button" onClick={() => askRegenerate('header')} className={`${toolButton} whitespace-nowrap`}>
              <RefreshIcon />
              {L.regenerate}
            </button>
            <button
              type="button"
              onClick={() => {
                track('practice_start', { from: 'all' })
                onPractice()
              }}
              className={`${primaryButton} whitespace-nowrap`}
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
        <Callout
          title={L.allDone}
          body={L.allDoneBody}
          action={
            <button type="button" onClick={() => askRegenerate('done')} className={primaryButton}>
              {L.regenerate}
            </button>
          }
        />
      )}
      {showPast && <PastScreen records={allRecords} current={currentIds} onClose={() => setShowPast(false)} />}
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
