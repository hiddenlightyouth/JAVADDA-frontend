import { useCallback, useEffect, useRef, useState } from 'react'
import type { OnLoad } from './http'

/**
 * 자료를 받는 동안의 진행 정도를 퍼센트로 모아요. 요청 하나하나는 `OnLoad`로 0에서 1까지를 알리고(`readWithLoad`, `src/lib/http.ts`),
 * 화면 전체의 퍼센트는 지금까지 더한 요청의 평균이에요. 숫자는 뒤로 가지 않아요.
 */

export interface LoadTracker {
  /** 요청 하나를 더하고, 그 요청이 얼마나 받았는지 알릴 함수를 돌려줘요. */
  track(): OnLoad
  /** 이 묶음을 그만 알려요. 새 묶음을 시작하거나 화면을 떠날 때 불러요. */
  stop(): void
}

/** 요청 여러 개를 묶어 퍼센트(0에서 100)를 알려요. 요청마다 0에서 1이고, 전체는 그 평균이에요. */
export function createLoadTracker(onPercent: (percent: number) => void): LoadTracker {
  const parts: number[] = []
  let best = 0
  let stopped = false
  const update = () => {
    if (stopped || parts.length === 0) return
    const next = Math.round((parts.reduce((sum, part) => sum + part, 0) / parts.length) * 100)
    if (next <= best) return
    best = next
    onPercent(best)
  }
  return {
    track() {
      const index = parts.push(0) - 1
      return (fraction) => {
        const value = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0))
        if (value <= parts[index]) return
        parts[index] = value
        update()
      }
    },
    stop() {
      stopped = true
    },
  }
}

/**
 * 화면 하나의 받는 진행 정도예요. start로 새 묶음을 시작하면 0%로 돌아가고, 예전 묶음의 알림은 버려요.
 * 요청이 하나뿐이면 one()으로 새 묶음과 그 요청의 알림 함수를 한 번에 받아요.
 */
export function useLoadProgress() {
  const [percent, setPercent] = useState(0)
  const current = useRef<LoadTracker | null>(null)
  const start = useCallback((): LoadTracker => {
    current.current?.stop()
    setPercent(0)
    const tracker = createLoadTracker(setPercent)
    current.current = tracker
    return tracker
  }, [])
  const one = useCallback((): OnLoad => start().track(), [start])
  useEffect(() => () => current.current?.stop(), [])
  return { percent, start, one }
}

/** 이만큼(ms) 안에 끝나는 받기는 진행 막대를 보여주지 않아요. `LoadProgress`도 같은 시간만큼 늦게 나타나요. */
export const LOAD_SHOW_AFTER_MS = 150
/** 진행 막대가 보였으면 100%를 이만큼(ms) 보여준 뒤에 내용으로 바꿔요. */
export const LOAD_HOLD_MS = 200

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * 진행 막대를 보여줄지예요. 받는 동안(loading)은 true이고, 끝났을 때 막대가 이미 보였으면(150ms 넘게 받았으면) 100%를 0.2초 더 보여주려고 그동안도 true예요.
 * 금방 끝난 받기는 바로 false가 돼서 내용이 곧장 보여요.
 */
export function useLoadHold(loading: boolean): boolean {
  const [state, setState] = useState(() => ({ loading, since: loading ? now() : 0, holding: false }))
  let current = state
  if (state.loading !== loading) {
    current = loading ? { loading, since: now(), holding: false } : { loading, since: 0, holding: now() - state.since >= LOAD_SHOW_AFTER_MS }
    setState(current)
  }
  const holding = current.holding
  useEffect(() => {
    if (!holding) return
    const timer = setTimeout(() => setState((prev) => ({ ...prev, holding: false })), LOAD_HOLD_MS)
    return () => clearTimeout(timer)
  }, [holding])
  return loading || holding
}
