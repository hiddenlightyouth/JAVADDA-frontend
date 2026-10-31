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

/** 채용 지도의 내 위치 버튼이에요. */
export function CrosshairIcon({ className = 'size-4', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <circle cx="8" cy="8" r="4.5" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" />
    </Icon>
  )
}

/** 지도의 축소 버튼이에요. */
export function MinusIcon({ className = 'size-3.5', strokeWidth = 1.6, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M3 8h10" />
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

/** 로고가 없는 기업 자리에 넣는 건물이에요. */
export function BuildingIcon({ className = 'size-4 shrink-0 text-gray-400', strokeWidth = 1.4, label }: IconProps) {
  return (
    <Icon className={className} strokeWidth={strokeWidth} label={label}>
      <path d="M3 14V3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v11M10 6.5h2a1 1 0 0 1 1 1V14M1.75 14h12.5M5.5 5h2M5.5 8h2M5.5 11h2" />
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

/** 개념 아이콘의 옅은 면이에요. 선과 같은 색을 14%만 깔아서 두 톤으로 보여요. */
const SOFT = { fill: 'currentColor', fillOpacity: 0.14 } as const

/**
 * 기술 로고가 없는 개념 스킬(테스트, 네트워크, 운영체제 등)의 아이콘이에요. 24 격자에 옅은 면과 선을 겹친 두 톤이에요.
 * 갭 카드의 `SkillMark`가 스킬 이름을 보고 고르고, 맞는 것이 없으면 `code`를 그려요.
 */
const CONCEPTS = {
  /** 네트워크: 지구본 */
  network: (
    <>
      <circle cx="12" cy="12" r="9" {...SOFT} />
      <path d="M12 3c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3ZM3.6 9h16.8M3.6 15h16.8" />
    </>
  ),
  /** 운영체제와 동시성: 칩 */
  system: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2.2" {...SOFT} />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
      <path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
    </>
  ),
  /** 테스트 코드와 코딩 테스트: 키보드 */
  keyboard: (
    <>
      <rect x="2" y="5.5" width="20" height="13" rx="2.6" {...SOFT} />
      <g fill="currentColor" stroke="none">
        <rect x="5" y="8.6" width="2.2" height="2" rx="0.5" />
        <rect x="8.6" y="8.6" width="2.2" height="2" rx="0.5" />
        <rect x="12.2" y="8.6" width="2.2" height="2" rx="0.5" />
        <rect x="15.8" y="8.6" width="3.2" height="2" rx="0.5" />
        <rect x="5" y="12" width="3.2" height="2" rx="0.5" />
        <rect x="9.6" y="12" width="2.2" height="2" rx="0.5" />
        <rect x="13.2" y="12" width="2.2" height="2" rx="0.5" />
        <rect x="16.8" y="12" width="2.2" height="2" rx="0.5" />
        <rect x="7.5" y="15.2" width="9" height="1.6" rx="0.8" />
      </g>
    </>
  ),
  /** 자료구조와 알고리즘: 갈라지는 트리 */
  algorithm: (
    <>
      <path d="M10.9 7.3 7.1 15.7M13.1 7.3l3.8 8.4" />
      <circle cx="12" cy="5" r="2.5" fill="currentColor" />
      <circle cx="6" cy="18.5" r="2.5" {...SOFT} />
      <circle cx="18" cy="18.5" r="2.5" {...SOFT} />
    </>
  ),
  /** 시스템 설계와 아키텍처: 쌓인 판 */
  design: (
    <>
      <path d="M12 3 21 7.5 12 12 3 7.5Z" {...SOFT} />
      <path d="M3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </>
  ),
  /** MSA와 분산 시스템: 이어진 작은 서비스 넷 */
  services: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity={0.3} />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" {...SOFT} />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" {...SOFT} />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" {...SOFT} />
      <path d="M10.5 6.75h3M6.75 10.5v3M17.25 10.5v3M10.5 17.25h3" />
    </>
  ),
  /** LLM과 AI: 반짝이 */
  ai: (
    <>
      <path d="M10 3.5l1.7 4.6a2 2 0 0 0 1.2 1.2L17.5 11l-4.6 1.7a2 2 0 0 0-1.2 1.2L10 18.5l-1.7-4.6a2 2 0 0 0-1.2-1.2L2.5 11l4.6-1.7a2 2 0 0 0 1.2-1.2Z" {...SOFT} />
      <path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="4.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  /** SQL과 데이터베이스: 원통 */
  database: (
    <>
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" {...SOFT} />
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </>
  ),
  /** 협업과 커뮤니케이션: 두 사람 */
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" {...SOFT} />
      <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <circle cx="16.8" cy="8.8" r="2.5" />
      <path d="M16.2 14.4c2.5 0 4.3 1.7 4.8 4.6" />
    </>
  ),
  /** 보안과 인증: 체크가 있는 방패 */
  security: (
    <>
      <path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6Z" {...SOFT} />
      <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </>
  ),
  /** 클라우드와 서버리스: 구름 */
  cloud: <path d="M7 19h10.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.6 9.1 5 5 0 0 0 7 19Z" {...SOFT} />,
  /** 데이터 분석과 파이프라인: 막대그래프 */
  data: (
    <>
      <rect x="6.5" y="12" width="3.2" height="7.5" rx="0.9" {...SOFT} />
      <rect x="11.5" y="8" width="3.2" height="11.5" rx="0.9" fill="currentColor" fillOpacity={0.3} />
      <rect x="16.5" y="4.5" width="3.2" height="15" rx="0.9" {...SOFT} />
      <path d="M3.5 3.5v16.5h17" />
    </>
  ),
  /** 모바일: 휴대전화 */
  mobile: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" {...SOFT} />
      <path d="M10.5 18.3h3" />
    </>
  ),
  /** 배포와 CI/CD: 로켓 */
  deploy: (
    <>
      <path d="M12 2.5c3.3 1.8 5 5.2 5 9.5l-2.2 3.5H9.2L7 12c0-4.3 1.7-7.7 5-9.5Z" {...SOFT} />
      <circle cx="12" cy="9.5" r="1.8" />
      <path d="M7.4 13.2 4.5 16v2.6l4.3-1.3M16.6 13.2l2.9 2.8v2.6l-4.3-1.3M10.6 18.6l1.4 2.9 1.4-2.9" />
    </>
  ),
  /** 모니터링과 로그: 맥박 */
  monitoring: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2.6" {...SOFT} />
      <path d="M6 13h2.8l1.9-4.2 2.6 7 1.9-3.3H18" />
    </>
  ),
  /** 성능과 캐시: 번개 */
  performance: <path d="M13 2.5 4.8 13.5h6.2l-1 8 8.2-11h-6.2Z" {...SOFT} />,
  /** API: 플러그 */
  api: (
    <>
      <path d="M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0Z" {...SOFT} />
      <path d="M9.5 2.5V7M14.5 2.5V7M12 16v5.5" />
    </>
  ),
  /** 웹과 화면: 브라우저 창 */
  web: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2.6" {...SOFT} />
      <path d="M2.5 8.5h19M6.5 12.5h6.5M6.5 15.8h10" />
      <circle cx="5.5" cy="6.25" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8" cy="6.25" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  /** 문서와 글쓰기: 접힌 종이 */
  docs: (
    <>
      <path d="M6.5 2.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5Z" {...SOFT} />
      <path d="M13.5 2.5v5h5M8.5 12h7M8.5 15.5h7" />
    </>
  ),
  /** 그 밖의 기술: 코드 괄호 */
  code: (
    <>
      <rect x="2.5" y="3.5" width="19" height="17" rx="3.5" {...SOFT} stroke="none" />
      <path d="M8.5 8.5 5 12l3.5 3.5M15.5 8.5 19 12l-3.5 3.5M13.3 6.8l-2.6 10.4" />
    </>
  ),
}

export type Concept = keyof typeof CONCEPTS

/** 개념 스킬 아이콘이에요. 색은 className의 글자색을 따라요. */
export function ConceptIcon({ concept, className = 'size-5', label }: { concept: Concept; className?: string; label?: string }) {
  return (
    <Icon className={className} strokeWidth={1.6} label={label} viewBox="0 0 24 24">
      {CONCEPTS[concept]}
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
