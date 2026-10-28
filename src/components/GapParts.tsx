import { useState, type ReactNode } from 'react'
import { careerName, companyOf, daysLeft, daysSince, familyName, fitOf, type Company, type Resume, type GapKind, type JobPosting, type RadarAxis, type RequirementCheck, LEVEL_MAX } from '../lib/gap'
import { getLang, messages, useMessages } from '../lib/i18n'
import { primaryButton } from './Dialog'
import { Bone } from './Skeleton'
import { CheckIcon, CloseIcon } from './Icons'

/**
 * 취업 갭 진단의 화면들이 같이 쓰는 작은 부품이에요. 기업 머리글자, 적합도 표시, 스킬 이름표, 공고 카드, 흰 칸, 레이더와 막대 그래프가 있어요.
 * 새 화면도 여기 것을 쓰고, 같은 모양을 화면마다 다시 그리지 않아요.
 */

/** 올라온 지 이 날수까지는 신규로 보여줘요. */
const NEW_DAYS = 3

const TEXT = messages({
  ko: {
    fit: (value: number) => `적합도 ${value}%`,
    noFit: '이력서를 올리면 적합도가 보여요',
    deadline: (days: number) => (days === 0 ? '오늘 마감' : `마감 ${days}일 전`),
    always: '상시 채용',
    posted: (days: number) => (days <= NEW_DAYS ? '신규' : `${days}일 전`),
    required: '필수',
    preferred: '우대',
    kinds: { missing: '부족', partial: '보완', strength: '강점' } as Record<GapKind, string>,
    checks: { met: '충분해요', partial: '근거가 약해요', missing: '보이지 않아요' } as Record<RequirementCheck['status'], string>,
    mine: '나',
    wanted: '공고',
    loading: '불러오고 있어요.',
    failed: '불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    retry: '다시 시도하기',
    remove: (name: string) => `${name} 빼기`,
  },
  en: {
    fit: (value: number) => `${value}% fit`,
    noFit: 'Upload a resume to see your fit',
    deadline: (days: number) => (days === 0 ? 'Closes today' : `Closes in ${days} ${days === 1 ? 'day' : 'days'}`),
    always: 'Rolling',
    posted: (days: number) => (days <= NEW_DAYS ? 'New' : `${days} days ago`),
    required: 'Required',
    preferred: 'Preferred',
    kinds: { missing: 'Missing', partial: 'Weak', strength: 'Strength' },
    checks: { met: 'Covered', partial: 'Weak evidence', missing: 'Not found' },
    mine: 'You',
    wanted: 'Posting',
    loading: 'Loading.',
    failed: "Couldn't load. Please try again in a moment.",
    retry: 'Try again',
    remove: (name: string) => `Remove ${name}`,
  },
})

/** 기업 로고를 둥근 네모에 넣어요. 로고가 없거나 불러오지 못하면 기업 이름의 머리글자를 대신 넣어요. */
export function CompanyMark({ company, className = 'size-12 text-[17px]' }: { company: Company; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (company.logo && !broken) {
    return (
      // 로고는 흰 바탕에 맞춰 만든 그림이라, 다크 모드에서도 바탕을 진짜 흰색으로 둬요.
      <span aria-hidden className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-[#fff] ${className}`}>
        <img src={company.logo} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-contain" />
      </span>
    )
  }
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl bg-gray-100 font-semibold text-gray-700 ${className}`}>
      {company.initial}
    </span>
  )
}

/** 적합도 퍼센트예요. 숫자만 메인 컬러로 강조하고, 아래에 가는 막대로 한 번 더 보여줘요. */
export function FitBadge({ fit, compact = false }: { fit: number | null; compact?: boolean }) {
  const L = useMessages(TEXT)
  if (fit === null) return <span className="text-[12px] text-gray-400">{compact ? '' : L.noFit}</span>
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap" aria-label={L.fit(fit)}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <span className="block h-full rounded-full bg-brand" style={{ width: `${fit}%` }} />
      </span>
      <span className="text-[13px] font-semibold text-brand tabular-nums">{fit}%</span>
    </span>
  )
}

export type ChipTone = 'plain' | 'met' | 'partial' | 'missing' | 'active'

const CHIP_TONES: Record<ChipTone, string> = {
  plain: 'border-gray-200 bg-white text-gray-700',
  met: 'border-brand bg-brand-soft text-brand-hover',
  partial: 'border-dashed border-gray-300 bg-white text-gray-700',
  missing: 'border-dashed border-gray-200 bg-white text-gray-400',
  active: 'border-brand bg-brand-soft text-brand-hover',
}

/** 스킬 이름표예요. 공고와 이력서의 스킬을 같은 모양으로 늘어놓아요. onRemove가 있으면 오른쪽에 X가 붙어요. */
export function SkillChip({ name, tone = 'plain', hint, onRemove, onClick, className = '' }: {
  name: string
  tone?: ChipTone
  /** 이름 옆에 옅게 붙는 값(숙련도 등) */
  hint?: string
  onRemove?: () => void
  onClick?: () => void
  className?: string
}) {
  const L = useMessages(TEXT)
  const base = `inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] ${CHIP_TONES[tone]} ${className}`
  const body = (
    <>
      {tone === 'met' && <CheckIcon className="size-3 shrink-0" />}
      <span className="truncate">{name}</span>
      {hint && <span className="text-[11px] opacity-70 tabular-nums">{hint}</span>}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} transition-colors hover:border-brand hover:text-brand-hover`}>
        {body}
      </button>
    )
  }
  return (
    <span className={base}>
      {body}
      {onRemove && (
        <button type="button" aria-label={L.remove(name)} onClick={onRemove} className="-mr-1 flex size-4 items-center justify-center rounded text-gray-400 transition-colors hover:text-gray-900">
          <CloseIcon className="size-2.5" />
        </button>
      )}
    </span>
  )
}

/** 부족, 보완, 강점 이름표예요. 강점만 메인 컬러로 표시해요. */
export function KindLabel({ kind }: { kind: GapKind }) {
  const L = useMessages(TEXT)
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md px-2 text-[11.5px] font-medium ${
        kind === 'strength' ? 'bg-brand-soft text-brand-hover' : kind === 'partial' ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {L.kinds[kind]}
    </span>
  )
}

/** 필수와 우대 이름표예요. */
export function RequirementLabel({ requirement }: { requirement: 'required' | 'preferred' }) {
  const L = useMessages(TEXT)
  return <span className="text-[11.5px] text-gray-400">{requirement === 'required' ? L.required : L.preferred}</span>
}

/** 필수 역량을 갖췄는지를 체크, 세모, 엑스로 보여줘요. 빠진 것만 빨간색이에요. */
export function CheckMark({ status }: { status: RequirementCheck['status'] }) {
  const L = useMessages(TEXT)
  if (status === 'met') return <CheckIcon className="size-4 shrink-0 text-brand" label={L.checks.met} />
  if (status === 'partial') {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="size-4 shrink-0 text-gray-400" role="img" aria-label={L.checks.partial}>
        <path d="M8 3l5.5 9.5h-11z" />
      </svg>
    )
  }
  return <CloseIcon className="size-4 shrink-0 text-red-500" strokeWidth={1.8} label={L.checks.missing} />
}

/** 카드는 앞에서부터 조금씩 늦게 떠올라요. 뒤쪽 카드는 더 늦추지 않아요. */
const STAGGER_MS = 28
const STAGGER_MAX = 14

export const cardsGrid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4'
/** 한 줄만 보여주는 카드 줄. 둘째 줄부터는 높이를 0으로 두고 잘라서, 화면 폭에 들어가는 만큼만 보여요. */
export const cardsRow = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] auto-rows-[0px] grid-rows-[auto] gap-x-4 overflow-hidden'

/** 공고 카드예요. 기업 머리글자, 공고 제목, 기업과 지역, 소개 두 줄, 직군과 마감, 적합도가 있어요. */
export function PostingCard({ posting, fit, order = 0, onOpen }: { posting: JobPosting; fit: number | null; order?: number; onOpen: (posting: JobPosting) => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const left = daysLeft(posting)
  return (
    <li className="min-h-0 animate-rise" style={{ animationDelay: `${Math.min(order, STAGGER_MAX) * STAGGER_MS}ms` }}>
      <button type="button" onClick={() => onOpen(posting)} className="flex h-[196px] w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-brand">
        <span className="flex items-center gap-3">
          <CompanyMark company={company} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-gray-900">{posting.title}</span>
            <span className="block truncate text-[12px] text-gray-400">
              {company.name}, {posting.location}
            </span>
          </span>
        </span>
        <span className="mt-3 line-clamp-2 min-h-0 flex-1 text-[13px] leading-relaxed text-gray-600">{posting.summary}</span>
        <span className="mt-2 flex items-center justify-between gap-2 text-[12px] text-gray-400">
          <span className="min-w-0 truncate">
            {familyName(posting.family)}, {careerName(posting.career)}
            {left !== null ? `, ${L.deadline(left)}` : `, ${L.always}`}
          </span>
          <FitBadge fit={fit} compact />
        </span>
      </button>
    </li>
  )
}

/** 이력서 기준으로 스킬 이름표의 색을 정해요. 진단 시작 화면과 같은 기준이에요. */
export function skillTone(skill: string, resume: Resume | null): ChipTone {
  if (!resume) return 'plain'
  const level = resume.skills.find((item) => item.name === skill)?.level ?? 0
  return level >= 3 ? 'met' : level > 0 ? 'partial' : 'missing'
}

/**
 * 공고 자체를 앞에 세운 카드예요. 요즘 올라온 공고 줄에서 써요.
 * 올라온 때와 공고 제목을 크게 두고, 기업은 작은 로고와 이름으로 한 줄만 적고, 필수 역량을 이름표로 보여줘요.
 * 공고 카드와 크기가 같아서 같은 줄 규칙(cardsRow)에 들어가요.
 */
export function RecentPostingCard({ posting, resume, order = 0, onOpen }: { posting: JobPosting; resume: Resume | null; order?: number; onOpen: (posting: JobPosting) => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const days = daysSince(posting)
  return (
    <li className="min-h-0 animate-rise" style={{ animationDelay: `${Math.min(order, STAGGER_MAX) * STAGGER_MS}ms` }}>
      <button type="button" onClick={() => onOpen(posting)} className="group flex h-[196px] w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-brand">
        <span className={`text-[12px] font-medium ${days <= NEW_DAYS ? 'text-brand' : 'text-gray-400'}`}>{L.posted(days)}</span>
        <span className="mt-1.5 line-clamp-2 text-[16px] leading-snug font-semibold text-gray-900 transition-colors group-hover:text-brand">{posting.title}</span>
        <span className="mt-2 flex min-w-0 items-center gap-1.5 text-[12px] text-gray-500">
          <CompanyMark company={company} className="size-5 rounded-md text-[9px]" />
          <span className="truncate">
            {company.name}, {posting.location}, {careerName(posting.career)}
          </span>
        </span>
        <span className="mt-2.5 mb-3 line-clamp-2 min-h-0 flex-1 text-[13px] leading-relaxed text-gray-600">{posting.summary}</span>
        <span className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 flex-wrap gap-1.5 overflow-hidden [max-height:28px]">
            {posting.required.slice(0, 3).map((skill) => (
              <SkillChip key={skill} name={skill} tone={skillTone(skill, resume)} className="h-6! px-2! text-[12px]!" />
            ))}
          </span>
          <FitBadge fit={fitOf(posting, resume)} compact />
        </span>
      </button>
    </li>
  )
}

/** 공고 카드와 같은 크기와 배치의 뼈대예요. */
export function PostingCardsSkeleton({ row = false, count }: { row?: boolean; count?: number }) {
  const L = useMessages(TEXT)
  return (
    <ul className={row ? cardsRow : cardsGrid} aria-busy="true">
      <li className="sr-only">{L.loading}</li>
      {Array.from({ length: count ?? (row ? 8 : 9) }, (_, item) => (
        <li key={item} aria-hidden className="flex h-[196px] min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Bone className="size-12 shrink-0 rounded-xl!" />
            <div className="min-w-0 flex-1">
              <Bone className="h-3.5 w-3/5" />
              <Bone className="mt-2 h-3 w-2/5" />
            </div>
          </div>
          <div className="mt-4 flex-1">
            <Bone className="h-3 w-full" />
            <Bone className="mt-2 h-3 w-4/5" />
          </div>
          <div className="flex items-center justify-between">
            <Bone className="h-3 w-28" />
            <Bone className="h-3 w-16" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 회색 바탕 위의 흰 칸이에요. 제목 줄 오른쪽에 버튼을 둘 수 있어요. */
export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[14px] font-semibold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** 비어 있거나 실패했을 때 가운데에 보여주는 안내예요. */
export function Notice({ title, body, action, onAction, className = '' }: { title: string; body?: string; action?: string; onAction?: () => void; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-4 text-center ${className}`}>
      <div>
        <p className="text-[15px] font-semibold text-gray-900">{title}</p>
        {body && <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-gray-500">{body}</p>}
      </div>
      {action && onAction && (
        <button type="button" onClick={onAction} className={primaryButton}>
          {action}
        </button>
      )}
    </div>
  )
}

export function Failed({ onRetry, className = '' }: { onRetry: () => void; className?: string }) {
  const L = useMessages(TEXT)
  return <Notice title={L.failed} action={L.retry} onAction={onRetry} className={className} />
}

/** 가로 막대 하나예요. 이름, 막대, 값이 한 줄이에요. */
export function Meter({ label, value, max = 100, display, note }: { label: ReactNode; value: number; max?: number; display?: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 truncate text-[13px] text-gray-900">{label}</span>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full origin-left animate-grow rounded-full bg-brand" style={{ width: `${Math.max(1.5, (value / max) * 100)}%` }} />
        </div>
        <span className="w-12 shrink-0 text-right text-[12.5px] text-gray-700 tabular-nums">{display ?? value}</span>
      </div>
      {note && <p className="mt-1 pl-[7.75rem] text-[12px] leading-relaxed text-gray-400">{note}</p>}
    </div>
  )
}

/** 적합도를 큰 숫자와 둥근 테두리로 보여줘요. */
export function ScoreRing({ score, size = 112 }: { score: number; size?: number }) {
  const stroke = 7
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-gray-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className="text-brand transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[28px] font-semibold text-gray-900 tabular-nums">
        {score}
        <span className="ml-0.5 text-[14px] font-medium text-gray-400">%</span>
      </span>
    </div>
  )
}

/** 축마다 나와 공고의 수준을 겹쳐 그린 레이더예요. 라이브러리 없이 SVG로 그려요. 공고는 회색 점선, 나는 메인 컬러예요. */
export function Radar({ axes, size = 260 }: { axes: RadarAxis[]; size?: number }) {
  const L = useMessages(TEXT)
  const center = size / 2
  const radius = size / 2 - 36
  const count = axes.length
  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2
    const r = (Math.max(0, Math.min(LEVEL_MAX, value)) / LEVEL_MAX) * radius
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const
  }
  const polygon = (pick: (axis: RadarAxis) => number) => axes.map((axis, index) => point(index, pick(axis)).join(',')).join(' ')
  const label = axes.map((axis, index) => {
    const [x, y] = point(index, LEVEL_MAX + 1.1)
    const anchor: 'middle' | 'end' | 'start' = Math.abs(x - center) < 4 ? 'middle' : x < center ? 'end' : 'start'
    return { x, y, text: axis.axis, anchor }
  })
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} role="img" aria-label={axes.map((axis) => `${axis.axis} ${L.mine} ${axis.mine}, ${L.wanted} ${axis.required}`).join('; ')}>
        {[1, 2, 3, 4, 5].map((level) => (
          <polygon key={level} points={polygon(() => level)} fill="none" stroke="currentColor" strokeWidth={1} className="text-gray-100" />
        ))}
        {axes.map((_, index) => {
          const [x, y] = point(index, LEVEL_MAX)
          return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke="currentColor" strokeWidth={1} className="text-gray-100" />
        })}
        <polygon points={polygon((axis) => axis.required)} fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 3" className="text-gray-400" />
        <polygon points={polygon((axis) => axis.mine)} fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" className="text-brand" />
        {axes.map((axis, index) => {
          const [x, y] = point(index, axis.mine)
          return <circle key={axis.axis} cx={x} cy={y} r={3} fill="currentColor" className="text-brand" />
        })}
        {label.map((item) => (
          <text key={item.text} x={item.x} y={item.y} textAnchor={item.anchor} dominantBaseline="middle" className="fill-gray-500 font-sans text-[11px]">
            {item.text}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 flex items-center gap-4 text-[12px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-brand" aria-hidden />
          {L.mine}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-gray-400" aria-hidden />
          {L.wanted}
        </span>
      </figcaption>
    </figure>
  )
}

/** 몇 주 동안의 흐름을 작은 세로 막대로 보여줘요. 마지막 값이 가장 진해요. */
export function Sparkline({ series, className = 'h-10' }: { series: number[]; className?: string }) {
  const max = Math.max(1, ...series)
  return (
    <div className={`flex items-end gap-[2px] ${className}`} aria-hidden>
      {series.map((value, index) => (
        <span
          key={index}
          className={`min-w-0 flex-1 rounded-t-[2px] ${index === series.length - 1 ? 'bg-brand' : 'bg-brand/35'}`}
          style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

/** 변화량을 "+12" 또는 "-3"처럼 적어요. 늘어난 것만 메인 컬러예요. */
export function Delta({ value, unit = '' }: { value: number; unit?: string }) {
  const sign = value > 0 ? '+' : ''
  return <span className={`text-[12.5px] font-medium tabular-nums ${value > 0 ? 'text-brand' : value < 0 ? 'text-gray-500' : 'text-gray-400'}`}>{`${sign}${value}${unit}`}</span>
}

/** 숫자를 지금 언어에 맞게 적어요. */
export const number = (value: number) => value.toLocaleString(getLang() === 'ko' ? 'ko-KR' : 'en-US')

/** 퍼센트(0에서 1)를 "49%"처럼 적어요. */
export const percent = (value: number) => `${Math.round(value * 100)}%`
