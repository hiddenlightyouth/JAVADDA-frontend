import { useMemo, useState } from 'react'
import { track } from '../../lib/analytics'
import { isSignedIn } from '../../lib/auth'
import { gradeLabAnswer, requestLogin, type InterviewQuestion } from '../../lib/gap'
import { messages, useMessages } from '../../lib/i18n'
import { readJson, writeJson } from '../../lib/storage'
import { TECH_QUESTIONS, type TechTrack } from '../../lib/techQuestions'
import { Dropdown } from '../Dropdown'
import { filterChip, filterRow, Notice } from '../GapParts'
import { ChevronRightIcon, SearchIcon } from '../Icons'
import { Practice, type LabSession } from '../Practice'
import { useShowMore } from '../ui'

/**
 * 잡아따 Labs의 기술 면접 (/labs/tech-interview)이에요. 모아 둔 백엔드와 프론트엔드 기술 면접 질문(`techQuestions.ts`)으로 가상 면접을 봐요.
 * 맨 위에 검색창, 직군과 질문 수 메뉴, "가상 면접 시작" 버튼이 있고, 그 아래 분야 버튼 줄과 질문 목록이에요.
 * 시작하면 지금 걸러진 질문 중에서 고른 수만큼 섞어 뽑아 면접 연습과 같은 가상 면접(`Practice`의 lab)을 열어요. 질문 줄을 누르면 그 질문 하나만 연습해요.
 * 채점은 서버가 리포트 없이 질문 글로 해서(`gradeLabAnswer`) 로그인해야 해요. 고른 직군, 분야, 질문 수는 이 기기에 기억해요.
 */

const COUNTS = [3, 5, 10] as const
type Count = (typeof COUNTS)[number]
const SAVED_KEY = 'javadda:labs-interview'

interface Saved {
  track: TechTrack
  topic: string | null
  count: Count
}

const TEXT = messages({
  ko: {
    search: '질문 찾기',
    track: '직군',
    tracks: { backend: '백엔드', frontend: '프론트엔드' } as Record<TechTrack, string>,
    count: '질문 수',
    counts: (count: number) => `질문 ${count}개`,
    start: '가상 면접 시작',
    topic: '분야',
    all: '전체',
    items: (count: number) => `${count.toLocaleString()}개의 질문`,
    practice: '이 질문 연습',
    title: (track: string) => `${track} 기술 면접`,
    back: '질문 목록으로',
    emptyTitle: '맞는 질문이 없어요',
    emptyBody: '다른 분야를 고르거나 검색어를 바꿔 보세요.',
    reset: '조건 초기화',
  },
  en: {
    search: 'Find a question',
    track: 'Track',
    tracks: { backend: 'Backend', frontend: 'Frontend' } as Record<TechTrack, string>,
    count: 'Questions',
    counts: (count: number) => `${count} questions`,
    start: 'Start mock interview',
    topic: 'Topic',
    all: 'All',
    items: (count: number) => `${count.toLocaleString()} questions`,
    practice: 'Practice this',
    title: (track: string) => `${track} tech interview`,
    back: 'Back to questions',
    emptyTitle: 'No questions match',
    emptyBody: 'Try another topic or search term.',
    reset: 'Reset filters',
  },
})

function loadSaved(): Saved {
  const saved = readJson<Partial<Saved> | null>(SAVED_KEY, null)
  const trackValue: TechTrack = saved?.track === 'frontend' ? 'frontend' : 'backend'
  const topic = saved?.topic && TECH_QUESTIONS[trackValue].some((each) => each.name === saved.topic) ? saved.topic : null
  const count = COUNTS.includes(saved?.count as Count) ? (saved?.count as Count) : 5
  return { track: trackValue, topic, count }
}

interface Item {
  id: string
  question: string
  topic: string
}

/** 가상 면접이 읽는 질문 모양으로 바꿔요. 의도와 답변 포인트는 서버의 AI가 채점하면서 스스로 떠올려요. */
function asQuestion(item: Item): InterviewQuestion {
  return {
    id: item.id,
    question: item.question,
    category: 'tech',
    probability: 0,
    source: { type: 'corpus', label: item.topic },
    intent: '',
    answerPoints: [],
    followUp: '',
  }
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list]
  for (let at = copy.length - 1; at > 0; at -= 1) {
    const other = Math.floor(Math.random() * (at + 1))
    ;[copy[at], copy[other]] = [copy[other], copy[at]]
  }
  return copy
}

export function TechInterview() {
  const L = useMessages(TEXT)
  const [saved, setSaved] = useState(loadSaved)
  const [query, setQuery] = useState('')
  const [session, setSession] = useState<LabSession | null>(null)
  /** 같은 질문으로 다시 열어도 면접을 처음부터 그리게 열 때마다 올려요. */
  const [round, setRound] = useState(0)

  const update = (next: Partial<Saved>) => {
    const value = { ...saved, ...next }
    setSaved(value)
    writeJson(SAVED_KEY, value)
  }

  const topics = TECH_QUESTIONS[saved.track]
  const items = useMemo<Item[]>(() => topics.flatMap((each) => each.questions.map(([id, question]) => ({ id, question, topic: each.name }))), [topics])
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return items.filter((item) => (!saved.topic || item.topic === saved.topic) && words.every((word) => item.question.toLowerCase().includes(word)))
  }, [items, saved.topic, query])
  const { count, more } = useShowMore(shown.length, `${saved.track}|${saved.topic}|${query}`)

  function open(picked: Item[], from: 'start' | 'question') {
    if (picked.length === 0) return
    // 채점은 서버의 AI가 해서 로그인해야 해요. 로그인하면 이 화면으로 돌아와요.
    if (!isSignedIn()) return requestLogin()
    track('labs_interview_start', { track: saved.track, topic: saved.topic ?? 'all', count: picked.length, from })
    setRound((value) => value + 1)
    setSession({
      title: L.title(L.tracks[saved.track]),
      questions: picked.map(asQuestion),
      grade: (question, answer, interviewer) => gradeLabAnswer(question.question, question.source.label, answer, interviewer),
      backLabel: L.back,
    })
  }

  return (
    <div className="@container">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-11 min-w-0 flex-1 basis-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 transition-colors focus-within:border-brand @2xl:basis-0">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={L.search}
            aria-label={L.search}
            data-search-input
            className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-[14px] [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <Dropdown
          size="lg"
          label={L.track}
          value={L.tracks[saved.track]}
          groups={[
            {
              items: (['backend', 'frontend'] as const).map((value) => ({
                label: L.tracks[value],
                checked: saved.track === value,
                onSelect: () => {
                  track('labs_interview_track', { track: value })
                  update({ track: value, topic: null })
                },
              })),
            },
          ]}
        />
        <Dropdown
          size="lg"
          label={L.count}
          value={L.counts(saved.count)}
          groups={[{ items: COUNTS.map((value) => ({ label: L.counts(value), checked: saved.count === value, onSelect: () => update({ count: value }) })) }]}
        />
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => open(shuffled(shown).slice(0, saved.count), 'start')}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
        >
          {L.start}
          <ChevronRightIcon className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div role="radiogroup" aria-label={L.topic} className={`mt-4 ${filterRow}`}>
        <button type="button" role="radio" aria-checked={!saved.topic} onClick={() => update({ topic: null })} className={`${filterChip(!saved.topic)} px-5`}>
          {L.all}
        </button>
        {topics.map((each) => (
          <button
            key={each.name}
            type="button"
            role="radio"
            aria-checked={saved.topic === each.name}
            onClick={() => {
              const next = saved.topic === each.name ? null : each.name
              track('labs_interview_topic', { topic: next ?? 'all' })
              update({ topic: next })
            }}
            className={`${filterChip(saved.topic === each.name)} px-5`}
          >
            {each.name}
          </button>
        ))}
      </div>

      <p className="mt-6 text-[13px] text-gray-500">{L.items(shown.length)}</p>

      {shown.length === 0 ? (
        <Notice
          title={L.emptyTitle}
          body={L.emptyBody}
          action={L.reset}
          onAction={() => {
            setQuery('')
            update({ topic: null })
          }}
          className="mt-16"
        />
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-200/70 rounded-2xl bg-gray-50">
            {shown.slice(0, count).map((item, order) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open([item], 'question')}
                  className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-gray-100 sm:px-5"
                >
                  <span className="w-7 shrink-0 text-[13px] text-gray-400 tabular-nums">{order + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] leading-snug font-medium break-keep text-gray-900 transition-colors group-hover:text-brand">{item.question}</span>
                    {!saved.topic && <span className="mt-1 block text-[12.5px] text-gray-500">{item.topic}</span>}
                  </span>
                  <span className="hidden shrink-0 text-[12.5px] font-medium text-gray-400 transition-colors group-hover:text-brand sm:block">{L.practice}</span>
                  <ChevronRightIcon className="size-4 shrink-0 text-gray-400 transition-colors group-hover:text-brand" strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
          {more}
        </>
      )}

      {session && <Practice key={round} lab={session} onBack={() => setSession(null)} />}
    </div>
  )
}
