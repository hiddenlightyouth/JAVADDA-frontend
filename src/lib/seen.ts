import { authFetch, isSignedIn, onSignedInChange } from './auth'
import { readJson, writeJson } from './storage'
import { createStore, useStore } from './store'

/**
 * 읽음 표시와 사이드바의 New예요. 로그인했으면 계정에 적고(GET, POST /reads, GET /visits, PUT /visits/{화면}), 로그인하지 않았으면 이 기기에 적어요.
 *
 * 읽음: 공고, 기술 블로그 글, 공모전의 원문을 한 번 열면(미니 브라우저든 새 탭이든) 읽은 것으로 쳐요.
 * 공고는 `posting:아이디`, 글과 공모전처럼 주소로 여는 것은 `page:주소`로 적어요. 공모전은 모은 사이트 중 하나라도 열었으면 읽음이에요.
 *
 * New: 화면(공고 탐색, 기술 블로그, 공모전)마다 마지막으로 연 때를 적어 두고, 그 뒤에 들어온 것이 있으면 사이드바에 New를 붙여요.
 * 처음 쓰는 기기와 계정은 지금을 적어 두어서(계정은 서버가 적어요), 원래 있던 것으로 New가 뜨지 않아요.
 *
 * 로그인하면 이 기기에 쌓인 읽음을 계정에 올리고 기기에서는 지워요. 서버에 아직 이 API가 없거나 닿지 못하면 이 기기에 적던 대로 해요.
 */

const READ_KEY = 'javadda:read'
const VISIT_KEY = 'javadda:last-visit'
/** 이 기기에는 읽은 것을 최근 것부터 이만큼만 남겨요. 서버도 같은 수만 돌려줘요. */
const READ_LIMIT = 3000
/** 로그인하며 한 번에 올리는 수예요. 서버가 받는 최대 수와 같아요. */
const UPLOAD_LIMIT = 1000

export type FreshSection = 'explore' | 'blogs' | 'contests'
const SECTIONS: readonly FreshSection[] = ['explore', 'blogs', 'contests']
type Visits = Partial<Record<FreshSection, number>>

const localReads = () => readJson<string[]>(READ_KEY, [])
const localVisits = () => readJson<Visits>(VISIT_KEY, {})

const readStore = createStore<ReadonlySet<string>>(new Set(localReads()))
const visitStore = createStore<Visits>(localVisits())

/** 계정에서 받아 왔는지예요. 받기 전이나 서버에 이 API가 없으면 이 기기에 적어요. */
let accountReads = false
let accountVisits = false
/** 로그아웃하거나 다시 로그인하면 늘려서, 그 전에 보낸 요청의 답을 버려요. */
let generation = 0
/** 계정의 방문 기록을 받기 전에 연 화면이에요. 받은 뒤에 서버에도 적어서, 지금 보는 화면에 New가 뜨지 않게 해요. */
const visitedEarly = new Set<FreshSection>()

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const postingKey = (id: string) => `posting:${id}`
export const pageKey = (url: string) => `page:${url}`

export function markRead(key: string) {
  const current = readStore.get()
  if (current.has(key)) return
  readStore.set(new Set([...current, key]))
  if (accountReads) {
    void authFetch('/reads', json({ keys: [key] })).catch(() => {})
    return
  }
  writeJson(READ_KEY, [...localReads().filter((each) => each !== key), key].slice(-READ_LIMIT))
}

/** 키 중 하나라도 읽었으면 true예요. */
export function useRead(...keys: string[]): boolean {
  return useStore(readStore, (set) => keys.some((key) => set.has(key)))
}

/** 그 화면을 지금 열었다고 적어요. 사이드바의 New가 사라져요. */
export function markVisited(section: FreshSection) {
  visitStore.set({ ...visitStore.get(), [section]: Date.now() })
  if (accountVisits) {
    void sendVisit(section, generation)
    return
  }
  writeJson(VISIT_KEY, { ...localVisits(), [section]: Date.now() })
  if (isSignedIn()) visitedEarly.add(section)
}

async function sendVisit(section: FreshSection, started: number) {
  const result = await authFetch<Record<string, string>>(`/visits/${section}`, { method: 'PUT' }).catch(() => null)
  if (started === generation && result?.ok && result.data) visitStore.set(visitsOf(result.data))
}

/** 이 기기를 처음 쓰면 지금을 적어 둬요. 원래 있던 것이 모두 New로 뜨지 않게요. 계정은 서버가 적어요. */
export function startVisits() {
  const current = localVisits()
  const missing = SECTIONS.filter((section) => current[section] === undefined)
  if (missing.length === 0) return
  const next = { ...current }
  for (const section of missing) next[section] = Date.now()
  writeJson(VISIT_KEY, next)
  if (!accountVisits) visitStore.set({ ...next, ...visitStore.get() })
}

const visitsOf = (data: Record<string, string>): Visits => Object.fromEntries(SECTIONS.filter((section) => data[section]).map((section) => [section, timeOf(data[section])]))

let syncing = false

/** 로그인하면 계정의 읽음과 방문 기록을 받고, 로그아웃하면 이 기기의 것으로 돌아가요. 처음 그릴 때 한 번 불러요. */
export function startSeenSync() {
  if (syncing || typeof window === 'undefined') return
  syncing = true
  onSignedInChange((signedIn) => (signedIn ? void loadAccount() : useDevice()))
  if (isSignedIn()) void loadAccount()
}

async function loadAccount() {
  const started = ++generation
  // 이 기기에 쌓인 읽음을 먼저 계정에 올리고, 올렸으면 기기에서는 지워요.
  const pending = localReads()
  if (pending.length > 0) {
    const uploaded = await authFetch('/reads', json({ keys: pending.slice(-UPLOAD_LIMIT) })).catch(() => null)
    if (uploaded?.ok) writeJson(READ_KEY, [])
  }
  const [reads, visits] = await Promise.all([
    authFetch<string[]>('/reads').catch(() => null),
    authFetch<Record<string, string>>('/visits').catch(() => null),
  ])
  if (started !== generation) return
  if (reads?.ok && Array.isArray(reads.data)) {
    accountReads = true
    // 올리지 못한 것과 받는 동안 연 것도 남겨요.
    readStore.set(new Set([...reads.data, ...readStore.get()]))
  }
  if (visits?.ok && visits.data) {
    accountVisits = true
    visitStore.set(visitsOf(visits.data))
    for (const section of visitedEarly) markVisited(section)
  }
  visitedEarly.clear()
}

function useDevice() {
  generation += 1
  accountReads = false
  accountVisits = false
  visitedEarly.clear()
  readStore.set(new Set(localReads()))
  visitStore.set(localVisits())
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
