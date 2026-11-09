import { useId, useState } from 'react'
import { track } from '../lib/analytics'
import { messages, useMessages } from '../lib/i18n'
import { readJson, writeItem, writeJson } from '../lib/storage'
import { createStore, useStore } from '../lib/store'
import { Modal } from './Dialog'
import { ChevronDownIcon, CloseButton, GripIcon } from './Icons'
import { Checkbox, iconButton, primaryButton, quietButton } from './ui'

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
    body: '보고 싶은 줄만 켜고, 끌거나 화살표로 순서를 바꿔요.',
    close: '닫기',
    reset: '기본 배치로',
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
    notes: {
      fit: '이력서가 있을 때 보여요',
      again: '적합도가 낮았던 공고가 있을 때 보여요',
    } as Partial<Record<HomeSection, string>>,
  },
  en: {
    edit: 'Customize home',
    title: 'Customize home',
    body: 'Turn on the rows you want and drag or use the arrows to reorder them.',
    close: 'Close',
    reset: 'Reset to default',
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
    notes: {
      fit: 'Shown once you add a resume',
      again: 'Shown when a diagnosed posting scored low',
    } as Partial<Record<HomeSection, string>>,
  },
})

export const HOME_LAYOUT_TEXT = TEXT

/** 새 진단 화면의 배치를 바꾸는 창이에요. 줄마다 켜고 끄는 체크 칸, 끌어 옮기는 손잡이, 위아래 버튼이 있어요. 바꾸면 바로 화면에 보여요. */
export function HomeLayoutDialog({ onClose }: { onClose: () => void }) {
  const L = useMessages(TEXT)
  const layout = useHomeLayout()
  const titleId = useId()
  const [drag, setDrag] = useState<{ id: HomeSection; over: HomeSection | null } | null>(null)

  const move = (id: HomeSection, to: number) => {
    const order = layout.order.filter((each) => each !== id)
    order.splice(Math.max(0, Math.min(order.length, to)), 0, id)
    track('home_layout_move', { section: id, to })
    save({ ...layout, order })
  }

  const toggle = (id: HomeSection, on: boolean) => {
    track('home_layout_toggle', { section: id, visible: on })
    save({ ...layout, hidden: on ? layout.hidden.filter((each) => each !== id) : [...layout.hidden, id] })
  }

  const reset = () => {
    track('home_layout_reset')
    save(DEFAULT)
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
      <ul className="min-h-0 flex-1 overflow-y-auto px-3">
        {layout.order.map((id, index) => {
          const visible = !layout.hidden.includes(id)
          const name = L.names[id]
          const note = L.notes[id]
          const over = drag && drag.over === id && drag.id !== id
          const below = over && layout.order.indexOf(drag.id) < index
          return (
            <li
              key={id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', id)
                setDrag({ id, over: null })
              }}
              onDragOver={(event) => {
                if (!drag) return
                event.preventDefault()
                if (drag.over !== id) setDrag({ ...drag, over: id })
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (drag && drag.id !== id) move(drag.id, index)
                setDrag(null)
              }}
              onDragEnd={() => setDrag(null)}
              className={`relative flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-50 ${drag?.id === id ? 'opacity-40' : ''}`}
            >
              {over && <span aria-hidden className={`absolute right-2 left-2 h-0.5 rounded-full bg-brand ${below ? '-bottom-px' : '-top-px'}`} />}
              <GripIcon className="size-4 shrink-0 cursor-grab text-gray-300" />
              <Checkbox checked={visible} onChange={(on) => toggle(id, on)} className="min-w-0 flex-1 py-1.5">
                <span className="min-w-0">
                  <span className={`block truncate text-[14px] ${visible ? 'text-gray-900' : 'text-gray-400'}`}>{name}</span>
                  {note && <span className="block truncate text-[12px] text-gray-400">{note}</span>}
                </span>
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
        <button type="button" disabled={isDefault} onClick={reset} className={`${quietButton} -ml-3.5 disabled:text-gray-300`}>
          {L.reset}
        </button>
        <button type="button" onClick={onClose} className={primaryButton}>
          {L.done}
        </button>
      </div>
    </Modal>
  )
}
