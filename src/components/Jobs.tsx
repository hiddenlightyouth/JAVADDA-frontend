import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, COMPANIES, companyOf, daysLeft, familyName, fetchPostings, fitOf, sortPostings, useResume, type CareerLevel, type JobFamily, type JobPosting, type PostingSort, type Resume, SEARCH_SUGGESTIONS, SUGGEST_MS } from '../lib/gap'
import { getLang, localizePath, messages, pick, useMessages } from '../lib/i18n'
import { pathOf } from '../lib/routes'
import { showToast } from '../lib/toast'
import { copyText, PageHeader } from './AppPage'
import { MapMenu } from './DeepParts'
import { CompanyMark, Failed, FitBadge, Notice, SkillChip, skillTone } from './GapParts'
import { BriefcaseIcon, MapPinIcon, PersonIcon } from './Icons'
import { PostingBrowser, SplitView } from './PostingBrowser'
import { Bone } from './Skeleton'

/**
 * 공고 탐색 화면이에요. 공고를 화면 가득 펼쳐 놓고 직군과 경력으로 걸러 보다가, 눌러서 진단을 시작해요.
 * 이력서를 올려 두었으면 카드마다 적합도가 보여요.
 */

const FAMILIES: JobFamily[] = ['backend', 'frontend', 'mobile', 'data', 'devops']
const CAREERS: CareerLevel[] = ['entry', 'junior', 'any']
const SORTS: PostingSort[] = ['fit', 'recent', 'deadline']

const TEXT = messages({
  ko: {
    title: '공고 탐색',
    placeholder: '기업, 공고, 기술 이름으로 찾기',
    label: '공고 찾기',
    all: '전체',
    family: '직군',
    career: '경력',
    sort: '정렬',
    sorts: { fit: '적합도순', recent: '최신순', deadline: '마감 임박순' } as Record<PostingSort, string>,
    items: (count: number) => `${count}개의 공고`,
    none: '맞는 공고가 없어요.',
    noneBody: '검색어나 걸러 둔 조건을 바꿔 보세요.',
    sources: '워크넷과 기업 채용 페이지에서 하루 한 번 모아요.',
    category: '직무 카테고리',
    location: '지역',
    company: '기업',
    always: '상시 채용',
    view: '원문 보기',
    share: '링크 복사',
    more: (count: number) => `외 ${count}개`,
    dday: (days: number) => (days === 0 ? '오늘 마감' : `D-${days}`),
    copied: '공고 링크를 복사했어요.',
    copyFailed: '링크를 복사하지 못했어요.',
  },
  en: {
    title: 'Explore jobs',
    placeholder: 'Search companies, postings, or skills',
    label: 'Search postings',
    all: 'All',
    family: 'Role',
    career: 'Level',
    sort: 'Sort',
    sorts: { fit: 'Best fit', recent: 'Newest', deadline: 'Closing soon' },
    items: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    none: 'No postings match.',
    noneBody: 'Try a different search or filter.',
    sources: 'Collected once a day from Worknet and company career pages.',
    category: 'Job category',
    location: 'Location',
    company: 'Company',
    always: 'Rolling',
    view: 'Original',
    share: 'Copy link',
    more: (count: number) => `+${count} more`,
    dday: (days: number) => (days === 0 ? 'Closes today' : `D-${days}`),
    copied: 'Copied the posting link.',
    copyFailed: "Couldn't copy the link.",
  },
})

/** 공고 카드는 넓은 화면에서 한 줄에 둘이나 셋씩 놓여요. */
// 원문 칸이 열리면 목록 폭이 줄어서, 화면 폭이 아니라 목록 폭(@container)을 보고 칸 수를 정해요.
const jobsGrid = 'grid gap-4 @2xl:grid-cols-2 @7xl:grid-cols-3'
/** 카드 맨 아래의 작은 글자 버튼이에요. 카드를 덮는 제목 버튼보다 위에 놓여요. */
const cardAction =
  'relative z-10 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900'
/** 카드에 보여주는 필수 역량 수예요. 나머지는 수만 적어요. */
const SKILLS_SHOWN = 4

type Loaded = JobPosting[] | 'failed'

/** company를 주면 그 기업 공고만 골라 둔 채로 열어요. 새 진단 화면의 기업 둘러보기에서 와요. */
export function Jobs({ onPick, initialCompany = null }: { onPick: (postingId: string) => void; initialCompany?: string | null }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<JobFamily | null>(null)
  const [career, setCareer] = useState<CareerLevel | null>(null)
  const [sort, setSort] = useState<PostingSort>(resume ? 'fit' : 'recent')
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const [suggestion, setSuggestion] = useState(0)
  const [company, setCompany] = useState<string | null>(initialCompany)
  const [viewing, setViewing] = useState<JobPosting | null>(null)

  // 검색창이 비어 있는 동안 추천 검색어가 하나씩 아래에서 올라오며 바뀌어요.
  useEffect(() => {
    if (query) return
    const timer = window.setInterval(() => setSuggestion((value) => (value + 1) % SEARCH_SUGGESTIONS.length), SUGGEST_MS)
    return () => window.clearInterval(timer)
  }, [query])

  // 검색어는 잠깐 멈췄을 때 보내요.
  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    const timer = window.setTimeout(() => {
      void fetchPostings({ query, family, career }).then(
        (list) => {
          if (!stale) setLoaded(list)
        },
        () => {
          if (!stale) setLoaded('failed')
        },
      )
    }, query ? 250 : 0)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [query, family, career, attempt])

  // 기업은 받아 온 공고에서 바로 걸러요. 기업마다 공고가 몇 개뿐이라 서버에 다시 묻지 않아요.
  const list = Array.isArray(loaded) ? sortPostings(company ? loaded.filter((posting) => posting.companyId === company) : loaded, sort, resume) : loaded

  return (
    <SplitView side={viewing && <PostingBrowser key={viewing.id} posting={viewing} onClose={() => setViewing(null)} />}>
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-6 pt-14 md:px-10 md:pt-9">
          <PageHeader title={L.title} />
          <div className="border-b border-gray-200" />
        </div>

        <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-16 md:px-10">
          <label className="relative flex h-14 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 focus-within:border-brand">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-gray-400" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // 비어 있을 때 Enter를 누르면 지금 보이는 추천 검색어로 찾아요.
                if (event.key === 'Enter' && !query && !event.nativeEvent.isComposing) {
                  track('jobs_suggestion_use', { query: SEARCH_SUGGESTIONS[suggestion] })
                  setQuery(SEARCH_SUGGESTIONS[suggestion])
                }
              }}
              aria-label={L.label}
              data-search-input
              className="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {/* 추천 검색어는 자리표시 글자처럼 옅게 보여서, 이런 걸 쳐 볼 수 있다는 것만 슬쩍 알려요. */}
            {!query && (
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-12 right-5 flex items-center overflow-hidden text-[15px] whitespace-nowrap text-gray-400">
                <span key={suggestion} className="animate-rise">
                  {SEARCH_SUGGESTIONS[suggestion]}
                </span>
              </span>
            )}
          </label>

          {/* 직군은 메뉴에 숨기지 않고 늘어놓아서, 한 번 눌러 바로 골라요. */}
          <div role="radiogroup" aria-label={L.category} className="mt-4 flex flex-wrap gap-2">
            {[null, ...FAMILIES].map((value) => (
              <button
                key={value ?? 'all'}
                type="button"
                role="radio"
                aria-checked={family === value}
                onClick={() => {
                  track('jobs_family_select', { family: value ?? 'all' })
                  setFamily(value)
                }}
                className={`flex h-9 items-center rounded-full border px-4 text-[13.5px] font-medium transition-colors ${
                  family === value ? 'border-brand bg-brand text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-950'
                }`}
              >
                {value ? familyName(value) : L.all}
              </button>
            ))}
          </div>

          {/* 기업도 로고를 보고 한 번에 골라요. 다시 누르면 풀려요. */}
          <div role="radiogroup" aria-label={L.company} className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] @2xl:flex-wrap @2xl:overflow-visible">
            {COMPANIES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={company === item.id}
                onClick={() => {
                  const next = company === item.id ? null : item.id
                  track('jobs_company_select', { company: next ?? 'all' })
                  setCompany(next)
                }}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1.5 text-[13px] font-medium transition-colors ${
                  company === item.id ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-950'
                }`}
              >
                <CompanyMark company={item} className="size-6 rounded-full! text-[10px]" />
                {item.name}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MapMenu
              label={L.career}
              value={career ? careerName(career) : L.all}
              groups={[
                {
                  items: [null, ...CAREERS].map((value) => ({
                    label: value ? careerName(value) : L.all,
                    checked: career === value,
                    onSelect: () => {
                      track('jobs_career_select', { career: value ?? 'all' })
                      setCareer(value)
                    },
                  })),
                },
              ]}
            />
            <MapMenu
              label={L.sort}
              value={L.sorts[sort]}
              groups={[
                {
                  items: SORTS.filter((value) => value !== 'fit' || resume).map((value) => ({
                    label: L.sorts[value],
                    checked: sort === value,
                    onSelect: () => {
                      track('jobs_sort_change', { sort: value })
                      setSort(value)
                    },
                  })),
                },
              ]}
            />
            {Array.isArray(list) && <p className="ml-auto text-[13px] text-gray-500 tabular-nums">{L.items(list.length)}</p>}
          </div>

          <div className="mt-4">
            {list === undefined ? (
              <JobCardsSkeleton />
            ) : list === 'failed' ? (
              <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
            ) : list.length === 0 ? (
              <Notice title={L.none} body={L.noneBody} className="mt-16" />
            ) : (
              <ul className={jobsGrid}>
                {list.map((posting, order) => (
                  <JobCard
                    key={`${sort}:${posting.id}`}
                    posting={posting}
                    resume={resume}
                    onView={() => setViewing(posting)}
                    fit={fitOf(posting, resume)}
                    order={order}
                    onOpen={() => {
                      track('posting_select', { posting: posting.id, from: 'explore' })
                      onPick(posting.id)
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
          <p className="mt-10 text-center text-[12px] text-gray-400">{L.sources}</p>
        </div>
      </main>
    </SplitView>
  )
}

/** 카드는 앞에서부터 조금씩 늦게 떠올라요. 뒤쪽 카드는 더 늦추지 않아요. */
const STAGGER_MS = 28
const STAGGER_MAX = 14

/** 10.28 처럼 달과 날만 적어요. */
const shortDate = (iso: string) => {
  const date = new Date(iso)
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 공고 탐색의 카드예요. 위에 기업과 마감까지 남은 날, 가운데에 공고 제목과 필수 역량, 아래에 모집 기간과 적합도, 원문 보기(앱 안의 미니 브라우저)와 링크 복사가 있어요.
 * 이력서가 있으면 필수 역량 이름표를 진단 시작 화면과 같은 기준으로 칠해서, 카드만 보고도 무엇이 비는지 보여요.
 * 카드의 나머지 자리를 누르면 진단 시작으로 가요.
 */
function JobCard({ posting, resume, fit, order, onOpen, onView }: { posting: JobPosting; resume: Resume | null; fit: number | null; order: number; onOpen: () => void; onView: () => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  const left = daysLeft(posting)
  const share = () => {
    const url = `${window.location.origin}${localizePath(pathOf({ kind: 'diagnose', postingId: posting.id }), getLang())}`
    void copyText(url).then((done) => showToast(done ? pick(TEXT).copied : pick(TEXT).copyFailed))
  }
  return (
    <li
      className="group relative flex animate-rise flex-col rounded-2xl bg-gray-50 p-5 transition-colors hover:bg-gray-100"
      style={{ animationDelay: `${Math.min(order, STAGGER_MAX) * STAGGER_MS}ms` }}
    >
      <div className="flex items-center gap-3">
        <CompanyMark company={company} className="size-10 text-[15px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-gray-900">{company.name}</p>
          <p className="truncate text-[12px] text-gray-400">{company.industry}</p>
        </div>
        {/* 마감이 사흘 안으로 남으면 메인 컬러로 알려요. */}
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums ${
            left !== null && left <= 3 ? 'bg-brand-soft text-brand-hover' : 'bg-gray-200/70 text-gray-500'
          }`}
        >
          {left === null ? L.always : L.dday(left)}
        </span>
      </div>

      <h3 className="mt-4 text-[17px] leading-snug font-semibold text-gray-900">
        {/* 제목 버튼이 카드 전체를 덮어서, 카드 어디를 눌러도 진단 시작으로 가요. */}
        <button type="button" onClick={onOpen} className="text-left transition-colors group-hover:text-brand-hover after:absolute after:inset-0 after:rounded-2xl">
          {posting.title}
        </button>
      </h3>
      {/* 직군, 경력, 지역은 아이콘을 붙여 한 줄에 늘어놓아서, 훑어볼 때 바로 눈에 들어와요. */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-gray-600">
        <li className="flex items-center gap-1.5">
          <BriefcaseIcon label={L.family} />
          {familyName(posting.family)}
        </li>
        <li className="flex items-center gap-1.5">
          <PersonIcon label={L.career} />
          {careerName(posting.career)}
        </li>
        <li className="flex min-w-0 items-center gap-1.5">
          <MapPinIcon label={L.location} />
          <span className="truncate">{posting.location}</span>
        </li>
      </ul>
      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-gray-500">{posting.summary}</p>

      <div className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
        {posting.required.slice(0, SKILLS_SHOWN).map((skill) => (
          <SkillChip key={skill} name={skill} tone={skillTone(skill, resume)} />
        ))}
        {posting.required.length > SKILLS_SHOWN && <span className="inline-flex h-7 items-center px-1 text-[12px] text-gray-400">{L.more(posting.required.length - SKILLS_SHOWN)}</span>}
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-gray-200 pt-3">
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-gray-400 tabular-nums">
          {shortDate(posting.postedAt)} ~ {posting.deadline ? shortDate(posting.deadline) : L.always}
        </span>
        <FitBadge fit={fit} compact />
        {/* 원문은 새 탭 대신 앱 안의 미니 브라우저로 열어요. */}
        <button type="button" onClick={onView} className={cardAction}>
          {L.view}
        </button>
        <button type="button" onClick={share} className={cardAction}>
          {L.share}
        </button>
      </div>
    </li>
  )
}

/** 공고 카드와 같은 배치의 뼈대예요. */
function JobCardsSkeleton() {
  return (
    <ul className={jobsGrid} aria-busy="true">
      {Array.from({ length: 6 }, (_, item) => (
        <li key={item} aria-hidden className="rounded-2xl bg-gray-50 p-5">
          <div className="flex items-center gap-3">
            <Bone className="size-10 shrink-0 rounded-xl!" />
            <div className="min-w-0 flex-1">
              <Bone className="h-3.5 w-24" />
              <Bone className="mt-2 h-3 w-36" />
            </div>
            <Bone className="h-6 w-12 rounded-md!" />
          </div>
          <Bone className="mt-5 h-4 w-3/4" />
          <Bone className="mt-3 h-3 w-full" />
          <div className="mt-4 flex gap-1.5">
            <Bone className="h-7 w-16 rounded-md!" />
            <Bone className="h-7 w-20 rounded-md!" />
            <Bone className="h-7 w-14 rounded-md!" />
          </div>
          <div className="mt-5 flex justify-between border-t border-gray-200 pt-4">
            <Bone className="h-3 w-24" />
            <Bone className="h-3 w-28" />
          </div>
        </li>
      ))}
    </ul>
  )
}
