import type { ReactNode } from 'react'
import { iconButton } from './ui'

// 여러 화면이 같이 쓰는 선 아이콘이에요. 크기와 색은 className으로 정해요.

interface IconProps {
  className?: string
  strokeWidth?: number
  /** 글자 대신 아이콘만 있을 때 읽어 줄 이름. 없으면 화면 낭독기가 건너뛰어요. */
  label?: string
}

function Icon({ className, strokeWidth, label, viewBox = '0 0 16 16', children }: IconProps & { viewBox?: string; children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
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

/** 강의 난이도를 나타내는 세 칸 막대예요. */
export function LevelIcon({ className = 'size-3.5 shrink-0 text-gray-400', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M3.5 13V10M8 13V6.5M12.5 13V3" />
    </Icon>
  )
}

/** 강의 시간을 나타내는 시계예요. */
export function ClockIcon({ className = 'size-3.5 shrink-0 text-gray-400', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5v3.25l2 1.25" />
    </Icon>
  )
}

/** 줄을 열면 자세한 칸이 나온다는 걸 알려주는 오른쪽 화살표예요. */
export function ChevronRightIcon({ className = 'size-3.5 shrink-0 text-gray-300', strokeWidth = 1.6, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M6 3.5l4.5 4.5L6 12.5" />
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

/** 닫기(X) 버튼이에요. 자리는 className으로 정해요. */
export function CloseButton({ label, onClick, size = 'sm', disabled, className = '' }: {
  label: string
  onClick: () => void
  size?: keyof typeof iconButton
  disabled?: boolean
  className?: string
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`${iconButton[size]} ${className}`}>
      <CloseIcon className={size === 'sm' ? 'size-3.5' : 'size-4'} />
    </button>
  )
}

/** 대표 이력서 표시예요. filled면 안을 채워요. */
export function StarIcon({ className = 'size-4', strokeWidth = 1.4, label, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z" fill={filled ? 'currentColor' : 'none'} />
    </Icon>
  )
}

/** 마감 달력의 달력이에요. */
export function CalendarIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.8h11M5.5 2v2.6M10.5 2v2.6" />
    </Icon>
  )
}

/** 채용 지도의 접은 지도예요. */
export function MapIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M2.5 4.2l3.7-1.7 3.6 1.7 3.7-1.7v9.3l-3.7 1.7-3.6-1.7-3.7 1.7z" />
      <path d="M6.2 2.5v9.3M9.8 4.2v9.3" />
    </Icon>
  )
}

/** 찾기 칸의 돋보기예요. */
export function SearchIcon({ className = 'size-4 shrink-0 text-gray-400', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </Icon>
  )
}

/** 새 탭에서 연다는 표시예요. */
export function ExternalLinkIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
    </Icon>
  )
}

/** 파일을 올리는 화살표예요. */
export function UploadIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M8 10.5V3M5 6l3-3 3 3M2.75 10v2.25a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1V10" />
    </Icon>
  )
}

/** 링크를 나타내는 사슬이에요. */
export function LinkIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M6.75 9.25a2.65 2.65 0 0 0 3.75 0l2-2a2.65 2.65 0 0 0-3.75-3.75l-.65.65" />
      <path d="M9.25 6.75a2.65 2.65 0 0 0-3.75 0l-2 2a2.65 2.65 0 0 0 3.75 3.75l.65-.65" />
    </Icon>
  )
}

/** 근거가 약하다는 세모예요. */
export function TriangleIcon({ className = 'size-4 shrink-0 text-gray-400', strokeWidth = 1.6, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M8 3l5.5 9.5h-11z" />
    </Icon>
  )
}

/** 서류 한 장이에요. 내 이력서 메뉴에 써요. */
export function DocumentIcon({ className = 'size-4 shrink-0', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M4 1.75h5.5L12.5 4.75v9a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V2.5a.75.75 0 0 1 .75-.75Z" />
      <path d="M6 7.5h4.5M6 10h4.5M6 5h2" />
    </Icon>
  )
}

/** 관리자를 나타내는 방패예요. */
export function ShieldIcon({ className = 'size-4 shrink-0', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M8 2l4.5 1.7v3.6c0 2.9-1.8 5.3-4.5 6.4-2.7-1.1-4.5-3.5-4.5-6.4V3.7z" />
    </Icon>
  )
}

/** 사이드바를 접고 펴는 버튼의 그림이에요. */
export function SidebarIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <rect x="2" y="3" width="12" height="10" rx="2.5" />
      <path d="M6.5 3v10" />
    </Icon>
  )
}

/*
 * 기술 로고가 없는 개념 스킬(테스트, 네트워크, 운영체제 등)의 아이콘이에요. 갭 카드의 `SkillMark`가 스킬 이름을 보고 골라 그려요.
 */

/** 테스트 코드예요. 실험용 비커예요. */
export function BeakerIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M5.5 2h5M6.5 2v4.2L3.2 12.6A1 1 0 0 0 4.1 14h7.8a1 1 0 0 0 .9-1.4L9.5 6.2V2M4.6 10h6.8" />
    </Icon>
  )
}

/** 네트워크예요. 지구본이에요. */
export function GlobeIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.7 1.6 2.5 3.6 2.5 6S9.7 12.4 8 14c-1.7-1.6-2.5-3.6-2.5-6S6.3 3.6 8 2Z" />
    </Icon>
  )
}

/** 운영체제와 컴퓨터 구조예요. 칩이에요. */
export function ChipIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" />
      <path d="M6.5 6.5h3v3h-3zM6.5 2.5v2M9.5 2.5v2M6.5 11.5v2M9.5 11.5v2M2.5 6.5h2M2.5 9.5h2M11.5 6.5h2M11.5 9.5h2" />
    </Icon>
  )
}

/** 자료구조와 알고리즘이에요. 나뭇가지처럼 갈라지는 트리예요. */
export function TreeIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <circle cx="8" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="12.5" r="1.5" />
      <path d="M7.3 4.8 4.7 11.2M8.7 4.8l2.6 6.4" />
    </Icon>
  )
}

/** 시스템 설계와 아키텍처예요. 겹겹이 쌓인 판이에요. */
export function LayersIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M8 2.5 14 5.5 8 8.5 2 5.5ZM2 8.3l6 3 6-3M2 11l6 3 6-3" />
    </Icon>
  )
}

/** MSA예요. 작은 서비스 네 개예요. */
export function BoxesIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </Icon>
  )
}

/** LLM과 AI예요. 반짝이는 별이에요. */
export function SparkleIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M7 2.5 8.3 6l3.2 1.3-3.2 1.3L7 12l-1.3-3.4L2.5 7.3 5.7 6ZM12 10.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" />
    </Icon>
  )
}

/** SQL과 데이터베이스예요. 원통이에요. */
export function DatabaseIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <ellipse cx="8" cy="4" rx="5" ry="1.8" />
      <path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" />
    </Icon>
  )
}

/** 그 밖의 개념 스킬이에요. 코드 괄호예요. */
export function CodeIcon({ className = 'size-4', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3 7 13" />
    </Icon>
  )
}

/** 압정이에요. 사이드바에서 고정한 리포트에 붙여요. */
export function PinIcon({ className = 'size-3.5 shrink-0', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M6 2h4M7 2v4L4.5 9h7L9 6V2M8 9v5" />
    </Icon>
  )
}

/** 점 세 개예요. 줄의 관리 메뉴를 여는 버튼에 써요. */
export function DotsIcon({ className = 'size-4', label }: Omit<IconProps, 'strokeWidth'>) {
  return (
    <Icon className={className} label={label}>
      <circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

/** 로그아웃이에요. 문 밖으로 나가는 화살표예요. */
export function SignOutIcon({ className = 'size-4 shrink-0', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M6.5 2.5h-2a1.5 1.5 0 0 0-1.5 1.5v8a1.5 1.5 0 0 0 1.5 1.5h2M10 5l3 3-3 3M13 8H6.5" />
    </Icon>
  )
}

/** 위아래로 펼쳐지는 메뉴라는 표시예요. */
export function ChevronUpDownIcon({ className = 'size-4 shrink-0 text-gray-400', strokeWidth = 1.5, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M5 6.5L8 3.5l3 3M5 9.5l3 3 3-3" />
    </Icon>
  )
}

/** 설정의 톱니바퀴예요. */
export function SettingsIcon({ className = 'size-4', strokeWidth = 1.9, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label} viewBox="0 0 24 24">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

/** 버그 신고의 벌레예요. */
export function BugIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M5.5 5.5a2.5 2.5 0 0 1 5 0M5 6.5h6a1 1 0 0 1 1 1v2a4 4 0 0 1-8 0v-2a1 1 0 0 1 1-1zM8 8v5.5M4 9H2M14 9h-2M4.5 12L3 13.5M11.5 12l1.5 1.5M4.3 6.8L3 5.5M11.7 6.8L13 5.5" />
    </Icon>
  )
}

/** 기술 블로그를 나타내는 펼친 책이에요. */
export function BookIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M2.5 3.5h6a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5h-6.5z" />
      <path d="M13.5 3.5h-1a2 2 0 0 0-2 2" />
      <path d="M10.5 13.5V6M13.5 3.5V12h-3" />
    </Icon>
  )
}

/** 말로 답하기의 마이크예요. */
export function MicIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <rect x="5.75" y="1.75" width="4.5" height="8" rx="2.25" />
      <path d="M3.25 7.5a4.75 4.75 0 0 0 9.5 0M8 12.25v2" />
    </Icon>
  )
}

/** 질문 듣기의 스피커예요. */
export function SpeakerIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M2.5 6.25v3.5h2.25L8 12.5v-9L4.75 6.25z" />
      <path d="M10.5 5.75a3.2 3.2 0 0 1 0 4.5M12.25 4a5.7 5.7 0 0 1 0 8" />
    </Icon>
  )
}

/** 알려 줄 것이 있다는 동그라미 느낌표예요. */
export function AlertIcon({ className = 'size-4 shrink-0', strokeWidth = 1.6, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.5M8 11h.01" />
    </Icon>
  )
}
