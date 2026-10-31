import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { fetchPostings, SEARCH_SUGGESTIONS, SUGGEST_MS, type CareerLevel, type JobFamily, type JobPosting } from '../lib/gap'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { Failed } from './GapParts'
import { loadCenter, LoadProgress } from './ui'

/**
 * 공고를 늘어놓는 화면(새 진단, 공고 탐색, 추천 공고, 마감 달력, 채용 지도, 기업 상세, 기술 블로그)이 같이 쓰는 작은 부품이에요.
 * 공고 받기(`usePostings`), 받는 동안과 실패했을 때의 자리(`LoadGate`), 빈 검색창의 추천 검색어(`useSuggestion`, `SuggestionHint`)가 있어요.
 */

export type LoadedPostings = JobPosting[] | 'failed' | undefined

/** 검색어가 있으면 이만큼(ms) 멈췄을 때 보내요. */
const QUERY_DELAY_MS = 250

/**
 * 공고 목록을 받아요(GET /postings). 공고 탐색, 추천 공고, 마감 달력, 채용 지도가 같이 써요.
 * 받는 동안 loaded는 undefined이고, 받지 못하면 'failed'예요. retry로 다시 받아요. 조건이 바뀌면 앞의 요청의 답은 버려요.
 * 검색어가 있으면 잠깐 멈췄을 때 보내요. waiting은 진행 칸을 보여줄지(`useLoadHold`)이고, percent는 받은 정도예요.
 */
export function usePostings({ query = '', family = null, career = null }: { query?: string; family?: JobFamily | null; career?: CareerLevel | null } = {}) {
  const [loaded, setLoaded] = useState<LoadedPostings>(undefined)
  const [attempt, setAttempt] = useState(0)
  const load = useLoadProgress()

  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    const onLoad = load.one()
    const timer = window.setTimeout(
      () => {
        void fetchPostings({ query, family, career }, onLoad).then(
          (list) => {
            if (!stale) setLoaded(list)
          },
          () => {
            if (!stale) setLoaded('failed')
          },
        )
      },
      query ? QUERY_DELAY_MS : 0,
    )
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [query, family, career, attempt, load.one])

  const hold = useLoadHold(loaded === undefined)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { loaded, postings: Array.isArray(loaded) ? loaded : null, waiting: hold || loaded === undefined, percent: load.percent, retry }
}

/**
 * 자료를 받는 동안에는 가운데에 진행 칸(`LoadProgress`)을, 받지 못했으면 다시 시도 안내(`Failed`)를, 받았으면 내용을 그려요.
 * 내용은 받은 뒤에만 만들게 함수로 넘겨요.
 */
export function LoadGate({ waiting, failed, percent, onRetry, children }: { waiting: boolean; failed: boolean; percent: number; onRetry: () => void; children: () => ReactNode }) {
  if (waiting) return <LoadProgress percent={percent} className={loadCenter} />
  if (failed) return <Failed className="mt-16" onRetry={onRetry} />
  return <>{children()}</>
}

/** 회색 칸(`Panel`) 제목 줄 오른쪽에 두는 작은 글자 버튼과 링크예요. 공고 탐색에서 보기, 요약 더 보기, 네이버 지도가 같이 써요. */
export const panelAction = 'flex items-center gap-1 text-[12.5px] font-medium text-gray-500 transition-colors hover:text-gray-900'

/** 10.28처럼 달과 날만 적어요. 공고 카드의 모집 기간과 기업 상세의 가장 가까운 마감이 같이 써요. */
export const shortDate = (iso: string) => {
  const date = new Date(iso)
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
}

/** 검색창이 비어 있는(active) 동안 추천 검색어를 하나씩 돌려요. 새 진단 화면과 공고 탐색이 같이 써요. */
export function useSuggestion(active: boolean): { index: number; text: string } {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % SEARCH_SUGGESTIONS.length), SUGGEST_MS)
    return () => window.clearInterval(timer)
  }, [active])
  return { index, text: SEARCH_SUGGESTIONS[index] }
}

/**
 * 빈 검색창 안에 자리표시 글자처럼 옅게 보이는 추천 검색어예요. 바뀔 때마다 아래에서 올라와요.
 * 이런 걸 쳐 볼 수 있다는 것만 슬쩍 알려서 이름표는 붙이지 않아요. 왼쪽과 오른쪽 자리(className)는 검색창 모양에 맞춰 넘겨요.
 */
export function SuggestionHint({ index, text, className }: { index: number; text: string; className: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-y-0 flex items-center overflow-hidden text-base whitespace-nowrap text-gray-400 sm:text-[14px] ${className}`}>
      <span key={index} className="animate-rise">
        {text}
      </span>
    </span>
  )
}
