import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { COMPANIES, companyOf, fetchPostings, fitOf, useReports, useResume, type JobPosting } from '../lib/gap'
import { holidayOf } from '../lib/holidays'
import { getLang, messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { PageHeader, ScrollPage } from './AppPage'
import { CompanyFilter, CompanyMark, Failed, FitTag, PostingMeta, usePickConfirm } from './GapParts'
import { ChevronRightIcon } from './Icons'
import { Badge, iconButton, loadCenter, LoadProgress, Segmented, toolButton } from './ui'

/**
 * 마감 달력이에요. 공고의 마감일을 달력에 놓아서, 어느 기업의 어떤 공고가 언제 마감인지 한눈에 봐요.
 * 날짜 칸에는 그날 마감하는 공고를 기업 로고와 제목으로 몇 개까지 적고, 날짜를 누르면 아래에 그날의 공고를 모두 보여줘요.
 * 기업으로 거르고, 진단한 공고만 볼 수도 있어요. 상시 채용(마감 없음)은 올라온 날부터 계속 열려 있어서,
 * 날짜 칸마다 그날 열려 있던 상시 채용 수를 날짜 옆에 작게 적어요. 날짜를 고르면 아래에 그날 마감하는 공고와 그날 열려 있던 상시 채용 공고를 함께 보여줘요.
 * 공고를 누르면 해당 공고로 이동할지 한 번 더 묻고, 진단으로 가요(이미 진단했으면 그 리포트로 가요).
 */

const TEXT = messages({
  ko: {
    title: '마감 달력',
    month: (year: number, month: number) => `${year}년 ${month + 1}월`,
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
    prev: '이전 달',
    next: '다음 달',
    today: '오늘',
    company: '기업',
    scope: '보기',
    scopes: { all: '전체 공고', diagnosed: '진단한 공고' } as Record<Scope, string>,
    always: (count: number) => `${count}개의 상시 채용`,
    alwaysShort: (count: number) => `상시 ${count}`,
    alwaysTitle: (month: number, date: number) => `${month + 1}월 ${date}일 상시 채용`,
    more: (count: number) => `${count}개 더`,
    day: (month: number, date: number) => `${month + 1}월 ${date}일 마감`,
    dayEmpty: '정보를 찾을 수 없음',
    diagnosed: '진단함',
    pick: (title: string) => `${title} 진단하기`,
  },
  en: {
    title: 'Deadlines',
    month: (year: number, month: number) => new Date(year, month, 1).toLocaleDateString('en', { year: 'numeric', month: 'long' }),
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    prev: 'Previous month',
    next: 'Next month',
    today: 'Today',
    company: 'Company',
    scope: 'Show',
    scopes: { all: 'All postings', diagnosed: 'Diagnosed' },
    always: (count: number) => `${count} rolling`,
    alwaysShort: (count: number) => `+${count}`,
    alwaysTitle: (month: number, date: number) => `Rolling on ${new Date(2000, month, date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
    more: (count: number) => `${count} more`,
    day: (month: number, date: number) => `Closing ${new Date(2000, month, date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
    dayEmpty: 'No information found',
    diagnosed: 'Diagnosed',
    pick: (title: string) => `Diagnose ${title}`,
  },
})

type Scope = 'all' | 'diagnosed'
const SCOPES: Scope[] = ['all', 'diagnosed']

/** 날짜 칸에 적는 공고 수예요. 나머지는 수만 적어요. */
const SHOWN_PER_DAY = 3

type Loaded = JobPosting[] | 'failed'

/** 이 기기의 날짜로 2026-10-31 같은 열쇠를 만들어요. 마감 시각이 어느 날짜 칸에 들어갈지 정할 때 써요. */
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/**
 * 달력에 그릴 날짜들이에요. 그달 1일이 있는 주의 일요일부터 늘 6주(42일)예요.
 * 달마다 줄 수가 바뀌지 않고, 월말에도 다음 달 첫 주의 마감이 같이 보여요.
 */
function monthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - first.getDay() + index))
}

export function DeadlineCalendar({ onPick }: { onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const reports = useReports()
  const now = new Date()
  const todayKey = dayKey(now)
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [company, setCompany] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const [selected, setSelected] = useState<string>(todayKey)
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const load = useLoadProgress()

  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    void fetchPostings({}, load.one()).then(
      (list) => {
        if (!stale) setLoaded(list)
      },
      () => {
        if (!stale) setLoaded('failed')
      },
    )
    return () => {
      stale = true
    }
  }, [attempt, load.one])
  const waiting = useLoadHold(loaded === undefined)

  const diagnosed = useMemo(() => new Set(reports.map((report) => report.postingId)), [reports])
  /** 처음 받았을 때 한 번만 가장 가까운 마감으로 옮겨요. 그 뒤로는 사용자가 넘긴 달을 그대로 둬요. */
  const placed = useRef(false)

  // 고른 조건의 공고를 마감 날짜마다 모아요. 같은 날은 마감 시각이 이른 것부터예요.
  const { byDay, always } = useMemo(() => {
    const byDay = new Map<string, JobPosting[]>()
    const always: { posting: JobPosting; from: string }[] = []
    if (!Array.isArray(loaded)) return { byDay, always }
    for (const posting of loaded) {
      if (company && posting.companyId !== company) continue
      if (scope === 'diagnosed' && !diagnosed.has(posting.id)) continue
      if (!posting.deadline) {
        always.push({ posting, from: dayKey(new Date(posting.postedAt)) })
        continue
      }
      const key = dayKey(new Date(posting.deadline))
      byDay.set(key, [...(byDay.get(key) ?? []), posting])
    }
    for (const list of byDay.values()) list.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    return { byDay, always }
  }, [loaded, company, scope, diagnosed])

  // 처음 열면 오늘부터 가장 가까운 마감이 있는 달과 날짜를 골라 둬요. 이번 달에 남은 마감이 없으면 빈 달력만 보여서 이상해 보였어요.
  useEffect(() => {
    if (placed.current || !Array.isArray(loaded)) return
    placed.current = true
    const upcoming = [...byDay.keys()].filter((key) => key >= todayKey).sort()[0]
    if (!upcoming) return
    const date = new Date(`${upcoming}T00:00:00`)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
    setSelected(upcoming)
  }, [loaded, byDay, todayKey])

  const days = monthDays(cursor.year, cursor.month)
  const monthCount = days.filter((day) => day.getMonth() === cursor.month).reduce((sum, day) => sum + (byDay.get(dayKey(day))?.length ?? 0), 0)
  /** 그날 열려 있던 상시 채용 공고예요. 올라온 날부터 쳐요. */
  const alwaysOn = (key: string) => always.filter((item) => item.from <= key).map((item) => item.posting)
  const selectedDate = new Date(`${selected}T00:00:00`)
  const selectedList = byDay.get(selected) ?? []
  const selectedAlways = alwaysOn(selected)
  // 상시 채용 수를 누르면 그 날짜를 고르고 아래의 상시 채용 목록으로 내려가요.
  const alwaysRef = useRef<HTMLElement>(null)

  function moveMonth(step: number) {
    const next = new Date(cursor.year, cursor.month + step, 1)
    setCursor({ year: next.getFullYear(), month: next.getMonth() })
    // 오늘이 있는 달로 오면 오늘을, 아니면 그달 1일을 골라 둬요.
    setSelected(next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth() ? todayKey : dayKey(next))
    track('calendar_month_change', { step })
  }

  function goToday() {
    setCursor({ year: now.getFullYear(), month: now.getMonth() })
    setSelected(todayKey)
  }

  // 공고를 누르면 바로 가지 않고 한 번 더 물어요.
  const confirmPick = usePickConfirm()
  function pick(posting: JobPosting, from: 'cell' | 'list') {
    confirmPick.ask(posting, () => {
      track('posting_select', { posting: posting.id, from: `calendar-${from}` })
      onPick(posting.id)
    })
  }

  return (
    <ScrollPage header={<PageHeader title={L.title} />} className="@container">
      <CompanyFilter companies={COMPANIES} value={company} label={L.company} onChange={setCompany} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" aria-label={L.prev} onClick={() => moveMonth(-1)} className={`${iconButton.md} size-9! border border-gray-200 bg-white`}>
          <ChevronRightIcon className="size-4 rotate-180" />
        </button>
        <h2 className="min-w-28 text-center text-[17px] font-semibold text-gray-900 tabular-nums">{L.month(cursor.year, cursor.month)}</h2>
        <button type="button" aria-label={L.next} onClick={() => moveMonth(1)} className={`${iconButton.md} size-9! border border-gray-200 bg-white`}>
          <ChevronRightIcon className="size-4" />
        </button>
        <button type="button" onClick={goToday} className={toolButton}>
          {L.today}
        </button>
        <span className="ml-auto">
          <Segmented size="md" label={L.scope} value={scope} options={SCOPES.map((value) => [value, L.scopes[value]] as const)} onChange={setScope} />
        </span>
      </div>

      <div className="mt-4">
        {waiting || loaded === undefined ? (
          <LoadProgress percent={load.percent} className={loadCenter} />
        ) : loaded === 'failed' ? (
          <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
        ) : (
          // 넓은 화면에서는 달력을 왼쪽에 두고, 고른 날짜의 공고를 오른쪽 칸에 나란히 둬요. 좁으면 달력 아래로 내려가요.
          // 달력과 오른쪽 칸은 저마다 @container라, 안의 칸과 줄은 화면 폭이 아니라 자기 폭을 보고 글자를 줄여요.
          <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_360px] @5xl:items-start @7xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="@container overflow-hidden rounded-2xl border border-gray-200">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                {L.weekdays.map((name, index) => (
                  <span key={name} className={`py-2 text-center text-[12px] font-medium ${index === 0 ? 'text-red-500' : index === 6 ? 'text-brand' : 'text-gray-500'}`}>
                    {name}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, index) => {
                  const key = dayKey(day)
                  const list = byDay.get(key) ?? []
                  const inMonth = day.getMonth() === cursor.month
                  const past = key < todayKey
                  const isSelected = key === selected
                  const holiday = holidayOf(key)
                  const alwaysCount = inMonth ? alwaysOn(key).length : 0
                  // 일요일과 공휴일은 빨간색, 토요일은 메인 컬러예요. 지난 날은 흐리게 둬요.
                  const tone = holiday || day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-brand' : 'text-gray-800'
                  return (
                    // 칸 전체가 날짜를 고르는 자리이고, 안의 공고 이름표는 바로 진단으로 가요.
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${L.day(day.getMonth(), day.getDate())} ${list.length}`}
                      onClick={() => setSelected(key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelected(key)
                        }
                      }}
                      className={`flex min-h-20 cursor-pointer flex-col gap-1 p-1.5 text-left transition-colors outline-none focus-visible:bg-brand-soft @3xl:min-h-28 ${index % 7 !== 6 ? 'border-r' : ''} ${
                        index < days.length - 7 ? 'border-b' : ''
                      } border-gray-200 ${isSelected ? 'bg-brand-soft/60' : inMonth ? 'hover:bg-gray-50' : 'bg-gray-50/60 hover:bg-gray-100/60'}`}
                    >
                      <span className="flex min-w-0 items-center gap-0.5 @3xl:gap-1">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12.5px] tabular-nums ${
                            key === todayKey ? 'bg-brand font-semibold text-white' : inMonth ? `${tone} ${past ? 'opacity-50' : ''}` : 'text-gray-300'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {holiday && inMonth && getLang() === 'ko' && <span className={`hidden min-w-0 truncate text-[10.5px] text-red-400 @3xl:inline ${past ? 'opacity-50' : ''}`}>{holiday}</span>}
                        {/* 그날 열려 있던 상시 채용 수예요. 누르면 아래에 그 공고들이 나와요. */}
                        {alwaysCount > 0 && (
                          <button
                            type="button"
                            data-no-press
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelected(key)
                              requestAnimationFrame(() => alwaysRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                            }}
                            className={`ml-auto min-w-0 shrink-0 rounded px-0.5 text-[10px] whitespace-nowrap tabular-nums @3xl:px-1 @3xl:text-[10.5px] transition-colors ${
                              isSelected ? 'text-brand-hover' : 'text-gray-400 hover:text-gray-700'
                            } ${past ? 'opacity-50' : ''}`}
                          >
                            <span className="@3xl:hidden">{L.alwaysShort(alwaysCount)}</span>
                            <span className="hidden @3xl:inline">{L.always(alwaysCount)}</span>
                          </button>
                        )}
                      </span>
                      {/* 좁은 화면에서는 이름표 대신 점과 수만 보여요. */}
                      {list.length > 0 && (
                        <span className="flex items-center gap-1 px-1 @3xl:hidden">
                          <span className={`size-1.5 rounded-full ${past ? 'bg-gray-300' : 'bg-brand'}`} />
                          <span className="text-[11px] text-gray-500 tabular-nums">{list.length}</span>
                        </span>
                      )}
                      <span className={`hidden flex-col gap-1 @3xl:flex ${past ? 'opacity-50' : ''}`}>
                        {list.slice(0, SHOWN_PER_DAY).map((posting) => (
                          <button
                            key={posting.id}
                            type="button"
                            data-no-press
                            title={`${companyOf(posting.companyId).name} · ${posting.title}`}
                            aria-label={L.pick(posting.title)}
                            onClick={(event) => {
                              event.stopPropagation()
                              pick(posting, 'cell')
                            }}
                            className={`flex h-6 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] transition-colors ${
                              diagnosed.has(posting.id) ? 'bg-brand-soft text-brand-hover hover:bg-brand-soft/70' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <CompanyMark company={companyOf(posting.companyId)} className="size-4 rounded-[4px]! text-[8px]" />
                            <span className="min-w-0 truncate">{posting.title}</span>
                          </button>
                        ))}
                        {list.length > SHOWN_PER_DAY && <span className="px-1.5 text-[11.5px] text-gray-500 tabular-nums">{L.more(list.length - SHOWN_PER_DAY)}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 오른쪽 칸은 달력 옆에 멈춰 있고, 공고가 많으면 칸 안에서 스크롤해요. */}
            <div className="@container flex flex-col gap-8 @5xl:sticky @5xl:top-0 @5xl:max-h-[calc(100dvh-10rem)] @5xl:overflow-y-auto">
              {/* 고른 날짜에 마감하는 공고예요. 그달에 마감이 하나도 없으면 칸째 두지 않아요. */}
              {monthCount > 0 && (
                <section>
                  <h2 className="text-[16px] font-semibold text-gray-900">{L.day(selectedDate.getMonth(), selectedDate.getDate())}</h2>
                  {selectedList.length === 0 ? (
                    <p className="mt-3 text-[13.5px] text-gray-500">{L.dayEmpty}</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {selectedList.map((posting) => (
                        <DayRow key={posting.id} posting={posting} fit={fitOf(posting, resume)} diagnosed={diagnosed.has(posting.id)} onOpen={() => pick(posting, 'list')} />
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* 고른 날짜에 열려 있던 상시 채용 공고예요. */}
              {selectedAlways.length > 0 && (
                <section ref={alwaysRef} className="scroll-mt-4">
                  <h2 className="text-[16px] font-semibold text-gray-900">
                    {L.alwaysTitle(selectedDate.getMonth(), selectedDate.getDate())} <span className="text-gray-400 tabular-nums">{selectedAlways.length}</span>
                  </h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {selectedAlways.map((posting) => (
                      <DayRow key={posting.id} posting={posting} fit={fitOf(posting, resume)} diagnosed={diagnosed.has(posting.id)} onOpen={() => pick(posting, 'list')} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
      {confirmPick.dialog}
    </ScrollPage>
  )
}

/** 고른 날짜의 공고 한 줄이에요. 공고 탐색의 줄 보기와 같은 모양이고, 마감 시각을 오른쪽에 적어요. */
function DayRow({ posting, fit, diagnosed, onOpen }: { posting: JobPosting; fit: number | null; diagnosed: boolean; onOpen: () => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const time = posting.deadline ? new Date(posting.deadline).toLocaleTimeString(getLang() === 'en' ? 'en' : 'ko', { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <li>
      <button type="button" data-no-press onClick={onOpen} className="group flex w-full items-center gap-4 rounded-2xl bg-gray-50 px-4 py-3.5 text-left transition-colors hover:bg-gray-100">
        <CompanyMark company={company} className="size-10 text-[15px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{posting.title}</span>
          <PostingMeta posting={posting} className="mt-1" careerClass="hidden @xl:flex" locationClass="hidden @2xl:flex">
            <span className="truncate font-medium text-gray-700">{company.name}</span>
          </PostingMeta>
        </span>
        {diagnosed && (
          <Badge tone="brand" strong>
            {L.diagnosed}
          </Badge>
        )}
        <span className="hidden @md:inline-flex">
          <FitTag fit={fit} />
        </span>
        {time && <span className="shrink-0 text-[13px] text-gray-500 tabular-nums">{time}</span>}
      </button>
    </li>
  )
}
