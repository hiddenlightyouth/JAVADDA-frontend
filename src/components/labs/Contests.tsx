import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { track } from '../../lib/analytics'
import { CONTEST_CATEGORIES, contestDaysLeft, fetchContests, type Contest, type ContestCategory } from '../../lib/contests'
import { useLoadHold, useLoadProgress } from '../../lib/load'
import { messages, useMessages } from '../../lib/i18n'
import { readItem, writeItem } from '../../lib/storage'
import { Dropdown } from '../Dropdown'
import { ScrollPage } from '../AppPage'
import { DeadlineTag, Failed, Notice, filterChip, filterRow } from '../GapParts'
import { CalendarIcon, DocumentIcon, ExternalLinkIcon, SearchIcon } from '../Icons'
import { jobsGrid, jobsList, NotchedFrame, onBlankClick, PostingCountBar, readLayout, useElementSize, type Layout } from '../JobCard'
import { shortDate } from '../ScreenParts'
import { PostingBrowser, SplitView, type BrowserPage } from '../PostingBrowser'
import { Badge, LoadProgress, loadCenter, primaryButton, stagger, tag, useShowMore } from '../ui'

/**
 * 잡아따 Labs의 공모전 (/labs/contests)이에요. 공모전 사이트 네 곳에서 모은 공모전을 분야로 골라 봐요.
 * 모양은 공고 탐색과 같아요. 맨 위에 검색창과 정렬, 그 아래 분야 버튼 줄(IT가 맨 앞), 공모전 수와 보기 방식, 카드(`ContestCard`)나 줄(`ContestRow`)이에요.
 * 어느 사이트에서 모았는지는 목록에 적지 않아요. 카드를 누르면 처음 모은 사이트의 공고를 미니 브라우저로 열어요.
 */

type Sort = 'deadline' | 'recent'
const SORTS: readonly Sort[] = ['deadline', 'recent']
const CATEGORY_KEY = 'javadda:contests-category'
/** 카드에 보여주는 분야 수예요. */
const CATEGORIES_SHOWN = 3

const TEXT = messages({
  ko: {
    search: '공모전 이름이나 주최로 찾기',
    sort: '정렬',
    sorts: { deadline: '마감 임박순', recent: '최신순' } as Record<Sort, string>,
    category: '분야',
    all: '전체',
    categories: {
      it: 'IT, 소프트웨어', idea: '기획, 아이디어', startup: '창업, 취업', science: '과학, 공학', design: '디자인', marketing: '광고, 마케팅',
      video: '영상, 사진', naming: '네이밍, 슬로건', writing: '문학, 글', thesis: '논문, 학술', arts: '예체능', etc: '기타',
    } as Record<ContestCategory, string>,
    items: (count: number) => `${count.toLocaleString()}개의 공모전`,
    prize: (prize: string) => `상금 ${prize}`,
    period: '접수 기간',
    open: '공모전 보기',
    emptyTitle: '조건에 맞는 공모전이 없어요',
    emptyBody: '다른 분야를 고르거나 검색어를 바꿔 보세요.',
    noneTitle: '아직 모은 공모전이 없어요',
    noneBody: '매일 새벽에 새로 모아요. 내일 다시 들러 주세요.',
    reset: '조건 초기화',
  },
  en: {
    search: 'Search by contest or organizer',
    sort: 'Sort',
    sorts: { deadline: 'Closing soon', recent: 'Newest' } as Record<Sort, string>,
    category: 'Category',
    all: 'All',
    categories: {
      it: 'IT and software', idea: 'Ideas and planning', startup: 'Startups and careers', science: 'Science and engineering', design: 'Design', marketing: 'Marketing',
      video: 'Video and photo', naming: 'Naming and slogans', writing: 'Writing', thesis: 'Research papers', arts: 'Arts', etc: 'Other',
    } as Record<ContestCategory, string>,
    items: (count: number) => `${count.toLocaleString()} contests`,
    prize: (prize: string) => `Prize ${prize}`,
    period: 'Entry period',
    open: 'View contest',
    emptyTitle: 'No contests match',
    emptyBody: 'Try another category or search term.',
    noneTitle: 'No contests yet',
    noneBody: 'We collect new ones every morning. Check back tomorrow.',
    reset: 'Reset filters',
  },
})

function savedCategory(): ContestCategory | null {
  const value = readItem(CATEGORY_KEY)
  return CONTEST_CATEGORIES.includes(value as ContestCategory) ? (value as ContestCategory) : null
}

export function Contests({ header }: { header?: ReactNode }) {
  const [viewing, setViewing] = useState<BrowserPage | null>(null)
  const open = (contest: Contest) => {
    const main = contest.links[0]
    if (!main) return
    track('labs_contest_open', { site: main.site, category: contest.categories[0] ?? 'etc' })
    setViewing({ url: main.url, title: contest.title })
  }

  return (
    <SplitView side={viewing && <PostingBrowser key={viewing.url} page={viewing} onClose={() => setViewing(null)} />}>
      <ScrollPage header={header}>
        <ContestList onOpen={open} />
      </ScrollPage>
    </SplitView>
  )
}

function ContestList({ onOpen }: { onOpen: (contest: Contest) => void }) {
  const L = useMessages(TEXT)
  const { percent, one } = useLoadProgress()
  const [contests, setContests] = useState<Contest[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('deadline')
  const [category, setCategory] = useState<ContestCategory | null>(savedCategory)
  const [layout, setLayout] = useState<Layout>(readLayout)

  useEffect(() => {
    let alive = true
    setFailed(false)
    fetchContests(one())
      .then((list) => alive && setContests(list))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [one, attempt])

  const choose = (next: ContestCategory | null) => {
    track('labs_contest_category', { category: next ?? 'all' })
    setCategory(next)
    writeItem(CATEGORY_KEY, next ?? '')
  }

  const counts = useMemo(() => {
    const map = new Map<ContestCategory, number>()
    for (const contest of contests ?? []) for (const each of contest.categories) map.set(each, (map.get(each) ?? 0) + 1)
    return map
  }, [contests])

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const list = (contests ?? []).filter(
      (contest) =>
        (!category || contest.categories.includes(category)) &&
        words.every((word) => `${contest.title} ${contest.organizer ?? ''}`.toLowerCase().includes(word)),
    )
    return sort === 'recent' ? [...list].sort((a, b) => (a.firstSeenAt < b.firstSeenAt ? 1 : -1)) : list
  }, [contests, category, query, sort])

  const { count, more } = useShowMore(shown.length, `${category}|${query}|${sort}`)
  const loading = useLoadHold(!contests && !failed)

  if (failed) return <Failed onRetry={() => setAttempt((value) => value + 1)} className="pt-24" />
  if (!contests || loading) return <LoadProgress percent={contests ? 100 : percent} className={loadCenter} />
  if (contests.length === 0) return <Notice title={L.noneTitle} body={L.noneBody} className="pt-24" />

  return (
    <div className="@container">
      {/* 공고 탐색의 거르는 줄(PostingFilterBar)과 같은 모양이에요. 좁으면 검색창이 한 줄을 다 쓰고 정렬은 아래로 내려가요. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-11 min-w-0 flex-1 basis-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 transition-colors focus-within:border-brand @2xl:basis-0">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={L.search}
            aria-label={L.search}
            data-search-input
            className="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-[14px] [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <Dropdown
          size="lg"
          label={L.sort}
          value={L.sorts[sort]}
          groups={[{ items: SORTS.map((value) => ({ label: L.sorts[value], checked: sort === value, onSelect: () => setSort(value) })) }]}
        />
      </div>
      <div role="radiogroup" aria-label={L.category} className={`mt-4 ${filterRow}`}>
        <button type="button" role="radio" aria-checked={!category} onClick={() => choose(null)} className={`${filterChip(!category)} px-5`}>
          {L.all}
        </button>
        {CONTEST_CATEGORIES.filter((each) => counts.has(each) || each === category).map((each) => (
          <button
            key={each}
            type="button"
            role="radio"
            aria-checked={category === each}
            onClick={() => choose(category === each ? null : each)}
            className={`${filterChip(category === each)} px-5`}
          >
            {L.categories[each]}
          </button>
        ))}
      </div>
      <PostingCountBar count={shown.length} layout={layout} onLayout={setLayout} items={L.items} />
      <div className="mt-4">
        {shown.length === 0 ? (
          <Notice
            title={L.emptyTitle}
            body={L.emptyBody}
            action={L.reset}
            onAction={() => {
              setQuery('')
              choose(null)
            }}
            className="mt-16"
          />
        ) : (
          <>
            <ul className={layout === 'gallery' ? jobsGrid : jobsList}>
              {shown.slice(0, count).map((contest, order) =>
                layout === 'gallery' ? (
                  <ContestCard key={`${layout}:${sort}:${contest.id}`} contest={contest} order={order} onOpen={onOpen} />
                ) : (
                  <ContestRow key={`${layout}:${sort}:${contest.id}`} contest={contest} order={order} onOpen={onOpen} />
                ),
              )}
            </ul>
            {more}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * 공모전 포스터예요. 공모전은 포스터로 알아보는 경우가 많아서 카드의 왼쪽을 크게 차지해요.
 * 없거나 못 불러오면 같은 크기의 흰 칸에 옅은 서류 아이콘이라 카드 모양이 흐트러지지 않아요.
 */
function Poster({ contest, className }: { contest: Contest; className: string }) {
  const [broken, setBroken] = useState(false)
  if (!contest.imageUrl || broken) {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-white text-gray-300 ${className}`}>
        <DocumentIcon className="size-1/3 max-w-8" />
      </span>
    )
  }
  return (
    <img
      src={contest.imageUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-xl border border-gray-200/70 bg-white object-cover ${className}`}
    />
  )
}

/** 접수 기간이에요. 시작일을 모르면 마감만 적고(~ 11.30), 마감을 모르면 두지 않아요. */
function Period({ contest }: { contest: Contest }) {
  const L = useMessages(TEXT)
  if (!contest.deadline) return null
  return (
    <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
      <CalendarIcon className="size-3.5 shrink-0 text-gray-400" label={L.period} />
      {contest.startDate ? `${shortDate(contest.startDate)} ` : ''}~ {shortDate(contest.deadline)}
    </span>
  )
}

/**
 * 갤러리형 카드예요. 공고 탐색의 카드(`JobCard`)와 같은 모양으로, 오른쪽 위 홈에 마감까지 남은 날을 적어요.
 * 왼쪽에 포스터를 크게(3:4) 두고, 오른쪽에 주최와 첫 분야, 제목, 접수 기간, 분야 이름표를 적어요. 맨 아래 줄에 상금과 공모전 보기가 있어요.
 */
function ContestCard({ contest, order, onOpen }: { contest: Contest; order: number; onOpen: (contest: Contest) => void }) {
  const L = useMessages(TEXT)
  const [ref, size] = useElementSize<HTMLLIElement>()
  const open = () => onOpen(contest)
  return (
    <li ref={ref} onClick={onBlankClick(open)} className="group relative isolate flex animate-rise cursor-pointer flex-col p-4 sm:p-5" style={stagger(order)}>
      <NotchedFrame left={contestDaysLeft(contest)} card={size} />
      <div className="flex flex-1 gap-4">
        <Poster contest={contest} className="aspect-[3/4] w-24 self-start @sm:w-28 @6xl:w-32" />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 오른쪽 위는 홈이 파고들어 있어서, 주최 줄은 그 자리를 비워 둬요. */}
          <span className="block truncate pr-20 text-[13.5px] font-medium text-gray-900">{contest.organizer}</span>
          <span className="block truncate pr-20 text-[12px] text-gray-400">{L.categories[contest.categories[0] ?? 'etc']}</span>
          <h3 className="mt-3 line-clamp-3 text-[16px] leading-snug font-semibold text-gray-900">
            <button type="button" onClick={open} className="text-left transition-colors group-hover:text-brand-hover">
              {contest.title}
            </button>
          </h3>
          <span className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-gray-600">
            <Period contest={contest} />
          </span>
          <div className="mt-3 flex flex-wrap content-start gap-1.5">
            {contest.categories.slice(0, CATEGORIES_SHOWN).map((each) => (
              <span key={each} className={tag}>
                {L.categories[each]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1.5 border-t border-gray-200 pt-3">
        {contest.prize && <Badge tone="brand">{L.prize(contest.prize)}</Badge>}
        <button type="button" onClick={open} className={`${primaryButton} ml-auto shrink-0 gap-1.5`}>
          {L.open}
          <ExternalLinkIcon className="size-3.5" />
        </button>
      </div>
    </li>
  )
}

/** 리스트형 줄이에요. 공고 탐색의 줄(`JobRow`)과 같은 모양이고, 목록 폭이 좁으면 접수 기간, 분야, 상금, 버튼을 차례로 숨겨요. */
function ContestRow({ contest, order, onOpen }: { contest: Contest; order: number; onOpen: (contest: Contest) => void }) {
  const L = useMessages(TEXT)
  const open = () => onOpen(contest)
  return (
    <li onClick={onBlankClick(open)} className="group flex animate-rise cursor-pointer items-center gap-4 rounded-2xl bg-gray-50 px-4 py-3.5 transition-colors hover:bg-gray-100" style={stagger(order)}>
      <Poster contest={contest} className="aspect-[3/4] w-12" />
      <div className="min-w-0 flex-1">
        <h3 className="flex text-[15px] font-semibold text-gray-900">
          <button type="button" onClick={open} className="min-w-0 truncate text-left transition-colors group-hover:text-brand-hover">
            {contest.title}
          </button>
        </h3>
        <span className="mt-1 flex min-w-0 items-center gap-x-3 text-[12.5px] text-gray-600">
          <span className="truncate font-medium text-gray-700">{contest.organizer}</span>
          <span className="hidden @xl:flex">
            <Period contest={contest} />
          </span>
        </span>
      </div>
      <div className="hidden shrink-0 gap-1.5 @5xl:flex">
        {contest.categories.slice(0, 2).map((each) => (
          <span key={each} className={tag}>
            {L.categories[each]}
          </span>
        ))}
      </div>
      {contest.prize && (
        <span className="hidden shrink-0 @2xl:inline-flex">
          <Badge tone="brand">{L.prize(contest.prize)}</Badge>
        </span>
      )}
      <DeadlineTag left={contestDaysLeft(contest)} />
      <button type="button" onClick={open} className={`${primaryButton} hidden! shrink-0 @3xl:inline-flex!`}>
        {L.open}
      </button>
    </li>
  )
}
