import { useEffect } from 'react'
import { appAtLeast, postToApp } from './app'
import { readItem, readJson, writeItem, writeJson } from './storage'
import { createStore, useStore } from './store'

// 앱 화면 구석에 떠 있는 펫이에요. Codex 앱의 펫처럼 AI가 일하는 동안 같이 바빠지고, 끝나면 기뻐해요.
// 캐릭터는 잡아따 도마뱀(블록 도마뱀, 몸 색이 테마를 따라가요)과, pixel-reels 릴스의 Claude(주황 박스 봇)와 Codex(구름 머리 치비)예요.

export type PetKind = 'javadda' | 'claude' | 'codex'
export const PET_KINDS: PetKind[] = ['javadda', 'claude', 'codex']
/** 펫 이름이에요. 설정의 펫 줄과 펫의 읽기 이름표가 같이 써요. */
export const PET_NAMES: Record<PetKind, string> = { javadda: 'Javadda', claude: 'Claude', codex: 'Codex' }
export const isPetKind = (value: unknown): value is PetKind => PET_KINDS.includes(value as PetKind)

const KIND_KEY = 'javadda:pet'
const POSITION_KEY = 'javadda:pet-position'

const readKind = (): PetKind | null => {
  const raw = readItem(KIND_KEY)
  return isPetKind(raw) ? raw : null
}

const kindStore = createStore<PetKind | null>(typeof window === 'undefined' ? null : readKind())

/** 앱 3.5부터 바탕화면 펫으로 잡아따 도마뱀(javadda)을 받아요. */
const appTakesJavadda = appAtLeast('3.5')

/**
 * 앱에 알리는 펫 이름이에요. 3.4까지의 앱은 바탕화면 펫으로 Claude와 Codex만 받아서, 잡아따 도마뱀은 claude로 알려 펫 창만 띄우게 해요.
 * 그때는 펫 창(`PetWindow`)이 이 기기에 적어 둔 고른 펫을 읽어 도마뱀을 그려요(`storedPet`).
 */
const appKind = (kind: PetKind | null): PetKind | null => (kind === 'javadda' && !appTakesJavadda ? 'claude' : kind)

/** 이 기기에 적어 둔 고른 펫이에요. 바탕화면 펫 창은 앱 화면 밖이라 이것으로 앱이 모르는 펫(도마뱀)을 알아요. */
export const storedPet = readKind

/** 고른 펫이에요. null이면 꺼져 있어요(처음은 꺼져 있어요). */
export const usePet = () => useStore(kindStore, (value) => value, null)

export function setPet(kind: PetKind | null) {
  writeItem(KIND_KEY, kind)
  kindStore.set(kind)
  if (desktopPet) postToApp({ type: 'pet', kind: appKind(kind) })
}

/**
 * macOS 앱 3.2부터는 펫이 앱 창 밖, 바탕화면에 떠요. 앱이 투명한 펫 창을 띄우고 그 안에 /pet-window를 그려요.
 * 웹은 고른 펫(pet 메시지)과 상태(petState 메시지)만 앱에 보내고, 앱 안에는 펫을 그리지 않아요.
 */
export const desktopPet = appAtLeast('3.2')

/** 앱이 펫 창에 상태, 누르기, 바라볼 쪽을 넘기는 이벤트예요. */
export const PET_WINDOW_EVENT = 'javadda:pet'

// 앱이 켜질 때 웹에 적어 둔 펫을 알려서, 앱이 기억한 값과 맞춰요.
if (desktopPet) postToApp({ type: 'pet', kind: appKind(kindStore.get()) })

/** 펫이 지금 바쁜지, 몇 퍼센트인지, 마지막으로 끝난 일이 무엇인지예요. */
export interface PetStatus {
  busy: boolean
  /** 화면이 자료를 받는 중(뼈대가 보이는 중)이에요. 말풍선 없이 춤만 춰요. */
  loading: boolean
  percent: number | null
  event: { kind: 'done' | 'error'; at: number } | null
  /** 공고를 늘어놓은 화면(공고 탐색, 추천 공고)을 보는 중이에요. 도마뱀이 공고 종이에 매달려 같이 봐요. */
  reading?: boolean
}

/** 바탕화면의 펫 창에 지금 상태를 보내요. hidden이면 앱이 펫 창을 잠깐 내려요(면접 연습 화면 등). */
export function postPetState(status: PetStatus, hidden: boolean) {
  postToApp({ type: 'petState', busy: status.busy, loading: status.loading, percent: status.percent, event: status.event, reading: !!status.reading, hidden })
}

/** 창의 오른쪽 아래에서 떨어진 거리(px)예요. 끌어 옮긴 자리를 이 기기에 기억해요. */
export interface PetPosition {
  right: number
  bottom: number
}
export const DEFAULT_PET_POSITION: PetPosition = { right: 20, bottom: 20 }

export const readPetPosition = (): PetPosition => {
  const saved = readJson<Partial<PetPosition>>(POSITION_KEY, {})
  return typeof saved.right === 'number' && typeof saved.bottom === 'number' ? { right: saved.right, bottom: saved.bottom } : DEFAULT_PET_POSITION
}
export const writePetPosition = (position: PetPosition) => writeJson(POSITION_KEY, position)

/** 마지막으로 끝난 일(기쁨이나 실패 반응)이에요. 바쁜지와 퍼센트는 보고 있는 기다리는 칸을 따라가요(`usePetWatching`). */
const eventStore = createStore<PetStatus['event']>(null)
export const usePetEvent = () => useStore(eventStore)

/** 끝난 일을 알려요. 리포트가 다 만들어졌을 때처럼 요청 밖에서 끝나는 일도 이걸로 알려요. */
export function petEvent(kind: 'done' | 'error') {
  eventStore.set({ kind, at: Date.now() })
}

/** AI 요청이 끝났다고 알려요(withProgress). 사용자가 기다리던 화면을 떠났으면 반응하지 않아요. */
export function petWorkEnd(ok: boolean) {
  if (petWatching()) petEvent(ok ? 'done' : 'error')
}

const loadingStore = createStore(0)
export const usePetLoadingNow = () => useStore(loadingStore) > 0

/** 자료를 받는 동안 보이는 뼈대(`Skeleton`)가 불러요. active인 동안 펫이 춤춰요. */
export function usePetLoading(active: boolean) {
  useEffect(() => {
    if (!active) return
    loadingStore.set(loadingStore.get() + 1)
    return () => loadingStore.set(loadingStore.get() - 1)
  }, [active])
}

const hiddenStore = createStore(0)
export const usePetHidden = () => useStore(hiddenStore) > 0

/** 면접 연습의 검은 화면처럼 펫이 방해되는 화면에서 불러요. 그 화면이 떠 있는 동안 펫을 숨겨요. */
export function useHidePet() {
  useEffect(() => {
    hiddenStore.set(hiddenStore.get() + 1)
    return () => hiddenStore.set(hiddenStore.get() - 1)
  }, [])
}

/**
 * 사용자가 AI를 기다리는 칸(`AiProgress`)을 보고 있는지예요. 펫은 이 칸이 화면에 있는 동안만 바쁘게 춤추고 퍼센트를 적어요.
 * 요청은 화면을 떠나도 끝까지 가지만, 기다리던 화면을 나가면 펫은 바로 멈춰요. percent는 마지막으로 그린 칸의 퍼센트예요.
 */
const watchStore = createStore<{ count: number; percent: number | null }>({ count: 0, percent: null })
let watchLeftAt = 0
/** 칸이 막 사라진 때(결과로 바뀐 순간)도 보고 있던 것으로 쳐서, 끝났을 때의 기쁨과 실패 반응은 그대로 나와요. */
const WATCH_GRACE_MS = 1500
export const petWatching = () => watchStore.get().count > 0 || Date.now() - watchLeftAt < WATCH_GRACE_MS
export const usePetWatch = () => useStore(watchStore)

/** AI를 기다리는 칸이 불러요. 칸이 떠 있는 동안 펫이 그 퍼센트로 바빠져요. */
export function usePetWatching(percent: number) {
  useEffect(() => {
    watchStore.set({ ...watchStore.get(), count: watchStore.get().count + 1 })
    return () => {
      watchLeftAt = Date.now()
      const count = Math.max(0, watchStore.get().count - 1)
      watchStore.set({ count, percent: count ? watchStore.get().percent : null })
    }
  }, [])
  useEffect(() => {
    watchStore.set({ ...watchStore.get(), percent })
  }, [percent])
}

const readingStore = createStore(0)
export const usePetReadingNow = () => useStore(readingStore) > 0

/** 공고를 늘어놓은 화면(공고 탐색, 추천 공고)이 불러요. 그 화면이 떠 있는 동안 도마뱀이 공고 종이에 매달려 같이 봐요. */
export function usePetReading() {
  useEffect(() => {
    readingStore.set(readingStore.get() + 1)
    return () => readingStore.set(readingStore.get() - 1)
  }, [])
}
