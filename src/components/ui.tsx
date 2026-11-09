import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { messages, useMessages } from '../lib/i18n'
import { LOAD_SHOW_AFTER_MS } from '../lib/load'
import { CheckIcon } from './Icons'
import { Kbd } from './Shortcuts'

/** 기다리는 동안만 보이는 로봇 애니메이션이라, 플레이어와 엔진은 그때 따로 받아요. */
const AiLoader = lazy(() => import('./AiLoader'))

/** 빈 서류 안내 위에 띄우는 펄럭이는 빈 종이예요. 로봇과 같은 플레이어로, 받는 동안은 같은 크기의 빈자리만 둬요. */
export function EmptyPaper({ className = 'size-28' }: { className?: string }) {
  return (
    <Suspense fallback={<span aria-hidden className={`block ${className}`} />}>
      <AiLoader src="/lottie/empty-document.lottie" className={className} />
    </Suspense>
  )
}

/** 기다리는 중을 알리는 모래시계 애니메이션이에요(LottieFiles의 Free loading Animation, LK Jing). 심사 중인 API 키가 써요. */
export function WaitingGlass({ className = 'size-28' }: { className?: string }) {
  return (
    <Suspense fallback={<span aria-hidden className={`block ${className}`} />}>
      <AiLoader src="/lottie/review-waiting.lottie" className={className} />
    </Suspense>
  )
}

/** 거절을 알리는 빨간 엑스 애니메이션이에요(`public/lottie/review-rejected.json`, 직접 그렸어요). 거절된 API 키가 써요. 한 번만 재생하고 엑스가 그려진 채로 멈춰요. */
export function RejectedMark({ className = 'size-28' }: { className?: string }) {
  return (
    <Suspense fallback={<span aria-hidden className={`block ${className}`} />}>
      <AiLoader src="/lottie/review-rejected.json" className={className} loop={false} />
    </Suspense>
  )
}

/**
 * 여러 화면이 같이 쓰는 기본 모양이에요. 버튼, 입력칸, 작은 제목, 고르는 칸, 탭, 목록, 오류 문구를 한 곳에서 정해요.
 * 새 화면은 여기 것을 쓰고 같은 모양을 다시 적지 않아요. 크기가 다르면 여기에 단계를 더해요.
 */

const TEXT = messages({
  ko: { loading: '불러오고 있어요', progress: '진행 정도', more: (count: number) => `${count}개 더 보기` },
  en: { loading: 'Loading', progress: 'Progress', more: (count: number) => `Show ${count} more` },
})

// ── 긴 목록 ────────────────────────────────────────────

/** 긴 목록을 처음에 그리는 수이자, 더 그릴 때마다 늘리는 수예요. */
const SHOW_STEP = 24

/**
 * 공고가 수백, 수천 개로 늘어도 화면이 버벅이지 않게 긴 목록을 조금씩 그려요. 처음에 step개만 그리고,
 * 목록 끝(`more`)이 화면에 들어오면 저절로 step개씩 더 그려요. 끝에는 "N개 더 보기" 버튼도 있어요. reset이 바뀌면(검색어, 필터) 처음 수로 돌아가요.
 * 화면은 `items.slice(0, count)`만 그리고 목록 아래에 `more`를 둬요. 다 그렸으면 more는 아무것도 그리지 않아요.
 */
export function useShowMore(total: number, reset: unknown, step = SHOW_STEP): { count: number; more: ReactNode } {
  const L = useMessages(TEXT)
  const [count, setCount] = useState(step)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => setCount(step), [reset, step])
  const left = Math.max(0, total - count)
  useEffect(() => {
    const node = sentinel.current
    if (!node || left === 0) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setCount((value) => value + step)
    }, { rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [left, step])
  const more =
    left > 0 ? (
      <div ref={sentinel} className="mt-6 flex justify-center">
        <button type="button" onClick={() => setCount((value) => value + step)} className={toolButton}>
          {L.more(Math.min(step, left))}
        </button>
      </div>
    ) : null
  return { count, more }
}

// ── 버튼 ───────────────────────────────────────────────

/**
 * 버튼, 드롭다운, 입력칸, 검색창, 거르는 버튼의 모서리 둥글기와 높이예요. 모두 이 둘 하나로 맞춰서, 어느 화면에서 나란히 놓여도 높이와 모서리가 같아요.
 * 새 버튼과 입력칸도 이것을 써요. 표 안의 작은 글자 버튼(ghostButton)과 아이콘 버튼만 한 단계 작아요.
 */
export const buttonRadius = 'rounded-lg'
/** 버튼, 드롭다운, 입력칸, 검색창의 높이(40px)예요. */
export const controlHeight = 'h-10'

const brandFill = 'bg-brand font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'

/** 메인 컬러 버튼이에요(40px). 아이콘을 앞에 붙여도 가운데에 맞아요. */
export const primaryButton = `inline-flex ${controlHeight} items-center justify-center gap-1.5 ${buttonRadius} px-4 text-[13px] ${brandFill}`
/** 안내 화면 가운데에 두는 메인 버튼이에요. 높이는 같고 옆 여백과 글자만 조금 커요. */
export const primaryButtonMd = `inline-flex ${controlHeight} items-center justify-center ${buttonRadius} px-5 text-[14px] ${brandFill}`
/** 로그인처럼 폭을 다 채우는 메인 버튼이에요. 높이는 다른 버튼과 같아요. */
export const primaryButtonLg = `${controlHeight} w-full ${buttonRadius} text-[15px] ${brandFill}`
/** 취소처럼 바탕 없이 글자만 있는 버튼이에요. */
export const quietButton = `${controlHeight} ${buttonRadius} px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900`
/** 지우기처럼 되돌리기 어려운 작업의 확인 버튼이에요. */
export const dangerButton = `${controlHeight} ${buttonRadius} bg-red-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400`
const softBase = `${controlHeight} shrink-0 ${buttonRadius} bg-gray-100 px-4 text-[13px] font-medium text-gray-700 transition-colors disabled:text-gray-400 disabled:hover:text-gray-400`
/** 더 보기, 연결 끊기처럼 옅은 회색 알약 버튼이에요. */
export const softButton = `${softBase} hover:text-brand`
/** 연결 끊기, 기기 로그아웃처럼 지우는 쪽의 회색 알약 버튼이에요. 마우스를 올리면 빨개져요. */
export const softDangerButton = `${softBase} hover:text-red-500`

// 누를 수 없을 때는 글자만 흐려지고, 마우스를 올려도 테두리와 글자가 바뀌지 않아요.
const toolBase =
  'flex items-center gap-2 border border-gray-200 bg-white font-medium whitespace-nowrap transition-colors disabled:text-gray-400 disabled:hover:border-gray-200 disabled:hover:text-gray-400'
/** 테두리를 두른 흰 도구 버튼이에요(40px). 드롭다운, 재진단, 복사 같은 보조 작업에 써요. */
export const toolButton = `${toolBase} ${controlHeight} ${buttonRadius} px-3.5 text-[13px] text-gray-800 hover:border-gray-300 hover:text-gray-950`
/**
 * 화면 맨 위 거르는 줄(공고 탐색, 추천 공고, 기술 블로그)의 도구 버튼이에요. 높이는 다른 버튼과 같고(40px) 글자만 조금 커요.
 * 드롭다운의 size="lg"가 이 모양이에요.
 */
export const toolButtonLg = `${toolBase} ${controlHeight} ${buttonRadius} px-4 text-[14px] text-gray-800 hover:border-gray-300 hover:text-gray-950`
/** 도구 버튼의 빨간 모양이에요. 삭제에 써요. */
export const toolDangerButton = `${toolBase} ${controlHeight} ${buttonRadius} px-3.5 text-[13px] text-red-500 hover:border-red-200 hover:text-red-600`
/**
 * 제목 줄의 도구 버튼을 휴대폰(640px 미만)에서 아이콘만 남긴 40px 칸으로 줄여요. 버튼에 덧붙이고, 글자는 `phoneHidden`으로 감싸 화면 읽기 프로그램에는 남겨요.
 * 리포트처럼 제목 줄 버튼이 많아 두 줄로 넘치는 화면이 써요.
 */
export const iconOnPhone = 'max-sm:w-10 max-sm:justify-center max-sm:px-0'
export const phoneHidden = 'max-sm:sr-only'

const ghostBase = `h-8 shrink-0 ${buttonRadius} px-2 text-[12.5px] font-medium transition-colors disabled:text-gray-300 disabled:hover:bg-transparent`
/** 줄과 표 안에 두는 작은 글자 버튼이에요(32px). */
export const ghostButton = `${ghostBase} text-gray-600 hover:bg-gray-100 hover:text-gray-900`
/** 작은 글자 버튼의 빨간 모양이에요. */
export const ghostDangerButton = `${ghostBase} text-red-500 hover:bg-red-50 hover:text-red-600`

/** 아이콘만 있는 버튼이에요. sm은 떠 있는 작은 카드, md는 창과 칸의 도구 줄, lg는 40px 버튼과 나란히 놓일 때예요. */
const iconMd = `flex shrink-0 items-center justify-center ${buttonRadius} text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300 disabled:hover:bg-transparent`
export const iconButton = {
  sm: `flex size-7 shrink-0 items-center justify-center ${buttonRadius} text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700`,
  md: `size-8 ${iconMd}`,
  lg: `size-10 ${iconMd}`,
}

// ── 메뉴 ───────────────────────────────────────────────

/** 버튼을 누르면 펼쳐지는 메뉴 칸이에요. 자리(위치, 폭, 펼쳐지는 방향)는 덧붙여서 정해요. */
export const menuPanel = 'animate-pop rounded-xl border border-gray-200 bg-white p-1.5'
const menuBase = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] transition-colors'
/** 메뉴의 한 줄이에요. */
export const menuItem = `${menuBase} text-gray-800 hover:bg-gray-100 disabled:text-gray-400`
/** 지우기처럼 빨간 메뉴 줄이에요. */
export const menuDangerItem = `${menuBase} font-medium text-red-500 hover:bg-red-50`

// ── 입력칸 ─────────────────────────────────────────────

/** 입력칸의 공통 모양이에요. 흰 바탕에 테두리, 포커스가 가면 메인 컬러 테두리예요. */
export const fieldBase = 'border border-gray-200 bg-white text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand'
// 모바일에서 글자가 16px보다 작으면 입력칸을 누를 때 화면이 확대돼서, 좁은 화면에서는 16px로 둬요.
/** 한 줄 입력칸(40px)이에요. */
export const textField = `${controlHeight} w-full ${buttonRadius} px-3 text-base sm:text-[13.5px] ${fieldBase}`
/** 창과 칸 안의 한 줄 입력칸이에요. 높이(40px)는 textField와 같고 글자만 조금 작아요. */
export const textFieldSm = `${controlHeight} w-full ${buttonRadius} px-3 text-base sm:text-[13px] ${fieldBase}`
/** 여러 줄 입력칸이에요. 높이는 덧붙여서 정해요. */
export const textArea = `w-full resize-none ${buttonRadius} p-4 text-base leading-relaxed sm:text-[14px] ${fieldBase}`

// ── 글자 ───────────────────────────────────────────────

/** 칸 안의 작은 제목(판단 근거, 보완 방법 등)이에요. */
export const label = 'text-[12.5px] font-medium text-gray-500'
/** 이름표의 크기와 모양이에요(28px). 색은 덧붙여서 정해요. `tag`와 스킬 이름표(`SkillChip`, `GapParts`)가 같이 써요. */
export const chipShape = 'inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-[12.5px]'
/** 작은 이름표의 모양이에요. 테두리 없이 옅은 회색으로 채운 칸이에요. */
export const tag = `${chipShape} border-transparent bg-gray-200/70 text-gray-700`

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
  /** 예전의 흰 이름표. 흰 칸이 도드라져 보여서 지금은 회색 이름표와 같아요 */
  white: 'bg-gray-200/70 text-gray-600',
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
  // md는 바깥 높이가 40px라 같은 줄의 버튼, 드롭다운, 입력칸과 높이가 같아요.
  md: { box: 'rounded-lg p-0.5', item: 'h-9 rounded-md px-3.5 text-[13px]', icon: 'size-9 rounded-md' },
}

/** 켜고 끄는 작은 체크 칸과 이름이에요. 켜면 메인 컬러 칸에 흰 체크가 들어가요. */
export function Checkbox({ checked, onChange, children, className = '' }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-[13px] text-gray-600 select-none ${className}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span className={`flex size-4 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${checked ? 'border-brand bg-brand' : 'border-gray-300 bg-white'}`}>
        {checked && <CheckIcon className="size-3 text-white" strokeWidth={2.2} />}
      </span>
      {children}
    </label>
  )
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
 * 기다리는 화면의 큰 모양이에요. 위에 움직이는 로봇(`AiLoader`), 그 아래 동그란 진행 고리 안에 큰 퍼센트, 맨 아래에 지금 하는 일의 문장이 있어요.
 * AI를 기다리는 칸(`AiProgress`, `GapParts`)이 써요. 자료를 받는 동안은 이것 대신 뼈대(`Skeleton`)예요.
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

/** 뼈대(`Skeleton`)의 한 조각이에요. 회색 막대가 천천히 옅어졌다 짙어져요. 회색 칸 위에서도 보이게 gray-200/70이에요. */
export function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-skeleton rounded-md bg-gray-200/70 ${className}`} />
}

/** 뼈대가 흉내 낼 내용의 모양이에요. */
export type SkeletonShape = 'cards' | 'rows' | 'lines' | 'page' | 'document' | 'calendar' | 'block' | 'stats' | 'app'

/** 회색 칸 하나의 뼈대예요. 공고 카드처럼 로고와 이름, 제목, 한 줄 정보, 이름표, 아래 줄이 있어요. */
function CardBones() {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <Bone className="size-9 rounded-lg" />
        <Bone className="h-3.5 w-24" />
      </div>
      <Bone className="mt-5 h-5 w-4/5" />
      <Bone className="mt-3 h-3.5 w-3/5" />
      <div className="mt-5 flex gap-1.5">
        <Bone className="h-6 w-16" />
        <Bone className="h-6 w-14" />
        <Bone className="h-6 w-20" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Bone className="h-6 w-20" />
        <Bone className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  )
}

/** 표나 리스트의 한 줄 뼈대예요. */
function RowBones({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Bone className="size-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <Bone className={`h-4 ${index % 3 === 1 ? 'w-2/5' : index % 3 === 2 ? 'w-3/5' : 'w-1/2'}`} />
        <Bone className="mt-2 h-3 w-1/3" />
      </div>
      <Bone className="hidden h-6 w-16 sm:block" />
    </div>
  )
}

const DOC_WIDTHS = ['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-full', 'w-2/3']

/**
 * 자료를 받는 동안 내용이 올 자리에 두는 뼈대(스켈레톤)예요. 내용과 비슷한 모양의 회색 칸이 천천히 깜빡여요.
 * AI를 기다리는 곳은 이것을 쓰지 않고 진행 정도를 알려 주는 `AiProgress`(`ProgressRing`)를 써요.
 * shape는 cards(공고 카드 그리드), rows(표와 리스트), lines(메뉴 안처럼 좁은 자리), page(화면 하나), document(글), calendar(달력), block(지도처럼 큰 칸 하나), stats(숫자 칸과 표), app(사이드바와 화면)이에요.
 * 금방 끝나는 받기에서 깜빡이지 않게 0.15초 뒤에 나타나요. 그동안은 자리만 차지해요. 읽기 프로그램에는 "불러오고 있어요"를 알려요.
 */
export function Skeleton({ shape = 'page', count, className = '' }: { shape?: SkeletonShape; count?: number; className?: string }) {
  const L = useMessages(TEXT)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), LOAD_SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])
  const many = (fallback: number) => Array.from({ length: count ?? fallback }, (_, index) => index)
  let body: ReactNode
  switch (shape) {
    case 'cards':
      body = (
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @6xl:grid-cols-3">
            {many(6).map((index) => (
              <CardBones key={index} />
            ))}
          </div>
        </div>
      )
      break
    case 'rows':
      body = (
        <div className="divide-y divide-gray-200/70 overflow-hidden rounded-2xl bg-gray-50">
          {many(8).map((index) => (
            <RowBones key={index} index={index} />
          ))}
        </div>
      )
      break
    case 'lines':
      body = (
        <div className="flex flex-col gap-2.5">
          {many(3).map((index) => (
            <Bone key={index} className={`h-3.5 ${index % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
          ))}
        </div>
      )
      break
    case 'document':
      body = (
        <div className="flex flex-col gap-3">
          <Bone className="mb-3 h-7 w-2/3" />
          {many(12).map((index) => (
            <Bone key={index} className={`h-3.5 ${DOC_WIDTHS[index % DOC_WIDTHS.length]} ${index % 4 === 3 ? 'mb-4' : ''}`} />
          ))}
        </div>
      )
      break
    case 'calendar':
      body = (
        <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="h-9 border-b border-gray-200 bg-gray-50" />
            <div className="grid grid-cols-7">
              {Array.from({ length: 42 }, (_, index) => (
                <div key={index} className="h-20 border-gray-200 p-2 not-[:nth-child(7n)]:border-r not-[:nth-last-child(-n+7)]:border-b sm:h-24">
                  <Bone className="h-3 w-4" />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden flex-col gap-2 @5xl:flex">
            <Bone className="mb-2 h-5 w-32" />
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <Bone className="size-8 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <Bone className="h-3.5 w-3/4" />
                  <Bone className="mt-2 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
      break
    case 'block':
      body = <Bone className="size-full min-h-[420px] rounded-2xl" />
      break
    case 'stats':
      body = (
        <div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="rounded-2xl bg-gray-50 p-4">
                <Bone className="h-3 w-16" />
                <Bone className="mt-3 h-7 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-gray-50 p-5">
            <Bone className="h-4 w-28" />
            <div className="mt-5 flex h-36 items-end gap-2">
              {[40, 65, 50, 80, 55, 90, 70, 60, 85, 45, 75, 95].map((height, index) => (
                <span key={index} aria-hidden className="block flex-1 animate-skeleton rounded-t-md bg-gray-200/70" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </div>
      )
      break
    case 'app':
      body = (
        <div className="flex min-h-dvh">
          <div className="hidden w-60 shrink-0 flex-col gap-2 bg-gray-50 px-3 pt-14 md:flex">
            {many(9).map((index) => (
              <div key={index} className="flex items-center gap-2.5 px-2 py-1.5">
                <Bone className="size-4 rounded" />
                <Bone className={`h-3.5 ${index % 2 === 0 ? 'w-24' : 'w-20'}`} />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 px-4 pt-16 sm:px-6 md:px-10">
            <Bone className="mx-auto h-12 w-full max-w-2xl rounded-xl" />
            <Bone className="mt-12 h-5 w-40" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className={index === 1 ? 'hidden sm:block' : index === 2 ? 'hidden xl:block' : ''}>
                  <CardBones />
                </div>
              ))}
            </div>
            <Bone className="mt-10 h-5 w-32" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className={index === 1 ? 'hidden sm:block' : index === 2 ? 'hidden xl:block' : ''}>
                  <CardBones />
                </div>
              ))}
            </div>
          </div>
        </div>
      )
      break
    default:
      body = (
        <div>
          <div className="rounded-2xl bg-gray-50 p-5 sm:p-6">
            <Bone className="h-4 w-32" />
            <Bone className="mt-4 h-7 w-2/3" />
            <Bone className="mt-3 h-3.5 w-full" />
            <Bone className="mt-2 h-3.5 w-4/5" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((index) => (
              <div key={index} className="rounded-2xl bg-gray-50 p-5">
                <Bone className="h-4 w-24" />
                {[0, 1, 2].map((line) => (
                  <Bone key={line} className={`mt-4 h-3.5 ${line === 2 ? 'w-1/2' : 'w-full'}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )
  }
  return (
    <div aria-busy="true" className={`${visible ? 'animate-fade' : 'invisible'} ${className}`}>
      <span role="status" className="sr-only">
        {L.loading}
      </span>
      {body}
    </div>
  )
}

/** 화면 가운데에 두는 AI 진행 칸(`AiProgress`)의 자리예요. */
export const loadCenter = 'mx-auto mt-16 w-full max-w-md'

// ── 카드 ───────────────────────────────────────────────

/** 카드는 앞에서부터 조금씩 늦게 떠올라요. 뒤쪽 카드는 더 늦추지 않아요. */
export const stagger = (order: number): CSSProperties => ({ animationDelay: `${Math.min(order, 14) * 28}ms` })
