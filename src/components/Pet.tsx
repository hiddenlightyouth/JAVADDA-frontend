import { useEffect, useRef, useState } from 'react'
import { useReports } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import {
  desktopPet,
  petEvent,
  postPetState,
  readPetPosition,
  usePet,
  usePetEvent,
  usePetHidden,
  usePetLoadingNow,
  usePetWatch,
  usePetReadingNow,
  petWatching,
  writePetPosition,
  PET_NAMES,
  type PetKind,
  type PetPosition,
  type PetStatus,
} from '../lib/pet'
import { PET_SIZE, PetStage } from './PetStage'

const TEXT = messages({
  ko: { label: (name: string) => `펫 ${name}, 눌러서 인사하고 끌어서 옮겨요` },
  en: { label: (name: string) => `Pet ${name}. Click to say hi, drag to move` },
})

/** 이만큼 넘게 움직이면 누른 게 아니라 끄는 거예요. */
const DRAG_PX = 4
/** 도마뱀이 돌아다니는 빠르기(px/초)와 한 번에 가는 거리(px)예요. */
const WANDER_SPEED = 45
const WANDER_MIN = 40
const WANDER_MAX = 110
/** 사용자가 옮겨 놓은 자리(집)에서 가로세로로 이만큼(px)까지만 돌아다녀요. 작업하는 화면을 가리고 다니지 않게 좁게 둬요. */
const WANDER_RANGE = 110
/** 다음 나들이까지 쉬는 시간(ms)이에요. */
const WANDER_REST = [6000, 15000] as const
/** 사용자가 이만큼(ms) 마우스와 키보드를 쓰지 않으면 돌아다니지 않아서, 가만히 두면 잠들어요. */
const WANDER_IDLE = 15000
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp = (position: PetPosition): PetPosition => ({
  right: Math.max(0, Math.min(window.innerWidth - PET_SIZE, position.right)),
  bottom: Math.max(0, Math.min(window.innerHeight - PET_SIZE, position.bottom)),
})

/** 보고 있는 기다리는 칸과 끝난 일(AI 요청, 만드는 중이던 리포트)을 모아 펫이 지금 바쁜지, 몇 퍼센트인지, 마지막으로 끝난 일이 무엇인지 알려요. */
function usePetStatus(): PetStatus {
  const event = usePetEvent()
  const loading = usePetLoadingNow()
  const watch = usePetWatch()
  const reading = usePetReadingNow()
  const reports = useReports()
  // 만드는 중이던 리포트가 다 되거나 실패하면 알려요.
  const pendingIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const now = new Set(reports.filter((report) => report.status === 'pending').map((report) => report.id))
    for (const id of pendingIds.current) {
      if (now.has(id)) continue
      const report = reports.find((item) => item.id === id)
      // 그 리포트를 기다리는 화면을 보고 있을 때만 반응해요
      if (!petWatching()) continue
      if (report?.status === 'done') petEvent('done')
      else if (report?.status === 'failed') petEvent('error')
    }
    pendingIds.current = now
  }, [reports])
  // 바쁜지와 퍼센트는 요청이 아니라 화면을 따라가요. 기다리는 칸(AiProgress)이 보이는 동안만 춤추고, 그 화면을 나가면 멈춰요
  return {
    busy: watch.count > 0,
    loading,
    percent: watch.count > 0 ? watch.percent : null,
    event,
    reading,
  }
}

/**
 * 펫이에요(설정 창에서 켜요). 브라우저에서는 앱 화면 구석에 떠 있고, 끌어서 옮기면 그 자리를 기억해요.
 * macOS 앱 3.2부터는 앱이 바탕화면에 펫 창을 띄워서, 여기서는 그리지 않고 상태만 앱에 보내요(`DesktopPetBridge`).
 */
export function Pet() {
  const kind = usePet()
  const hidden = usePetHidden()
  if (desktopPet) return <DesktopPetBridge hidden={hidden || !kind} />
  if (!kind || hidden) return null
  return <InAppPet key={kind} kind={kind} />
}

function DesktopPetBridge({ hidden }: { hidden: boolean }) {
  const status = usePetStatus()
  useEffect(() => {
    postPetState(status, hidden)
  }, [status.busy, status.loading, status.percent, status.event?.at, status.reading, hidden])
  return null
}

function InAppPet({ kind }: { kind: PetKind }) {
  const text = useMessages(TEXT)
  const status = usePetStatus()
  const [position, setPosition] = useState<PetPosition>(() => clamp(readPetPosition()))
  const [pokeAt, setPokeAt] = useState(0)
  const [grabbed, setGrabbed] = useState(false)
  const [pull, setPull] = useState<{ dx: number; at: number } | undefined>()
  const lastX = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  // 돌아다니는 동안은 매 프레임 상태를 바꾸지 않고 칸의 자리만 바로 옮겨요. 지금 자리는 여기에 둬요
  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])
  // 집: 사용자가 끌어다 놓은 자리예요. 돌아다닌 자리는 저장하지 않아서 다시 열면 집에서 시작해요
  const homeRef = useRef(position)
  const [motion, setMotion] = useState<{ vx: number; vy: number } | undefined>()

  // 잡아따 도마뱀은 가끔 화면을 돌아다녀요. 위아래로 갈 때는 벽을 타듯 기어요(PetStage의 motion).
  // 바쁘거나 끌려가는 중, 사용자가 자리를 비운 동안은 돌아다니지 않아요
  const wanderable = kind === 'javadda' && !status.busy && !status.loading && !status.reading && !grabbed && !reducedMotion()
  useEffect(() => {
    if (!wanderable) return
    let userAt = Date.now()
    const onUser = () => (userAt = Date.now())
    window.addEventListener('pointermove', onUser)
    window.addEventListener('keydown', onUser)
    let timer = 0
    let raf = 0
    const rest = () => {
      timer = window.setTimeout(trip, WANDER_REST[0] + Math.random() * (WANDER_REST[1] - WANDER_REST[0]))
    }
    const trip = () => {
      if (document.hidden || drag.current || Date.now() - userAt > WANDER_IDLE) return rest()
      const from = positionRef.current
      const home = homeRef.current
      const vertical = Math.random() < 0.5
      const near = (value: number, center: number) => Math.max(center - WANDER_RANGE, Math.min(center + WANDER_RANGE, value))
      const go = (dist: number) =>
        clamp(vertical ? { ...from, bottom: near(from.bottom + dist, home.bottom) } : { ...from, right: near(from.right - dist, home.right) })
      const dist = (WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN)) * (Math.random() < 0.5 ? -1 : 1)
      // 화면 끝에 막히면 반대로 가요
      let to = go(dist)
      if (Math.hypot(to.right - from.right, to.bottom - from.bottom) < WANDER_MIN / 2) to = go(-dist)
      const dx = from.right - to.right
      const dy = to.bottom - from.bottom
      const length = Math.hypot(dx, dy)
      if (length < WANDER_MIN / 2) return rest()
      const ms = (length / WANDER_SPEED) * 1000
      setMotion({ vx: (dx / length) * WANDER_SPEED, vy: (dy / length) * WANDER_SPEED })
      const start = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms)
        const at = { right: from.right + (to.right - from.right) * p, bottom: from.bottom + (to.bottom - from.bottom) * p }
        positionRef.current = at
        const wrap = wrapRef.current
        if (wrap) {
          wrap.style.right = `${at.right}px`
          wrap.style.bottom = `${at.bottom}px`
        }
        if (p < 1) {
          raf = requestAnimationFrame(step)
          return
        }
        setMotion(undefined)
        setPosition(at)
        rest()
      }
      raf = requestAnimationFrame(step)
    }
    rest()
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onUser)
      window.removeEventListener('keydown', onUser)
      setMotion(undefined)
      setPosition(positionRef.current)
    }
  }, [wanderable])

  useEffect(() => {
    const onResize = () => setPosition((value) => clamp(value))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const drag = useRef<{ x: number; y: number; start: PetPosition; moved: boolean } | null>(null)
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, start: positionRef.current, moved: false }
  }
  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return
    if (!d.moved) {
      lastX.current = event.clientX
      setGrabbed(true)
    }
    d.moved = true
    setPull({ dx: event.clientX - lastX.current, at: performance.now() })
    lastX.current = event.clientX
    setPosition(clamp({ right: d.start.right - dx, bottom: d.start.bottom - dy }))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    setGrabbed(false)
    if (d.moved) {
      setPosition((value) => {
        writePetPosition(value)
        homeRef.current = value
        return value
      })
      return
    }
    setPokeAt(Date.now())
  }

  const onLeft = window.innerWidth - position.right - PET_SIZE / 2 < window.innerWidth / 2

  return (
    <div ref={wrapRef} className="pointer-events-none fixed z-30 select-none" style={{ right: position.right, bottom: position.bottom }} data-pet={kind}>
      <button
        type="button"
        aria-label={text.label(PET_NAMES[kind])}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
          setGrabbed(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setPokeAt(Date.now())
          }
        }}
        className={`pointer-events-auto block touch-none rounded-2xl ${grabbed ? 'cursor-grabbing' : 'cursor-pointer'}`}
      >
        <PetStage kind={kind} status={status} pokeAt={pokeAt} bubbleAlign={onLeft ? 'left' : 'right'} grabbed={grabbed} pull={pull} motion={motion} />
      </button>
    </div>
  )
}
