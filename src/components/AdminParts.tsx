import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Result } from '../lib/admin'
import type { Slice } from '../lib/auth'
import { panelBody } from './Dialog'
import { Failed as FailedNotice } from './GapParts'
import { SearchIcon } from './Icons'
import { MoreButton } from './MoreButton'
import { fieldBase, loadCenter, LoadProgress, tag } from './ui'
import type { OnLoad } from '../lib/http'
import { getLang, messages, pick, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'

const TEXT = messages({
  ko: {
    share: (percent: string) => `전체의 ${percent}%`,
    none: '기록 없음',
    app: '앱',
    mobile: '모바일',
    guest: '비회원',
    removedUser: '지워진 회원',
  },
  en: {
    share: (percent: string) => `${percent}% of total`,
    none: 'No record',
    app: 'App',
    mobile: 'Mobile',
    guest: 'Guest',
    removedUser: 'Deleted member',
  },
})

/** 숫자와 그래프를 담는 회색 칸이에요. 앱의 다른 칸(`Panel`)처럼 테두리 없이 옅은 회색이에요. */
export const card = 'rounded-2xl bg-gray-50 p-4'
/** 탭 안의 묶음 제목이에요. */
export const sectionTitle = 'text-[15px] font-semibold text-gray-900'
/** 회색 칸 안의 작은 제목이에요. */
export const cardTitle = 'text-[13.5px] font-semibold text-gray-900'

const LOCALES = { ko: 'ko-KR', en: 'en-US' } as const
export const full = (value: number) => value.toLocaleString(LOCALES[getLang()])
const compactFormats = {
  ko: new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }),
}
export const compact = (value: number) => compactFormats[getLang()].format(value)
export const share = (part: number, total: number) => pick(TEXT).share(total > 0 ? ((part / total) * 100).toFixed(1) : '0')

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={card}>
      <dt className="text-[12.5px] text-gray-500">{label}</dt>
      <dd className="mt-1.5 text-[22px] leading-tight font-semibold text-gray-900 tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-[12px] text-gray-400 tabular-nums">{note}</dd>}
    </div>
  )
}

/** 숫자 칸이 올 자리에서 받는 정도를 보여줘요. 회색 칸 하나에 가는 막대와 퍼센트만 둬요. */
export function StatsLoading({ percent, className = 'mt-3' }: { percent: number; className?: string }) {
  return (
    <div className={`${className} ${card} py-6`}>
      <LoadProgress percent={percent} compact />
    </div>
  )
}

export interface Bar {
  key: string
  /** 마우스를 올리면 보여줄 말 */
  title: string
  value: number
}

/** 라이브러리 없이 그리는 막대 그래프예요. 막대에 마우스를 올리면 값이 나와요. */
export function BarChart({ bars, label, first, last }: { bars: Bar[]; label: string; first: string; last: string }) {
  const peak = Math.max(0, ...bars.map((bar) => bar.value))
  return (
    <>
      <div role="img" aria-label={label} className={`mt-4 flex h-40 items-end ${bars.length > 40 ? 'gap-px' : 'gap-1'}`}>
        {bars.map((bar) => (
          <div key={bar.key} title={bar.title} className="flex h-full min-w-0 flex-1 items-end rounded-sm transition-colors hover:bg-gray-100">
            <div className="w-full rounded-t-sm bg-brand" style={{ height: bar.value > 0 ? `${Math.max((bar.value / peak) * 100, 2)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-gray-400 tabular-nums">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </>
  )
}

/** 그 회원이 로그인한 적이 있는 기기 종류예요. */
export function DeviceTags({ app, mobile, desktop }: { app: boolean; mobile: boolean; desktop: boolean }) {
  const L = useMessages(TEXT)
  if (!app && !mobile && !desktop) return <span className="text-[12.5px] text-gray-400">{L.none}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {app && <span className={tag}>{L.app}</span>}
      {mobile && <span className={tag}>{L.mobile}</span>}
      {desktop && <span className={tag}>PC</span>}
    </span>
  )
}

/**
 * 표의 회원 칸이에요. 이름과 이메일을 두 줄로 적어요. 회원이 아니면 "비회원", 지워진 회원이면 "지워진 회원"이에요.
 * 폭은 className(max-w)으로 정해요.
 */
export function MemberCell({ userId, userName, userEmail, className = 'max-w-[200px]' }: { userId: number | null; userName: string | null; userEmail: string | null; className?: string }) {
  const L = useMessages(TEXT)
  if (userId === null) return <span className="text-gray-400">{L.guest}</span>
  return (
    <>
      <p className={`truncate text-gray-900 ${className}`}>{userName ?? L.removedUser}</p>
      <p className={`mt-0.5 truncate text-[12px] text-gray-400 ${className}`}>{userEmail ?? ''}</p>
    </>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className={`flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 focus-within:border-brand sm:max-w-xs ${fieldBase}`}>
      <SearchIcon className="size-3.5 shrink-0 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
      />
    </label>
  )
}

/** 글자를 치는 동안에는 기다렸다가, 잠깐 멈추면 값을 돌려줘요. 검색어마다 요청을 보내지 않게 해요. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return settled
}

/**
 * 한 번에 받는 관리자 자료예요(현황, 피드백 합계, AI 사용량, 회원과 호출 상세). key가 바뀌거나 reload를 부르면 다시 받아요.
 * keep이면 다시 받는 동안 보던 자료를 그대로 둬서(기간만 바꿀 때, 관리 작업 뒤) 화면이 깜빡이지 않아요. 아니면 비우고 진행 막대를 보여줘요.
 * 받을 때마다 받은 바이트로 퍼센트를 세요(percent). 처음 받는 동안(waiting)은 진행 막대를 보여줘요.
 */
export function useAdminData<T>(load: (onLoad: OnLoad) => Promise<Result<T>>, key: string | number, keep = false) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(load)
  latest.current = load
  const progress = useLoadProgress()
  const { one } = progress

  useEffect(() => {
    let stale = false
    setError('')
    if (!keep) setData(null)
    void latest.current(one()).then((result) => {
      if (stale) return
      if (result.ok) setData(result.data)
      else setError(result.message)
    })
    return () => {
      stale = true
    }
  }, [key, attempt, keep, one])

  const waiting = useLoadHold(data === null && !error)
  return { data, error, waiting, percent: progress.percent, reload: () => setAttempt((value) => value + 1) }
}

/**
 * 20개씩 더 보기로 받는 목록이에요. key가 바뀌면(검색어, 필터) 처음부터 다시 받아요.
 * refresh는 보던 목록을 비우지 않고 첫 쪽을 조용히 다시 받아서, 관리 작업 뒤에 화면이 깜빡이지 않아요.
 * 받을 때마다 받은 바이트로 퍼센트를 세요(percent). 첫 쪽을 받는 동안(waiting)은 표 자리에 진행 막대를, 더 보기는 버튼에 퍼센트를 보여줘요.
 */
export function usePaged<T>(load: (page: number, onLoad?: OnLoad) => Promise<Result<Slice<T>>>, key: string) {
  const [items, setItems] = useState<T[] | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(load)
  latest.current = load
  const quiet = useRef(false)
  const progress = useLoadProgress()
  const { one } = progress

  useEffect(() => {
    let stale = false
    if (!quiet.current) setItems(null)
    quiet.current = false
    void latest.current(0, one()).then((result) => {
      if (stale) return
      if (!result.ok) {
        setError(result.message)
        return
      }
      setError('')
      setItems(result.data.items)
      setNext(result.data.hasNext ? 1 : null)
    })
    return () => {
      stale = true
    }
  }, [key, attempt, one])

  const waiting = useLoadHold(items === null && !error)

  async function more() {
    if (next === null || loadingMore) return
    setLoadingMore(true)
    const result = await latest.current(next, one())
    setLoadingMore(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setItems((prev) => [...(prev ?? []), ...result.data.items])
    setNext(result.data.hasNext ? next + 1 : null)
  }

  return {
    items,
    error,
    hasNext: next !== null,
    loadingMore,
    percent: progress.percent,
    waiting,
    more,
    retry: () => {
      setError('')
      setAttempt((value) => value + 1)
    },
    refresh: () => {
      quiet.current = true
      setAttempt((value) => value + 1)
    },
  }
}

export type Paged<T> = ReturnType<typeof usePaged<T>>

export function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <FailedNotice message={message} onRetry={onRetry} className="mt-16" />
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-16 text-center text-[13.5px] leading-relaxed text-gray-500">{children}</p>
}

export const th = 'px-4 py-2.5 text-left text-[12px] font-medium whitespace-nowrap text-gray-500'
export const td = 'px-4 py-2.5 align-middle'

/**
 * 더 보기로 받는 목록을 표로 그려요(회원, 채팅, 피드백, AI 호출). 첫 쪽을 받는 동안은 표와 같은 테두리 안에 진행 막대,
 * 받지 못하면 다시 시도, 비어 있으면 안내(empty)를 보여주고, 다음 쪽이 있으면 표 아래에 더 보기 버튼을 둬요.
 * head는 머리 줄의 칸(th)들이고, children은 받은 줄마다 그릴 tr이에요.
 */
export function PagedTable<T>({ list, empty, head, minWidth = 'min-w-[760px]', children }: {
  list: Paged<T>
  empty: ReactNode
  head: ReactNode
  /** 좁은 화면에서 옆으로 넘기게 되는 표의 가장 작은 폭 */
  minWidth?: string
  children: (item: T) => ReactNode
}) {
  if (list.waiting) {
    return (
      <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-6">
        <LoadProgress percent={list.percent} compact />
      </div>
    )
  }
  if (list.items === null) return <Failed message={list.error} onRetry={list.retry} />
  if (list.items.length === 0) return <Empty>{empty}</Empty>
  return (
    <>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className={`w-full ${minWidth} text-[13px] text-gray-700 tabular-nums`}>
          <thead>
            <tr>{head}</tr>
          </thead>
          <tbody>{list.items.map(children)}</tbody>
        </table>
      </div>
      {list.hasNext && <MoreButton loading={list.loadingMore} percent={list.percent} onClick={() => void list.more()} />}
    </>
  )
}

/** 표에서 눌러 상세 칸을 여는 줄의 모양이에요. 열려 있는 줄은 한 단계 짙어요. */
export const openableRow = (open: boolean) => `cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50 ${open ? 'bg-gray-50' : ''}`

/** 상세 칸 맨 위의 이름과 값 칸이에요. 넓으면 한 줄에 둘(wide면 넷)씩 놓여요. */
export function InfoGrid({ rows, wide = false }: { rows: readonly (readonly [string, ReactNode])[]; wide?: boolean }) {
  return (
    <dl className={`mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] ${wide ? 'sm:grid-cols-4' : ''}`}>
      {rows.map(([name, value]) => (
        <div key={name}>
          <dt className="text-[12px] text-gray-400">{name}</dt>
          <dd className="mt-0.5 text-gray-900 tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * 오른쪽 상세 칸(`SidePanel`)의 내용 자리예요. 처음 받는 동안은 진행 막대, 받지 못하면 다시 시도, 받으면 children으로 그려요.
 * 다시 받는 동안(관리 작업 뒤)에는 보던 내용을 그대로 둬요.
 */
export function PanelContent<T>({ state, children }: { state: ReturnType<typeof useAdminData<T>>; children: (data: T) => ReactNode }) {
  if (state.data === null) {
    if (state.waiting || !state.error) {
      return (
        <div className="px-6">
          <LoadProgress percent={state.percent} className={loadCenter} />
        </div>
      )
    }
    return <Failed message={state.error} onRetry={state.reload} />
  }
  return <div className={panelBody}>{children(state.data)}</div>
}
