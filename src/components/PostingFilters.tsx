import { useMemo, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { careerName, companyOf, COMPANY_SIZES, companySizeOf, familyName, sizeName, type CareerLevel, type CompanySize, type JobFamily, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { Dropdown } from './Dropdown'
import { SearchIcon } from './Icons'
import { SuggestionHint, useSuggestion } from './ScreenParts'

/**
 * 공고 탐색과 마감 달력이 같이 쓰는 맨 위 거르는 줄이에요. 검색창과 직군, 경력, 기업 규모 드롭다운이 있어요.
 * 값은 화면이 들고, 이 줄은 고른 값을 알리고 이벤트를 보내요. 이벤트 이름은 화면마다 앞이 달라요(jobs_family_select, calendar_family_select).
 */

export const FAMILIES: JobFamily[] = ['backend', 'frontend', 'mobile', 'data', 'devops', 'other']
export const CAREERS: CareerLevel[] = ['entry', 'junior', 'any']

/** 직군 메뉴의 값이에요. null은 모든 공고, dev는 개발이 아닌 직무(기타)를 뺀 개발 직군 전체예요. */
export type FamilyFilter = JobFamily | 'dev' | null

/** 저장해 둔 값이 지금 메뉴에 있으면 그 값을, 없으면 처음 값(null)을 써요. */
export function pickOption<T>(value: unknown, options: readonly T[]): T | null {
  return options.includes(value as T) ? (value as T) : null
}

/** 서버에 보낼 직군이에요. 개발 직군 전체는 서버에 없는 값이라 받아 온 뒤에 걸러요. */
export const serverFamily = (family: FamilyFilter) => (family === 'dev' ? null : family)

/** 받아 온 공고를 직군(개발 직군 전체), 기업 규모, 상시 채용 숨기기로 걸러요. 검색어, 직군, 경력은 서버가 먼저 걸러 줘요. */
export function matchesFilters(posting: JobPosting, { family, size, hideRolling }: { family: FamilyFilter; size: CompanySize | null; hideRolling: boolean }) {
  return (family !== 'dev' || posting.family !== 'other') && (!size || companySizeOf(companyOf(posting.companyId)) === size) && (!hideRolling || Boolean(posting.deadline))
}

const TEXT = messages({
  ko: {
    label: '공고 찾기',
    all: '전체',
    family: '직군',
    devAll: '개발 직군 전체',
    career: '경력',
    size: '기업 규모',
  },
  en: {
    label: 'Search postings',
    all: 'All',
    family: 'Role',
    devAll: 'All dev roles',
    career: 'Level',
    size: 'Company size',
  },
})

interface Props {
  /** 이벤트 이름 앞에 붙여요. */
  from: 'jobs' | 'calendar'
  query: string
  onQuery: (query: string) => void
  family: FamilyFilter
  onFamily: (family: FamilyFilter) => void
  career: CareerLevel | null
  onCareer: (career: CareerLevel | null) => void
  size: CompanySize | null
  onSize: (size: CompanySize | null) => void
  /** 규모 메뉴 옆에 적을 공고 수를 셀 공고예요. */
  postings: JobPosting[] | null
  /** 드롭다운 뒤에 더 놓을 메뉴예요. 공고 탐색의 정렬이 여기 와요. */
  children?: ReactNode
}

/** 검색창 옆에 직군, 경력, 기업 규모를 드롭다운으로 나란히 둬요. 좁으면 검색창이 한 줄을 다 쓰고 메뉴는 아래로 내려가요. 화면은 @container여야 해요. */
export function PostingFilterBar({ from, query, onQuery, family, onFamily, career, onCareer, size, onSize, postings, children }: Props) {
  const L = useMessages(TEXT)
  // 검색창이 비어 있는 동안 추천 검색어가 하나씩 아래에서 올라오며 바뀌어요.
  const suggestion = useSuggestion(!query)
  // 규모 메뉴는 분류를 늘 모두 두고, 받아 온 공고 중 그 규모인 공고 수를 옆에 적어요.
  const sizeCounts = useMemo(() => {
    const counts = new Map<CompanySize, number>()
    for (const posting of postings ?? []) {
      const value = companySizeOf(companyOf(posting.companyId))
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return counts
  }, [postings])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex h-11 min-w-0 flex-1 basis-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 transition-colors focus-within:border-brand @2xl:basis-0">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            // 비어 있을 때 Enter를 누르면 지금 보이는 추천 검색어로 찾아요.
            if (event.key === 'Enter' && !query && !event.nativeEvent.isComposing) {
              track(`${from}_suggestion_use`, { query: suggestion.text })
              onQuery(suggestion.text)
            }
          }}
          aria-label={L.label}
          data-search-input
          className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none sm:text-[14px] [&::-webkit-search-cancel-button]:hidden"
        />
        {!query && <SuggestionHint {...suggestion} className="right-4 left-[42px]" />}
      </label>
      <Dropdown
        size="lg"
        active={family !== null}
        label={L.family}
        value={family === 'dev' ? L.devAll : family ? familyName(family) : L.all}
        groups={[
          {
            items: ([null, 'dev', ...FAMILIES] as FamilyFilter[]).map((value) => ({
              label: value === 'dev' ? L.devAll : value ? familyName(value) : L.all,
              checked: family === value,
              onSelect: () => {
                track(`${from}_family_select`, { family: value ?? 'all' })
                onFamily(value)
              },
            })),
          },
        ]}
      />
      <Dropdown
        size="lg"
        active={career !== null}
        label={L.career}
        value={career ? careerName(career) : L.all}
        groups={[
          {
            items: [null, ...CAREERS].map((value) => ({
              label: value ? careerName(value) : L.all,
              checked: career === value,
              onSelect: () => {
                track(`${from}_career_select`, { career: value ?? 'all' })
                onCareer(value)
              },
            })),
          },
        ]}
      />
      <Dropdown
        size="lg"
        active={size !== null}
        label={L.size}
        value={size ? sizeName(size) : L.all}
        groups={[
          {
            items: [null, ...COMPANY_SIZES].map((value) => ({
              label: value ? sizeName(value) : L.all,
              hint: value ? String(sizeCounts.get(value) ?? 0) : undefined,
              checked: size === value,
              onSelect: () => {
                track(`${from}_size_select`, { size: value ?? 'all' })
                onSize(value)
              },
            })),
          },
        ]}
      />
      {children}
    </div>
  )
}
