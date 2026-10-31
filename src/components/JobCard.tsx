import { useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { companyOf, daysLeft, type Company, type JobPosting, type Resume } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { readItem, writeItem } from '../lib/storage'
import { CardTag, CompanyMark, DiagnosedTag, FitBadge, FitTag, PostingMeta, SkillChip, skillTone, Tip } from './GapParts'
import { ExternalLinkIcon, GridIcon, ListIcon } from './Icons'
import { PostingBrowser } from './PostingBrowser'
import { iconButton, Segmented, stagger } from './ui'

/**
 * 공고 탐색과 추천 공고가 같이 쓰는 공고 카드(갤러리형)와 줄(리스트형), 보기 방식 버튼, 미니 브라우저예요.
 * 두 화면이 같은 모양이라 여기 것만 고쳐요.
 */

const TEXT = messages({
  ko: {
    companyInfo: (name: string) => `${name} 기업 정보 보기`,
    layout: '보기 방식',
    layouts: { gallery: '갤러리형으로 보기', list: '리스트형으로 보기' } as Record<Layout, string>,
    always: '상시 채용',
    view: '채용 공고 열기',
    analyze: '분석하기',
    more: (count: number) => `외 ${count}개`,
    dday: (days: number) => (days === 0 ? '오늘 마감' : `D-${days}`),
  },
  en: {
    companyInfo: (name: string) => `About ${name}`,
    layout: 'View',
    layouts: { gallery: 'Gallery view', list: 'List view' },
    always: 'Rolling',
    view: 'Open posting',
    analyze: 'Analyze',
    more: (count: number) => `+${count} more`,
    dday: (days: number) => (days === 0 ? 'Closes today' : `D-${days}`),
  },
})

/** 공고 카드는 넓은 화면에서 한 줄에 둘이나 셋씩 놓여요. */
// 원문 칸이 열리면 목록 폭이 줄어서, 화면 폭이 아니라 목록 폭(@container)을 보고 칸 수를 정해요.
export const jobsGrid = 'grid gap-4 @2xl:grid-cols-2 @6xl:grid-cols-3'
/** 리스트형은 한 줄에 공고 하나씩이에요. */
export const jobsList = 'flex flex-col gap-2'
/** 카드 맨 아래의 분석하기 버튼이에요. 메인 컬러로 눈에 띄게 둬요. */
const cardPrimary =
  'relative z-10 inline-flex h-8 shrink-0 items-center rounded-lg bg-brand px-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover'
/** 카드에 보여주는 필수 역량 수예요. 나머지는 수만 적어요. */
const SKILLS_SHOWN = 4

// 갤러리형은 카드를 여러 칸으로, 리스트형은 한 줄에 공고 하나씩 늘어놓아요. 고른 것은 이 기기에 기억하고, 두 화면이 같이 써요.
export type Layout = 'gallery' | 'list'
const LAYOUTS: Layout[] = ['gallery', 'list']
const LAYOUT_KEY = 'whoisloafing:jobs-layout'
export const readLayout = (): Layout => (readItem(LAYOUT_KEY) === 'list' ? 'list' : 'gallery')

/** 갤러리형과 리스트형을 고르는 버튼 두 개예요. 고른 것은 이 기기에 기억해요. */
export function LayoutToggle({ value, onChange }: { value: Layout; onChange: (layout: Layout) => void }) {
  const L = useMessages(TEXT)
  return (
    <Segmented
      label={L.layout}
      value={value}
      options={LAYOUTS.map((item) => [item, L.layouts[item], item === 'gallery' ? <GridIcon /> : <ListIcon />] as const)}
      onChange={(next) => {
        track('jobs_layout_change', { layout: next })
        onChange(next)
        writeItem(LAYOUT_KEY, next)
      }}
    />
  )
}

/**
 * 카드에서 여는 미니 브라우저예요. 공고의 원문이나 기업 소개 사이트를 열어요.
 * 화면은 side를 `SplitView`에 넘기고, 카드에 view와 viewCompany를 이어요.
 */
export function useJobBrowser(): { side: ReactNode; view: (posting: JobPosting) => void; viewCompany: (companyId: string) => void } {
  const [viewing, setViewing] = useState<{ posting: JobPosting } | { company: Company } | null>(null)
  const side =
    viewing &&
    ('posting' in viewing ? (
      <PostingBrowser key={viewing.posting.id} posting={viewing.posting} onClose={() => setViewing(null)} />
    ) : (
      <PostingBrowser key={viewing.company.id} company={viewing.company} onClose={() => setViewing(null)} onPosting={(posting) => setViewing({ posting })} />
    ))
  return { side, view: (posting) => setViewing({ posting }), viewCompany: (companyId) => setViewing({ company: companyOf(companyId) }) }
}

/** 10.28 처럼 달과 날만 적어요. */
const shortDate = (iso: string) => {
  const date = new Date(iso)
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 공고 탐색의 카드예요. 위에 기업과 적합도, 채용 공고 열기 아이콘(앱 안의 미니 브라우저), 가운데에 공고 제목과 필수 역량, 아래에 마감까지 남은 날과 모집 기간, 분석하기가 있어요.
 * 이력서가 있으면 필수 역량 이름표를 진단 시작 화면과 같은 기준으로 칠해서, 카드만 보고도 무엇이 비는지 보여요.
 * 카드의 나머지 자리를 누르면 해당 공고로 이동할지 한 번 더 묻고, 분석하기는 바로 진단해요.
 */
function JobCard({ posting, resume, fit, order, onOpen, onView, onAnalyze, onCompany }: JobItemProps) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const left = daysLeft(posting)
  return (
    // 카드의 빈 자리를 누르면 이동할지 물어요. 안쪽 버튼(기업, 채용 공고 열기, 분석하기)은 저마다 따로 받아요.
    // 제목 버튼을 카드 전체에 늘여 덮으면, 누른 곳과 뗀 곳이 달라져 클릭이 한 번 씹혀서 카드가 직접 받아요.
    <li
      onClick={(event) => {
        if (!(event.target as Element).closest('button, a')) onOpen()
      }}
      className="group relative flex animate-rise cursor-pointer flex-col rounded-2xl bg-gray-50 p-5 transition-colors hover:bg-gray-100"
      style={stagger(order)}
    >
      <div className="flex items-center gap-3">
        {/* 로고와 기업 이름을 누르면 기업 소개를 미니 브라우저로 열어요. */}
        <button type="button" onClick={onCompany} aria-label={L.companyInfo(company.name)} className="group/company -m-1 flex min-w-0 items-center gap-3 rounded-xl p-1 text-left">
          <CompanyMark company={company} className="size-10 text-[15px] transition-opacity group-hover/company:opacity-80" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-gray-900 group-hover/company:underline">{company.name}</span>
            <span className="block truncate text-[12px] text-gray-400">{company.industry}</span>
          </span>
        </button>
        {/* 기업 옆에 적합도와, 원문을 앱 안의 미니 브라우저로 여는 아이콘을 둬요. */}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <FitBadge fit={fit} compact />
          <Tip text={L.view}>
            <button type="button" onClick={onView} aria-label={L.view} className={`${iconButton.md} relative z-10 hover:bg-gray-200/70`}>
              <ExternalLinkIcon />
            </button>
          </Tip>
        </span>
      </div>

      <h3 className="mt-4 text-[16px] leading-snug font-semibold text-gray-900">
        <button type="button" onClick={onOpen} className="text-left transition-colors group-hover:text-brand-hover">
          {posting.title}
        </button>
      </h3>
      {/* 직군, 경력, 지역은 아이콘을 붙여 한 줄에 늘어놓아서, 훑어볼 때 바로 눈에 들어와요. */}
      <PostingMeta posting={posting} size="md" className="mt-2" />
      {/* 소개가 제목을 그대로 되풀이하면(규칙으로 읽은 공고) 줄을 두지 않아요. */}
      {posting.summary.trim() !== posting.title.trim() && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-gray-500">{posting.summary}</p>}

      <div className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
        {posting.required.slice(0, SKILLS_SHOWN).map((skill) => (
          <SkillChip key={skill} name={skill} tone={skillTone(skill, resume)} />
        ))}
        {posting.required.length > SKILLS_SHOWN && <span className="inline-flex h-7 items-center px-1 text-[12px] text-gray-400">{L.more(posting.required.length - SKILLS_SHOWN)}</span>}
      </div>

      {/* 진단한 공고는 진단함 태그를 앞에 붙이고, 이력서가 있으면 적합도(높음, 중간, 낮음)를 그 뒤에 붙여요. 마감이 사흘 안으로 남으면 메인 컬러로 알려요. */}
      <div className="mt-5 flex items-center gap-1.5 border-t border-gray-200 pt-3">
        <DiagnosedTag postingId={posting.id} />
        <FitTag fit={fit} />
        <DeadlineTag left={left} />
        <span className="ml-1 min-w-0 flex-1 truncate text-[12.5px] text-gray-400 tabular-nums">
          {shortDate(posting.postedAt)} ~ {posting.deadline ? shortDate(posting.deadline) : L.always}
        </span>
        <button type="button" onClick={onAnalyze} className={cardPrimary}>
          {L.analyze}
        </button>
      </div>
    </li>
  )
}

/** 마감까지 남은 날이에요. 사흘 안으로 남으면 메인 컬러로 알려요. 채용 지도의 공고 줄도 같이 써요. */
export function DeadlineTag({ left }: { left: number | null }) {
  const L = useMessages(TEXT)
  return (
    <CardTag tone={left !== null && left <= 3 ? 'brand' : 'gray'}>
      <span className="tabular-nums">{left === null ? L.always : L.dday(left)}</span>
    </CardTag>
  )
}

type JobItemProps = { posting: JobPosting; resume: Resume | null; fit: number | null; order: number; onOpen: () => void; onView: () => void; onAnalyze: () => void; onCompany: () => void }

/** 고른 보기 방식에 맞춰 카드나 줄로 그려요. */
export function JobItem({ layout, ...props }: JobItemProps & { layout: Layout }) {
  return layout === 'gallery' ? <JobCard {...props} /> : <JobRow {...props} />
}

/**
 * 리스트형 보기의 한 줄이에요. 왼쪽에 기업 로고, 가운데에 공고 제목과 기업, 직군, 경력, 지역, 넓으면 필수 역량, 오른쪽에 마감까지 남은 날과 적합도, 채용 공고 열기 아이콘과 분석하기가 있어요.
 * 목록 폭이 좁으면 경력, 지역, 필수 역량, 적합도, 두 버튼을 차례로 숨겨요. 카드처럼 줄의 빈 자리를 누르면 이동할지 묻고, 로고를 누르면 기업 소개를 미니 브라우저로 열어요.
 */
function JobRow({ posting, resume, fit, order, onOpen, onView, onAnalyze, onCompany }: JobItemProps) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const left = daysLeft(posting)
  return (
    <li
      onClick={(event) => {
        if (!(event.target as Element).closest('button, a')) onOpen()
      }}
      className="group flex animate-rise cursor-pointer items-center gap-4 rounded-2xl bg-gray-50 px-4 py-3.5 transition-colors hover:bg-gray-100"
      style={stagger(order)}
    >
      <button type="button" onClick={onCompany} aria-label={L.companyInfo(company.name)} className="shrink-0 rounded-xl transition-opacity hover:opacity-80">
        <CompanyMark company={company} className="size-10 text-[15px]" />
      </button>
      <div className="min-w-0 flex-1">
        <h3 className="flex text-[15px] font-semibold text-gray-900">
          <button type="button" onClick={onOpen} className="min-w-0 truncate text-left transition-colors group-hover:text-brand-hover">
            {posting.title}
          </button>
        </h3>
        <PostingMeta posting={posting} className="mt-1 text-[12.5px]!" careerClass="hidden @xl:flex" locationClass="hidden @2xl:flex">
          <span className="truncate font-medium text-gray-700">{company.name}</span>
        </PostingMeta>
      </div>
      <div className="hidden shrink-0 gap-1.5 @5xl:flex">
        {posting.required.slice(0, 3).map((skill) => (
          <SkillChip key={skill} name={skill} tone={skillTone(skill, resume)} />
        ))}
      </div>
      <DiagnosedTag postingId={posting.id} />
      {/* 좁은 줄에서는 제목 자리가 모자라서 적합도 태그를 숨겨요. */}
      <span className="hidden shrink-0 @md:inline-flex">
        <FitTag fit={fit} />
      </span>
      <DeadlineTag left={left} />
      <span className="hidden shrink-0 @lg:inline-flex">
        <FitBadge fit={fit} compact />
      </span>
      <Tip text={L.view} className="hidden shrink-0 @3xl:inline-flex">
        <button type="button" onClick={onView} aria-label={L.view} className={`${iconButton.md} hover:bg-gray-200/70`}>
          <ExternalLinkIcon />
        </button>
      </Tip>
      <button type="button" onClick={onAnalyze} className={`${cardPrimary} hidden! @3xl:inline-flex!`}>
        {L.analyze}
      </button>
    </li>
  )
}
