import { readJson, writeJson } from './storage'
import { createStore, useStore } from './store'

/**
 * 읽음 표시와 사이드바의 New예요. 서버에는 두지 않고 이 기기에만 적어요.
 *
 * 읽음: 공고, 기술 블로그 글, 공모전의 원문을 한 번 열면(미니 브라우저든 새 탭이든) 읽은 것으로 쳐요.
 * 공고는 `posting:아이디`, 글과 공모전처럼 주소로 여는 것은 `page:주소`로 적어요. 공모전은 모은 사이트 중 하나라도 열었으면 읽음이에요.
 *
 * New: 화면(공고 탐색, 기술 블로그, 공모전)마다 마지막으로 연 때를 적어 두고, 그 뒤에 들어온 것이 있으면 사이드바에 New를 붙여요.
 * 처음 쓰는 기기는 지금을 적어 두어서, 원래 있던 것으로 New가 뜨지 않아요.
 */

const READ_KEY = 'javadda:read'
const VISIT_KEY = 'javadda:last-visit'
/** 읽은 것은 최근 것부터 이만큼만 남겨요. 오래 쓰면 저장소가 끝없이 커지지 않게요. */
const READ_LIMIT = 3000

export type FreshSection = 'explore' | 'blogs' | 'contests'

const readStore = createStore<ReadonlySet<string>>(new Set(readJson<string[]>(READ_KEY, [])))

export const postingKey = (id: string) => `posting:${id}`
export const pageKey = (url: string) => `page:${url}`

export function markRead(key: string) {
  const current = readStore.get()
  if (current.has(key)) return
  const next = [...current, key].slice(-READ_LIMIT)
  writeJson(READ_KEY, next)
  readStore.set(new Set(next))
}

/** 키 중 하나라도 읽었으면 true예요. */
export function useRead(...keys: string[]): boolean {
  return useStore(readStore, (set) => keys.some((key) => set.has(key)))
}

const visitStore = createStore<Partial<Record<FreshSection, number>>>(readJson(VISIT_KEY, {}))

/** 그 화면을 지금 열었다고 적어요. 사이드바의 New가 사라져요. */
export function markVisited(section: FreshSection) {
  const next = { ...visitStore.get(), [section]: Date.now() }
  writeJson(VISIT_KEY, next)
  visitStore.set(next)
}

/** 처음 쓰는 기기는 지금을 적어 둬요. 원래 있던 것이 모두 New로 뜨지 않게요. */
export function startVisits() {
  const current = visitStore.get()
  const missing = (['explore', 'blogs', 'contests'] as const).filter((section) => current[section] === undefined)
  if (missing.length === 0) return
  const next = { ...current }
  for (const section of missing) next[section] = Date.now()
  writeJson(VISIT_KEY, next)
  visitStore.set(next)
}

/** 서버 시각(시간대 없는 한국 시각)이나 날짜(YYYY-MM-DD)를 이 기기의 시각으로 읽어요. 날짜만 있으면 그날 0시예요. */
export function timeOf(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value.length === 10 ? `${value}T00:00:00` : value).getTime()
  return Number.isNaN(time) ? 0 : time
}

/**
 * 가장 최근에 들어온 것의 시각이에요. 공고의 올린 때가 앞날(내일 23:59처럼)로 오는 것이 있어서, 아직 오지 않은 시각은 세지 않아요.
 * 그런 공고는 그때가 지나면 New로 쳐요.
 */
export function latestTime(values: Iterable<string | null | undefined>): number {
  const now = Date.now()
  let latest = 0
  for (const value of values) {
    const time = timeOf(value)
    if (time <= now && time > latest) latest = time
  }
  return latest
}

/** 마지막으로 그 화면을 연 뒤에 들어온 것이 있는지예요. latest는 가장 최근에 들어온 것의 시각이에요. */
export function useFresh(section: FreshSection, latest: number): boolean {
  const visited = useStore(visitStore, (visits) => visits[section])
  return visited !== undefined && latest > visited
}
