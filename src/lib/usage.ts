import { track } from './analytics'
import { authFetch } from './auth'
import { createStore, useStore } from './store'

// 요금제와 주간 사용량을 다뤄요. 한도와 기록은 서버가 지키고, 화면은 사용량을 보여줘요.

export type PlanId = 'FREE' | 'LITE' | 'PRO'

export interface PlanInfo {
  id: PlanId
  weeklyLimit: number
  /** 한 달 요금(원) */
  monthlyPrice: number
}

export interface Usage {
  /** 로그인하지 않았으면 null이에요. */
  plan: PlanId | null
  guest: boolean
  limit: number
  used: number
  /** 다시 채워지는 때. 한국 시간 월요일 0시예요. */
  resetAt: string
  plans: PlanInfo[]
}

const usage = createStore<Usage | null>(null)
let loading: Promise<Usage | null> | null = null

/** 이번 주 사용량을 새로 받아요. 서버에 사용량 API가 없거나 받지 못하면 null이에요. */
export function refreshUsage(): Promise<Usage | null> {
  loading ??= authFetch<Usage>('/usage')
    .then((result) => (result.ok && result.data ? result.data : null))
    .catch(() => null)
    .then((next) => {
      loading = null
      usage.set(next)
      return next
    })
  return loading
}

/** 받아 둔 이번 주 사용량. 아직 받지 않았으면 null이에요. */
export function useUsage(): Usage | null {
  return useStore(usage, undefined, null)
}

/** 한도에 대한 비율(%). 0보다 크면 적어도 1%로 보여줘요. */
export function percentOf(units: number, limit: number): number {
  if (limit <= 0) return 100
  const percent = Math.ceil((units / limit) * 100)
  return Math.min(100, units > 0 ? Math.max(1, percent) : 0)
}

const plansOpen = createStore(false)
const setPlansOpen = plansOpen.set

/** 요금제 창을 열어요. 계정 메뉴에서 열어요. */
export function openPlans(from: 'menu' | 'model' | 'chat') {
  track('plans_open', { from })
  setPlansOpen(true)
}

export function closePlans() {
  setPlansOpen(false)
}

/** 요금제 창이 열려 있는지. App이 한 번 읽어서 창을 그려요. */
export function usePlansOpen(): boolean {
  return useStore(plansOpen)
}
