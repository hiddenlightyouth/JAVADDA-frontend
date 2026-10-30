import { useEffect, useRef, useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { BLOG_COMPANIES, COLLECTED_AT, fetchBlogDigests, isStale, THEME_NAMES, themeShare, themeTrends, topSkills, type BlogDigest, type BlogPost, type ThemeTrend } from '../lib/blogs'
import { companyOf, POSTINGS } from '../lib/gap'
import { getLang, messages, useMessages } from '../lib/i18n'
import { PageHeader } from './AppPage'
import { CompanyMark, Failed, Meter, Notice, Panel, SkillChip } from './GapParts'
import { ExternalLinkIcon } from './Icons'
import { Bone } from './Skeleton'
import { Busy, primaryButton, stagger, toolButton } from './ui'

/**
 * 기술 블로그 화면이에요. 기업마다 기술 블로그의 대표 글을 요약해 두고, 요즘 어떤 고민을 하는지 분석해서 보여줘요.
 * 글 제목을 누르면 원문을 새 탭으로 바로 열어요. 기업을 고르지 않았으면 여러 기업에 걸친 요즘 흐름과 기업별 요약 카드를 보여줘요.
 * 기업은 주소(`/blogs/기업아이디`)로 골라서, 뒤로 가기로 앞에 보던 기업이나 전체로 돌아가요.
 */

const TEXT = messages({
  ko: {
    title: '기술 블로그',
    all: '전체',
    company: '기업',
    trendTitle: '요즘 기업들의 고민',
    trendLead: (active: number, count: number, theme: string) => `최근 넉 달 동안 글을 쓴 ${active}곳 중 ${count}곳이 ${theme} 이야기를 했어요.`,
    trendNote: '글에 붙인 주제로 세었어요. 한 글에 주제가 둘이면 둘 다 셌어요.',
    companies: (count: number) => `${count}곳`,
    of: (active: number) => `/ ${active}곳`,
    themeLabel: '요즘 고민',
    pickCompany: (name: string) => `${name} 블로그 보기`,
    posts: (count: number) => `글 ${count}개`,
    latest: '마지막 글',
    paused: '쉬는 중',
    concernTitle: '요즘 이런 고민을 해요',
    stale: (date: string) => `마지막 글이 ${date}에 올라왔어요. 지금의 고민과는 다를 수 있어요.`,
    evidence: '근거가 된 글',
    postsTitle: '대표 글',
    morePosts: '블로그에서 더 보기',
    read: '원문 읽기',
    shareTitle: '주제 비중',
    shareCount: (count: number) => `${count}개`,
    skillsTitle: '자주 나온 기술',
    interviewTitle: '면접에서 이렇게 써 보세요',
    jobsTitle: '이 기업의 공고',
    jobsBody: (count: number) => (count ? `지금 열려 있는 공고가 ${count}개 있어요. 블로그에서 본 고민을 공고의 요구 역량과 맞춰 보세요.` : '지금 열려 있는 공고는 없어요.'),
    jobs: '공고 보기',
    openBlog: '블로그 열기',
    back: '전체 기술 블로그로',
    collected: (date: string) => `각 블로그에서 ${date}까지 올라온 글을 모아 요약했어요. 제목을 누르면 원문이 새 탭으로 열려요.`,
    missing: '이 기업의 기술 블로그 요약은 아직 없어요.',
    missingBody: '다른 기업을 골라 보세요.',
    missingAction: '전체 보기',
    newTab: '새 탭에서 열려요',
  },
  en: {
    title: 'Tech blogs',
    all: 'All',
    company: 'Company',
    trendTitle: 'What companies are working on',
    trendLead: (active: number, count: number, theme: string) => `Of the ${active} companies that posted in the last four months, ${count} wrote about ${theme}.`,
    trendNote: 'Counted by the topics tagged on each post. A post with two topics counts for both.',
    companies: (count: number) => `${count}`,
    of: (active: number) => `of ${active}`,
    themeLabel: 'Trending',
    pickCompany: (name: string) => `View ${name}`,
    posts: (count: number) => `${count} ${count === 1 ? 'post' : 'posts'}`,
    latest: 'Latest',
    paused: 'Paused',
    concernTitle: 'What they are working on',
    stale: (date: string) => `The latest post is from ${date}. Their focus may have changed since.`,
    evidence: 'Based on',
    postsTitle: 'Featured posts',
    morePosts: 'More on the blog',
    read: 'Read',
    shareTitle: 'Topics',
    shareCount: (count: number) => `${count}`,
    skillsTitle: 'Frequent tech',
    interviewTitle: 'Use it in your interview',
    jobsTitle: 'Open postings',
    jobsBody: (count: number) => (count ? `${count} open ${count === 1 ? 'posting' : 'postings'}. Match what you read here with their requirements.` : 'No open postings right now.'),
    jobs: 'View postings',
    openBlog: 'Open blog',
    back: 'All tech blogs',
    collected: (date: string) => `Summarized from posts published up to ${date}. Titles open the original in a new tab.`,
    missing: "We don't have a summary for this company's blog yet.",
    missingBody: 'Try another company.',
    missingAction: 'View all',
    newTab: 'Opens in a new tab',
  },
})

/** 한 번 받은 요약은 화면을 오가도 다시 받지 않아요. */
let cache: BlogDigest[] | null = null

/** 10월 27일처럼 적어요. 글을 모은 해와 다르면 해도 적어요. */
function dayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  const sameYear = iso.slice(0, 4) === COLLECTED_AT.slice(0, 4)
  if (getLang() === 'en') return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' })
  return `${sameYear ? '' : `${date.getFullYear()}년 `}${date.getMonth() + 1}월 ${date.getDate()}일`
}

/** 새 탭으로 여는 링크에 붙이는 작은 표시예요. */
function ExternalMark({ className = 'size-3.5' }: { className?: string }) {
  return <ExternalLinkIcon className={`shrink-0 ${className}`} strokeWidth={1.5} />
}

export function Blogs({ company, onCompany, onJobs }: {
  /** 고른 기업. null이면 전체예요. */
  company: string | null
  onCompany: (company: string | null) => void
  /** 그 기업 공고만 골라 둔 공고 탐색으로 가요. */
  onJobs: (company: string) => void
}) {
  const L = useMessages(TEXT)
  const [loaded, setLoaded] = useState<BlogDigest[] | 'failed' | undefined>(cache ?? undefined)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (cache) return
    let stale = false
    setLoaded(undefined)
    fetchBlogDigests().then(
      (list) => {
        cache = list
        if (!stale) setLoaded(list)
      },
      () => {
        if (!stale) setLoaded('failed')
      },
    )
    return () => {
      stale = true
    }
  }, [attempt])

  const digests = Array.isArray(loaded) ? loaded : null
  const digest = company && digests ? (digests.find((item) => item.companyId === company) ?? null) : null
  const picked = company ? companyOf(company) : null

  const select = (next: string | null, from: string) => {
    if (next === company) return
    track('blog_company_select', { company: next ?? 'all', from })
    onCompany(next)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-6 pt-14 md:px-10 md:pt-9">
        {picked ? (
          <PageHeader
            owner={L.title}
            title={picked.name}
            mark={<CompanyMark company={picked} className="size-11 text-[16px]" />}
            onBack={() => select(null, 'back')}
            backLabel={L.back}
            actions={
              digest && (
                <a
                  href={digest.blog}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('blog_site_open', { company: digest.companyId })}
                  className={toolButton}
                >
                  {L.openBlog}
                  <ExternalMark className="size-3.5 text-gray-400" />
                </a>
              )
            }
          />
        ) : (
          <PageHeader title={L.title} />
        )}
      </div>

      <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10">
        {/* 기업은 공고 탐색처럼 로고를 보고 한 번에 골라요. */}
        <div role="radiogroup" aria-label={L.company} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] @2xl:flex-wrap @2xl:overflow-visible">
          <button
            type="button"
            role="radio"
            aria-checked={!company}
            onClick={() => select(null, 'chips')}
            className={`flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-medium transition-colors ${
              !company ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-950'
            }`}
          >
            {L.all}
          </button>
          {BLOG_COMPANIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={company === item.id}
              onClick={() => select(item.id, 'chips')}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1.5 text-[13px] font-medium transition-colors ${
                company === item.id ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-950'
              }`}
            >
              <CompanyMark company={item} className="size-6 rounded-full! text-[10px]" />
              {item.name}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {loaded === undefined ? (
            company ? <DetailSkeleton /> : <OverviewSkeleton />
          ) : loaded === 'failed' ? (
            <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
          ) : company && !digest ? (
            <Notice title={L.missing} body={L.missingBody} action={L.missingAction} onAction={() => select(null, 'missing')} className="mt-16" />
          ) : digest ? (
            <Detail key={digest.companyId} digest={digest} onJobs={onJobs} />
          ) : (
            <Overview digests={loaded} onPick={(id) => select(id, 'card')} />
          )}
        </div>
        <p className="mt-10 text-center text-[12px] text-gray-400">{L.collected(dayLabel(COLLECTED_AT))}</p>
      </div>
    </main>
  )
}

/** 전체 보기의 칸 수예요. 목록 폭을 보고 정해요. 공고 탐색의 카드 줄과 같은 기준(672px, 1152px)이에요. */
function useColumns() {
  const ref = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      setColumns(width >= 1152 ? 3 : width >= 672 ? 2 : 1)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, columns }
}

/**
 * 높이가 다른 칸을 빈틈없이 쌓는 갤러리예요. 칸을 왼쪽부터 차례로 나눠 담아서, 읽는 순서는 왼쪽 위부터 그대로예요.
 * 짧은 주제 칸과 긴 블로그 카드가 섞여도 줄마다 높이를 맞추느라 비는 자리가 생기지 않아요.
 */
function Gallery({ items }: { items: { key: string; node: ReactNode }[] }) {
  const { ref, columns } = useColumns()
  const lanes: (typeof items)[] = Array.from({ length: columns }, () => [])
  items.forEach((item, index) => lanes[index % columns].push(item))
  return (
    <div ref={ref} className="flex items-start gap-4">
      {lanes.map((lane, index) => (
        <ul key={index} className="flex min-w-0 flex-1 flex-col gap-4">
          {lane.map((item) => (
            <li key={item.key} className="animate-rise">
              {item.node}
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}

/**
 * 전체 보기예요. 여러 기업에 걸친 요즘 고민(주제마다 작은 칸)과 기업별 블로그 카드를 한 갤러리에 섞어 놓아요.
 * 주제 칸은 블로그 카드 사이사이에 고르게 끼워서, 따로 큰 칸을 차지하지 않아요.
 */
function Overview({ digests, onPick }: { digests: BlogDigest[]; onPick: (company: string) => void }) {
  const L = useMessages(TEXT)
  const { trends, active } = themeTrends(digests)
  const themes = trends.slice(0, 6)
  const top = themes[0]

  // 블로그 카드 사이에 주제 칸을 고르게 끼워요. 첫 줄 둘째 자리부터 들어가요.
  const items: { key: string; node: ReactNode }[] = []
  const step = themes.length ? digests.length / themes.length : Infinity
  let next = 0
  digests.forEach((digest, index) => {
    items.push({ key: digest.companyId, node: <DigestCard digest={digest} order={items.length} onOpen={() => onPick(digest.companyId)} /> })
    while (next < themes.length && index + 1 >= next * step + 1) {
      const trend = themes[next]
      items.push({ key: `theme:${trend.theme}`, node: <ThemeCard trend={trend} active={active} order={items.length} onPick={onPick} /> })
      next += 1
    }
  })

  return (
    <div>
      {top && (
        <div className="mb-4 px-1">
          <h2 className="text-[15px] font-semibold text-gray-900">{L.trendTitle}</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600">{L.trendLead(active, top.companies.length, THEME_NAMES[top.theme])}</p>
        </div>
      )}
      <Gallery items={items} />
      {top && <p className="mt-6 text-center text-[12px] text-gray-400">{L.trendNote}</p>}
    </div>
  )
}

/** 요즘 고민 주제 하나의 작은 칸이에요. 몇 곳이 썼는지와 그 기업 로고가 있고, 로고를 누르면 그 기업 블로그로 가요. */
function ThemeCard({ trend, active, order, onPick }: { trend: ThemeTrend; active: number; order: number; onPick: (company: string) => void }) {
  const L = useMessages(TEXT)
  return (
    <div className="rounded-2xl bg-gray-50 p-5" style={stagger(order)}>
      <p className="text-[12px] font-medium text-brand">{L.themeLabel}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[16px] leading-snug font-semibold text-gray-900">{THEME_NAMES[trend.theme]}</p>
        <p className="shrink-0 tabular-nums">
          <span className="text-[16px] font-semibold text-brand">{L.companies(trend.companies.length)}</span>
          <span className="ml-1 text-[12px] text-gray-400">{L.of(active)}</span>
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200/70" aria-hidden>
        <div className="h-full origin-left animate-grow rounded-full bg-brand" style={{ width: `${(trend.companies.length / Math.max(1, active)) * 100}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {trend.companies.map((id) => {
          const company = companyOf(id)
          return (
            <button
              key={id}
              type="button"
              aria-label={L.pickCompany(company.name)}
              title={company.name}
              onClick={() => onPick(id)}
              className="rounded-lg transition-opacity hover:opacity-75"
            >
              <CompanyMark company={company} className="size-7 rounded-lg! text-[11px]" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 기업 하나의 요약 카드예요. 요즘 고민 한 줄과 주요 주제, 마지막 글을 보여주고, 누르면 그 기업의 자세한 분석으로 가요. */
function DigestCard({ digest, order, onOpen }: { digest: BlogDigest; order: number; onOpen: () => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(digest.companyId)
  const paused = isStale(digest)
  const latest = digest.posts[0]
  return (
    <div
      onClick={(event) => {
        if (!(event.target as Element).closest('button, a')) onOpen()
      }}
      className="group flex cursor-pointer flex-col rounded-2xl bg-gray-50 p-5 transition-colors hover:bg-gray-100"
      style={stagger(order)}
    >
      <div className="flex items-center gap-3">
        <CompanyMark company={company} className="size-10 text-[15px]" />
        <span className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="block max-w-full truncate text-left text-[14px] font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">
            {company.name}
          </button>
          <span className="block truncate text-[12px] text-gray-400">{digest.platform}</span>
        </span>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums ${paused ? 'bg-gray-200/70 text-gray-400' : 'bg-gray-200/70 text-gray-500'}`}>
          {paused ? L.paused : dayLabel(latest.date)}
        </span>
      </div>

      <p className="mt-4 line-clamp-3 text-[14px] leading-relaxed text-gray-800">{digest.headline}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {themeShare(digest)
          .slice(0, 3)
          .map(({ theme }) => (
            <SkillChip key={theme} name={THEME_NAMES[theme]} />
          ))}
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-gray-200 pt-3 text-[12.5px]">
        <span className="shrink-0 text-gray-400">{L.latest}</span>
        <a
          href={latest.url}
          target="_blank"
          rel="noopener noreferrer"
          title={L.newTab}
          onClick={() => track('blog_post_open', { company: digest.companyId, post: latest.id, from: 'card' })}
          className="relative z-10 flex min-w-0 flex-1 items-center gap-1 text-gray-600 transition-colors hover:text-brand"
        >
          <span className="truncate">{latest.title}</span>
          <ExternalMark className="size-3 text-gray-400" />
        </a>
        <span className="shrink-0 text-gray-400 tabular-nums">{L.posts(digest.posts.length)}</span>
      </div>
    </div>
  )
}

/** 기업 하나의 자세한 분석이에요. 왼쪽에 요즘 고민과 대표 글, 오른쪽에 주제 비중, 기술, 면접에서 쓸 점, 공고가 있어요. */
function Detail({ digest, onJobs }: { digest: BlogDigest; onJobs: (company: string) => void }) {
  const L = useMessages(TEXT)
  const byId = new Map(digest.posts.map((item) => [item.id, item]))
  const share = themeShare(digest)
  const openings = POSTINGS.filter((posting) => posting.companyId === digest.companyId).length
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title={L.concernTitle}>
          {isStale(digest) && <p className="mb-4 rounded-xl bg-white px-4 py-3 text-[13px] leading-relaxed text-gray-600">{L.stale(dayLabel(digest.posts[0].date))}</p>}
          <p className="text-[18px] leading-snug font-semibold text-gray-900">{digest.headline}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-gray-600">{digest.analysis}</p>
          <ol className="mt-5 grid gap-3 @4xl:grid-cols-3">
            {digest.concerns.map((concern, index) => (
              <li key={concern.title} className="flex flex-col rounded-xl bg-white p-4">
                <p className="flex items-baseline gap-2 text-[14px] font-semibold text-gray-900">
                  <span className="text-[13px] text-brand tabular-nums">{index + 1}</span>
                  {concern.title}
                </p>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-gray-600">{concern.body}</p>
                <p className="mt-3 text-[11.5px] font-medium text-gray-400">{L.evidence}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {concern.posts.map((id) => {
                    const item = byId.get(id)
                    if (!item) return null
                    return (
                      <li key={id}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={L.newTab}
                          onClick={() => track('blog_post_open', { company: digest.companyId, post: id, from: 'concern' })}
                          className="flex items-start gap-1 text-[12.5px] leading-snug text-gray-700 transition-colors hover:text-brand"
                        >
                          <span className="line-clamp-2">{item.title}</span>
                          <ExternalMark className="mt-0.5 size-3 text-gray-400" />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title={L.postsTitle}
          action={
            <a href={digest.blog} target="_blank" rel="noopener noreferrer" onClick={() => track('blog_site_open', { company: digest.companyId })} className="flex items-center gap-1 text-[12.5px] font-medium text-brand hover:text-brand-hover">
              {L.morePosts}
              <ExternalMark className="size-3" />
            </a>
          }
        >
          <ul className="-mx-3 -my-1 flex flex-col">
            {digest.posts.map((item) => (
              <PostRow key={item.id} post={item} company={digest.companyId} />
            ))}
          </ul>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel title={L.shareTitle}>
          <div className="flex flex-col gap-3">
            {share.slice(0, 6).map(({ theme, count }) => (
              <Meter key={theme} label={THEME_NAMES[theme]} value={count} max={digest.posts.length} display={L.shareCount(count)} />
            ))}
          </div>
        </Panel>

        <Panel title={L.skillsTitle}>
          <div className="flex flex-wrap gap-1.5">
            {topSkills(digest).map((skill) => (
              <SkillChip key={skill} name={skill} />
            ))}
          </div>
        </Panel>

        <Panel title={L.interviewTitle}>
          <ol className="flex flex-col gap-3">
            {digest.interview.map((tip, index) => (
              <li key={tip} className="flex gap-2.5 text-[13px] leading-relaxed text-gray-700">
                <span className="mt-px text-[12.5px] font-semibold text-brand tabular-nums">{index + 1}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={L.jobsTitle}>
          <p className="text-[13px] leading-relaxed text-gray-600">{L.jobsBody(openings)}</p>
          {openings > 0 && (
            <button
              type="button"
              onClick={() => {
                track('blog_jobs_open', { company: digest.companyId })
                onJobs(digest.companyId)
              }}
              className={`${primaryButton} mt-4 w-full`}
            >
              {L.jobs}
            </button>
          )}
        </Panel>
      </div>
    </div>
  )
}

/** 대표 글 한 줄이에요. 줄 전체가 원문 링크라 어디를 눌러도 새 탭으로 열려요. */
function PostRow({ post, company }: { post: BlogPost; company: string }) {
  const L = useMessages(TEXT)
  return (
    <li className="animate-rise">
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('blog_post_open', { company, post: post.id, from: 'list' })}
        className="group flex gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-gray-200/50"
      >
        <span className="w-[4.5rem] shrink-0 pt-0.5 text-[12px] leading-snug text-gray-400 tabular-nums">{dayLabel(post.date)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] leading-snug font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{post.title}</span>
          <span className="mt-1.5 block text-[13px] leading-relaxed text-gray-600">{post.summary}</span>
          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {post.themes.map((theme) => (
              <span key={theme} className="inline-flex h-6 items-center rounded-md bg-gray-200/70 px-2 text-[11.5px] font-medium text-gray-600">
                {THEME_NAMES[theme]}
              </span>
            ))}
            {/* 주제와 이름이 같은 기술은 한 번만 보여줘요. */}
            {post.skills.filter((skill) => !post.themes.some((theme) => THEME_NAMES[theme] === skill)).map((skill) => (
              <span key={skill} className="inline-flex h-6 items-center rounded-md border border-gray-200 bg-white px-2 text-[11.5px] text-gray-600">
                {skill}
              </span>
            ))}
          </span>
        </span>
        <span className="hidden shrink-0 items-start gap-1 pt-0.5 text-[12.5px] font-medium text-gray-400 transition-colors group-hover:text-brand @xl:flex">
          {L.read}
          <ExternalMark className="mt-0.5 size-3" />
        </span>
      </a>
    </li>
  )
}

/** 전체 보기와 같은 배치의 뼈대예요. 블로그 카드와 짧은 주제 칸이 섞인 갤러리예요. */
function OverviewSkeleton() {
  return (
    <Busy>
      <Bone className="mx-1 h-4 w-40" />
      <Bone className="mx-1 mt-2.5 mb-5 h-3.5 w-2/3" />
      <div className="grid items-start gap-4 @2xl:grid-cols-2 @6xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, item) =>
          item % 3 === 1 ? (
            <div key={item} className="rounded-2xl bg-gray-50 p-5">
              <Bone className="h-3 w-14" />
              <Bone className="mt-3 h-4 w-28" />
              <Bone className="mt-4 h-1.5 w-full" />
              <div className="mt-4 flex gap-1.5">
                {[0, 1, 2, 3].map((logo) => (
                  <Bone key={logo} className="size-7 rounded-lg!" />
                ))}
              </div>
            </div>
          ) : (
            <div key={item} className="rounded-2xl bg-gray-50 p-5">
              <div className="flex items-center gap-3">
                <Bone className="size-10 shrink-0 rounded-xl!" />
                <div className="min-w-0 flex-1">
                  <Bone className="h-3.5 w-20" />
                  <Bone className="mt-2 h-3 w-32" />
                </div>
              </div>
              <Bone className="mt-5 h-3.5 w-full" />
              <Bone className="mt-2 h-3.5 w-4/5" />
              <div className="mt-4 flex gap-1.5">
                <Bone className="h-7 w-24 rounded-md!" />
                <Bone className="h-7 w-20 rounded-md!" />
              </div>
            </div>
          ),
        )}
      </div>
    </Busy>
  )
}

/** 기업 분석과 같은 배치의 뼈대예요. */
function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
      <div aria-hidden className="flex flex-col gap-4">
        <div className="rounded-2xl bg-gray-50 p-5">
          <Bone className="h-3.5 w-32" />
          <Bone className="mt-5 h-5 w-4/5" />
          <Bone className="mt-4 h-3.5 w-full" />
          <Bone className="mt-2 h-3.5 w-3/4" />
        </div>
        <div className="rounded-2xl bg-gray-50 p-5">
          {Array.from({ length: 4 }, (_, item) => (
            <div key={item} className="flex gap-4 py-3">
              <Bone className="h-3 w-14 shrink-0" />
              <div className="flex-1">
                <Bone className="h-4 w-2/3" />
                <Bone className="mt-2 h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="rounded-2xl bg-gray-50 p-5">
        <Bone className="h-3.5 w-20" />
        {Array.from({ length: 4 }, (_, item) => (
          <Bone key={item} className="mt-4 h-2 w-full" />
        ))}
      </div>
    </div>
  )
}
