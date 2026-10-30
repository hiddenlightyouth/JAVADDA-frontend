import { useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { Kbd } from './Shortcuts'
import { messages, useMessages } from '../lib/i18n'
import { CheckIcon, ChevronDownIcon } from './Icons'
import { Bone } from './Skeleton'
import { label as labelText, menuItem, menuPanel, toolButton } from './ui'

const TEXT = messages({
  ko: { loading: '불러오고 있어요.' },
  en: { loading: 'Loading.' },
})

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
  /** 불러오는 중이면 true. 항목 대신 스켈레톤을 보여줘요. */
  loading?: boolean
}

/**
 * 버튼을 누르면 아래로 펼쳐지는 메뉴예요. 공고 탐색의 직군, 경력, 정렬과 예상 질문의 유형 고르기에 같이 써요.
 * 고른 항목에는 체크 표시가 붙고, 바깥을 누르거나 Esc를 누르면 닫혀요.
 */
export function Dropdown({ label, value, active = false, groups, onOpen, align = 'left', className = '' }: {
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
  /** 버튼 모양을 덧씌울 때 써요. */
  className?: string
}) {
  const L = useMessages(TEXT)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 메뉴 줄의 누름이 바깥으로 흘러나오기 전에(캡처 단계에서) 먼저 받아야, 옆의 다른 메뉴를 눌렀을 때도 이 메뉴가 닫혀요.
  useDismiss(open, ref, () => setOpen(false), { capture: true })

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen((value) => !value)
        }}
        className={`${toolButton} ${active ? 'border-brand! text-brand-hover!' : ''} ${className}`}
      >
        {label && <span className="text-gray-500">{label}</span>}
        {value && <span className="max-w-40 truncate">{value}</span>}
        <ChevronDownIcon className={`size-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className={`absolute top-full z-10 mt-2 max-h-[60dvh] w-64 overflow-y-auto ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'} ${menuPanel}`}>
          {groups.map((group, index) => (
            <div key={group.title ?? index} className={index > 0 ? 'mt-1 border-t border-gray-100 pt-1' : ''}>
              {group.title && <p className={`px-2.5 pt-2 pb-1 ${labelText}`}>{group.title}</p>}
              {group.note && <p className="px-2.5 py-2 text-[13px] leading-relaxed text-gray-500">{group.note}</p>}
              {group.loading && (
                <div aria-busy="true">
                  <span className="sr-only">{L.loading}</span>
                  {['w-24', 'w-32', 'w-20', 'w-28', 'w-24'].map((width, order) => (
                    <div key={order} aria-hidden className="flex h-9 items-center justify-between px-2.5">
                      <Bone className={`h-3 ${width}`} />
                      <Bone className="h-3 w-10" />
                    </div>
                  ))}
                </div>
              )}
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
        </div>
      )}
    </div>
  )
}
