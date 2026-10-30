import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchQuestions, PROGRESS_START, type InterviewQuestion, type ProgressState, type QuestionCategory } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { Dropdown } from './Dropdown'
import { AiProgress, Failed, Notice } from './GapParts'
import { Bullets, ghostButton, label, primaryButton, stagger, tag, toolButton } from './ui'

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
    count: (count: number) => `${count} ${count === 1 ? 'question' : 'questions'}`,
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

function Card({ question, order, onPractice }: { question: InterviewQuestion; order: number; onPractice: () => void }) {
  const L = useMessages(QUESTION_TEXT)
  const [open, setOpen] = useState(false)
  return (
    <li className="animate-rise rounded-2xl bg-gray-50 p-5" style={stagger(order)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Probability value={question.probability} />
        <span className={tag}>{L.categories[question.category]}</span>
        <span className="text-[12px] text-gray-400">{L.source(question.source.label)}</span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed font-semibold text-gray-900">{question.question}</p>
      {open && <QuestionDetail question={question} className="mt-4" />}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            if (!open) track('question_expand', { id: question.id })
            setOpen((value) => !value)
          }}
          className={`${ghostButton} -ml-2`}
        >
          {open ? L.hide : L.show}
        </button>
        <button type="button" onClick={onPractice} className={toolButton}>
          {L.practiceOne}
        </button>
      </div>
    </li>
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
  /** 마지막으로 보낸 요청이에요. 앞의 요청이 늦게 끝나도 화면을 덮지 않게 해요. */
  const latest = useRef(0)

  async function load() {
    const request = ++latest.current
    setQuestions(undefined)
    setProgress(PROGRESS_START)
    const list = await fetchQuestions(reportId, (next) => {
      if (request === latest.current) setProgress(next)
    })
    if (request === latest.current) setQuestions(list.length > 0 ? list : null)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  const list = questions ? questions.filter((question) => !category || question.category === category) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          label={L.type}
          value={category ? L.categories[category] : L.all}
          groups={[
            {
              items: [null, ...CATEGORIES].map((value) => ({
                label: value ? L.categories[value] : L.all,
                checked: category === value,
                onSelect: () => {
                  track('questions_filter', { category: value ?? 'all' })
                  setCategory(value)
                },
              })),
            },
          ]}
        />
        {questions && <span className="text-[13px] text-gray-500 tabular-nums">{L.count(list.length)}</span>}
        <button
          type="button"
          disabled={!questions}
          onClick={() => {
            track('practice_start', { from: 'all' })
            onPractice()
          }}
          className={`${primaryButton} ml-auto`}
        >
          {L.practiceAll}
        </button>
      </div>

      {questions === undefined ? (
        // AI가 질문을 만드는 동안은 진행 정도를 막대로 보여줘요. 이미 만들어 둔 질문이면 금방 지나가요.
        <AiProgress progress={progress.progress} stage={progress.stage} className="mx-auto mt-16 w-full max-w-md" />
      ) : questions === null ? (
        <Failed onRetry={() => void load()} className="mt-16" />
      ) : (
        <ul className="space-y-3">
          {list.map((question, order) => (
            <Card
              key={question.id}
              question={question}
              order={order}
              onPractice={() => {
                track('practice_start', { from: 'question' })
                onPractice(question.id)
              }}
            />
          ))}
        </ul>
      )}
      {questions && list.length === 0 && <Notice title={L.count(0)} className="mt-16" />}
    </div>
  )
}
