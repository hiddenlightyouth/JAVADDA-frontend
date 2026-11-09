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

/** 이만큼(ms) 안에 끝나는 받기는 뼈대(`Skeleton`, ui)를 보여주지 않아요. 뼈대가 그만큼 늦게 나타나요. */
export const LOAD_SHOW_AFTER_MS = 150

/**
 * 뼈대를 보여줄지예요. 받는 동안(loading)만 true이고, 받으면 바로 내용으로 바꿔요.
 * 예전에는 진행 막대의 100%를 잠깐 보여주려고 끝난 뒤에도 잠깐 true였어요. 뼈대는 끝을 보여줄 것이 없어서 기다리지 않아요.
 */
export function useLoadHold(loading: boolean): boolean {
  return loading
}

/** 그림을 다 받는 데 이보다 오래 걸리면 기다리지 않고 그려요. 느린 망에서 화면이 막히지 않게요. */
const IMAGE_WAIT_MS = 5000

/**
 * 그림들을 미리 받아 브라우저에 담아 둬요. 다 받거나(실패한 것도 끝난 것으로 쳐요) IMAGE_WAIT_MS가 지나면 끝나요.
 * onLoad에는 받은 비율을 0에서 1로 알려요.
 */
export function preloadImages(urls: readonly string[], onLoad?: (fraction: number) => void): Promise<void> {
  if (urls.length === 0) {
    onLoad?.(1)
    return Promise.resolve()
  }
  let done = 0
  const each = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const image = new Image()
        const finish = () => {
          done += 1
          onLoad?.(done / urls.length)
          resolve()
        }
        image.onload = () =>
          void image
            .decode()
            .catch(() => undefined)
            .finally(finish)
        image.onerror = finish
        image.src = url
      }),
  )
  return Promise.race([Promise.all(each).then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_MS))]).finally(() => onLoad?.(1))
}
