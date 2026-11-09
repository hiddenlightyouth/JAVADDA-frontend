import { useEffect, useRef, useState } from 'react'
import { messages, useMessages } from '../lib/i18n'
import type { PetKind, PetStatus } from '../lib/pet'
import type { PetMood } from './petScene'

const TEXT = messages({
  ko: {
    names: { claude: 'Claude', codex: 'Codex' } as Record<PetKind, string>,
    working: '열심히 하는 중이에요',
    done: '다 됐어요!',
    error: '앗, 잘 안 됐어요',
    hello: ['안녕하세요!', '오늘도 공고 보러 왔어요?', '같이 갭을 채워 봐요', '이력서는 잘 되고 있어요?', '면접 연습도 해 봐요', '간지러워요'],
  },
  en: {
    names: { claude: 'Claude', codex: 'Codex' },
    working: 'Working on it',
    done: 'All done!',
    error: 'Oops, that failed',
    hello: ['Hi there!', 'Looking at postings today?', "Let's close those gaps", "How's the resume going?", 'Try an interview practice', 'That tickles'],
  },
})

export const PET_SIZE = 124
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

type Scene = ReturnType<typeof import('./petScene').createPetScene>

interface Props {
  kind: PetKind
  status: PetStatus
  /** 바뀔 때마다 뛰어오르며 인사해요. */
  pokeAt: number
  /** 바라볼 쪽(-1에서 1). 없으면 이 창 안의 마우스를 따라가요. */
  look?: number
  bubbleAlign: 'left' | 'right' | 'center'
}

/**
 * 펫 한 마리와 말풍선이에요. 앱 화면 안의 펫(`Pet`)과 macOS 앱이 바탕화면에 띄우는 펫 창(`PetWindow`)이 같이 써요.
 * AI를 기다리는 동안 바쁘게 움직이고 퍼센트를 적고, 끝나면 뛰어오르며 기뻐하고, 실패하면 어지러워해요.
 */
export function PetStage({ kind, status, pokeAt, look, bubbleAlign }: Props) {
  const text = useMessages(TEXT)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
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

  const say = (line: string, mood: PetMood, ms = 2600) => {
    window.clearTimeout(bubbleTimer.current)
    setBubble({ text: line, mood })
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms)
  }
  useEffect(() => () => window.clearTimeout(bubbleTimer.current), [])

  // 끝난 일에 반응해요. 켜기 전에 끝난 일에는 반응하지 않아요.
  const mountedAt = useRef(Date.now())
  const event = status.event
  useEffect(() => {
    if (!event || event.at < mountedAt.current) return
    if (event.kind === 'done') {
      sceneRef.current?.hop()
      say(text.done, 'happy')
    } else say(text.error, 'error', 3000)
  }, [event?.at])

  useEffect(() => {
    if (!pokeAt) return
    sceneRef.current?.hop()
    const lines = text.hello
    say(lines[Math.floor(Math.random() * lines.length)], 'talk')
  }, [pokeAt])

  // AI가 분석하거나 화면이 자료를 받는 동안 춤춰요.
  const mood: PetMood = bubble?.mood ?? (status.busy || status.loading ? 'dance' : 'idle')
  useEffect(() => {
    sceneRef.current?.setMood(mood)
  })

  useEffect(() => {
    if (look !== undefined) {
      sceneRef.current?.look(look)
      return
    }
    const onMove = (pointer: PointerEvent) => {
      const box = canvasRef.current?.getBoundingClientRect()
      if (!box) return
      sceneRef.current?.look((pointer.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [look])

  const line = bubble?.text ?? (status.busy ? `${text.working}${status.percent ? ` ${status.percent}%` : ''}` : null)
  const align = bubbleAlign === 'left' ? 'left-2' : bubbleAlign === 'right' ? 'right-2' : 'left-1/2 -translate-x-1/2'

  return (
    <div className="relative" style={{ width: PET_SIZE, height: PET_SIZE }}>
      {line && (
        <div
          role="status"
          // 다크 모드에서 gray-900은 밝아져서, 펫처럼 늘 짙은 회색 말풍선에 흰 글자로 둬요.
          style={{ background: '#2C2C2C', color: '#fff' }}
          className={`absolute bottom-full w-max max-w-56 animate-fade rounded-xl px-3 py-1.5 text-[13px] font-medium ${align}`}
        >
          {line}
        </div>
      )}
      <canvas ref={canvasRef} className="size-full" aria-label={text.names[kind]} />
    </div>
  )
}
