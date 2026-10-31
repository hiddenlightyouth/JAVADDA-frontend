import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../hooks/useDismiss'
import { Kbd } from './Shortcuts'
import { CheckIcon, ChevronDownIcon } from './Icons'
import { label as labelText, LoadProgress, menuItem, menuPanel, toolButton, toolButtonLg } from './ui'

interface MenuItem {
  label: string
  /** 오른쪽에 옅게 붙는 값 (공고 수 등) */
  hint?: string
  /** 이 항목의 단축키. 오른쪽에 자판 모양으로 보여줘요. */
  shortcut?: string
  checked?: boolean
  onSelect: () => void
}

interface MenuGroup {
  title?: string
  items: MenuItem[]
  /** 항목 대신 보여줄 안내 (오류 등) */
  note?: string
  /** 불러오는 중이면 받은 정도(0에서 100)예요. 항목 대신 가는 진행 막대와 퍼센트를 보여줘요. */
  progress?: number
}

/** 메뉴와 버튼 사이, 메뉴와 화면 끝 사이의 틈이에요. */
const GAP = 8
/** 아래 남은 자리가 이보다 좁고 위가 더 넓으면 위로 펼쳐요. */
const MIN_BELOW = 240

interface Place {
  left?: number
  right?: number
  top?: number
  bottom?: number
  maxHeight: number
  up: boolean
}

/** 버튼의 자리를 보고 메뉴를 놓을 곳을 구해요. 아래가 좁으면 위로 펼치고, 남은 자리만큼만 키워요. */
function placeOf(button: HTMLElement, align: 'left' | 'right'): Place {
  const rect = button.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - GAP * 2
  const above = rect.top - GAP * 2
  const up = below < MIN_BELOW && above > below
  const horizontal = align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }
  const vertical = up ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }
  return { ...horizontal, ...vertical, maxHeight: Math.max(120, up ? above : below), up }
}

/**
 * 버튼을 누르면 아래로 펼쳐지는 메뉴예요. 공고 탐색의 직군, 경력, 정렬과 예상 질문의 유형 고르기에 같이 써요.
 * 고른 항목에는 체크 표시가 붙고, 바깥을 누르거나 Esc를 누르면 닫혀요.
 * 메뉴는 화면 맨 바깥(body)에 그려요. 설정 창처럼 스크롤되는 칸 안에 두면 칸 끝에서 잘리거나 칸이 같이 늘어나서 어색했어요.
 * 아래 자리가 모자라면 위로 펼치고, 스크롤하거나 창 크기가 바뀌면 버튼을 따라가요.
 */
export function Dropdown({ label, value, active = false, groups, onOpen, align = 'left', size = 'md', className = '' }: {
  /** 버튼에 적는 이름. 고른 값만 보여줘도 뜻이 통하면 넘기지 않아요. */
  label?: string
  /** 지금 고른 값. 있으면 버튼에 이름 옆으로 보여줘요. */
  value?: string
  active?: boolean
  groups: MenuGroup[]
  /** 메뉴를 열 때 불러요. 내용을 그때 받아 올 때 써요. */
  onOpen?: () => void
  /** 메뉴를 버튼의 어느 쪽 끝에 맞출지. 오른쪽 끝에 놓인 버튼(설정 창)은 right예요. */
  align?: 'left' | 'right'
  /** md는 줄 안의 기본 크기(36px), lg는 화면 맨 위 거르는 줄의 크기(44px)예요. */
  size?: 'md' | 'lg'
  /** 버튼 모양을 덧씌울 때 써요. 크기는 size로 정하고 여기서 바꾸지 않아요. */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<Place | null>(null)

  // 메뉴 줄의 누름이 바깥으로 흘러나오기 전에(캡처 단계에서) 먼저 받아야, 옆의 다른 메뉴를 눌렀을 때도 이 메뉴가 닫혀요.
  // 메뉴는 body에 그려져서 ref 바깥에 있으니, 메뉴 안을 누른 것도 바깥으로 치지 않게 따로 알려 줘요.
  useDismiss(open, ref, () => setOpen(false), { capture: true, ignore: (target) => !!menuRef.current?.contains(target) })

  // 열려 있는 동안 버튼 자리를 따라가요. 메뉴 안을 스크롤할 때는 버튼이 움직이지 않으니 그대로 둬요.
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null)
      return
    }
    const update = () => buttonRef.current && setPlace(placeOf(buttonRef.current, align))
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) update()
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, align])

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen((value) => !value)
        }}
        className={`${size === 'lg' ? toolButtonLg : toolButton} ${active ? 'border-brand! text-brand-hover!' : ''} ${className}`}
      >
        {label && <span className="text-gray-500">{label}</span>}
        {value && <span className="max-w-40 truncate">{value}</span>}
        <ChevronDownIcon className={`size-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && place && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ left: place.left, right: place.right, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
          className={`fixed z-50 w-64 overflow-y-auto ${place.up ? (align === 'right' ? 'origin-bottom-right' : 'origin-bottom-left') : align === 'right' ? 'origin-top-right' : 'origin-top-left'} ${menuPanel}`}
        >
          {groups.map((group, index) => (
            <div key={group.title ?? index} className={index > 0 ? 'mt-1 border-t border-gray-100 pt-1' : ''}>
              {group.title && <p className={`px-2.5 pt-2 pb-1 ${labelText}`}>{group.title}</p>}
              {group.note && <p className="px-2.5 py-2 text-[13px] leading-relaxed text-gray-500">{group.note}</p>}
              {group.progress !== undefined && <LoadProgress percent={group.progress} compact className="px-2.5 py-3" />}
              {group.items.map((item, order) => (
                <button
                  key={`${order}:${item.label}`}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={menuItem}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">{item.hint}</span>}
                  {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                  <CheckIcon className={`size-3.5 shrink-0 text-brand ${item.checked ? '' : 'invisible'}`} />
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
