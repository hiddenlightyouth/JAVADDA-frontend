import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { blogCompaniesOf, COLLECTED_AT, fetchBlogDigests, isStale, THEME_NAMES, themeTrends, topSkills, type BlogDigest, type BlogPost, type BlogTheme, type ThemeTrend } from '../lib/blogs'
import { canEmbed, companyOf, POSTINGS } from '../lib/gap'
import { getLang, messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { CompanyFilter, CompanyMark, Failed, Notice } from './GapParts'
import { PostingBrowser, SplitView, type BrowserPage } from './PostingBrowser'
import { Badge, Bullets, label, loadCenter, LoadProgress, primaryButton, stagger, toolButton } from './ui'

/**
 * 기술 블로그 화면이에요. 여러 기업 기술 블로그의 글을 최신 순서로 한데 늘어놓고, 기업과 주제로 걸러 봐요.
 * 기업은 공고 탐색처럼 로고 버튼으로 고르고, 주소(`/blogs/기업아이디`)에 남아서 뒤로 가기로 돌아가요. 주제는 메뉴나 주제 칸을 눌러 골라요.
 * 기업을 고르면 글 앞에 그 기업이 요즘 어떤 고민을 하는지 요약한 칸이 와요. 아무것도 고르지 않았으면 많이 다룬 주제 칸이 글 사이에 섞여요.
 * 글을 누르면 공고 원문처럼 앱 안의 미니 브라우저로 열어요. 앱 안에 띄울 수 없게 막아 둔 블로그와, Cmd나 가운데 버튼으로 누른 것은 새 탭으로 열려요.
 */

/** 끝 글자가 한글이고 받침이 있는지예요. 영어나 숫자로 끝나면 받침이 없는 것으로 봐요. */
const hasBatchim = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}

const TEXT = messages({
  ko: {
    title: '기술 블로그',
    all: '전체',
    company: '기업',
    theme: '주제',
    count: (count: number) => `${count}개의 글`,
    pickTheme: (name: string) => `${name} 글만 보기`,
    // 주제 이름 뒤에 붙는 말이에요. 끝 글자에 받침이 있으면 '을', 없으면 '를'이에요.
    themeAsk: (name: string) => `${hasBatchim(name) ? '을' : '를'} 고민하고 있는 조직은?`,
    stale: (date: string) => `마지막 글이 ${date}에 올라왔어요. 지금의 고민과는 다를 수 있어요.`,
    skillsTitle: '자주 나온 기술',
    interviewTitle: '면접에서 이렇게 써 보세요',
    jobs: (count: number) => `공고 ${count}개 보기`,
    openBlog: '블로그 열기',
    none: '이 조건에 맞는 글이 없어요.',
    noneAction: '주제 풀기',
    missing: '이 기업의 기술 블로그 요약은 아직 없어요.',
    missingBody: '다른 기업을 골라 보세요.',
    missingAction: '전체 보기',
  },
  en: {
    title: 'Tech blogs',
    all: 'All',
    company: 'Company',
    theme: 'Topic',
    count: (count: number) => `${count} ${count === 1 ? 'post' : 'posts'}`,
    pickTheme: (name: string) => `Show ${name} posts`,
    themeAsk: () => '',
    stale: (date: string) => `The latest post is from ${date}. Their focus may have changed since.`,
    skillsTitle: 'Frequent tech',
    interviewTitle: 'Use it in your interview',
    jobs: (count: number) => `View ${count} ${count === 1 ? 'posting' : 'postings'}`,
    openBlog: 'Open blog',
    none: 'No posts match.',
    noneAction: 'Clear topic',
    missing: "We don't have a summary for this company's blog yet.",
    missingBody: 'Try another company.',
    missingAction: 'View all',
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

/** 기업을 붙인 글 하나예요. 여러 기업의 글을 한 목록에 섞을 때 써요. */
type Entry = BlogPost & { companyId: string }

/**
 * 원문 링크의 누름이에요. 그냥 누르면 미니 브라우저로 열고, Cmd, Ctrl, Shift, 가운데 버튼이면 브라우저가 알아서 새 탭으로 열게 둬요.
 * 다른 서비스 안에 띄우는 것을 막아 둔 블로그(`canEmbed`)는 미니 브라우저에 요약만 보여주는 대신 바로 새 탭으로 열어요.
 */
const openIn = (read: (page: BrowserPage) => void, page: BrowserPage) => (event: MouseEvent) => {
  if (!canEmbed(page.url)) {
    track('blog_post_open', { company: page.companyId, from: 'tab' })
    return
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  read(page)
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
  const [theme, setTheme] = useState<BlogTheme | null>(null)
  const [reading, setReading] = useState<BrowserPage | null>(null)
  const load = useLoadProgress()
  const waiting = useLoadHold(loaded === undefined)

  useEffect(() => {
    if (cache) return
    let stale = false
    setLoaded(undefined)
    fetchBlogDigests(load.one()).then(
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
  }, [attempt, load.one])

  const digests = Array.isArray(loaded) ? loaded : null
  const blogCompanies = useMemo(() => blogCompaniesOf(digests ?? []), [digests])
  const digest = company && digests ? (digests.find((item) => item.companyId === company) ?? null) : null

  /** 모든 기업의 글을 최신 순서로 이어 붙여요. */
  const entries = useMemo<Entry[]>(
    () => (digests ?? []).flatMap((item) => item.posts.map((post) => ({ ...post, companyId: item.companyId }))).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [digests],
  )
  const inCompany = useMemo(() => (company ? entries.filter((entry) => entry.companyId === company) : entries), [entries, company])
  const shown = useMemo(() => (theme ? inCompany.filter((entry) => entry.themes.includes(theme)) : inCompany), [inCompany, theme])
  /** 주제 메뉴는 지금 고른 기업의 글에 나온 주제만, 많이 나온 순서로 보여줘요. */
  const themes = useMemo(() => {
    const counts = new Map<BlogTheme, number>()
    for (const entry of inCompany) for (const item of entry.themes) counts.set(item, (counts.get(item) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [inCompany])

  const selectCompany = (next: string | null) => {
    if (next === company) return
    track('blog_company_select', { company: next ?? 'all', from: 'chips' })
    // 다른 기업에는 그 주제 글이 없을 수 있어서, 기업을 바꾸면 주제를 풀어요.
    setTheme(null)
    onCompany(next)
  }
  const selectTheme = (next: BlogTheme | null, from: string) => {
    track('blog_theme_select', { theme: next ?? 'all', from })
    setTheme(next)
  }
  const read = (page: BrowserPage) => {
    track('blog_post_open', { company: page.companyId, from: 'browser' })
    setReading(page)
  }

  return (
    <SplitView side={reading && <PostingBrowser key={reading.url} page={reading} onClose={() => setReading(null)} />}>
      <ScrollPage
        className="@container"
        header={
          <PageHeader
            title={L.title}
            actions={
              digest && (
                <a
                  href={digest.blog}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={openIn(read, { url: digest.blog, title: digest.platform, companyId: digest.companyId })}
                  className={toolButton}
                >
                  {L.openBlog}
                </a>
              )
            }
          />
        }
      >
        {/* 기업은 공고 탐색처럼 로고를 보고 한 번에 골라요. */}
        <CompanyFilter companies={blogCompanies} value={company} label={L.company} allLabel={L.all} onChange={selectCompany} />

        <div className="mt-4 flex h-9 items-center justify-between gap-3">
          <Dropdown
            label={L.theme}
            value={theme ? THEME_NAMES[theme] : L.all}
            active={theme !== null}
            groups={[
              {
                items: [
                  { label: L.all, checked: theme === null, onSelect: () => selectTheme(null, 'menu') },
                  ...themes.map(([item, count]) => ({ label: THEME_NAMES[item], hint: String(count), checked: theme === item, onSelect: () => selectTheme(item, 'menu') })),
                ],
              },
            ]}
          />
          {digests && <p className="text-[13px] text-gray-500 tabular-nums">{L.count(shown.length)}</p>}
        </div>

        <div className="mt-4">
          {waiting || loaded === undefined ? (
            <LoadProgress percent={load.percent} className={loadCenter} />
          ) : loaded === 'failed' ? (
            <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
          ) : company && !digest ? (
            <Notice title={L.missing} body={L.missingBody} action={L.missingAction} onAction={() => selectCompany(null)} className="mt-16" />
          ) : shown.length === 0 ? (
            <Notice title={L.none} action={L.noneAction} onAction={() => selectTheme(null, 'empty')} className="mt-16" />
          ) : (
            <Gallery
              items={buildItems({
                entries: shown,
                digest,
                trends: !company && !theme ? themeTrends(loaded).trends.slice(0, 6) : [],
                onJobs,
                onTheme: (item) => selectTheme(item, 'card'),
                read,
              })}
            />
          )}
        </div>
      </ScrollPage>
    </SplitView>
  )
}

/**
 * 갤러리에 놓을 칸을 차례로 만들어요. 기업을 골랐으면 맨 앞에 그 기업 요약 칸이 오고,
 * 아무것도 고르지 않았으면 많이 다룬 주제 칸을 글 사이사이에 고르게 끼워요. 첫 주제 칸은 첫 줄 둘째 자리에 와요.
 */
function buildItems({ entries, digest, trends, onJobs, onTheme, read }: {
  entries: Entry[]
  digest: BlogDigest | null
  trends: ThemeTrend[]
  onJobs: (company: string) => void
  onTheme: (theme: BlogTheme) => void
  read: (page: BrowserPage) => void
}) {
  const items: { key: string; node: ReactNode }[] = []
  if (digest) items.push({ key: `company:${digest.companyId}`, node: <CompanyCard digest={digest} onJobs={onJobs} /> })
  const step = trends.length ? Math.max(2, Math.floor(entries.length / trends.length)) : Infinity
  let next = 0
  entries.forEach((entry, index) => {
    items.push({ key: `${entry.companyId}:${entry.id}`, node: <PostCard entry={entry} order={items.length} read={read} /> })
    if (next < trends.length && (index + 1) % step === 1) {
      items.push({ key: `theme:${trends[next].theme}`, node: <ThemeCard trend={trends[next]} order={items.length} onPick={onTheme} /> })
      next += 1
    }
  })
  return items
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
 * 짧은 주제 칸과 긴 글 카드가 섞여도 줄마다 높이를 맞추느라 비는 자리가 생기지 않아요.
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

/** 글 하나의 카드예요. 카드 전체가 원문 링크라 어디를 눌러도 미니 브라우저로 열려요. */
function PostCard({ entry, order, read }: { entry: Entry; order: number; read: (page: BrowserPage) => void }) {
  const company = companyOf(entry.companyId)
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={openIn(read, { url: entry.url, title: entry.title, companyId: entry.companyId })}
      className="group block rounded-2xl bg-gray-50 p-5 transition-colors hover:bg-gray-100"
      style={stagger(order)}
    >
      <span className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <CompanyMark company={company} className="size-5 rounded-md! text-[9px]" />
        <span className="min-w-0 flex-1 truncate">{company.name}</span>
        <span className="shrink-0 tabular-nums">{dayLabel(entry.date)}</span>
      </span>
      <span className="mt-3 block text-[15px] leading-snug font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{entry.title}</span>
      <span className="mt-2 line-clamp-3 block text-[13px] leading-relaxed text-gray-600">{entry.summary}</span>
      <span className="mt-3 flex flex-wrap gap-1">
        {entry.themes.map((item) => (
          <Badge key={item} strong>
            {THEME_NAMES[item]}
          </Badge>
        ))}
      </span>
    </a>
  )
}

/** 많이 다룬 주제 하나의 작은 칸이에요. 그 주제를 쓴 기업 로고가 있고, 누르면 그 주제 글만 걸러 봐요. */
function ThemeCard({ trend, order, onPick }: { trend: ThemeTrend; order: number; onPick: (theme: BlogTheme) => void }) {
  const L = useMessages(TEXT)
  const name = THEME_NAMES[trend.theme]
  return (
    <button type="button" aria-label={L.pickTheme(name)} onClick={() => onPick(trend.theme)} className="group block w-full rounded-2xl bg-brand-soft p-5 text-left transition-colors hover:bg-brand-soft/70" style={stagger(order)}>
      {/* 이름만 두면 뭘 말하는지 모르니, 한국어에서는 질문으로 적어요. 영어는 "Who's working on AI agents?"예요. */}
      <span className="block text-[16px] leading-snug font-semibold text-gray-900">
        {getLang() === 'en' ? (
          <>
            Who's working on <span className="text-brand-hover">{name}</span>?
          </>
        ) : (
          <>
            <span className="text-brand-hover">{name}</span>
            {L.themeAsk(name)}
          </>
        )}
      </span>
      <span className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
        {trend.companies.map((id) => (
          <CompanyMark key={id} company={companyOf(id)} className="size-7 rounded-lg! text-[11px]" />
        ))}
      </span>
    </button>
  )
}

/** 기업을 골랐을 때 글 앞에 오는 칸이에요. 요즘 고민 한 줄과 분석, 자주 나온 기술, 면접에서 쓸 점, 그 기업 공고로 가는 버튼이 있어요. */
function CompanyCard({ digest, onJobs }: { digest: BlogDigest; onJobs: (company: string) => void }) {
  const L = useMessages(TEXT)
  const openings = POSTINGS.filter((posting) => posting.companyId === digest.companyId).length
  const paused = isStale(digest)
  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      {paused && <p className="mb-4 rounded-xl bg-white px-4 py-3 text-[13px] leading-relaxed text-gray-600">{L.stale(dayLabel(digest.posts[0].date))}</p>}
      <p className="text-[17px] leading-snug font-semibold text-gray-900">{digest.headline}</p>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-gray-600">{digest.analysis}</p>
      <h3 className={`mt-5 ${label}`}>{L.skillsTitle}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {topSkills(digest).map((skill) => (
          <span key={skill} className="inline-flex h-7 items-center rounded-md bg-white px-2.5 text-[12.5px] text-gray-700">
            {skill}
          </span>
        ))}
      </div>
      <h3 className={`mt-5 ${label}`}>{L.interviewTitle}</h3>
      <Bullets items={digest.interview} brand className="mt-1.5" />
      {openings > 0 && (
        <button
          type="button"
          onClick={() => {
            track('blog_jobs_open', { company: digest.companyId })
            onJobs(digest.companyId)
          }}
          className={`${primaryButton} mt-5 w-full`}
        >
          {L.jobs(openings)}
        </button>
      )}
    </div>
  )
}
