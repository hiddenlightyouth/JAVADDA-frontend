import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { careerName, categoryName, COMPANY_CATEGORIES, companyOf, daysLeft, daysSince, familyName, fitOf, levelOf, skillLogoOf, useDiagnosed, type Company, type CompanyCategory, type Resume, type GapKind, type JobPosting, type RadarAxis, type RequirementCheck, LEVEL_MAX } from '../lib/gap'
import { getLang, messages, useMessages } from '../lib/i18n'
import { ConfirmDialog } from './Dialog'
import { BeakerIcon, BoxesIcon, BriefcaseIcon, CheckIcon, ChipIcon, CloseIcon, CodeIcon, DatabaseIcon, GlobeIcon, LayersIcon, MapPinIcon, PersonIcon, SparkleIcon, TreeIcon, TriangleIcon } from './Icons'
import { Badge, primaryButton, ProgressRing, stagger } from './ui'

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
    fitTip: '내 이력서가 이 공고의 요구 역량을 얼마나 채우는지예요. 필수 역량을 가장 크게 보고, 우대 역량과 역량의 폭을 더해요.',
    toneTips: { met: '이력서에서 충분히 보여요.', partial: '이력서에 있지만 근거가 약해요.', missing: '이력서에서 보이지 않아요.' } as Partial<Record<ChipTone, string>>,
    always: '상시 채용',
    posted: (days: number) => (days <= NEW_DAYS ? '신규' : `${days}일 전`),
    fitTag: (fit: number): string => (fit >= 70 ? '높음' : fit >= 50 ? '중간' : '낮음'),
    dday: (days: number) => (days === 0 ? 'D-day' : `D-${days}`),
    family: '직군',
    career: '경력',
    location: '지역',
    required: '필수',
    preferred: '우대',
    kinds: { missing: '부족', partial: '보완', strength: '강점' } as Record<GapKind, string>,
    checks: { met: '충분해요', partial: '근거가 약해요', missing: '보이지 않아요' } as Record<RequirementCheck['status'], string>,
    mine: '나',
    wanted: '공고',
    failed: '불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    retry: '다시 시도하기',
    pickTitle: '해당 공고로 이동할까요?',
    pickBody: (company: string, title: string, diagnosed: boolean) => `${company}의 ${title} 공고로 ${diagnosed ? '이동할까요?' : '이동하고, 분석을 시작할까요?'}`,
    pickGo: '이동하기',
    remove: (name: string) => `${name} 빼기`,
    stages: {
      waiting: '시작하는 중',
      queued: '진단 순서를 기다리고 있어요',
      reading: '서류에서 글자를 꺼내고 있어요',
      analyzing: 'AI가 서류의 역량을 읽고 있어요',
      preparing: '필요한 자료를 모으고 있어요',
      calculating: '적합도를 계산하고 있어요',
      writing: 'AI가 리포트를 쓰고 있어요',
      reviewing: 'AI가 서류를 문단마다 읽고 있어요',
      writingQuestions: 'AI가 예상 질문을 만들고 있어요',
      grading: 'AI가 답변을 채점하고 있어요',
      saving: '결과를 저장하고 있어요',
      done: '다 됐어요',
    } as Record<string, string>,
    stageFallback: '처리하고 있어요',
    diagnosed: '진단함',
    diagnosing: '진단 중',
    diagnosedTip: '이미 진단한 공고예요. 누르면 그 리포트를 열어요.',
    diagnosingTip: '지금 진단하고 있는 공고예요. 누르면 그 리포트를 열어요.',
  },
  en: {
    fit: (value: number) => `${value}% fit`,
    noFit: 'Upload a resume to see your fit',
    fitTip: 'How well your resume covers what this posting asks for. Required skills count most, then preferred skills and breadth.',
    toneTips: { met: 'Clearly shown in your resume.', partial: 'In your resume, but with thin evidence.', missing: 'Not found in your resume.' },
    always: 'Rolling',
    posted: (days: number) => (days <= NEW_DAYS ? 'New' : `${days} days ago`),
    fitTag: (fit: number) => (fit >= 70 ? 'High' : fit >= 50 ? 'Medium' : 'Low'),
    dday: (days: number) => (days === 0 ? 'D-day' : `D-${days}`),
    family: 'Role',
    career: 'Level',
    location: 'Location',
    required: 'Required',
    preferred: 'Preferred',
    kinds: { missing: 'Missing', partial: 'Weak', strength: 'Strength' },
    checks: { met: 'Covered', partial: 'Weak evidence', missing: 'Not found' },
    mine: 'You',
    wanted: 'Posting',
    failed: "Couldn't load. Please try again in a moment.",
    retry: 'Try again',
    pickTitle: 'Go to this posting?',
    pickBody: (company: string, title: string, diagnosed: boolean) => `${diagnosed ? 'Go to' : 'Go to and analyze'} ${title} at ${company}?`,
    pickGo: 'Go',
    remove: (name: string) => `Remove ${name}`,
    stages: {
      waiting: 'Getting started',
      queued: 'Waiting for its turn',
      reading: 'Pulling the text out of your document',
      analyzing: 'AI is reading the skills in your document',
      preparing: 'Gathering what we need',
      calculating: 'Calculating your fit',
      writing: 'AI is writing your report',
      reviewing: 'AI is reading your document paragraph by paragraph',
      writingQuestions: 'AI is writing likely questions',
      grading: 'AI is grading your answer',
      saving: 'Saving the results',
      done: 'All done',
    },
    stageFallback: 'Working on it',
    diagnosed: 'Diagnosed',
    diagnosing: 'Analyzing',
    diagnosedTip: 'You already diagnosed this posting. Click to open that report.',
    diagnosingTip: 'This posting is being diagnosed now. Click to open that report.',
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

/** 로고가 없는 개념 스킬의 아이콘이에요. 스킬 이름에 들어 있는 말로 골라요. 위에서부터 먼저 맞는 것을 써요. */
const CONCEPT_ICONS: [RegExp, typeof CodeIcon][] = [
  [/테스트|test|tdd/i, BeakerIcon],
  [/네트워크|network|http|tcp/i, GlobeIcon],
  [/운영체제|컴퓨터 구조|\bos\b|linux/i, ChipIcon],
  [/알고리즘|자료구조|algorithm/i, TreeIcon],
  [/설계|아키텍처|architecture|design/i, LayersIcon],
  [/msa|마이크로|micro/i, BoxesIcon],
  [/llm|\bai\b|\brag\b|머신러닝|딥러닝|\bml\b/i, SparkleIcon],
  [/sql|데이터베이스|database|db/i, DatabaseIcon],
  [/협업|커뮤니케이션|collab/i, PersonIcon],
]

/**
 * 기술 스택 로고를 둥근 네모에 넣어요. 기업 로고처럼 다크 모드에서도 바탕은 흰색이에요.
 * 로고가 없는 개념 스킬(테스트 코드, 네트워크 등)은 뜻에 맞는 선 아이콘을, 맞는 것도 없으면 코드 괄호를 같은 칸에 메인 컬러로 그려요.
 */
export function SkillMark({ skill, className = 'size-9' }: { skill: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  const logo = skillLogoOf(skill)
  const Concept = CONCEPT_ICONS.find(([pattern]) => pattern.test(skill))?.[1] ?? CodeIcon
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[#fff] p-1.5 ${className}`}>
      {logo && !broken ? (
        <img src={logo} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-contain" />
      ) : (
        <Concept className="size-[55%] text-[#2e90fa]" />
      )}
    </span>
  )
}

/** 적합도 퍼센트예요. 숫자만 메인 컬러로 강조하고, 아래에 가는 막대로 한 번 더 보여줘요. */
/**
 * 마우스를 올리거나 키보드로 안쪽에 가면 뜨는 짧은 설명이에요. 숫자나 색만 보고는 뜻을 모를 때 붙여요.
 * 잠깐(0.3초) 머물러야 떠서 훑고 지나갈 때는 거슬리지 않아요. 카드나 스크롤 칸이 넘치는 부분을 잘라도 가려지지 않게,
 * 말풍선은 화면 맨 바깥(body)에 고정 위치로 그려요. 위에 자리가 없으면 아래로 뒤집고, 창 가장자리를 넘지 않게 맞춰요.
 */
/** side가 right면 오른쪽에 꼬리 달린 말풍선으로 띄워요. 사이드바처럼 옆이 비어 있는 곳에 써요. */
export function Tip({ text, children, className = 'inline-flex max-w-full', side = 'top' }: { text: string; children: ReactNode; className?: string; side?: TipSide }) {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef(0)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => ref.current && setAnchor(ref.current.getBoundingClientRect()), 300)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setAnchor(null)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // 스크롤하면 붙어 있던 자리를 벗어나니 닫아요.
  useEffect(() => {
    if (!anchor) return
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [anchor])
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} className={className}>
      {children}
      {anchor && createPortal(<TipBubble anchor={anchor} text={text} side={side} />, document.body)}
    </span>
  )
}

const TIP_GAP = 8

type TipSide = 'top' | 'right'

function TipBubble({ anchor, text, side }: { anchor: DOMRect; text: string; side: TipSide }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number; right?: boolean } | null>(null)
  // 그린 뒤에 크기를 재서 자리를 정해요. 정하기 전에는 보이지 않게 둬요.
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect()
    // 오른쪽에 자리가 있으면 가운데 높이를 맞춰 옆에 띄우고, 없으면 위나 아래로 띄워요.
    if (side === 'right' && anchor.right + TIP_GAP + box.width <= window.innerWidth - TIP_GAP) {
      setPlace({ left: anchor.right + TIP_GAP, top: anchor.top + anchor.height / 2 - box.height / 2, right: true })
      return
    }
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - box.width / 2, TIP_GAP), window.innerWidth - box.width - TIP_GAP)
    const above = anchor.top - box.height - TIP_GAP
    setPlace({ left, top: above >= TIP_GAP ? above : anchor.bottom + TIP_GAP })
  }, [anchor, side])
  return (
    <span
      ref={ref}
      role="tooltip"
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
      className="pointer-events-none fixed z-[70] w-max max-w-60 animate-fade rounded-lg bg-gray-900 px-2.5 py-1.5 text-left text-[12px] leading-snug font-normal text-white"
    >
      {place?.right && <span aria-hidden className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rotate-45 rounded-[1px] bg-gray-900" />}
      {text}
    </span>
  )
}

/**
 * 적합도에 맞는 색이에요. 높음(70% 이상)은 메인 컬러, 중간(50% 이상)은 노란색, 낮음은 빨간색이에요.
 * 적합도 태그(`FitTag`), 적합도 막대(`FitBadge`), 사이드바의 리포트 줄이 같은 색을 써요.
 */
export function fitColor(fit: number): { text: string; bar: string } {
  if (fit >= 70) return { text: 'text-brand', bar: 'bg-brand' }
  if (fit >= 50) return { text: 'text-amber-700', bar: 'bg-amber-500' }
  return { text: 'text-red-600', bar: 'bg-red-500' }
}

export function FitBadge({ fit, compact = false }: { fit: number | null; compact?: boolean }) {
  const L = useMessages(TEXT)
  if (fit === null) return <span className="text-[12px] text-gray-400">{compact ? '' : L.noFit}</span>
  return (
    <Tip text={L.fitTip}>
      <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap" aria-label={L.fit(fit)}>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-200/70" aria-hidden>
          <span className={`block h-full rounded-full ${fitColor(fit).bar}`} style={{ width: `${fit}%` }} />
        </span>
        <span className={`text-[13px] font-semibold tabular-nums ${fitColor(fit).text}`}>{fit}%</span>
      </span>
    </Tip>
  )
}

type ChipTone = 'plain' | 'met' | 'partial' | 'missing' | 'active'

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
  // 공고 기준으로 칠한 이름표는 색만으로는 뜻을 모르니, 올리면 무슨 뜻인지 알려줘요.
  const tip = L.toneTips[tone]
  if (onClick) {
    const button = (
      <button type="button" onClick={onClick} className={`${base} transition-colors hover:border-brand hover:text-brand-hover`}>
        {body}
      </button>
    )
    return tip ? <Tip text={tip}>{button}</Tip> : button
  }
  const chip = (
    <span className={base}>
      {body}
      {onRemove && (
        <button type="button" aria-label={L.remove(name)} onClick={onRemove} className="-mr-1 flex size-4 items-center justify-center rounded text-gray-400 transition-colors hover:text-gray-900">
          <CloseIcon className="size-2.5" />
        </button>
      )}
    </span>
  )
  return tip ? <Tip text={tip}>{chip}</Tip> : chip
}

/** 부족, 보완, 강점 이름표예요. 강점만 메인 컬러로 표시해요. */
export function KindLabel({ kind }: { kind: GapKind }) {
  const L = useMessages(TEXT)
  return (
    <Badge tone={kind === 'strength' ? 'brand' : 'gray'} strong>
      {L.kinds[kind]}
    </Badge>
  )
}

/** 필수와 우대 이름표예요. 필수가 한 단계 짙어요. */
export function RequirementLabel({ requirement }: { requirement: 'required' | 'preferred' }) {
  const L = useMessages(TEXT)
  return (
    <span className={`inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[11px] font-medium ${requirement === 'required' ? 'bg-gray-200/70 text-gray-700' : 'bg-gray-100 text-gray-400'}`}>
      {requirement === 'required' ? L.required : L.preferred}
    </span>
  )
}

/** 필수 역량을 갖췄는지를 체크, 세모, 엑스로 보여줘요. 빠진 것만 빨간색이에요. */
export function CheckMark({ status }: { status: RequirementCheck['status'] }) {
  const L = useMessages(TEXT)
  if (status === 'met') return <CheckIcon className="size-4 shrink-0 text-brand" label={L.checks.met} />
  if (status === 'partial') {
    return <TriangleIcon label={L.checks.partial} />
  }
  return <CloseIcon className="size-4 shrink-0 text-red-500" strokeWidth={1.8} label={L.checks.missing} />
}

export const cardsGrid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4'
/** 한 줄만 보여주는 카드 줄. 둘째 줄부터는 높이를 0으로 두고 잘라서, 화면 폭에 들어가는 만큼만 보여요. */
export const cardsRow = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] auto-rows-[0px] grid-rows-[auto] gap-x-4 overflow-hidden'

/** 카드 위에 붙는 작은 태그예요. 신규와 적합도 높음은 메인 컬러, 적합도 중간은 노란색, 마감까지 남은 날과 적합도 낮음은 빨간색, 나머지는 회색이에요. 공고 탐색의 마감 태그도 같은 모양이에요. */
export function CardTag({ tone, children }: { tone: 'brand' | 'amber' | 'red' | 'gray'; children: ReactNode }) {
  return (
    <Badge tone={tone} strong>
      {children}
    </Badge>
  )
}

/**
 * 적합도를 높음(70% 이상, 메인 컬러), 중간(50% 이상, 노란색), 낮음(빨간색)으로 나눈 카드 태그예요. 추천 공고와 공고 탐색의 카드, 줄이 같이 써요.
 * 이력서가 없어 적합도를 모르면(fit이 null) 아무것도 그리지 않아요.
 */
export function FitTag({ fit }: { fit: number | null }) {
  const L = useMessages(TEXT)
  if (fit === null) return null
  return <CardTag tone={fit >= 70 ? 'brand' : fit >= 50 ? 'amber' : 'red'}>{L.fitTag(fit)}</CardTag>
}

/**
 * 이미 진단한 공고에 붙이는 "진단함" 태그예요. 만드는 중이면 "진단 중"이에요. 공고 카드, 공고 탐색의 카드와 줄, 새 진단 화면의 검색 결과가 같이 써요.
 * 로그인한 계정의 리포트에서 찾고(`useDiagnosed`), 진단하지 않은 공고면 아무것도 그리지 않아요.
 */
export function DiagnosedTag({ postingId }: { postingId: string }) {
  const L = useMessages(TEXT)
  const report = useDiagnosed(postingId)
  if (!report) return null
  const pending = report.status === 'pending'
  return (
    <Tip text={pending ? L.diagnosingTip : L.diagnosedTip} className="inline-flex shrink-0">
      <Badge tone="brand" strong>
        {pending ? L.diagnosing : L.diagnosed}
      </Badge>
    </Tip>
  )
}

/** 진행 단계 이름을 화면에 보여줄 문장으로 바꿔요. 모르는 단계면 "처리하고 있어요"예요. */
export function useStageText(stage: string): string {
  const L = useMessages(TEXT)
  return L.stages[stage] ?? L.stageFallback
}

/**
 * AI를 기다리는 동안 보여주는 진행 칸이에요. 모양은 다른 기다리는 화면과 같은 로봇과 진행 고리(`ProgressRing`)이고, 문장만 서버가 알려 주는 단계로 바꿔요.
 * 이력서 올리기, 리포트 만들기, 서류 검증, 예상 질문, 답변 채점이 같이 써요. 회색 칸 위와 흰 바탕 어디에나 놓여요.
 * title을 주면 단계 문장 위에 작게 적어요(올리는 파일 이름 등).
 */
export function AiProgress({ progress, stage, title, className = '' }: { progress: number; stage: string; title?: string; className?: string }) {
  const text = useStageText(stage)
  return <ProgressRing value={progress} text={text} title={title} className={`animate-fade ${className}`} />
}

/**
 * 공고의 직군, 경력, 지역을 작은 선 아이콘과 함께 한 줄에 늘어놓아요. 공고 카드(`PostingTile`), 공고 탐색의 카드와 줄이 같이 써요.
 * 줄이 좁을 때 경력이나 지역을 숨기려면 careerClass, locationClass에 `hidden @xl:flex` 같은 것을 넘겨요. 앞에 기업 이름 같은 것을 붙이려면 children으로 넘겨요.
 */
export function PostingMeta({ posting, size = 'sm', careerClass = 'flex', locationClass = 'flex', className = '', children }: {
  posting: JobPosting
  size?: 'sm' | 'md'
  careerClass?: string
  locationClass?: string
  className?: string
  children?: ReactNode
}) {
  const L = useMessages(TEXT)
  const item = size === 'md' ? 'items-center gap-1.5' : 'items-center gap-1'
  return (
    <span className={`flex min-w-0 items-center text-gray-600 ${size === 'md' ? 'flex-wrap gap-x-3.5 gap-y-1 text-[12.5px]' : 'gap-x-3 text-[12px]'} ${className}`}>
      {children}
      <span className={`flex shrink-0 ${item}`}>
        <BriefcaseIcon label={L.family} />
        {familyName(posting.family)}
      </span>
      <span className={`shrink-0 ${item} ${careerClass}`}>
        <PersonIcon label={L.career} />
        {careerName(posting.career)}
      </span>
      <span className={`min-w-0 ${item} ${locationClass}`}>
        <MapPinIcon label={L.location} />
        <span className="truncate">{posting.location}</span>
      </span>
    </span>
  )
}

/**
 * 기업을 로고와 이름으로 한 번에 고르는 버튼 줄이에요. 공고 탐색과 기술 블로그가 같이 써요.
 * 고른 기업을 다시 누르면 풀려요. allLabel을 넘기면 맨 앞에 전체 버튼이 생겨요. 넓은 목록에서는 여러 줄로, 좁으면 옆으로 넘겨요.
 */
/**
 * 기업의 사업 분류를 고르는 버튼 줄이에요. 기업이 많아져서 공고 탐색과 마감 달력은 기업 대신 이것으로 골라요. 공고가 있는 분류만 보여줘요.
 * 네카라쿠배당토가 아닌 기업을 골라 들어오면(기업 상세, 새 진단) 그 기업 이름을 앞에 두고, 누르면 풀려요.
 */
export function CategoryFilter({ postings, value, onChange, label, allLabel, company, onClearCompany }: {
  postings: readonly { companyId: string }[]
  value: CompanyCategory | null
  onChange: (category: CompanyCategory | null) => void
  label: string
  allLabel: string
  company?: Company | null
  onClearCompany?: () => void
}) {
  const present = new Set(postings.map((posting) => companyOf(posting.companyId).category))
  const categories = COMPANY_CATEGORIES.filter((category) => present.has(category) || category === value)
  const tone = (on: boolean) => (on ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-950')
  const chip = 'flex h-10 shrink-0 items-center rounded-full border px-4 text-[14px] font-medium transition-colors'
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] @2xl:flex-wrap @2xl:overflow-visible">
      {company && (
        <button type="button" onClick={onClearCompany} className={`${chip} gap-2 pl-1.5 ${tone(true)}`}>
          <CompanyMark company={company} className="size-7 rounded-full! text-[11px]" />
          {company.name}
          <CloseIcon className="size-3" />
        </button>
      )}
      <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(null)} className={`${chip} ${tone(!value)}`}>
        {allLabel}
      </button>
      {categories.map((category) => (
        <button key={category} type="button" role="radio" aria-checked={value === category} onClick={() => onChange(value === category ? null : category)} className={`${chip} ${tone(value === category)}`}>
          {categoryName(category)}
        </button>
      ))}
    </div>
  )
}

export function CompanyFilter({ companies, value, onChange, label, allLabel, oneLine = false }: {
  companies: readonly Company[]
  /** 목록 폭이 넉넉하면 한 줄만 쓰고, 그 줄의 버튼이 늘어나 양 끝까지 채워요. 들어가지 않는 기업은 숨겨요. 폭은 화면이 아니라 목록을 보고 정해서 모니터, 사이드바, 원문 칸이 달라도 맞아요. */
  oneLine?: boolean
  value: string | null
  onChange: (company: string | null) => void
  label: string
  allLabel?: string
}) {
  const tone = (on: boolean) => (on ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-950')
  return (
    // 기업을 고르는 일이 화면의 첫 동작이라, 다른 도구 버튼(36px)보다 한 단계 크게(44px) 둬서 누르기 쉽게 해요.
    <div role="radiogroup" aria-label={label} className={`-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] @2xl:flex-wrap ${oneLine ? '@2xl:max-h-12 @2xl:gap-x-1.5 @2xl:overflow-hidden @2xl:[&>button]:grow @2xl:[&>button]:justify-center' : '@2xl:overflow-visible'}`}>
      {allLabel && (
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(null)} className={`flex h-11 shrink-0 items-center rounded-full border px-5 text-[14.5px] font-medium transition-colors ${tone(!value)}`}>
          {allLabel}
        </button>
      )}
      {companies.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={value === item.id}
          onClick={() => onChange(value === item.id ? null : item.id)}
          className={`flex h-11 shrink-0 items-center gap-2.5 rounded-full border py-1 pr-4.5 pl-1.5 text-[14.5px] font-medium transition-colors ${tone(value === item.id)}`}
        >
          <CompanyMark company={item} className="size-8 rounded-full! text-[12px]" />
          {item.name}
        </button>
      ))}
    </div>
  )
}

/** 이력서 기준으로 스킬 이름표의 색을 정해요. 진단 시작 화면과 같은 기준이에요. */
export function skillTone(skill: string, resume: Resume | null): ChipTone {
  if (!resume) return 'plain'
  const level = levelOf(resume, skill)
  return level >= 3 ? 'met' : level > 0 ? 'partial' : 'missing'
}

/**
 * 공고 자체를 앞에 세운 카드예요. 새 진단 화면의 모든 공고 줄에서 써요.
 * 왼쪽 위 태그에 올라온 때(posted)나 마감까지 남은 날(deadline)이나 얼마나 맞는지(fit, 나와 잘 맞는 공고와 다시 볼 공고)를 적고, 그 아래에 공고 제목, 기업,
 * 아이콘을 붙인 직군과 경력과 지역, 필수 역량을 놓아요. 테두리 없이 옅은 회색 바탕으로 구분해요.
 * 공고 카드와 크기가 같아서 같은 줄 규칙(cardsRow)에 들어가요.
 */
export function PostingTile({ posting, resume, fit = fitOf(posting, resume), tag, onGray = false, order = 0, onOpen }: {
  posting: JobPosting
  resume: Resume | null
  /** 부모가 정렬하며 이미 구한 적합도예요. 없으면 여기서 구해요. */
  fit?: number | null
  tag: 'posted' | 'deadline' | 'fit'
  /** 회색 칸(`Panel`) 안에 놓일 때예요. 회색 위에서도 보이게 흰 바탕으로 그려요. */
  onGray?: boolean
  order?: number
  onOpen: (posting: JobPosting) => void
}) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const since = daysSince(posting)
  const left = daysLeft(posting)
  return (
    <li className="min-h-0 animate-rise" style={stagger(order)}>
      <button type="button" onClick={() => onOpen(posting)} className={`group flex h-[196px] w-full flex-col rounded-2xl p-5 text-left transition-colors ${onGray ? 'bg-white hover:bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'}`}>
        <span className="flex items-center justify-between gap-2">
          {/* 진단한 공고는 진단함 태그를 맨 앞에 두고, 원래 태그(신규, 마감, 얼마나 맞는지)는 그 뒤에 그대로 붙여요. */}
          <span className="flex shrink-0 items-center gap-1.5">
            <DiagnosedTag postingId={posting.id} />
            {tag === 'posted' ? (
              <CardTag tone={since <= NEW_DAYS ? 'brand' : 'gray'}>{L.posted(since)}</CardTag>
            ) : tag === 'deadline' ? (
              <CardTag tone="red">{left === null ? L.always : L.dday(left)}</CardTag>
            ) : (
              <FitTag fit={fit} />
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-gray-500">
            <CompanyMark company={company} className="size-5 rounded-md text-[9px]" />
            <span className="truncate">{company.name}</span>
          </span>
        </span>
        <span className="mt-3 line-clamp-2 text-[16px] leading-snug font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{posting.title}</span>
        <PostingMeta posting={posting} className="mt-2" />
        <span className="mt-auto flex items-end justify-between gap-3 pt-3">
          {/* 회색 바탕 위라 테두리 있는 이름표 대신 한 단계 짙은 회색 태그로 적어요. 이력서가 있으면 갖춘 역량만 메인 컬러로 칠해요. */}
          <span className="flex min-w-0 flex-wrap gap-1 overflow-hidden [max-height:24px]">
            {posting.required.slice(0, 3).map((skill) => {
              const tone = skillTone(skill, resume)
              return (
                <Badge key={skill} tone={tone === 'met' ? 'brand' : tone === 'missing' ? 'muted' : 'gray'}>
                  {skill}
                </Badge>
              )
            })}
          </span>
          <FitBadge fit={fit} compact />
        </span>
      </button>
    </li>
  )
}

/** 회색 바탕 위의 흰 칸이에요. 제목 줄 오른쪽에 버튼을 둘 수 있어요. */
export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-gray-50 p-5 ${className}`}>
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

/** 불러오지 못했을 때의 안내와 다시 시도 버튼이에요. 서버가 이유를 알려 주면 그 말을 아래에 적어요. */
export function Failed({ message, onRetry, className = '' }: { message?: string; onRetry: () => void; className?: string }) {
  const L = useMessages(TEXT)
  return <Notice title={L.failed} body={message} action={L.retry} onAction={onRetry} className={className} />
}

/** 가로 막대 하나예요. 이름, 막대, 값이 한 줄이에요. */
export function Meter({ label, value, max = 100, display, note }: { label: ReactNode; value: number; max?: number; display?: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 truncate text-[13px] text-gray-900">{label}</span>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200/70">
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-gray-200/70" />
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

/** 점수 띠의 구간이에요. 공고 카드의 얼마나 맞는지 태그와 같은 기준이에요. */
const BANDS = [
  { from: 0, to: 50 },
  { from: 50, to: 70 },
  { from: 70, to: 100 },
]

/**
 * 점수를 크게 내세우는 머리말이에요. 회색 칸 없이 흰 바탕에 놓고, 왼쪽에 한마디 평가와 설명, 오른쪽에 큰 숫자와 구간 띠를 둬요.
 * 띠는 50과 70에서 끊겨서, 점수가 어느 구간에 있는지 한눈에 보여요. 리포트의 적합도와 서류 검증의 부합도가 같이 써요.
 */
export function ScoreHero({ score, label, meta, title, body }: { score: number; label: string; meta?: ReactNode; title: string; body: string }) {
  const L = useMessages(TEXT)
  return (
    <section className="flex animate-rise flex-col gap-6 rounded-2xl bg-gray-50 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
      <div className="min-w-0 max-w-2xl">
        {meta && <p className="mb-1.5 text-[12.5px] text-gray-500">{meta}</p>}
        <h2 className="text-[22px] leading-snug font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-gray-600">{body}</p>
      </div>
      <div className="w-full shrink-0 sm:w-72">
        <div className="flex items-end justify-between gap-3">
          <p className="text-[13px] text-gray-500">
            {label}
            <span className="mt-0.5 block font-medium text-brand">{L.fitTag(score)}</span>
          </p>
          <p className="text-[44px] leading-none font-semibold text-gray-900 tabular-nums">
            {score}
            <span className="ml-0.5 text-[18px] font-medium text-gray-400">%</span>
          </p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {BANDS.map((band) => (
            <span key={band.from} className="h-2 overflow-hidden rounded-full bg-gray-200/70" style={{ flexGrow: band.to - band.from, flexBasis: 0 }}>
              <span
                className="block h-full origin-left animate-grow rounded-full bg-brand"
                style={{ width: `${Math.min(100, Math.max(0, ((score - band.from) / (band.to - band.from)) * 100))}%` }}
              />
            </span>
          ))}
        </div>
        <div className="mt-2 flex text-[11.5px] tabular-nums" aria-hidden>
          {BANDS.map((band) => (
            <span key={band.from} className="text-gray-400" style={{ flexGrow: band.to - band.from, flexBasis: 0 }}>
              {band.from}
            </span>
          ))}
        </div>
      </div>
    </section>
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

/**
 * 공고를 눌렀을 때 바로 진단으로 가지 않고 한 번 더 물어요. 마감 달력, 공고 탐색, 추천 공고가 써요.
 * ask(공고, 갈 때 할 일)로 창을 열고, 화면은 돌려준 dialog를 그려요.
 */
export function usePickConfirm() {
  const [asking, setAsking] = useState<{ posting: JobPosting; go: () => void } | null>(null)
  const dialog = asking && (
    <PickConfirm
      posting={asking.posting}
      onCancel={() => setAsking(null)}
      onConfirm={() => {
        setAsking(null)
        asking.go()
      }}
    />
  )
  return { ask: (posting: JobPosting, go: () => void) => setAsking({ posting, go }), dialog }
}

function PickConfirm({ posting, onCancel, onConfirm }: { posting: JobPosting; onCancel: () => void; onConfirm: () => void }) {
  const L = useMessages(TEXT)
  const diagnosed = useDiagnosed(posting.id)
  return <ConfirmDialog title={L.pickTitle} body={L.pickBody(companyOf(posting.companyId).name, posting.title, Boolean(diagnosed))} confirm={L.pickGo} onCancel={onCancel} onConfirm={onConfirm} />
}
