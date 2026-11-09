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

/**
 * 앱에 알리는 펫 이름이에요. 3.4까지의 앱은 바탕화면 펫으로 Claude와 Codex만 받아서, 잡아따 도마뱀은 claude로 알려 펫 창만 띄우게 해요.
 * 펫 창(`PetWindow`)이 이 기기에 적어 둔 고른 펫을 읽어 도마뱀을 그려요(`storedPet`).
 */
const appKind = (kind: PetKind | null): 'claude' | 'codex' | null => (kind === 'javadda' ? 'claude' : kind)

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
}

/** 바탕화면의 펫 창에 지금 상태를 보내요. hidden이면 앱이 펫 창을 잠깐 내려요(면접 연습 화면 등). */
export function postPetState(status: PetStatus, hidden: boolean) {
  postToApp({ type: 'petState', busy: status.busy, loading: status.loading, percent: status.percent, event: status.event, hidden })
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

/** AI가 하는 일이에요. jobs는 지금 기다리는 요청 수, progress는 가장 최근 퍼센트, event는 마지막으로 끝난 일이에요. */
export interface PetActivity {
  jobs: number
  progress: number | null
  event: { kind: 'done' | 'error'; at: number } | null
}

const activityStore = createStore<PetActivity>({ jobs: 0, progress: null, event: null })
export const usePetActivity = () => useStore(activityStore)

/** 끝난 일을 알려요. 리포트가 다 만들어졌을 때처럼 요청 밖에서 끝나는 일도 이걸로 알려요. */
export function petEvent(kind: 'done' | 'error') {
  activityStore.set({ ...activityStore.get(), event: { kind, at: Date.now() } })
}

/**
 * AI 요청을 시작했다고 알려요. 진행 퍼센트를 넘길 함수와, 끝났을 때 부를 함수를 돌려줘요.
 * withProgress가 불러서 이력서 읽기, 서류 검증, 예상 질문, 채점이 모두 펫을 바쁘게 해요.
 */
export function petWork() {
  const start = activityStore.get()
  activityStore.set({ ...start, jobs: start.jobs + 1, progress: 0 })
  let ended = false
  return {
    progress(value: number) {
      if (ended) return
      activityStore.set({ ...activityStore.get(), progress: value })
    },
    end(ok: boolean) {
      if (ended) return
      ended = true
      const now = activityStore.get()
      const jobs = Math.max(0, now.jobs - 1)
      activityStore.set({ jobs, progress: jobs ? now.progress : null, event: { kind: ok ? 'done' : 'error', at: Date.now() } })
    },
  }
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
