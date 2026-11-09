import { markRead, pageKey, useRead } from '../lib/seen'
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { blogCompaniesOf, blogOutlook, COLLECTED_AT, fetchBlogDigests, fetchBlogOutlook, type BlogOutlook, isStale, THEME_NAMES, themeTrends, topSkills, type BlogDigest, type BlogPost, type BlogTheme, type ThemeTrend } from '../lib/blogs'
import { canEmbed, companyOf, POSTINGS, useResume } from '../lib/gap'
import { getLang, messages, useMessages } from '../lib/i18n'
import { isPlainClick } from '../lib/links'
import { PageHeader, ScrollPage } from './AppPage'
import { Dropdown } from './Dropdown'
import { Modal } from './Dialog'
import { CompanyFilter, CompanyMark, Notice, ReadTag, readTitle, SkillChip, skillTone, Tip } from './GapParts'
import { PostingBrowser, SplitView, type BrowserPage } from './PostingBrowser'
import { LoadGate } from './ScreenParts'
import { Badge, Bullets, label, primaryButton, quietButton, stagger, toolButton } from './ui'

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
    leaveTitle: '해당 링크로 이동하는 중',
    leaveCount: (seconds: number) => `${seconds}초 뒤에 새 탭에서 해당 링크가 열립니다.`,
    leaveBlocked: '새 탭을 열지 못했어요. 이동을 눌러 주세요.',
    leaveNow: '이동',
    leaveCancel: '취소',
    none: '이 조건에 맞는 글이 없어요.',
    noneAction: '주제 풀기',
    missing: '이 기업의 기술 블로그 요약은 아직 없어요.',
    missingBody: '다른 기업을 골라 보세요.',
    missingAction: '전체 보기',
    // 총정리 칸의 머리 문장이에요. 주제 이름 사이에는 와/과, 마지막 주제 뒤에는 을/를이 받침에 맞춰 붙어요.
    outlookLead: '요즘 기업들은 ',
    outlookAnd: (name: string) => `${hasBatchim(name) ? '과' : '와'} `,
    outlookTail: (name: string) => `${hasBatchim(name) ? '을' : '를'} 가장 많이 고민하고 있어요`,
    rising: '요즘 뜨는',
    risingTip: '최근 두 달에 그 전 두 달보다 이 주제의 글이 더 많이 올라왔어요.',
    outlookSkills: '필요한 역량',
    outlookPrepare: '대비 방법',
    skillDemand: (count: number) => (count ? `지금 열린 공고 ${count}개가 이 역량을 적었어요.` : '아직 이 역량을 적은 공고는 없어요.'),
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
    leaveTitle: 'Opening the link',
    leaveCount: (seconds: number) => `The link opens in a new tab in ${seconds}s.`,
    leaveBlocked: "Couldn't open a new tab. Press Go.",
    leaveNow: 'Go',
    leaveCancel: 'Cancel',
    none: 'No posts match.',
    noneAction: 'Clear topic',
    missing: "We don't have a summary for this company's blog yet.",
    missingBody: 'Try another company.',
    missingAction: 'View all',
    outlookLead: 'Companies are focused on ',
    outlookAnd: () => ' and ',
    outlookTail: () => '',
    rising: 'Rising',
    risingTip: 'More posts on this topic in the last two months than the two before.',
    outlookSkills: 'Skills to keep up',
    outlookPrepare: 'What to try now',
    skillDemand: (count: number) => (count ? `${count} open ${count === 1 ? 'posting lists' : 'postings list'} this skill.` : 'No open posting lists this skill yet.'),
  },
})

/** 한 번 받은 요약은 화면을 오가도 다시 받지 않아요. */
let cache: BlogDigest[] | null = null
/** 서버가 써 둔 총정리예요. 없으면 null, 아직 받지 않았으면 undefined예요. */
let outlookCache: BlogOutlook | null | undefined

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
 * 다른 서비스 안에 띄우는 것을 막아 둔 블로그(`canEmbed`)는 read가 외부 페이지로 간다고 알리고 3초 뒤에 새 탭으로 열어요.
 */
const openIn = (read: (page: BrowserPage) => void, page: BrowserPage) => (event: MouseEvent) => {
  // 새 탭으로 열어도 읽은 것으로 쳐요.
  markRead(pageKey(page.url))
  if (!isPlainClick(event)) return
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
  // 앱 안에 띄울 수 없어서 새 탭으로 열려고 기다리는 글이에요.
  const [leaving, setLeaving] = useState<BrowserPage | null>(null)
  const [served, setServed] = useState<BlogOutlook | null | undefined>(outlookCache)

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

  // 총정리는 글 목록을 막지 않고 따로 받아요. 오기 전과 서버에 없을 때는 화면이 글에서 계산한 총정리를 보여줘요.
  useEffect(() => {
    if (outlookCache !== undefined) return
    let stale = false
    fetchBlogOutlook().then((value) => {
      outlookCache = value
      if (!stale) setServed(value)
    })
    return () => {
      stale = true
    }
  }, [])

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
  // 고른 것이 바뀔 때만 갤러리 칸을 다시 만들어요. 미니 브라우저를 열고 닫을 때는 그대로 써요.
  const trends = useMemo(() => (digests && !company && !theme ? themeTrends(digests).trends.slice(0, 6) : []), [digests, company, theme])
  const outlook = useMemo(() => served ?? (digests ? blogOutlook(digests) : null), [served, digests])
  const read = (page: BrowserPage) => {
    if (!canEmbed(page.url)) {
      track('blog_post_open', { company: page.companyId, from: 'tab' })
      setLeaving(page)
      return
    }
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

        <div className="mt-4 flex h-11 items-center justify-between gap-3">
          <Dropdown
            size="lg"
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
          <LoadGate waiting={loaded === undefined} failed={loaded === 'failed'} skeleton="cards" onRetry={() => setAttempt((value) => value + 1)}>
            {() =>
              company && !digest ? (
                <Notice title={L.missing} body={L.missingBody} action={L.missingAction} onAction={() => selectCompany(null)} className="mt-16" />
              ) : shown.length === 0 ? (
                <Notice title={L.none} action={L.noneAction} onAction={() => selectTheme(null, 'empty')} className="mt-16" />
              ) : (
                <>
                  {/* 기업도 주제도 고르지 않았을 때만, 모든 블로그를 묶은 총정리를 글 앞에 둬요. */}
                  {!company && !theme && outlook && <OutlookCard outlook={outlook} onTheme={(item) => selectTheme(item, 'outlook')} />}
                  <Gallery items={buildItems({ entries: shown, digest, trends, onJobs, onTheme: (item) => selectTheme(item, 'card'), read })} />
                </>
              )
            }
          </LoadGate>
        </div>
        {leaving && <LeaveDialog page={leaving} onClose={() => setLeaving(null)} />}
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

/** 전체 보기의 칸 수예요. 목록 폭을 보고 정해요. 공고 탐색, 내 이력서의 카드 줄(@2xl, @6xl)과 같은 기준(672px, 1152px)이에요. */
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
  const seen = useRead(pageKey(entry.url))
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={openIn(read, { url: entry.url, title: entry.title, companyId: entry.companyId })}
      className="group block rounded-2xl bg-gray-50 p-4 transition-colors hover:bg-gray-100 sm:p-5"
      style={stagger(order)}
    >
      <span className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <CompanyMark company={company} className="size-5 rounded-md! text-[9px]" />
        <span className="min-w-0 flex-1 truncate">{company.name}</span>
        <ReadTag read={seen} />
        <span className="shrink-0 tabular-nums">{dayLabel(entry.date)}</span>
      </span>
      <span className={`mt-3 block text-[16px] leading-snug font-semibold ${readTitle(seen)} transition-colors group-hover:text-brand-hover`}>{entry.title}</span>
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

/**
 * 모든 기업 블로그를 묶어 본 총정리 칸이에요. 요즘 많이 다룬 주제 셋과 그 고민, 따라가려면 필요한 역량, 지금 해 볼 준비가 있어요.
 * 대표 이력서가 있으면 역량을 진단 시작과 같은 기준으로 칠하고, 아직 보이지 않는 역량 수를 알려줘요. 주제를 누르면 그 주제 글만 걸러 봐요.
 */
function OutlookCard({ outlook, onTheme }: { outlook: BlogOutlook; onTheme: (theme: BlogTheme) => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [first, second] = outlook.themes.map((item) => THEME_NAMES[item.theme])
  return (
    <section className="mb-4 animate-rise rounded-2xl bg-gray-50 p-4 sm:p-5 @2xl:p-6">
      {/* 서버의 총정리는 AI가 쓴 머리 문장과 흐름 문단이 있고, 화면이 계산한 총정리는 주제 이름으로 머리 문장을 만들어요. */}
      <h2 className="line-clamp-2 text-[19px] leading-snug font-semibold text-gray-900 @2xl:text-[21px]">
        {outlook.headline ?? (
          <>
            {L.outlookLead}
            <span className="text-brand-hover">{first}</span>
            {second && (
              <>
                {L.outlookAnd(first)}
                <span className="text-brand-hover">{second}</span>
              </>
            )}
            {L.outlookTail(second ?? first)}.
          </>
        )}
      </h2>

      <ul className="mt-5 grid gap-3 @3xl:grid-cols-3">
        {outlook.themes.map((item, index) => (
          <li key={item.theme}>
            <button
              type="button"
              aria-label={L.pickTheme(THEME_NAMES[item.theme])}
              onClick={() => onTheme(item.theme)}
              className="group flex h-full w-full flex-col rounded-xl bg-white p-4 text-left transition-colors hover:bg-gray-100"
              style={stagger(index)}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{THEME_NAMES[item.theme]}</span>
                {item.rising && (
                  <Tip text={L.risingTip}>
                    <Badge tone="brand" strong>
                      {L.rising}
                    </Badge>
                  </Tip>
                )}
              </span>
              <span className="mt-2 block flex-1 text-[13px] leading-relaxed text-gray-600">{item.concern}</span>
              <span className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
                {item.companies.map((id) => (
                  <CompanyMark key={id} company={companyOf(id)} className="size-6 rounded-md! text-[10px]" />
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 @3xl:grid-cols-2">
        <div>
          <h3 className={label}>{L.outlookSkills}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {outlook.skills.map((item) => (
              <SkillChip key={item.skill} name={item.skill} tone={skillTone(item.skill, resume)} tip={[item.reason, L.skillDemand(item.postings)].filter(Boolean).join(' ')} />
            ))}
          </div>
        </div>
        <div>
          <h3 className={label}>{L.outlookPrepare}</h3>
          <Bullets items={outlook.themes.map((item) => item.prepare)} brand className="mt-1.5" />
        </div>
      </div>
    </section>
  )
}

/** 기업을 골랐을 때 글 앞에 오는 칸이에요. 요즘 고민 한 줄과 분석, 자주 나온 기술, 면접에서 쓸 점, 그 기업 공고로 가는 버튼이 있어요. */
function CompanyCard({ digest, onJobs }: { digest: BlogDigest; onJobs: (company: string) => void }) {
  const L = useMessages(TEXT)
  const openings = POSTINGS.filter((posting) => posting.companyId === digest.companyId).length
  const paused = isStale(digest)
  return (
    <div className="rounded-2xl bg-gray-50 p-4 sm:p-5">
      {paused && <p className="mb-4 rounded-xl bg-white px-4 py-3 text-[13px] leading-relaxed text-gray-600">{L.stale(dayLabel(digest.posts[0].date))}</p>}
      <p className="text-[17px] leading-snug font-semibold text-gray-900">{digest.headline}</p>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-gray-600">{digest.analysis}</p>
      <h3 className={`mt-5 ${label}`}>{L.skillsTitle}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {topSkills(digest).map((skill) => (
          <SkillChip key={skill} name={skill} />
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

/** 외부 페이지로 가기 전에 기다리는 초예요. */
const LEAVE_SECONDS = 3

/**
 * 앱 안에 띄울 수 없는 글을 열기 전에 외부 페이지로 간다고 알리는 창이에요. 3초를 세고 새 탭으로 열어요.
 * 브라우저가 새 탭을 막으면 창을 그대로 두고, 이동(직접 누르는 링크)으로 열게 해요.
 */
function LeaveDialog({ page, onClose }: { page: BrowserPage; onClose: () => void }) {
  const L = useMessages(TEXT)
  const [left, setLeft] = useState(LEAVE_SECONDS)
  const [blocked, setBlocked] = useState(false)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (blocked) return
    if (left === 0) {
      const tab = window.open(page.url, '_blank')
      if (!tab) {
        setBlocked(true)
        return
      }
      tab.opener = null
      close.current()
      return
    }
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left, blocked, page.url])

  return (
    <Modal onClose={onClose} labelledBy="leave-dialog-title">
      <h2 id="leave-dialog-title" className="text-[15px] font-semibold text-gray-900">
        {L.leaveTitle}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500 tabular-nums" aria-live="polite">
        {blocked ? L.leaveBlocked : L.leaveCount(left)}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={quietButton}>
          {L.leaveCancel}
        </button>
        <a href={page.url} target="_blank" rel="noopener noreferrer" onClick={onClose} className={primaryButton}>
          {L.leaveNow}
        </a>
      </div>
    </Modal>
  )
}
