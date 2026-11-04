import { useEffect, useMemo, useState } from 'react'
import { track } from '../../lib/analytics'
import { isSignedIn, useAuth } from '../../lib/auth'
import { fetchLabAnswers, gradeLabAnswer, requestLogin, type InterviewQuestion, type LabRecord } from '../../lib/gap'
import { messages, pick, useMessages } from '../../lib/i18n'
import { INTERVIEWERS } from '../../lib/interviewers'
import { readJson, writeJson } from '../../lib/storage'
import { TECH_QUESTIONS, type TechTrack } from '../../lib/techQuestions'
import { filterChip, filterRow, Notice } from '../GapParts'
import { Modal } from '../Dialog'
import { Dropdown } from '../Dropdown'
import { CheckIcon, ChevronRightIcon, ClockIcon, CloseButton, SearchIcon } from '../Icons'
import { Practice, type LabSession } from '../Practice'
import { PastScreen } from '../ReportQuestions'
import { primaryButton, quietButton, Segmented, toolButtonLg, useShowMore } from '../ui'

/**
 * 잡아따 Labs의 기술 면접 (/labs/tech-interview)이에요. 모아 둔 백엔드와 프론트엔드 기술 면접 질문(`techQuestions.ts`)으로 가상 면접을 봐요.
 * 맨 위에 검색창, 직군 메뉴, "기술 면접 시작하기" 버튼이 있고, 그 아래 분야 버튼 줄과 질문 목록이에요.
 * 시작하기를 누르면 창(`StartDialog`)에서 랜덤으로 뽑기(3, 5, 10개)와 직접 고르기 중 하나를 골라요. 랜덤은 지금 걸러진 질문을 섞어 뽑아 바로 면접 연습과 같은 가상 면접(`Practice`의 lab)을 열고,
 * 직접 고르기는 목록에 체크 칸이 생겨서 10개(`MAX_PICK`)까지 고른 뒤 아래에 붙은 줄의 "면접 시작하기"로 열어요. 평소에는 질문 줄을 누르면 그 질문 하나만 연습해요.
 * 채점은 서버가 리포트 없이 질문 글로 해서(`gradeLabAnswer`) 로그인해야 해요. 서버가 답과 피드백을 계정에 저장해서, "지난 기록"에서 예상 질문 탭과 같은 검은 화면(`PastScreen`)으로 다시 보고
 * 연습한 질문 줄에는 체크와 최근 점수가 붙어요. 고른 직군, 분야, 질문 수는 이 기기에 기억해요.
 */

const COUNTS = [3, 5, 10] as const
type Count = (typeof COUNTS)[number]
const SAVED_KEY = 'javadda:labs-interview'
/** 직접 고를 때 한 번에 고르는 질문 수의 끝이에요. */
const MAX_PICK = 10

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
    counts: (count: number) => `${count}개`,
    start: '기술 면접 시작하기',
    startTitle: '기술 면접 시작하기',
    randomTitle: '랜덤 질문',
    randomStart: (count: number) => `${count}개로 시작하기`,
    pickTitle: '직접 선택',
    pickBody: '가상 면접을 원하는 질문을 직접 선택합니다.',
    pickStart: '선택하기',
    picked: (count: number) => (count === 0 ? '면접에서 물을 질문을 골라 주세요' : `${count}개 골랐어요`),
    pickFull: `${MAX_PICK}개까지 고를 수 있어요`,
    pickBegin: '면접 시작하기',
    cancel: '취소',
    close: '닫기',
    topic: '분야',
    part: '파트',
    all: '전체',
    items: (count: number) => `${count.toLocaleString()}개의 질문`,
    title: (track: string) => `${track} 기술 면접`,
    back: '질문 목록으로',
    emptyTitle: '맞는 질문이 없어요',
    emptyBody: '다른 분야를 고르거나 검색어를 바꿔 보세요.',
    reset: '조건 초기화',
    past: '지난 기록',
    practiced: (done: number, total: number) => `${total}개 중 ${done}개 연습했어요`,
    score: (value: number) => `${value}점`,
  },
  en: {
    search: 'Find a question',
    track: 'Track',
    tracks: { backend: 'Backend', frontend: 'Frontend' } as Record<TechTrack, string>,
    count: 'Questions',
    counts: (count: number) => `${count}`,
    start: 'Start tech interview',
    startTitle: 'Start a tech interview',
    randomTitle: 'Random questions',
    randomStart: (count: number) => `Start with ${count}`,
    pickTitle: 'Choose yourself',
    pickBody: 'Choose the questions you want in your mock interview.',
    pickStart: 'Choose',
    picked: (count: number) => (count === 0 ? 'Pick the questions to be asked' : `${count} picked`),
    pickFull: `You can pick up to ${MAX_PICK}`,
    pickBegin: 'Start interview',
    cancel: 'Cancel',
    close: 'Close',
    topic: 'Topic',
    part: 'Part',
    all: 'All',
    items: (count: number) => `${count.toLocaleString()} questions`,
    title: (track: string) => `${track} tech interview`,
    back: 'Back to questions',
    emptyTitle: 'No questions match',
    emptyBody: 'Try another topic or search term.',
    reset: 'Reset filters',
    past: 'History',
    practiced: (done: number, total: number) => `${done} of ${total} practiced`,
    score: (value: number) => `${value} pts`,
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
  const signedIn = useAuth().tokens !== null
  /** 서버에 저장된 지난 답변이에요(최근 것부터). 면접을 마치고 닫을 때마다 다시 받아요. */
  const [records, setRecords] = useState<LabRecord[]>([])
  const [showPast, setShowPast] = useState(false)
  const [reload, setReload] = useState(0)
  /** 시작하기 창이 열려 있는지예요. */
  const [choosing, setChoosing] = useState(false)
  /** 직접 고르는 중이면 고른 질문의 아이디(고른 순서)예요. 고르는 중이 아니면 null이에요. */
  const [picking, setPicking] = useState<string[] | null>(null)

  useEffect(() => {
    if (!signedIn) return setRecords([])
    let stale = false
    void fetchLabAnswers().then((list) => {
      if (!stale) setRecords(list)
    })
    return () => {
      stale = true
    }
  }, [signedIn, reload])

  /** 질문마다 가장 최근 점수예요. 기록이 최근 것부터 와서 처음 본 것이 최근이에요. */
  const latest = useMemo(() => {
    const map = new Map<string, number>()
    for (const record of records) if (!map.has(record.questionId)) map.set(record.questionId, record.feedback.score)
    return map
  }, [records])

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
  const practicedCount = useMemo(() => shown.filter((item) => latest.has(item.id)).length, [shown, latest])
  const { count, more } = useShowMore(shown.length, `${saved.track}|${saved.topic}|${query}`)

  function open(picked: Item[], from: 'random' | 'pick' | 'question') {
    if (picked.length === 0) return
    // 채점은 서버의 AI가 해서 로그인해야 해요. 로그인하면 이 화면으로 돌아와요.
    if (!isSignedIn()) return requestLogin()
    track('labs_interview_start', { track: saved.track, topic: saved.topic ?? 'all', count: picked.length, from })
    setRound((value) => value + 1)
    setSession({
      title: L.title(L.tracks[saved.track]),
      questions: picked.map(asQuestion),
      grade: (question, answer, interviewer) => gradeLabAnswer(question.id, question.question, question.source.label, answer, interviewer),
      backLabel: L.back,
    })
  }

  /** 파트(백엔드, 프론트엔드)를 바꿔요. 화면 위의 메뉴와 시작 창이 같이 써요. 분야와 고르던 질문은 풀어요. */
  function changeTrack(value: TechTrack) {
    if (value === saved.track) return
    track('labs_interview_track', { track: value })
    update({ track: value, topic: null })
    setPicking((prev) => (prev ? [] : prev))
  }

  function togglePick(item: Item) {
    setPicking((prev) => {
      if (!prev) return prev
      if (prev.includes(item.id)) return prev.filter((id) => id !== item.id)
      return prev.length >= MAX_PICK ? prev : [...prev, item.id]
    })
  }

  function beginPicked() {
    if (!picking) return
    const byId = new Map(items.map((item) => [item.id, item]))
    open(picking.flatMap((id) => byId.get(id) ?? []), 'pick')
    setPicking(null)
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
          label={L.part}
          value={L.tracks[saved.track]}
          groups={[
            {
              items: (['backend', 'frontend'] as const).map((value) => ({
                label: L.tracks[value],
                checked: saved.track === value,
                onSelect: () => changeTrack(value),
              })),
            },
          ]}
        />
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => {
            // 채점은 서버의 AI가 해서 로그인해야 해요. 로그인하면 이 화면으로 돌아와요.
            if (!isSignedIn()) return requestLogin()
            setChoosing(true)
          }}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
        >
          {L.start}
          <ChevronRightIcon className="size-4" strokeWidth={2} />
        </button>
        {signedIn && (
          <button
            type="button"
            onClick={() => {
              track('labs_interview_history_open', { count: records.length })
              setShowPast(true)
            }}
            className={`${toolButtonLg} whitespace-nowrap`}
          >
            <ClockIcon />
            {L.past}
            {records.length > 0 && <span className="text-gray-400 tabular-nums">{records.length}</span>}
          </button>
        )}
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

      <p className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[13px] text-gray-500">
        <span>{L.items(shown.length)}</span>
        {practicedCount > 0 && <span className="text-brand">{L.practiced(practicedCount, shown.length)}</span>}
      </p>

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
            {shown.slice(0, count).map((item, order) => {
              const chosen = picking?.includes(item.id) ?? false
              const full = !!picking && !chosen && picking.length >= MAX_PICK
              return (
              <li key={item.id}>
                <button
                  type="button"
                  role={picking ? 'checkbox' : undefined}
                  aria-checked={picking ? chosen : undefined}
                  disabled={full}
                  onClick={() => (picking ? togglePick(item) : open([item], 'question'))}
                  className={`group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl disabled:opacity-40 sm:px-5 ${chosen ? 'bg-brand-soft' : 'hover:bg-gray-100'}`}
                >
                  {picking ? (
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${chosen ? 'border-brand bg-brand' : 'border-gray-300 bg-white'}`}>
                      {chosen && <CheckIcon className="size-3.5 text-white" strokeWidth={2.2} />}
                    </span>
                  ) : latest.has(item.id) ? (
                    <span className="flex w-7 shrink-0 flex-col items-start">
                      <CheckIcon className="size-4 text-brand" strokeWidth={2} />
                      <span className="text-[11px] font-semibold text-brand tabular-nums">{latest.get(item.id)}</span>
                    </span>
                  ) : (
                    <span className="w-7 shrink-0 text-[13px] text-gray-400 tabular-nums">{order + 1}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] leading-snug font-medium break-keep text-gray-900 transition-colors group-hover:text-brand">{item.question}</span>
                    {!saved.topic && <span className="mt-1 block text-[12.5px] text-gray-500">{item.topic}</span>}
                  </span>
                  {picking ? (
                    chosen && <span className="shrink-0 text-[12.5px] font-semibold text-brand tabular-nums">{picking.indexOf(item.id) + 1}</span>
                  ) : (
                    <>
                      <ChevronRightIcon className="size-4 shrink-0 text-gray-400 transition-colors group-hover:text-brand" strokeWidth={1.8} />
                    </>
                  )}
                </button>
              </li>
              )
            })}
          </ul>
          {more}
        </>
      )}

      {/* 직접 고르는 동안 아래에 붙어 있어서, 목록이 길어도 시작 버튼을 찾지 않아요. 스크롤 칸의 아래 여백만큼 내려 화면 맨 아래에 붙여요. */}
      {picking && (
        <div className="sticky bottom-[-4rem] z-10 mt-6 flex items-center gap-3 border-t border-gray-200 bg-white py-4">
          <p className={`min-w-0 flex-1 text-[13px] ${picking.length >= MAX_PICK ? 'text-brand' : 'text-gray-500'}`}>{picking.length >= MAX_PICK ? L.pickFull : L.picked(picking.length)}</p>
          <button type="button" onClick={() => setPicking(null)} className={quietButton}>
            {L.cancel}
          </button>
          <button type="button" disabled={picking.length === 0} onClick={beginPicked} className={primaryButton}>
            {L.pickBegin}
          </button>
        </div>
      )}

      {choosing && (
        <StartDialog
          part={saved.track}
          onPart={changeTrack}
          total={shown.length}
          count={saved.count}
          onCount={(value) => update({ count: value })}
          onRandom={() => {
            setChoosing(false)
            open(shuffled(shown).slice(0, saved.count), 'random')
          }}
          onPick={() => {
            setChoosing(false)
            track('labs_interview_pick_open')
            setPicking([])
          }}
          onClose={() => setChoosing(false)}
        />
      )}

      {session && (
        <Practice
          key={round}
          lab={session}
          onBack={() => {
            setSession(null)
            setReload((value) => value + 1)
          }}
        />
      )}
      {showPast && (
        <PastScreen
          records={records}
          tags={(record) => (
            <span className="rounded-full bg-[#fff]/10 px-2 py-0.5 text-[11.5px] font-medium text-[#fff]/70">
              {[record.topic, pick(INTERVIEWERS.find((each) => each.key === record.interviewer)?.name ?? INTERVIEWERS[0].name)].filter(Boolean).join(', ')}
            </span>
          )}
          onClose={() => setShowPast(false)}
        />
      )}
    </div>
  )
}

/**
 * 기술 면접 시작하기 창이에요. 맨 위에서 파트(백엔드, 프론트엔드)를 고르고, 그 아래 랜덤 질문과 직접 선택을 큰 회색 칸 두 개로 나란히 보여줘요.
 * 랜덤 질문 칸에는 질문 수(3, 5, 10개)를 고르는 칸과 바로 시작하는 버튼이 있고(고른 파트에서 지금 고른 분야와 검색어 안의 질문을 섞어요), 직접 선택 칸에는 목록에서 고르러 가는 버튼이 있어요.
 */
function StartDialog({ part, onPart, total, count, onCount, onRandom, onPick, onClose }: {
  part: TechTrack
  onPart: (part: TechTrack) => void
  total: number
  count: Count
  onCount: (count: Count) => void
  onRandom: () => void
  onPick: () => void
  onClose: () => void
}) {
  const L = useMessages(TEXT)
  const counts = COUNTS.filter((value) => value <= total || value === COUNTS[0])
  const size = Math.min(count, total)
  return (
    <Modal onClose={onClose} labelledBy="tech-interview-start" className="w-full max-w-xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="tech-interview-start" className="text-[18px] font-bold text-gray-900">
          {L.startTitle}
        </h2>
        <CloseButton onClick={onClose} label={L.close} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="text-[13px] font-medium text-gray-500">{L.part}</span>
        <Segmented
          label={L.part}
          options={(['backend', 'frontend'] as const).map((value) => [value, L.tracks[value]] as const)}
          value={part}
          onChange={onPart}
          size="md"
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <section className="flex flex-col rounded-2xl bg-gray-50 p-4 sm:p-5">
          <h3 className="text-[15px] font-semibold text-gray-900">{L.randomTitle}</h3>
          <div className="flex-1" />
          <Segmented label={L.count} options={counts.map((value) => [value, L.counts(value)] as const)} value={count} onChange={onCount} size="md" className="mt-3 self-start" />
          <button type="button" onClick={onRandom} className={`${primaryButton} mt-3 w-full`}>
            {L.randomStart(size)}
          </button>
        </section>
        <section className="flex flex-col rounded-2xl bg-gray-50 p-4 sm:p-5">
          <h3 className="text-[15px] font-semibold text-gray-900">{L.pickTitle}</h3>
          <p className="mt-1 flex-1 text-[13px] leading-relaxed break-keep text-gray-500">{L.pickBody}</p>
          <button type="button" onClick={onPick} className={`${primaryButton} mt-4 w-full`}>
            {L.pickStart}
          </button>
        </section>
      </div>
    </Modal>
  )
}
