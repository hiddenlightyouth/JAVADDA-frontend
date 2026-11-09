import { useEffect, useRef, useState } from 'react'
import { useReports } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import {
  petEvent,
  readPetPosition,
  usePet,
  usePetActivity,
  usePetHidden,
  writePetPosition,
  type PetKind,
  type PetPosition,
} from '../lib/pet'
import type { PetMood } from './petScene'

const TEXT = messages({
  ko: {
    names: { claude: 'Claude', codex: 'Codex' } as Record<PetKind, string>,
    working: '열심히 하는 중이에요',
    done: '다 됐어요!',
    error: '앗, 잘 안 됐어요',
    hello: ['안녕하세요!', '오늘도 공고 보러 왔어요?', '같이 갭을 채워 봐요', '이력서는 잘 되고 있어요?', '면접 연습도 해 봐요', '간지러워요'],
    label: (name: string) => `펫 ${name}, 눌러서 인사하고 끌어서 옮겨요`,
  },
  en: {
    names: { claude: 'Claude', codex: 'Codex' },
    working: 'Working on it',
    done: 'All done!',
    error: 'Oops, that failed',
    hello: ['Hi there!', 'Looking at postings today?', "Let's close those gaps", "How's the resume going?", 'Try an interview practice', 'That tickles'],
    label: (name: string) => `Pet ${name}. Click to say hi, drag to move`,
  },
})

/** 펫 칸의 크기(px)예요. */
const SIZE = 124
/** 이만큼 넘게 움직이면 누른 게 아니라 끄는 거예요. */
const DRAG_PX = 4
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

type Scene = ReturnType<typeof import('./petScene').createPetScene>

const clamp = (position: PetPosition): PetPosition => ({
  right: Math.max(0, Math.min(window.innerWidth - SIZE, position.right)),
  bottom: Math.max(0, Math.min(window.innerHeight - SIZE, position.bottom)),
})

/**
 * 앱 화면 구석에 떠 있는 펫이에요(설정 창에서 켜요). AI 요청을 기다리는 동안 바쁘게 움직이고 퍼센트를 말풍선에 적고,
 * 끝나면 뛰어오르며 기뻐하고, 실패하면 어지러워해요. 누르면 인사하고, 끌어서 옮기면 그 자리를 기억해요.
 */
export function Pet() {
  const kind = usePet()
  const hidden = usePetHidden()
  if (!kind || hidden) return null
  return <PetBody key={kind} kind={kind} />
}

function PetBody({ kind }: { kind: PetKind }) {
  const text = useMessages(TEXT)
  const activity = usePetActivity()
  const reports = useReports()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const [position, setPosition] = useState<PetPosition>(() => clamp(readPetPosition()))
  const [bubble, setBubble] = useState<{ text: string; mood: PetMood } | null>(null)
  const bubbleTimer = useRef<number | undefined>(undefined)

  // three.js는 펫을 켰을 때만 받아요.
  useEffect(() => {
    let alive = true
    let scene: Scene | null = null
    void import('./petScene').then(({ createPetScene }) => {
      if (!alive || !canvasRef.current) return
      try {
        scene = createPetScene(canvasRef.current, kind, reducedMotion())
        sceneRef.current = scene
      } catch {
        // WebGL을 쓸 수 없는 환경이면 펫을 그리지 않아요.
      }
    })
    return () => {
      alive = false
      scene?.dispose()
      sceneRef.current = null
    }
  }, [kind])

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
  const busy = activity.jobs > 0 || !!pendingReport
  const percent = activity.jobs > 0 ? activity.progress : (pendingReport?.progress ?? null)

  const say = (line: string, mood: PetMood, ms = 2600) => {
    window.clearTimeout(bubbleTimer.current)
    setBubble({ text: line, mood })
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms)
  }
  useEffect(() => () => window.clearTimeout(bubbleTimer.current), [])

  // 끝난 일에 반응해요. 켜기 전에 끝난 일에는 반응하지 않아요.
  const mountedAt = useRef(Date.now())
  const lastEvent = activity.event
  useEffect(() => {
    if (!lastEvent || lastEvent.at < mountedAt.current) return
    if (lastEvent.kind === 'done') {
      sceneRef.current?.hop()
      say(text.done, 'happy')
    } else say(text.error, 'error', 3000)
  }, [lastEvent?.at])

  const mood: PetMood = bubble?.mood ?? (busy ? 'busy' : 'idle')
  useEffect(() => {
    sceneRef.current?.setMood(mood)
  })

  // 마우스가 있는 쪽을 바라봐요.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const center = window.innerWidth - position.right - SIZE / 2
      sceneRef.current?.look((event.clientX - center) / (window.innerWidth / 2))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [position.right])

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
    d.moved = true
    setPosition(clamp({ right: d.start.right - dx, bottom: d.start.bottom - dy }))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) {
      setPosition((value) => {
        writePetPosition(value)
        return value
      })
      return
    }
    poke()
  }
  const poke = () => {
    sceneRef.current?.hop()
    const lines = text.hello
    say(lines[Math.floor(Math.random() * lines.length)], 'talk')
  }

  const line = bubble?.text ?? (busy ? `${text.working}${percent ? ` ${percent}%` : ''}` : null)
  const onLeft = window.innerWidth - position.right - SIZE / 2 < window.innerWidth / 2

  return (
    <div
      className="pointer-events-none fixed z-30 select-none"
      style={{ right: position.right, bottom: position.bottom, width: SIZE, height: SIZE }}
      data-pet={kind}
    >
      {line && (
        <div
          role="status"
          // 다크 모드에서 gray-900은 밝아져서, 펫처럼 늘 짙은 회색 말풍선에 흰 글자로 둬요.
          style={{ background: '#2C2C2C', color: '#fff' }}
          className={`absolute bottom-full w-max max-w-56 animate-fade rounded-xl px-3 py-1.5 text-[13px] font-medium ${onLeft ? 'left-2' : 'right-2'}`}
        >
          {line}
        </div>
      )}
      <button
        type="button"
        aria-label={text.label(text.names[kind])}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            poke()
          }
        }}
        className="pointer-events-auto size-full cursor-grab touch-none rounded-2xl active:cursor-grabbing"
      >
        <canvas ref={canvasRef} className="size-full" />
      </button>
    </div>
  )
}
