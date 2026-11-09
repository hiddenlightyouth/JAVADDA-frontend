import { useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { isApp, postToApp } from '../lib/app'
import { track } from '../lib/analytics'
import { messages, useMessages } from '../lib/i18n'
import { readJson, writeItem, writeJson } from '../lib/storage'
import { createStore, useStore } from '../lib/store'
import { Modal } from './Dialog'
import { ChevronDownIcon, CloseButton, GripIcon } from './Icons'
import { buttonRadius, Checkbox, controlHeight, iconButton, primaryButton } from './ui'

/**
 * 새 진단 화면의 배치예요. 검색창 아래의 줄(요즘 뜨는 기업, 공고 줄, 공모전)을 어떤 순서로 둘지, 어느 줄을 숨길지 정해요.
 * 이 기기의 localStorage(`javadda:home-layout`)에 기억해요.
 */
export const HOME_SECTIONS = ['hot', 'fit', 'companies', 'recent', 'closing', 'again', 'contests'] as const
export type HomeSection = (typeof HOME_SECTIONS)[number]

export interface HomeLayout {
  order: HomeSection[]
  hidden: HomeSection[]
}

const KEY = 'javadda:home-layout'
const DEFAULT: HomeLayout = { order: [...HOME_SECTIONS], hidden: [] }

const isSection = (value: unknown): value is HomeSection => HOME_SECTIONS.includes(value as HomeSection)

/** 저장한 값에서 모르는 줄은 빼고, 나중에 새로 생긴 줄은 기본 순서의 자리에 끼워 넣어요. */
function normalize(saved: Partial<HomeLayout> | null): HomeLayout {
  const order = [...new Set((Array.isArray(saved?.order) ? saved.order : []).filter(isSection))]
  HOME_SECTIONS.forEach((section, index) => {
    if (order.includes(section)) return
    // 기본 순서에서 바로 앞 줄 뒤에 끼워요. 앞 줄이 없으면 맨 앞이에요.
    const before = HOME_SECTIONS.slice(0, index).reverse().find((each) => order.includes(each))
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, section)
  })
  const hidden = [...new Set((Array.isArray(saved?.hidden) ? saved.hidden : []).filter(isSection))]
  return { order, hidden }
}

const store = createStore<HomeLayout>(normalize(readJson<Partial<HomeLayout> | null>(KEY, null)))

export const useHomeLayout = () => useStore(store, (value) => value, DEFAULT)

function save(next: HomeLayout) {
  store.set(next)
  // 기본 배치로 돌아오면 지워서, 나중에 기본 순서가 바뀌어도 따라가요.
  const same = next.hidden.length === 0 && next.order.every((section, index) => section === DEFAULT.order[index])
  if (same) writeItem(KEY, null)
  else writeJson(KEY, next)
}

const TEXT = messages({
  ko: {
    edit: '홈 화면 편집',
    title: '홈 화면 편집',
    body: '보고 싶은 줄만 켜고, 줄을 끌거나 화살표로 순서를 바꿔요.',
    close: '닫기',
    reset: '초기화',
    done: '완료',
    up: (name: string) => `${name} 위로`,
    down: (name: string) => `${name} 아래로`,
    names: {
      fit: '나와 잘 맞는 공고',
      hot: '요즘 뜨는 기업',
      companies: '기업으로 둘러보기',
      recent: '따끈따끈 공고',
      closing: '마감이 가까운 공고',
      again: '다시 볼 공고',
      contests: '공모전',
    } satisfies Record<HomeSection, string>,
  },
  en: {
    edit: 'Customize home',
    title: 'Customize home',
    body: 'Turn on the rows you want and drag or use the arrows to reorder them.',
    close: 'Close',
    reset: 'Reset',
    done: 'Done',
    up: (name: string) => `Move ${name} up`,
    down: (name: string) => `Move ${name} down`,
    names: {
      fit: 'Good fits for you',
      hot: 'Trending companies',
      companies: 'Browse by company',
      recent: 'Just posted',
      closing: 'Closing soon',
      again: 'Worth another look',
      contests: 'Contests',
    } satisfies Record<HomeSection, string>,
  },
})

export const HOME_LAYOUT_TEXT = TEXT

/** 끌기를 시작했다고 볼 거리(px)예요. 이보다 덜 움직이면 체크 칸을 누른 것으로 쳐요. */
const DRAG_START = 4
/** 줄이 비켜나거나 제자리로 가는 시간(ms)이에요. */
const SLIDE_MS = 200

interface Drag {
  id: HomeSection
  from: number
  /** 지금 놓을 자리예요. */
  to: number
  /** 잡은 뒤 움직인 거리(px)예요. */
  dy: number
  /** 잡을 때 잰 줄마다의 위쪽과 높이예요. */
  tops: number[]
  heights: number[]
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 앱에서는 트랙패드를 톡 울려요. 브라우저에서는 아무 일도 없어요. */
function haptic(kind: 'alignment' | 'level') {
  if (isApp) postToApp({ type: 'haptic', kind })
}

/** 잡은 줄의 가운데가 어느 자리에 왔는지 세요. 다른 줄의 가운데를 넘으면 그 자리예요. */
function slotOf(drag: Pick<Drag, 'from' | 'dy' | 'tops' | 'heights'>) {
  const center = drag.tops[drag.from] + drag.dy + drag.heights[drag.from] / 2
  let to = drag.from
  drag.tops.forEach((top, index) => {
    const middle = top + drag.heights[index] / 2
    if (index > drag.from && center > middle) to = Math.max(to, index)
    if (index < drag.from && center < middle) to = Math.min(to, index)
  })
  return to
}

/**
 * 새 진단 화면의 배치를 바꾸는 창이에요. 줄마다 켜고 끄는 체크 칸, 손잡이, 위아래 버튼이 있어요. 바꾸면 바로 화면에 보여요.
 * 줄을 잡아 끌면 그 줄이 손가락을 따라오고 다른 줄이 미끄러지듯 비켜나요. 놓거나 위아래 버튼을 누르면 줄이 새 자리로 미끄러져 가요.
 */
export function HomeLayoutDialog({ onClose }: { onClose: () => void }) {
  const L = useMessages(TEXT)
  const layout = useHomeLayout()
  const titleId = useId()
  const [drag, setDrag] = useState<Drag | null>(null)
  const rows = useRef(new Map<HomeSection, HTMLLIElement>())
  /** 순서를 바꾸기 직전에 잰 줄의 자리예요. 바뀐 뒤 그 자리에서 새 자리로 미끄러지게 해요. */
  const before = useRef<Map<HomeSection, number> | null>(null)
  const press = useRef<{ id: HomeSection; y: number; pointer: number } | null>(null)

  useLayoutEffect(() => {
    const last = before.current
    before.current = null
    if (!last || reducedMotion()) return
    rows.current.forEach((element, id) => {
      const from = last.get(id)
      if (from === undefined) return
      const delta = from - element.getBoundingClientRect().top
      if (Math.abs(delta) < 1) return
      element.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], { duration: SLIDE_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
    })
  }, [layout.order])

  const remember = () => {
    before.current = new Map([...rows.current].map(([id, element]) => [id, element.getBoundingClientRect().top]))
  }

  const move = (id: HomeSection, to: number) => {
    const order = layout.order.filter((each) => each !== id)
    order.splice(Math.max(0, Math.min(order.length, to)), 0, id)
    if (order.every((each, index) => each === layout.order[index])) return
    remember()
    track('home_layout_move', { section: id, to })
    save({ ...layout, order })
  }

  const toggle = (id: HomeSection, on: boolean) => {
    track('home_layout_toggle', { section: id, visible: on })
    save({ ...layout, hidden: on ? layout.hidden.filter((each) => each !== id) : [...layout.hidden, id] })
  }

  const reset = () => {
    track('home_layout_reset')
    remember()
    save(DEFAULT)
  }

  const startDrag = (id: HomeSection, dy: number) => {
    const elements = layout.order.map((each) => rows.current.get(each))
    if (elements.some((element) => !element)) return null
    const from = layout.order.indexOf(id)
    const tops = elements.map((element) => element!.offsetTop)
    const heights = elements.map((element) => element!.offsetHeight)
    haptic('alignment')
    return { id, from, to: from, dy, tops, heights }
  }

  const onPointerDown = (id: HomeSection) => (event: ReactPointerEvent<HTMLLIElement>) => {
    // 위아래 버튼은 그대로 눌러요. 체크 칸은 조금 움직이면 끌기로 바뀌어요.
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    press.current = { id, y: event.clientY, pointer: event.pointerId }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLLIElement>) => {
    const pressed = press.current
    if (!pressed || pressed.pointer !== event.pointerId) return
    const dy = event.clientY - pressed.y
    if (!drag) {
      if (Math.abs(dy) < DRAG_START) return
      const started = startDrag(pressed.id, dy)
      if (!started) return
      try {
        // 줄 밖으로 나가도 계속 따라오게 잡아 둬요. 이미 놓인 손가락이면 오류가 나서 넘겨요.
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // 잡지 못해도 줄 위에서는 그대로 끌려요.
      }
      setDrag(started)
      return
    }
    const to = slotOf({ ...drag, dy })
    if (to !== drag.to) haptic('alignment')
    setDrag({ ...drag, dy, to })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLLIElement>) => {
    if (press.current?.pointer !== event.pointerId) return
    press.current = null
    if (!drag) return
    // 끌기를 마친 손을 떼면 체크 칸이 눌린 것으로 치지 않게, 이어서 오는 클릭 하나를 막아요.
    const swallow = (click: MouseEvent) => {
      click.preventDefault()
      click.stopPropagation()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
    haptic('level')
    remember()
    setDrag(null)
    if (drag.to !== drag.from) {
      const order = layout.order.filter((each) => each !== drag.id)
      order.splice(drag.to, 0, drag.id)
      track('home_layout_move', { section: drag.id, to: drag.to, from: 'drag' })
      save({ ...layout, order })
    } else {
      // 제자리에 놓았으면 순서는 그대로이고, 잡은 줄만 제자리로 미끄러져 돌아와요.
      const element = rows.current.get(drag.id)
      if (element && !reducedMotion())
        element.animate([{ transform: `translateY(${drag.dy}px)` }, { transform: 'translateY(0)' }], { duration: SLIDE_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
    }
  }

  /** 끄는 동안 줄마다 옮겨 그릴 거리예요. 잡은 줄은 손을 따라가고, 사이에 낀 줄은 잡은 줄의 높이만큼 비켜나요. */
  const offsetOf = (index: number) => {
    if (!drag) return 0
    if (index === drag.from) return drag.dy
    const size = drag.heights[drag.from]
    if (drag.from < index && index <= drag.to) return -size
    if (drag.to <= index && index < drag.from) return size
    return 0
  }

  const isDefault = layout.hidden.length === 0 && layout.order.every((section, index) => section === DEFAULT.order[index])

  return (
    <Modal onClose={onClose} labelledBy={titleId} className="flex max-h-[85dvh] w-full max-w-md flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 id={titleId} className="text-[17px] font-semibold text-gray-900">
            {L.title}
          </h2>
          <p className="mt-1 text-[13px] text-gray-500">{L.body}</p>
        </div>
        <CloseButton label={L.close} onClick={onClose} size="md" className="-mt-1 -mr-2" />
      </div>
      <ul className={`relative min-h-0 flex-1 px-3 ${drag ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {layout.order.map((id, index) => {
          const visible = !layout.hidden.includes(id)
          const name = L.names[id]
          const grabbed = drag?.id === id
          return (
            <li
              key={id}
              ref={(element) => {
                if (element) rows.current.set(id, element)
                else rows.current.delete(id)
              }}
              onPointerDown={onPointerDown(id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={drag ? { transform: `translateY(${offsetOf(index)}px)` } : undefined}
              className={`relative flex touch-none items-center gap-2 rounded-xl px-2 py-1.5 select-none ${
                grabbed
                  ? 'z-10 cursor-grabbing bg-gray-100 transition-[background-color,scale] scale-[1.02]'
                  : drag
                    ? 'transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]'
                    : 'transition-colors hover:bg-gray-50'
              }`}
            >
              <GripIcon className={`size-4 shrink-0 ${grabbed ? 'text-gray-500' : 'cursor-grab text-gray-300'}`} />
              <Checkbox checked={visible} onChange={(on) => toggle(id, on)} className="min-w-0 flex-1 py-1.5">
                <span className={`min-w-0 truncate text-[14px] ${visible ? 'text-gray-900' : 'text-gray-400'}`}>{name}</span>
              </Checkbox>
              <button type="button" disabled={index === 0} onClick={() => move(id, index - 1)} aria-label={L.up(name)} className={iconButton.md}>
                <ChevronDownIcon className="size-3.5 rotate-180" />
              </button>
              <button type="button" disabled={index === layout.order.length - 1} onClick={() => move(id, index + 1)} aria-label={L.down(name)} className={iconButton.md}>
                <ChevronDownIcon className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-3 pb-5">
        <button type="button" disabled={isDefault} onClick={reset} className={`${controlHeight} ${buttonRadius} -ml-3.5 px-3.5 text-[13px] font-medium text-red-500 transition-colors hover:text-red-600 disabled:text-gray-300`}>
          {L.reset}
        </button>
        <button type="button" onClick={onClose} className={primaryButton}>
          {L.done}
        </button>
      </div>
    </Modal>
  )
}
