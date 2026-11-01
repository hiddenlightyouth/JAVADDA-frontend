import { useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { companyOf, daysLeft, fitOf, type Company, type JobPosting, type Resume } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { readItem, writeItem } from '../lib/storage'
import { CardTag, CompanyMark, DeadlineTag, DiagnosedTag, FitBadge, FitTag, PostingMeta, SkillChip, skillTone, Tip } from './GapParts'
import { ExternalLinkIcon, GridIcon, ListIcon } from './Icons'
import { PostingBrowser } from './PostingBrowser'
import { shortDate } from './ScreenParts'
import { iconButton, primaryButton, Segmented, stagger, useShowMore } from './ui'

/**
 * 공고 탐색, 추천 공고, 새 진단 화면의 공고 줄이 같이 쓰는 공고 카드(갤러리형)와 줄(리스트형), 둘을 늘어놓는 목록(`PostingList`),
 * 공고 수와 보기 방식 버튼 줄, 미니 브라우저, 마감 달력과 채용 지도의 공고 줄(`PickRow`)이에요. 여러 화면이 같은 모양이라 여기 것만 고쳐요.
 */

const TEXT = messages({
  ko: {
    companyInfo: (name: string) => `${name} 기업 정보 보기`,
    layout: '보기 방식',
    layouts: { gallery: '갤러리형으로 보기', list: '리스트형으로 보기' } as Record<Layout, string>,
    always: '상시',
    today: '오늘 마감',
    until: (date: string) => `${date} 마감`,
    view: '채용 공고 열기',
    analyze: '분석하기',
    more: (count: number) => `외 ${count}개`,
    items: (count: number) => `${count}개의 공고`,
  },
  en: {
    companyInfo: (name: string) => `About ${name}`,
    layout: 'View',
    layouts: { gallery: 'Gallery view', list: 'List view' },
    always: 'Rolling',
    today: 'Today',
    until: (date: string) => `Closes ${date}`,
    view: 'Open posting',
    analyze: 'Analyze',
    more: (count: number) => `+${count} more`,
    items: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
  },
})

/** 공고 카드는 넓은 화면에서 한 줄에 둘이나 셋씩 놓여요. */
// 원문 칸이 열리면 목록 폭이 줄어서, 화면 폭이 아니라 목록 폭(@container)을 보고 칸 수를 정해요.
const jobsGrid = 'grid gap-4 @2xl:grid-cols-2 @6xl:grid-cols-3'
/** 리스트형은 한 줄에 공고 하나씩이에요. */
const jobsList = 'flex flex-col gap-2'
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

/** 목록 위의 한 줄이에요. 왼쪽에 공고 수(받는 동안은 비워요), 오른쪽에 보기 방식 버튼이 있어요. 공고 탐색과 추천 공고가 같이 써요. */
export function PostingCountBar({ count, layout, onLayout }: { count: number | null; layout: Layout; onLayout: (layout: Layout) => void }) {
  const L = useMessages(TEXT)
  return (
    <div className="mt-4 flex h-8 items-center justify-between gap-3">
      <p className="text-[13px] text-gray-500 tabular-nums">{count === null ? '' : L.items(count)}</p>
      <LayoutToggle value={layout} onChange={onLayout} />
    </div>
  )
}

export type JobBrowser = { side: ReactNode; view: (posting: JobPosting) => void; viewCompany: (companyId: string) => void }

/**
 * 카드에서 여는 미니 브라우저예요. 공고의 원문이나 기업 소개 사이트를 열어요.
 * 화면은 side를 `SplitView`에 넘기고, 카드에 view와 viewCompany를 이어요.
 */
export function useJobBrowser(): JobBrowser {
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

/**
 * 공고 탐색과 추천 공고의 목록이에요. 고른 보기 방식으로 카드나 줄을 늘어놓고, 카드를 누르면 원문을 미니 브라우저로 열어요.
 * 공고가 수백, 수천 개여도 버벅이지 않게 처음에 24개만 그리고 목록 끝이 보이면 더 그려요(`useShowMore`). 목록이 바뀌면 처음부터예요.
 * animateKey가 바뀌면(정렬 등) 카드를 새로 그려서 다시 떠올라요.
 */
export function PostingList({ postings, layout, resume, browser, onAnalyze, animateKey = '', className = '' }: {
  postings: JobPosting[]
  layout: Layout
  resume: Resume | null
  browser: JobBrowser
  onAnalyze: (posting: JobPosting) => void
  animateKey?: string
  className?: string
}) {
  const { count, more } = useShowMore(postings.length, `${postings.length}:${postings[0]?.id ?? ''}:${postings.at(-1)?.id ?? ''}`)
  return (
    <>
      <ul className={`${layout === 'gallery' ? jobsGrid : jobsList} ${className}`}>
        {postings.slice(0, count).map((posting, order) => (
          <JobItem
            key={`${layout}:${animateKey}:${posting.id}`}
            layout={layout}
            posting={posting}
            resume={resume}
            fit={fitOf(posting, resume)}
            order={order}
            onOpen={() => browser.view(posting)}
            onCompany={() => browser.viewCompany(posting.companyId)}
            onAnalyze={() => onAnalyze(posting)}
          />
        ))}
      </ul>
      {more}
    </>
  )
}

/** 카드와 줄의 빈 자리를 누른 것이에요. 안쪽 버튼(기업, 채용 공고 열기, 분석하기)은 저마다 따로 받아요. */
const onBlankClick = (open: () => void) => (event: { target: EventTarget }) => {
  if (!(event.target as Element).closest('button, a')) open()
}

/** 채용 공고 열기 아이콘이에요. 원문을 앱 안의 미니 브라우저로 열어요. */
function ViewButton({ onClick, className = 'inline-flex' }: { onClick: () => void; className?: string }) {
  const L = useMessages(TEXT)
  return (
    <Tip text={L.view} className={className}>
      <button type="button" onClick={onClick} aria-label={L.view} className={`${iconButton.md} hover:bg-gray-200/70`}>
        <ExternalLinkIcon />
      </button>
    </Tip>
  )
}

/**
 * 공고 탐색의 카드예요. 위에 기업과 적합도, 채용 공고 열기 아이콘(앱 안의 미니 브라우저), 가운데에 공고 제목과 필수 역량, 아래에 마감까지 남은 날과 모집 기간, 분석하기가 있어요.
 * 이력서가 있으면 필수 역량 이름표를 진단 시작 화면과 같은 기준으로 칠해서, 카드만 보고도 무엇이 비는지 보여요.
 * 카드의 나머지 자리를 누르면 원문을 미니 브라우저로 열고, 분석하기는 바로 진단해요.
 */
/** 카드 오른쪽 위를 파낸 홈의 높이(px)와, 홈 둘레가 휘는 반지름(px)이에요. 반지름은 카드 모서리(rounded-2xl)와 같아요. */
const NOTCH_HEIGHT = 52
const NOTCH_RADIUS = 16
/**
 * 홈 바깥으로 이어지는 오목한 모서리예요. 바깥은 카드가 놓인 흰 바탕색으로 칠하고, 그 경계에 카드 테두리와 같은 1px 선을 그어서
 * 카드 테두리가 끊기지 않고 홈을 따라 휘어 들어가요.
 */
const notchCorner = {
  width: NOTCH_RADIUS,
  height: NOTCH_RADIUS,
  background: `radial-gradient(circle at 0 100%, transparent ${NOTCH_RADIUS - 1.5}px, var(--color-gray-200) ${NOTCH_RADIUS - 1}px, var(--color-gray-200) ${NOTCH_RADIUS - 0.5}px, var(--color-white) ${NOTCH_RADIUS}px)`,
}

/**
 * 공고 카드 오른쪽 위를 서울 버스 정류장 안내판처럼 둥글게 파낸 홈이에요. 카드 테두리가 홈을 따라 이어지고, 홈 안에 마감까지 남은 날(D-6, 오늘 마감, 상시)을 크게 적어요.
 * 마감이 가장 중요한 정보라 가장 눈에 띄는 자리에 두고, 사흘 안으로 남으면 메인 컬러예요. 구체적인 날짜는 아래 태그 줄에 있어요.
 * 홈은 카드가 놓인 흰 바탕색이라, 마우스를 올려 카드가 짙어져도 홈은 그대로예요.
 */
function DeadlineNotch({ left }: { left: number | null }) {
  const L = useMessages(TEXT)
  const tone = left === null ? 'text-gray-500' : left <= 3 ? 'text-brand' : 'text-gray-900'
  return (
    <span
      className={`absolute -top-px -right-px flex items-center rounded-bl-2xl border-b border-l border-gray-200 bg-white pr-5 pl-5 text-[15px] font-bold tabular-nums ${tone}`}
      style={{ height: NOTCH_HEIGHT }}
    >
      {/* 바깥 모서리 조각은 홈의 테두리 1px과 겹치게 놓아서 선이 어긋나지 않아요. */}
      <span aria-hidden className="absolute top-0 right-[calc(100%-1px)]" style={notchCorner} />
      <span aria-hidden className="absolute top-[calc(100%-1px)] right-0" style={notchCorner} />
      {left === null ? L.always : left === 0 ? L.today : `D-${left}`}
    </span>
  )
}

export function JobCard({ posting, resume, fit, order, onOpen, onAnalyze, onCompany }: JobItemProps) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const left = daysLeft(posting)
  return (
    // 제목 버튼을 카드 전체에 늘여 덮으면, 누른 곳과 뗀 곳이 달라져 클릭이 한 번 씹혀서 카드가 직접 받아요.
    <li onClick={onBlankClick(onOpen)} className="group relative flex animate-rise cursor-pointer flex-col rounded-2xl border border-gray-200 bg-gray-50 p-5 transition-colors hover:bg-gray-100" style={stagger(order)}>
      <DeadlineNotch left={left} />
      {/* 오른쪽 위는 홈이 파고들어 있어서, 기업 줄은 그 자리를 비워 둬요. */}
      <div className="flex items-center gap-3 pr-24">
        {/* 로고와 기업 이름을 누르면 기업 소개를 미니 브라우저로 열어요. */}
        <button type="button" onClick={onCompany} aria-label={L.companyInfo(company.name)} className="group/company -m-1 flex min-w-0 items-center gap-3 rounded-xl p-1 text-left">
          <CompanyMark company={company} className="size-10 text-[15px] transition-opacity group-hover/company:opacity-80" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-gray-900 group-hover/company:underline">{company.name}</span>
            <span className="block truncate text-[12px] text-gray-400">{company.industry}</span>
          </span>
        </button>
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

      {/* 진단한 공고는 진단함 태그를 앞에 붙이고, 이력서가 있으면 적합도(높음, 중간, 낮음), 마감 날짜를 그 뒤에 붙여요. 오른쪽에 적합도와 원문을 여는 아이콘, 분석하기가 있어요. */}
      <div className="mt-5 flex items-center gap-1.5 border-t border-gray-200 pt-3">
        <DiagnosedTag postingId={posting.id} />
        <FitTag fit={fit} />
        {posting.deadline && <CardTag tone="gray">{L.until(shortDate(posting.deadline))}</CardTag>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <FitBadge fit={fit} compact />
          <ViewButton onClick={onOpen} />
        </span>
        <button type="button" onClick={onAnalyze} className={`${primaryButton} shrink-0`}>
          {L.analyze}
        </button>
      </div>
    </li>
  )
}

export type JobItemProps = { posting: JobPosting; resume: Resume | null; fit: number | null; order: number; onOpen: () => void; onAnalyze: () => void; onCompany: () => void }

/** 고른 보기 방식에 맞춰 카드나 줄로 그려요. */
function JobItem({ layout, ...props }: JobItemProps & { layout: Layout }) {
  return layout === 'gallery' ? <JobCard {...props} /> : <JobRow {...props} />
}

/**
 * 리스트형 보기의 한 줄이에요. 왼쪽에 기업 로고, 가운데에 공고 제목과 기업, 직군, 경력, 지역, 넓으면 필수 역량, 오른쪽에 마감까지 남은 날과 적합도, 채용 공고 열기 아이콘과 분석하기가 있어요.
 * 목록 폭이 좁으면 경력, 지역, 필수 역량, 두 버튼, 적합도를 차례로 숨겨요. 카드처럼 줄의 빈 자리를 누르면 원문을 열고, 로고를 누르면 기업 소개를 미니 브라우저로 열어요.
 */
function JobRow({ posting, resume, fit, order, onOpen, onAnalyze, onCompany }: JobItemProps) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  return (
    <li onClick={onBlankClick(onOpen)} className="group flex animate-rise cursor-pointer items-center gap-4 rounded-2xl bg-gray-50 px-4 py-3.5 transition-colors hover:bg-gray-100" style={stagger(order)}>
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
      <DeadlineTag left={daysLeft(posting)} />
      <span className="hidden shrink-0 @lg:inline-flex">
        <FitBadge fit={fit} compact />
      </span>
      <ViewButton onClick={onOpen} className="hidden shrink-0 @3xl:inline-flex" />
      <button type="button" onClick={onAnalyze} className={`${primaryButton} hidden! shrink-0 @3xl:inline-flex!`}>
        {L.analyze}
      </button>
    </li>
  )
}

/**
 * 마감 달력과 채용 지도의 공고 한 줄이에요. 리스트형 줄(`JobRow`)과 같은 모양이고, 줄 전체가 하나의 버튼이라 누르면 분석할지 물어요.
 * 화면마다 다른 태그는 오른쪽(trailing)이나 제목 아래(below)에 붙여요. 좁으면 경력을, locationClass를 넘기면 지역도 숨겨요.
 */
export function PickRow({ posting, onOpen, locationClass = 'flex', trailing, below }: {
  posting: JobPosting
  onOpen: () => void
  locationClass?: string
  trailing?: ReactNode
  below?: ReactNode
}) {
  const company = companyOf(posting.companyId)
  return (
    <li>
      <button
        type="button"
        data-no-press
        onClick={onOpen}
        className={`group flex w-full gap-4 rounded-2xl bg-gray-50 px-4 py-3.5 text-left transition-colors hover:bg-gray-100 ${below ? 'items-start' : 'items-center'}`}
      >
        <CompanyMark company={company} className="size-10 text-[15px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{posting.title}</span>
          <PostingMeta posting={posting} className="mt-1 text-[12.5px]!" careerClass="hidden @xl:flex" locationClass={locationClass}>
            <span className="truncate font-medium text-gray-700">{company.name}</span>
          </PostingMeta>
          {below && <span className="mt-2 flex flex-wrap items-center gap-1.5">{below}</span>}
        </span>
        {trailing}
      </button>
    </li>
  )
}
