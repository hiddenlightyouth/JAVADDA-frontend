import { lazy, Suspense, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { messages, useMessages } from '../lib/i18n'
import { LOAD_SHOW_AFTER_MS } from '../lib/load'
import { Kbd } from './Shortcuts'

/** 기다리는 동안만 보이는 로봇 애니메이션이라, 플레이어와 엔진은 그때 따로 받아요. */
const AiLoader = lazy(() => import('./AiLoader'))

/**
 * 여러 화면이 같이 쓰는 기본 모양이에요. 버튼, 입력칸, 작은 제목, 고르는 칸, 탭, 목록, 오류 문구를 한 곳에서 정해요.
 * 새 화면은 여기 것을 쓰고 같은 모양을 다시 적지 않아요. 크기가 다르면 여기에 단계를 더해요.
 */

const TEXT = messages({
  ko: { loading: '불러오고 있어요', progress: '진행 정도' },
  en: { loading: 'Loading', progress: 'Progress' },
})

// ── 버튼 ───────────────────────────────────────────────

const brandFill = 'bg-brand font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'

/** 메인 컬러의 알약 버튼이에요. 창과 줄 안의 기본 크기(36px)예요. 아이콘을 앞에 붙여도 가운데에 맞아요. */
export const primaryButton = `inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] ${brandFill}`
/** 안내 화면 가운데에 두는 한 단계 큰 메인 버튼(40px)이에요. */
export const primaryButtonMd = `inline-flex h-10 items-center justify-center rounded-full px-5 text-[14px] ${brandFill}`
/** 로그인처럼 폭을 다 채우는 큰 메인 버튼(48px)이에요. */
export const primaryButtonLg = `h-12 w-full rounded-full text-[15px] ${brandFill}`
/** 취소처럼 바탕 없이 글자만 있는 버튼이에요. */
export const quietButton = 'h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900'
/** 지우기처럼 되돌리기 어려운 작업의 확인 버튼이에요. */
export const dangerButton =
  'h-9 rounded-full bg-red-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400'
/** 더 보기, 연결 끊기처럼 옅은 회색 알약 버튼이에요. */
export const softButton =
  'h-9 shrink-0 rounded-full bg-gray-100 px-4 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand disabled:text-gray-400 disabled:hover:text-gray-400'
/** 연결 끊기, 기기 로그아웃처럼 지우는 쪽의 회색 알약 버튼이에요. 마우스를 올리면 빨개져요. */
export const softDangerButton =
  'h-9 shrink-0 rounded-full bg-gray-100 px-4 text-[13px] font-medium text-gray-700 transition-colors hover:text-red-500 disabled:text-gray-400 disabled:hover:text-gray-400'
/** 테두리를 두른 흰 도구 버튼이에요. 드롭다운, 재진단, 복사 같은 보조 작업에 써요. */
export const toolButton =
  'flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-gray-800 transition-colors hover:border-gray-300 hover:text-gray-950'
/**
 * 화면 맨 위 거르는 줄(공고 탐색, 추천 공고, 기술 블로그)의 큰 도구 버튼(44px)이에요.
 * 같은 줄의 검색창과 기업 고르기 버튼이 44px이라 높이를 맞춰요. 드롭다운의 size="lg"가 이 모양이에요.
 */
export const toolButtonLg =
  'flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-medium text-gray-800 transition-colors hover:border-gray-300 hover:text-gray-950'
/** 도구 버튼의 빨간 모양이에요. 삭제에 써요. */
export const toolDangerButton =
  'flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-red-500 transition-colors hover:border-red-200 hover:text-red-600'
/** 줄과 표 안에 두는 작은 글자 버튼이에요. */
export const ghostButton =
  'h-8 shrink-0 rounded-md px-2 text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300 disabled:hover:bg-transparent'
/** 작은 글자 버튼의 빨간 모양이에요. */
export const ghostDangerButton =
  'h-8 shrink-0 rounded-md px-2 text-[12.5px] font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:text-gray-300 disabled:hover:bg-transparent'

/** 아이콘만 있는 버튼이에요. sm은 떠 있는 작은 카드, md는 창과 칸의 도구 줄이에요. */
export const iconButton = {
  sm: 'flex size-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700',
  md: 'flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300 disabled:hover:bg-transparent',
}

// ── 메뉴 ───────────────────────────────────────────────

/** 버튼을 누르면 펼쳐지는 메뉴 칸이에요. 자리(위치, 폭, 펼쳐지는 방향)는 덧붙여서 정해요. */
export const menuPanel = 'animate-pop rounded-xl border border-gray-200 bg-white p-1.5'
/** 메뉴의 한 줄이에요. */
export const menuItem = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] text-gray-800 transition-colors hover:bg-gray-100 disabled:text-gray-400'
/** 지우기처럼 빨간 메뉴 줄이에요. */
export const menuDangerItem = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] font-medium text-red-500 transition-colors hover:bg-red-50'

// ── 입력칸 ─────────────────────────────────────────────

/** 입력칸의 공통 모양이에요. 흰 바탕에 테두리, 포커스가 가면 메인 컬러 테두리예요. */
export const fieldBase = 'border border-gray-200 bg-white text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand'
// 모바일에서 글자가 16px보다 작으면 입력칸을 누를 때 화면이 확대돼서, 좁은 화면에서는 16px로 둬요.
/** 한 줄 입력칸(40px)이에요. */
export const textField = `h-10 w-full rounded-lg px-3 text-base sm:text-[13.5px] ${fieldBase}`
/** 줄 안에 두는 작은 한 줄 입력칸(36px)이에요. 도구 버튼과 높이가 같아요. */
export const textFieldSm = `h-9 w-full rounded-lg px-3 text-base sm:text-[13px] ${fieldBase}`
/** 여러 줄 입력칸이에요. 높이는 덧붙여서 정해요. */
export const textArea = `w-full resize-none rounded-xl p-4 text-base leading-relaxed sm:text-[14px] ${fieldBase}`

// ── 글자 ───────────────────────────────────────────────

/** 칸 안의 작은 제목(판단 근거, 보완 방법 등)이에요. */
export const label = 'text-[12.5px] font-medium text-gray-500'
/** 작은 이름표의 모양이에요. 테두리를 두른 흰 칸이에요. */
export const tag = 'inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[12.5px] text-gray-700'

const BADGE_TONES = {
  /** 회색 칸 위의 기본 이름표 */
  gray: 'bg-gray-200/70 text-gray-600',
  /** 한 단계 옅은 회색. 빠진 것, 덜 중요한 것 */
  muted: 'bg-gray-200/40 text-gray-400',
  /** 갖춘 것, 강점, 신규처럼 좋은 쪽 */
  brand: 'bg-brand-soft text-brand-hover',
  /** 테두리만 메인 컬러. 면접 예상처럼 따로 눈여겨볼 것 */
  outline: 'border border-brand text-brand',
  /** 마감까지 남은 날, 적합도 낮음 */
  red: 'bg-red-50 text-red-600',
  /** 적합도 중간 */
  amber: 'bg-amber-50 text-amber-700',
  /** 회색 칸 안의 흰 이름표 */
  white: 'bg-white text-gray-600',
}

/**
 * 테두리 없이 바탕색으로 구분하는 작은 이름표예요(24px). 카드의 태그, 주제, 부족과 강점, 서류 검증 태그, 출처에 같이 써요.
 * 테두리를 두른 스킬 이름표는 `SkillChip`, 고르는 버튼은 `Segmented`예요.
 */
export function Badge({ tone = 'gray', strong = false, className = '', children }: { tone?: keyof typeof BADGE_TONES; strong?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[12px] whitespace-nowrap ${strong ? 'font-medium' : ''} ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}

/** 입력 아래나 버튼 줄에 빨갛게 띄우는 오류 문구예요. */
export function FormError({ children, className = '' }: { children: ReactNode; className?: string }) {
  if (!children) return null
  return (
    <p role="alert" className={`animate-rise text-[13px] leading-relaxed text-red-500 ${className}`}>
      {children}
    </p>
  )
}

// ── 고르는 칸과 탭 ─────────────────────────────────────

const SEGMENTED = {
  sm: { box: 'rounded-lg p-0.5', item: 'h-7 rounded-md px-2.5 text-[12.5px]', icon: 'size-7 rounded-md' },
  // md는 바깥 높이가 36px라 같은 줄의 도구 버튼, 드롭다운과 높이가 같아요.
  md: { box: 'rounded-lg p-0.5', item: 'h-8 rounded-md px-3.5 text-[13px]', icon: 'size-8 rounded-md' },
}

/**
 * 여러 값 중 하나를 고르는 칸이에요. 회색 바탕에 고른 것만 흰 칸으로 떠요.
 * 글자 대신 아이콘을 넣으면(icon) 정사각형 칸이 되고, 이름은 읽기 프로그램과 말풍선으로만 알려요.
 */
export function Segmented<T extends string | number>({ label: name, options, value, onChange, size = 'sm', className = '' }: {
  label: string
  options: readonly (readonly [T, string] | readonly [T, string, ReactNode])[]
  value: T
  onChange: (value: T) => void
  size?: keyof typeof SEGMENTED
  className?: string
}) {
  const shape = SEGMENTED[size]
  return (
    <div role="radiogroup" aria-label={name} className={`inline-flex shrink-0 gap-0.5 bg-gray-100 ${shape.box} ${className}`}>
      {options.map(([option, text, icon]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          aria-label={icon ? text : undefined}
          title={icon ? text : undefined}
          onClick={() => {
            if (value !== option) onChange(option)
          }}
          className={`flex items-center justify-center font-medium whitespace-nowrap transition-colors ${icon ? shape.icon : shape.item} ${
            value === option ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {icon ?? text}
        </button>
      ))}
    </div>
  )
}

/** 제목 줄 아래의 밑줄 탭이에요. 고른 탭에 메인 컬러 밑줄이 붙고, 단축키가 있으면 모서리에 자판 모양으로 보여줘요. */
export function Tabs<K extends string>({ label: name, items, current, onSelect, trailing, className = '' }: {
  label: string
  items: readonly { key: K; label: string; shortcut?: string }[]
  current: K
  onSelect: (key: K) => void
  /** 탭 줄 오른쪽 끝에 두는 것 */
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex shrink-0 items-center gap-1 border-b border-gray-200 ${className}`}>
      {/* 단축키 모양이 탭 모서리 밖으로 나와서, 넘치는 부분을 자르지 않아요. */}
      <div role="tablist" aria-label={name} className="flex min-w-0 gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={current === item.key}
            onClick={() => onSelect(item.key)}
            className={`relative -mb-px h-10 shrink-0 border-b-2 px-2 text-[13.5px] font-medium whitespace-nowrap transition-colors sm:px-3 ${
              current === item.key ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {item.label}
            {item.shortcut && <Kbd corner>{item.shortcut}</Kbd>}
          </button>
        ))}
      </div>
      {trailing && <div className="ml-auto flex shrink-0 items-center">{trailing}</div>}
    </div>
  )
}

// ── 목록 ───────────────────────────────────────────────

/** 점을 붙인 목록이에요. brand면 점이 메인 컬러예요. */
export function Bullets({ items, brand = false, className = '' }: { items: readonly ReactNode[]; brand?: boolean; className?: string }) {
  return (
    <ul className={`space-y-1 ${className}`}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-[13.5px] leading-relaxed text-gray-700">
          <span aria-hidden className={`mt-[9px] size-1 shrink-0 rounded-full ${brand ? 'bg-brand' : 'bg-gray-400'}`} />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** 동그라미 안의 번호예요. 회색 칸 위에서는 흰 바탕(onGray), 아직 닿지 않은 단계는 한 단계 짙은 회색(muted), 강조할 때는 메인 컬러(brand)예요. */
export function NumberBadge({ n, tone = 'plain', className = '' }: { n: number; tone?: 'plain' | 'onGray' | 'muted' | 'brand'; className?: string }) {
  const colors = { plain: 'bg-gray-100 text-gray-600', onGray: 'bg-white text-gray-600', muted: 'bg-gray-200/70 text-gray-600', brand: 'bg-brand text-white' }[tone]
  return (
    <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${colors} ${className}`}>
      {n}
    </span>
  )
}

/** 번호를 붙인 목록이에요. 보완 방법, 더 어필할 점, 주요 경력에 써요. */
export function NumberedList({ items, onGray = false, className = '' }: { items: readonly ReactNode[]; onGray?: boolean; className?: string }) {
  return (
    <ol className={`space-y-2.5 ${className}`}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[13.5px] leading-relaxed text-gray-700">
          <NumberBadge n={index + 1} tone={onGray ? 'onGray' : 'plain'} className="mt-px" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  )
}

// ── 불러오는 중 ────────────────────────────────────────

/**
 * 퍼센트 진행 막대의 모양이에요. 왼쪽에 지금 하는 일의 문장, 오른쪽에 "42%"(고정폭 숫자), 아래에 가는 막대(gray-200/70 바탕에 메인 컬러)예요.
 * compact는 메뉴나 표처럼 좁은 자리에 쓰는 한 줄 모양으로, 막대와 퍼센트만 보이고 문장은 읽기 프로그램에만 알려요.
 * AI를 기다리는 막대(`AiProgress`, `GapParts`)와 자료를 받는 막대(`LoadProgress`)가 같이 써요.
 */
export function ProgressBar({ value, text, title, compact = false, className = '' }: { value: number; text: string; title?: string; compact?: boolean; className?: string }) {
  const L = useMessages(TEXT)
  const percent = Math.min(100, Math.max(0, Math.round(value)))
  const bar = (
    <div
      role="progressbar"
      aria-label={`${L.progress}, ${text}`}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`overflow-hidden rounded-full bg-gray-200/70 ${compact ? 'h-1 min-w-0 flex-1' : 'mt-2.5 h-1.5'}`}
    >
      <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
    </div>
  )
  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span role="status" className="sr-only">
          {text}
        </span>
        {bar}
        <span className="shrink-0 text-[12px] font-medium text-gray-500 tabular-nums">{percent}%</span>
      </div>
    )
  }
  return (
    <div className={className}>
      {title && <p className="mb-1 truncate text-[12.5px] text-gray-400">{title}</p>}
      <div className="flex items-baseline justify-between gap-4">
        <p role="status" className="min-w-0 truncate text-[13.5px] text-gray-700">
          {text}
        </p>
        <span className="shrink-0 text-[13px] font-semibold text-gray-900 tabular-nums">{percent}%</span>
      </div>
      {bar}
    </div>
  )
}

/**
 * 기다리는 화면의 큰 모양이에요. 위에 움직이는 로봇(`AiLoader`), 그 아래 동그란 진행 고리 안에 큰 퍼센트, 맨 아래에 지금 하는 일의 문장이 있어요.
 * AI를 기다리는 칸(`AiProgress`, `GapParts`)과 자료를 받는 칸(`LoadProgress`)이 같이 써요. 메뉴나 표처럼 좁은 자리는 `ProgressBar`의 compact를 써요.
 * 로봇은 처음 쓸 때 따로 받아 와서, 받는 동안은 같은 크기의 빈자리만 둬요. 고리는 넘겨받은 퍼센트를 그대로 그려요.
 * title을 주면 문장 위에 작게 적어요(올리는 파일 이름 등).
 */
export function ProgressRing({ value, text, title, className = '' }: { value: number; text: string; title?: string; className?: string }) {
  const L = useMessages(TEXT)
  const percent = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <Suspense fallback={<span aria-hidden className="block size-20" />}>
        <AiLoader className="size-20" />
      </Suspense>
      <div
        role="progressbar"
        aria-label={`${L.progress}, ${text}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative mt-2 size-32"
      >
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-gray-200/70" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - percent}
            className="stroke-brand transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[34px] leading-none font-bold tracking-tight text-gray-900 tabular-nums">
          {percent}
          <span className="mt-2 ml-0.5 text-[16px] font-semibold text-gray-400">%</span>
        </span>
      </div>
      {title && <p className="mt-4 max-w-full truncate text-[12.5px] text-gray-400">{title}</p>}
      <p role="status" className={`${title ? 'mt-1' : 'mt-4'} max-w-full truncate text-[13.5px] text-gray-600`}>
        {text}
      </p>
    </div>
  )
}

/**
 * 자료를 받는 동안 그 자리에 두는 진행 칸이에요. 퍼센트는 받은 바이트로 셈해요(`useLoadProgress`, `src/lib/load.ts`).
 * 화면을 채우는 자리에서는 로봇과 진행 고리(`ProgressRing`)를, compact(메뉴, 표 안)에서는 한 줄 막대를 보여줘요.
 * 금방 끝나는 받기에서 깜빡이지 않게 0.15초 뒤에 나타나요. 그동안은 자리만 차지해요. 문장을 주지 않으면 "불러오고 있어요"예요.
 * 화면 가운데에 둘 때는 `loadCenter`를 className으로 넘겨요.
 */
export function LoadProgress({ percent, text, compact = false, className = '' }: { percent: number; text?: string; compact?: boolean; className?: string }) {
  const L = useMessages(TEXT)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), LOAD_SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div aria-busy="true" className={`${visible ? 'animate-fade' : 'invisible'} ${className}`}>
      {compact ? <ProgressBar value={percent} text={text ?? L.loading} compact /> : <ProgressRing value={percent} text={text ?? L.loading} />}
    </div>
  )
}

/** 화면 가운데에 두는 진행 막대의 자리예요. AI 진행 막대와 같은 폭과 위치예요. */
export const loadCenter = 'mx-auto mt-16 w-full max-w-md'

// ── 카드 ───────────────────────────────────────────────

/** 카드는 앞에서부터 조금씩 늦게 떠올라요. 뒤쪽 카드는 더 늦추지 않아요. */
export const stagger = (order: number): CSSProperties => ({ animationDelay: `${Math.min(order, 14) * 28}ms` })
