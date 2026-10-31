import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss } from '../hooks/useDismiss'
import { messages, useMessages } from '../lib/i18n'
import { CloseButton } from './Icons'
import { dangerButton, primaryButton, quietButton } from './ui'

const TEXT = messages({
  ko: { cancel: '취소', working: '처리 중' },
  en: { cancel: 'Cancel', working: 'Working' },
})

/**
 * 화면을 흐리게 덮고 가운데에 뜨는 창이에요. 바깥을 누르거나 Esc를 누르면 닫혀요.
 * 실수로 닫히면 되돌릴 수 없는 창(서류 올리기 등)은 closeOnBackdrop을 꺼서 바깥을 눌러도 닫히지 않게 해요.
 * 일을 하는 동안(서류를 읽는 중) 아예 닫히면 안 되면 closeOnEscape도 꺼요.
 * 화면 맨 바깥(body)에 그려요. 움직이는 요소 안에 두면 그 요소 크기만큼만 덮여서, 막과 블러가 화면 일부에만 깔려요.
 */
export function Modal({ onClose, labelledBy, alert = false, closeOnBackdrop = true, closeOnEscape = true, className = 'w-full max-w-sm p-5', children }: {
  onClose: () => void
  /** 창 제목의 id예요. 읽기 프로그램이 창 이름으로 읽어요. */
  labelledBy: string
  /** 되돌리기 어려운 작업을 묻는 창이면 켜요. */
  alert?: boolean
  /** 바깥(막)을 누르면 닫을지. 끄면 닫기 버튼이나 Esc로만 닫혀요. */
  closeOnBackdrop?: boolean
  /** Esc를 누르면 닫을지. 끄면 Esc가 창 아래 화면으로도 가지 않게 막기만 해요. */
  closeOnEscape?: boolean
  className?: string
  children: ReactNode
}) {
  const close = useRef(onClose)
  close.current = onClose
  const escape = useRef(closeOnEscape)
  escape.current = closeOnEscape

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 창 아래의 화면(맵, 칸)이 같은 Esc로 또 닫히지 않게 여기서 멈춰요.
      event.stopPropagation()
      if (escape.current) close.current()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-40 animate-fade flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) close.current()
      }}
    >
      <div role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={labelledBy} className={`animate-pop rounded-2xl border border-gray-200 bg-white ${className}`}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** 오른쪽에서 여는 칸의 내용 자리예요. 넘치면 이 안에서 스크롤해요. */
export const panelBody = 'min-h-0 flex-1 overflow-y-auto px-6 pb-6'

/**
 * 오른쪽에서 미끄러져 들어오는 칸이에요. 갭 상세, 서류 상세, 관리자의 회원과 호출 상세가 같이 써요.
 * 바깥을 누르거나 Esc를 누르면 닫혀요. 안에서 확인 창을 띄우는 동안에는 dismissable을 꺼서 칸이 먼저 닫히지 않게 해요.
 * 안에서 고치는 일이 많은 칸(서류 상세)은 closeOnOutside를 꺼서 바깥을 눌러도 닫히지 않고, 닫기 버튼과 Esc로만 닫혀요.
 * `Modal`처럼 화면 맨 바깥(body)에 그려요. header가 있으면 그 오른쪽에, 없으면 맨 위 줄에 닫기 버튼만 둬요.
 */
export function SidePanel({ onClose, closeLabel, labelledBy, label, header, dismissable = true, closeOnOutside = true, className = 'max-w-[440px]', children }: {
  onClose: () => void
  closeLabel: string
  /** 칸 제목의 id예요. 제목이 없으면 label을 넘겨요. */
  labelledBy?: string
  label?: string
  header?: ReactNode
  dismissable?: boolean
  /** 바깥을 누르면 닫을지. 끄면 닫기 버튼과 Esc로만 닫혀요. */
  closeOnOutside?: boolean
  /** 폭을 정해요. */
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  // ref를 넘기지 않으면 바깥 누름은 보지 않고 Esc만 받아요.
  useDismiss(dismissable, closeOnOutside ? ref : null, onClose)
  return createPortal(
    <aside
      ref={ref}
      role="dialog"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className={`fixed inset-y-0 right-0 z-30 flex w-full animate-slide-in flex-col border-l border-gray-200 bg-white ${className}`}
    >
      <div className={header ? 'flex shrink-0 items-start justify-between gap-3 px-6 pt-6 pb-4' : 'flex h-14 shrink-0 items-center justify-end px-4'}>
        {header && <div className="min-w-0">{header}</div>}
        <CloseButton label={closeLabel} size="md" onClick={onClose} />
      </div>
      {children}
    </aside>,
    document.body,
  )
}

/** 되돌리기 어려운 작업을 하기 전에 한 번 더 묻는 창이에요. */
export function ConfirmDialog({ title, body, confirm, danger = false, working = false, onCancel, onConfirm }: {
  title: string
  body: ReactNode
  confirm: string
  danger?: boolean
  working?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const L = useMessages(TEXT)
  // 확인 창이 둘 겹쳐도 제목 id가 겹치지 않게 창마다 따로 만들어요.
  const titleId = useId()
  return (
    <Modal onClose={onCancel} labelledBy={titleId} alert>
      <h2 id={titleId} className="text-[15px] font-semibold text-gray-900">
        {title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed break-keep text-gray-500 [overflow-wrap:anywhere]">{body}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={quietButton}>
          {L.cancel}
        </button>
        <button type="button" autoFocus disabled={working} onClick={onConfirm} className={danger ? dangerButton : primaryButton}>
          {working ? L.working : confirm}
        </button>
      </div>
    </Modal>
  )
}
