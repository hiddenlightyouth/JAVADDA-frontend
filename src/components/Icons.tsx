import type { ReactNode } from 'react'

// 여러 화면이 같이 쓰는 선 아이콘이에요. 크기와 색은 className으로 정해요.

interface IconProps {
  className?: string
  strokeWidth?: number
  /** 글자 대신 아이콘만 있을 때 읽어 줄 이름. 없으면 화면 낭독기가 건너뛰어요. */
  label?: string
}

function Icon({ className, strokeWidth, label, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {children}
    </svg>
  )
}

export function CloseIcon({ className = 'size-3.5', strokeWidth = 1.6, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  )
}

export function CheckIcon({ className = 'size-3.5 shrink-0 text-brand', strokeWidth = 1.8, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M3.5 8.5l3 3 6-7" />
    </Icon>
  )
}

export function PlusIcon({ className = 'size-3.5', strokeWidth = 1.6, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  )
}

export function ChevronDownIcon({ className = 'size-3 text-gray-400', strokeWidth = 1.6, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M4 6l4 4 4-4" />
    </Icon>
  )
}

export function BackIcon({ className = 'size-4', strokeWidth = 1.7, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M10 3.5L5.5 8 10 12.5" />
    </Icon>
  )
}

export function PinIcon({ className = 'size-3.5 shrink-0 text-gray-400', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M9.5 2.5l4 4-2 .5-2.2 2.2.2 2.8L4 6.5l2.8.2L9 4.5zM6.7 9.3L3 13" />
    </Icon>
  )
}

/** 지역을 나타내는 위치 핀이에요. */
export function MapPinIcon({ className = 'size-3.5 shrink-0 text-gray-400', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M8 14s4.5-4.1 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.9 8 14 8 14z" />
      <circle cx="8" cy="6.5" r="1.6" />
    </Icon>
  )
}

/** 직군을 나타내는 서류 가방이에요. */
export function BriefcaseIcon({ className = 'size-3.5 shrink-0 text-gray-400', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <rect x="2" y="4.75" width="12" height="8.5" rx="1.5" />
      <path d="M5.75 4.75V3.5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v1.25M2 8.5h12" />
    </Icon>
  )
}

/** 경력을 나타내는 사람 모양이에요. */
export function PersonIcon({ className = 'size-3.5 shrink-0 text-gray-400', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <circle cx="8" cy="5.25" r="2.5" />
      <path d="M3 13.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" />
    </Icon>
  )
}

export function TrashIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M2.5 4.5h11M6.5 4.5V3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1M6.75 7v4M9.25 7v4" />
    </Icon>
  )
}

/** 갤러리형 보기예요. 네모 네 칸이에요. */
export function GridIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </Icon>
  )
}

/** 리스트형 보기예요. 가로줄 세 개예요. */
export function ListIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </Icon>
  )
}

export function RefreshIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M13 8a5 5 0 1 1-1.46-3.54M13 2.5v3h-3" />
    </Icon>
  )
}

const CLOSE_BUTTON = {
  /** 떠 있는 작은 카드(로그인 안내, 앱 안내, 평가 등)의 X */
  sm: 'flex size-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700',
  /** 창과 오른쪽에서 여는 칸의 X */
  md: 'flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900',
}

/** 닫기(X) 버튼이에요. 자리는 className으로 정해요. */
export function CloseButton({ label, onClick, size = 'sm', disabled, className = '' }: {
  label: string
  onClick: () => void
  size?: keyof typeof CLOSE_BUTTON
  disabled?: boolean
  className?: string
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`${CLOSE_BUTTON[size]} ${className}`}>
      <CloseIcon className={size === 'sm' ? 'size-3.5' : 'size-4'} />
    </button>
  )
}
