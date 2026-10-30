import { useEffect, useState, type MouseEvent } from 'react'
import { track } from '../lib/analytics'
import { fetchBlogDigests, isStale, type BlogDigest } from '../lib/blogs'
import { canEmbed, companyOf, familyName, fetchCompany, SKILL_AXES, sortPostings, useResume, type CompanyProfile, type QuestionCategory, type Resume } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { PageHeader } from './AppPage'
import { CompanyMark, Delta, Failed, Notice, Panel, PostingTile, SkillChip, skillTone, Sparkline, Tip } from './GapParts'
import { PostingBrowser, SplitView, type BrowserPage } from './PostingBrowser'
import { Bone } from './Skeleton'
import { toolButton } from './ui'

/**
 * 기업 상세 화면이에요. 기업 소개와 열린 공고, 이 기업 공고에 적힌 기술 스택, 요구 역량 변화, 면접 질문, 기술 블로그 글을 한 화면에 모아요.
 * 기업 소개 사이트는 공고 원문처럼 앱 안의 미니 브라우저로 열어요.
 */

const TEXT = messages({
  ko: {
    back: '뒤로',
    site: '기업 사이트',
    blog: '기술 블로그',
    facts: { industry: '업종', open: '채용 중', families: '주로 뽑는 직군', locations: '근무지' },
    openCount: (count: number) => `공고 ${count}개`,
    postings: '채용 중인 공고',
    more: '공고 탐색에서 보기',
    noPostings: '지금 열려 있는 공고가 없어요.',
    stack: '기술 스택',
    stackHint: '이 기업 공고에 적힌 기술이에요.',
    stackCount: (count: number, total: number) => `공고 ${total}개 중 ${count}개에 적혀 있어요.`,
    trends: '요구 역량 변화',
    trendsHint: '같은 직군 공고에서 지난 12주 동안 이 기술을 적은 수예요.',
    changeTip: '최근 4주의 공고 수를 12주 전 4주와 견준 변화예요.',
    questions: '자주 나오는 면접 질문',
    questionsHint: '지원자들이 남긴 후기와 기출을 모았어요.',
    categories: { tech: '기술', project: '프로젝트', cs: 'CS 기초', culture: '컬처핏' } as Record<QuestionCategory, string>,
    reports: (count: number) => `${count}명이 받았어요`,
    posts: '기술 블로그',
    blogMore: '요약 더 보기',
    blogStale: '쉬는 중',
    noBlog: '공개된 기술 블로그를 찾지 못했어요.',
    notFound: '기업을 찾을 수 없어요',
    notFoundBody: '주소가 바뀌었거나 아직 모으지 않은 기업이에요.',
    home: '새 진단으로',
  },
  en: {
    back: 'Back',
    site: 'Company site',
    blog: 'Tech blog',
    facts: { industry: 'Industry', open: 'Hiring', families: 'Main roles', locations: 'Locations' },
    openCount: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    postings: 'Open postings',
    more: 'View in Explore',
    noPostings: 'No open postings right now.',
    stack: 'Tech stack',
    stackHint: 'Skills listed in the postings of this company.',
    stackCount: (count: number, total: number) => `Listed in ${count} of ${total} postings.`,
    trends: 'Demand over time',
    trendsHint: 'How many postings in this job family listed each skill over the last 12 weeks.',
    changeTip: 'Postings in the last 4 weeks compared with the 4 weeks 12 weeks ago.',
    questions: 'Common interview questions',
    questionsHint: 'Collected from candidate reviews and past interviews.',
    categories: { tech: 'Tech', project: 'Project', cs: 'CS basics', culture: 'Culture fit' },
    reports: (count: number) => `Asked to ${count} candidates`,
    posts: 'Tech blog',
    blogMore: 'See full summary',
    blogStale: 'On a break',
    noBlog: 'We could not find a public tech blog.',
    notFound: 'Company not found',
    notFoundBody: 'The link may have changed, or we have not collected this company yet.',
    home: 'New diagnosis',
  },
})

type Loaded = { profile: CompanyProfile; digest: BlogDigest | null } | null | 'failed'

export function Company({ id, onBack, onPick, onPostings, onBlogs }: {
  id: string
  onBack: () => void
  /** 공고를 골라 진단 시작으로 가요. */
  onPick: (postingId: string) => void
  /** 이 기업 공고만 골라 둔 공고 탐색으로 가요. */
  onPostings: (companyId: string) => void
  /** 기술 블로그 화면에서 이 기업의 요약을 열어요. */
  onBlogs: (companyId: string) => void
}) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  // 미니 브라우저에 띄운 것이에요. 기업 사이트(site)나 기술 블로그 글이에요.
  const [viewing, setViewing] = useState<'site' | BrowserPage | null>(null)

  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    // 기술 블로그 요약은 기술 블로그 화면과 같은 자료(`blogs.ts`)를 같이 받아요.
    void Promise.all([fetchCompany(id), fetchBlogDigests()]).then(
      ([profile, digests]) => {
        if (!stale) setLoaded(profile && { profile, digest: digests.find((digest) => digest.companyId === id) ?? null })
      },
      () => {
        if (!stale) setLoaded('failed')
      },
    )
    return () => {
      stale = true
    }
  }, [id, attempt])

  const company = companyOf(id)

  if (loaded === null) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <Notice title={L.notFound} body={L.notFoundBody} action={L.home} onAction={onBack} />
      </main>
    )
  }

  return (
    <SplitView
      side={
        viewing === 'site' ? (
          <PostingBrowser company={company} onClose={() => setViewing(null)} onPosting={(posting) => onPick(posting.id)} />
        ) : (
          viewing && <PostingBrowser key={viewing.url} page={viewing} onClose={() => setViewing(null)} />
        )
      }
    >
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-6 pt-14 md:px-10 md:pt-9">
          <PageHeader
            title={company.name}
            owner={company.industry}
            mark={<CompanyMark company={company} className="size-11 text-[15px]" />}
            onBack={onBack}
            backLabel={L.back}
            actions={
              <>
                {loaded === undefined ? null : loaded !== 'failed' && loaded.digest ? (
                  <button
                    type="button"
                    onClick={() => {
                      track('company_blog_click', { company: id, from: 'header' })
                      onBlogs(id)
                    }}
                    className={toolButton}
                  >
                    {L.blog}
                  </button>
                ) : (
                  company.techBlog && (
                    <a href={company.techBlog} target="_blank" rel="noreferrer" onClick={() => track('company_blog_click', { company: id, from: 'external' })} className={toolButton}>
                      {L.blog}
                    </a>
                  )
                )}
                {company.site && (
                  <button
                    type="button"
                    onClick={() => {
                      track('company_browser_open', { company: id, from: 'company' })
                      setViewing('site')
                    }}
                    className={toolButton}
                  >
                    {L.site}
                  </button>
                )}
              </>
            }
          />
        </div>

        <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10">
          {loaded === undefined ? (
            <Loading />
          ) : loaded === 'failed' ? (
            <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
          ) : (
            <Profile profile={loaded.profile} digest={loaded.digest} resume={resume} onPick={onPick} onPostings={() => onPostings(id)} onBlogs={() => onBlogs(id)} onRead={setViewing} />
          )}
        </div>
      </main>
    </SplitView>
  )
}

function Profile({ profile, digest, resume, onPick, onPostings, onBlogs, onRead }: {
  profile: CompanyProfile
  digest: BlogDigest | null
  resume: Resume | null
  onPick: (postingId: string) => void
  onPostings: () => void
  onBlogs: () => void
  /** 블로그 글을 미니 브라우저로 열어요. */
  onRead: (page: BrowserPage) => void
}) {
  const L = useMessages(TEXT)
  const { postings, stack } = profile
  const families = [...new Set(postings.map((posting) => familyName(posting.family)))]
  const locations = [...new Set(postings.map((posting) => posting.location))]
  const sorted = resume ? sortPostings(postings, 'fit', resume) : postings
  const facts = [
    { label: L.facts.industry, value: profile.company.industry },
    { label: L.facts.open, value: L.openCount(postings.length) },
    { label: L.facts.families, value: families.join(', ') || '-' },
    { label: L.facts.locations, value: locations.join(', ') || '-' },
  ]

  return (
    <div className="space-y-4">
      {/* 기업 소개 한 줄과 훑어보는 정보예요. 회색 칸 없이 흰 바탕에 둬요. */}
      <section className="pb-4">
        {profile.about && <p className="max-w-2xl text-[15px] leading-relaxed text-gray-700">{profile.about}</p>}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 @2xl:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[12px] text-gray-400">{fact.label}</dt>
              <dd className="mt-1 truncate text-[14px] font-medium text-gray-900">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title={L.postings}
            action={
              postings.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    track('company_more_click', { company: profile.company.id })
                    onPostings()
                  }}
                  className="text-[12.5px] font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  {L.more}
                </button>
              )
            }
          >
            {postings.length === 0 ? (
              <p className="text-[13px] text-gray-500">{L.noPostings}</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                {sorted.map((posting, order) => (
                  <PostingTile
                    key={posting.id}
                    posting={posting}
                    resume={resume}
                    tag={resume ? 'fit' : 'deadline'}
                    onGray
                    order={order}
                    onOpen={() => {
                      track('posting_select', { posting: posting.id, from: 'company' })
                      onPick(posting.id)
                    }}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {profile.trends.length > 0 && (
            <Panel title={L.trends} action={<span className="text-[12px] text-gray-400">{L.trendsHint}</span>}>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                {profile.trends.map((trend) => {
                  const change = recentChange(trend.series)
                  return (
                    <li key={trend.skill} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_4rem] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_5rem]">
                      <span className="truncate text-[13.5px] font-medium text-gray-900">{trend.skill}</span>
                      <Sparkline series={trend.series} className="h-7 max-w-56" />
                      <span className="text-right">
                        <Tip text={L.changeTip}>
                          <Delta value={change} unit="%" />
                        </Tip>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          {profile.questions.length > 0 && (
            <Panel title={L.questions} action={<span className="text-[12px] text-gray-400">{L.questionsHint}</span>}>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                {profile.questions.map((item) => (
                  <li key={item.question} className="px-4 py-3.5">
                    <p className="text-[13.5px] leading-relaxed text-gray-900">{item.question}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-gray-400">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{L.categories[item.category]}</span>
                      <span>{familyName(item.family)}</span>
                      <span>{L.reports(item.reports)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={L.stack}>
            <p className="-mt-2 mb-4 text-[12px] leading-relaxed text-gray-400">{L.stackHint}</p>
            <div className="space-y-4">
              {SKILL_AXES.map((axis) => {
                const items = stack.filter((item) => item.axis === axis)
                if (items.length === 0) return null
                return (
                  <section key={axis}>
                    <h3 className="text-[12px] text-gray-500">{axis}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {items.map((item) => (
                        <Tip key={item.skill} text={L.stackCount(item.count, postings.length)}>
                          <SkillChip name={item.skill} tone={skillTone(item.skill, resume)} />
                        </Tip>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </Panel>

          <Panel
            title={L.posts}
            action={
              digest && (
                <button
                  type="button"
                  onClick={() => {
                    track('company_blog_click', { company: profile.company.id, from: 'panel' })
                    onBlogs()
                  }}
                  className="text-[12.5px] font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  {L.blogMore}
                </button>
              )
            }
          >
            {!digest ? (
              <p className="text-[13px] text-gray-500">{L.noBlog}</p>
            ) : (
              <>
                <p className="-mt-1 mb-3 text-[13px] leading-relaxed text-gray-700">
                  {isStale(digest) && <span className="mr-1.5 rounded bg-gray-200/70 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{L.blogStale}</span>}
                  {digest.headline}
                </p>
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                  {digest.posts.slice(0, 3).map((post) => (
                    <li key={post.id}>
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event: MouseEvent) => {
                          const embed = canEmbed(post.url) && !(event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                          track('blog_post_open', { company: profile.company.id, from: embed ? 'company' : 'tab' })
                          if (!embed) return
                          event.preventDefault()
                          onRead({ url: post.url, title: post.title, companyId: profile.company.id })
                        }}
                        className="group block px-4 py-3 transition-colors hover:bg-gray-50"
                      >
                        <p className="text-[13px] leading-snug font-medium text-gray-900 group-hover:text-brand">{post.title}</p>
                        <p className="mt-1 text-[12px] text-gray-400 tabular-nums">{post.date.replaceAll('-', '.')}</p>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

/** 12주 막대의 처음 네 주와 마지막 네 주를 견줘서 얼마나 바뀌었는지 퍼센트로 적어요. */
function recentChange(series: number[]): number {
  const average = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length
  const before = average(series.slice(0, 4))
  return before === 0 ? 0 : Math.round(((average(series.slice(-4)) - before) / before) * 100)
}

/** 받는 동안 보여주는 뼈대예요. 화면의 배치와 같아요. */
function Loading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div aria-hidden className="pb-4">
        <Bone className="h-3.5 w-full max-w-xl" />
        <div className="mt-6 grid grid-cols-2 gap-6 @2xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item}>
              <Bone className="h-3 w-12" />
              <Bone className="mt-2 h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl bg-gray-50 p-5">
          <Bone className="h-3.5 w-24" />
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-xl bg-white p-4">
                <Bone className="h-3 w-16" />
                <Bone className="mt-3 h-4 w-3/4" />
                <Bone className="mt-2.5 h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-gray-50 p-5">
          <Bone className="h-3.5 w-20" />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4].map((item) => (
              <Bone key={item} className="h-7 w-16 rounded-md!" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
