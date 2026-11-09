import { useEffect, useRef, useState } from 'react'
import { useReports } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import {
  desktopPet,
  petEvent,
  postPetState,
  readPetPosition,
  usePet,
  usePetActivity,
  usePetHidden,
  usePetLoadingNow,
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

const clamp = (position: PetPosition): PetPosition => ({
  right: Math.max(0, Math.min(window.innerWidth - PET_SIZE, position.right)),
  bottom: Math.max(0, Math.min(window.innerHeight - PET_SIZE, position.bottom)),
})

/** AI 요청과 만드는 중인 리포트를 모아 펫이 지금 바쁜지, 몇 퍼센트인지, 마지막으로 끝난 일이 무엇인지 알려요. */
function usePetStatus(): PetStatus {
  const activity = usePetActivity()
  const loading = usePetLoadingNow()
  const reports = useReports()
  // 만드는 중이던 리포트가 다 되거나 실패하면 알려요.
  const pendingIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const now = new Set(reports.filter((report) => report.status === 'pending').map((report) => report.id))
    for (const id of pendingIds.current) {
      if (now.has(id)) continue
      const report = reports.find((item) => item.id === id)
      if (report?.status === 'done') petEvent('done')
      else if (report?.status === 'failed') petEvent('error')
    }
    pendingIds.current = now
  }, [reports])
  const pendingReport = reports.find((report) => report.status === 'pending')
  return {
    busy: activity.jobs > 0 || !!pendingReport,
    loading,
    percent: activity.jobs > 0 ? activity.progress : (pendingReport?.progress ?? null),
    event: activity.event,
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
  }, [status.busy, status.loading, status.percent, status.event?.at, hidden])
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

  useEffect(() => {
    const onResize = () => setPosition((value) => clamp(value))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const drag = useRef<{ x: number; y: number; start: PetPosition; moved: boolean } | null>(null)
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, start: position, moved: false }
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
        return value
      })
      return
    }
    setPokeAt(Date.now())
  }

  const onLeft = window.innerWidth - position.right - PET_SIZE / 2 < window.innerWidth / 2

  return (
    <div className="pointer-events-none fixed z-30 select-none" style={{ right: position.right, bottom: position.bottom }} data-pet={kind}>
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
        <PetStage kind={kind} status={status} pokeAt={pokeAt} bubbleAlign={onLeft ? 'left' : 'right'} grabbed={grabbed} pull={pull} />
      </button>
    </div>
  )
}
