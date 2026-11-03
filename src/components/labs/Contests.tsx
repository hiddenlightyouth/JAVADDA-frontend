import { useEffect, useMemo, useState } from 'react'
import { track } from '../../lib/analytics'
import { CONTEST_CATEGORIES, contestDaysLeft, fetchContests, type Contest, type ContestCategory, type ContestSite } from '../../lib/contests'
import { useLoadHold, useLoadProgress } from '../../lib/load'
import { messages, useMessages } from '../../lib/i18n'
import { readItem, writeItem } from '../../lib/storage'
import { Dropdown } from '../Dropdown'
import { CardTag, DeadlineTag, Failed, Notice, filterChip, filterRow } from '../GapParts'
import { SearchIcon } from '../Icons'
import { Badge, LoadProgress, fieldBase, loadCenter, stagger, useShowMore } from '../ui'

/**
 * 잡아따 Labs의 공모전 (/labs/contests)이에요. 공모전 사이트 네 곳에서 모은 공모전을 분야로 골라 봐요.
 * 맨 위에 검색창과 정렬, 그 아래 분야 버튼 줄(IT가 맨 앞), 카드 목록이에요. 카드를 누르면 처음 모은 사이트의 공고를 새 탭으로 열어요.
 */

type Sort = 'deadline' | 'recent'
const SORTS: readonly Sort[] = ['deadline', 'recent']
const CATEGORY_KEY = 'javadda:contests-category'

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
    sites: { linkareer: '링커리어', campuspick: '캠퍼스픽', wevity: '위비티', thinkgood: '씽굿' } as Record<ContestSite, string>,
    items: (count: number) => `${count.toLocaleString()}개의 공모전`,
    prize: (prize: string) => `상금 ${prize}`,
    emptyTitle: '조건에 맞는 공모전이 없어요',
    emptyBody: '다른 분야를 고르거나 검색어를 바꿔 보세요.',
    noneTitle: '아직 모은 공모전이 없어요',
    noneBody: '매일 새벽에 새로 모아요. 내일 다시 들러 주세요.',
    reset: '조건 초기화',
    intro: '링커리어, 캠퍼스픽, 위비티, 씽굿에 올라온 공모전을 한곳에 모았어요.',
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
    sites: { linkareer: 'Linkareer', campuspick: 'Campuspick', wevity: 'Wevity', thinkgood: 'Thinkgood' } as Record<ContestSite, string>,
    items: (count: number) => `${count.toLocaleString()} contests`,
    prize: (prize: string) => `Prize ${prize}`,
    emptyTitle: 'No contests match',
    emptyBody: 'Try another category or search term.',
    noneTitle: 'No contests yet',
    noneBody: 'We collect new ones every morning. Check back tomorrow.',
    reset: 'Reset filters',
    intro: 'Contests from Linkareer, Campuspick, Wevity and Thinkgood in one place.',
  },
})

function savedCategory(): ContestCategory | null {
  const value = readItem(CATEGORY_KEY)
  return CONTEST_CATEGORIES.includes(value as ContestCategory) ? (value as ContestCategory) : null
}

export function Contests() {
  const L = useMessages(TEXT)
  const { percent, one } = useLoadProgress()
  const [contests, setContests] = useState<Contest[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('deadline')
  const [category, setCategory] = useState<ContestCategory | null>(savedCategory)

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
    <div className="@container flex flex-col gap-4">
      <p className="text-[13.5px] text-gray-500">{L.intro}</p>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className={`flex h-11 min-w-0 flex-1 basis-64 items-center gap-2 rounded-xl px-3.5 ${fieldBase}`}>
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={L.search}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-gray-400 sm:text-[14px]"
          />
        </label>
        <Dropdown
          size="lg"
          label={L.sort}
          value={L.sorts[sort]}
          align="right"
          groups={[{ items: SORTS.map((value) => ({ label: L.sorts[value], checked: sort === value, onSelect: () => setSort(value) })) }]}
        />
      </div>
      <div role="radiogroup" aria-label={L.category} className={filterRow}>
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
            className={`${filterChip(category === each)} gap-1.5 px-5`}
          >
            {L.categories[each]}
            <span className="text-[12.5px] font-normal text-gray-400 tabular-nums">{counts.get(each) ?? 0}</span>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-gray-500 tabular-nums">{L.items(shown.length)}</p>
      {shown.length === 0 ? (
        <Notice
          title={L.emptyTitle}
          body={L.emptyBody}
          action={L.reset}
          onAction={() => {
            setQuery('')
            choose(null)
          }}
          className="pt-12"
        />
      ) : (
        <>
          <ul className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {shown.slice(0, count).map((contest, index) => (
              <ContestCard key={contest.id} contest={contest} order={index} />
            ))}
          </ul>
          {more}
        </>
      )}
    </div>
  )
}

function ContestCard({ contest, order }: { contest: Contest; order: number }) {
  const L = useMessages(TEXT)
  const [broken, setBroken] = useState(false)
  const main = contest.links[0]
  const open = () => {
    if (!main) return
    track('labs_contest_open', { site: main.site, category: contest.categories[0] ?? 'etc' })
    window.open(main.url, '_blank', 'noopener,noreferrer')
  }
  return (
    <li
      className="group flex cursor-pointer animate-rise gap-4 rounded-2xl bg-gray-50 p-4 transition-colors hover:bg-gray-100"
      style={stagger(order)}
      onClick={open}
    >
      {contest.imageUrl && !broken && (
        <img
          src={contest.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-[104px] w-[78px] shrink-0 rounded-lg bg-white object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <DeadlineTag left={contestDaysLeft(contest)} />
          {contest.categories.slice(0, 2).map((each) => (
            <CardTag key={each} tone="gray">
              {L.categories[each]}
            </CardTag>
          ))}
        </div>
        <a
          href={main?.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            open()
          }}
          className="line-clamp-2 text-[15px] leading-snug font-semibold text-gray-900 transition-colors group-hover:text-brand"
        >
          {contest.title}
        </a>
        {contest.organizer && <p className="truncate text-[13px] text-gray-500">{contest.organizer}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {contest.prize && <Badge tone="brand">{L.prize(contest.prize)}</Badge>}
          {contest.links.map((link) => (
            <a
              key={link.site}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.stopPropagation()
                track('labs_contest_open', { site: link.site, category: contest.categories[0] ?? 'etc' })
              }}
              className="inline-flex h-6 items-center rounded-md bg-white px-2 text-[12px] text-gray-600 transition-colors hover:text-brand"
            >
              {L.sites[link.site] ?? link.site}
            </a>
          ))}
        </div>
      </div>
    </li>
  )
}
