import { useEffect, useRef, type RefObject } from 'react'
import { REST, type MouthPose } from '../lib/lipsync'
import { createMouthRenderer, PORTRAIT_URL } from '../lib/mouthRenderer'
import './Interviewer.css'

/** 입이 움직이는 빠르기(초)예요. 입은 소리보다 늦어 보이면 안 되어서 벌릴 때가 다물 때보다 빨라요. */
const OPEN_SECONDS = 0.035
const CLOSE_SECONDS = 0.06
const SHAPE_SECONDS = 0.06

/** 질문마다 다시 그려져서, 사진은 한 번만 받아 둬요. */
let portrait: Promise<HTMLImageElement> | null = null
function loadPortrait() {
  portrait ??= new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      portrait = null
      reject(new Error('portrait'))
    }
    image.src = PORTRAIT_URL
  })
  return portrait
}

/** 목표에 충분히 가까우면 딱 맞춰서, 입이 다 닫히지 않고 남지 않게 해요. */
const follow = (from: number, to: number, seconds: number, elapsed: number) => {
  const next = from + (to - from) * (1 - Math.exp(-elapsed / seconds))
  return Math.abs(to - next) < 0.001 ? to : next
}

/**
 * 가상 면접관이에요. 입 모양은 `useSpeak`이 매 순간 정한 값(pose)을 자기 프레임으로 따라가요.
 * 그릴 수 없는 환경이나 움직임 줄이기 설정에서는 배경에 깔린 사진만 보여요.
 */
export function Interviewer({ pose, speaking, label }: { pose: RefObject<MouthPose>; speaking: boolean; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    let cleanup = () => {}

    void loadPortrait().then(
      (image) => {
        if (!alive) return
        const renderer = createMouthRenderer(element, image)
        if (!renderer) return
        const hide = () => {
          element.hidden = true
        }
        element.addEventListener('webglcontextlost', hide)
        const observer = new ResizeObserver(() => {
          renderer.resize(element.clientWidth)
          renderer.draw(shown)
        })
        const shown: MouthPose = { ...REST }
        renderer.resize(element.clientWidth)
        renderer.draw(shown)
        element.dataset.ready = 'true'
        observer.observe(element)

        let frame = 0
        let last: number | null = null
        const drawn: MouthPose = { ...REST }
        const tick = (now: number) => {
          frame = requestAnimationFrame(tick)
          // 첫 프레임의 시각은 지금보다 앞설 수 있어서, 프레임 사이의 시간만 재고 0 아래로 내려가지 않게 해요.
          const elapsed = last === null ? 0 : Math.max(0, Math.min(0.1, (now - last) / 1000))
          last = now
          const target = pose.current
          shown.open = follow(shown.open, target.open, target.open > shown.open ? OPEN_SECONDS : CLOSE_SECONDS, elapsed)
          shown.wide = follow(shown.wide, target.wide, SHAPE_SECONDS, elapsed)
          shown.round = follow(shown.round, target.round, SHAPE_SECONDS, elapsed)
          const moved = Math.abs(shown.open - drawn.open) + Math.abs(shown.wide - drawn.wide) + Math.abs(shown.round - drawn.round)
          if (moved < 0.002) return
          Object.assign(drawn, shown)
          renderer.draw(shown)
        }
        frame = requestAnimationFrame(tick)

        cleanup = () => {
          cancelAnimationFrame(frame)
          observer.disconnect()
          element.removeEventListener('webglcontextlost', hide)
          renderer.dispose()
        }
      },
      () => {},
    )

    return () => {
      alive = false
      cleanup()
    }
  }, [pose])

  return (
    <div className="interviewer mb-6 self-center" data-speaking={speaking} role="img" aria-label={label}>
      <div className="interviewer-portrait">
        <canvas ref={canvas} aria-hidden="true" />
      </div>
    </div>
  )
}
