import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import {
  companyOf,
  fitOf,
  postingOf,
  useReportPosting,
  PROVIDER_LOGOS,
  rerunReport,
  saveNote,
  togglePlan,
  useNotes,
  usePlans,
  requestLogin,
  useReport,
  useResume,
  type Course,
  type Report as ReportData,
  type RequirementCheck,
  type ScoreItem,
  type SkillGap,
} from '../lib/gap'
import { useAuth } from '../lib/auth'
import { useShortcuts } from '../lib/shortcuts'
import { formatDateTime } from '../lib/format'
import { messages, pick, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { showToast } from '../lib/toast'
import { pageFrame, PageHeader } from './AppPage'
import { panelBody, SidePanel } from './Dialog'
import { AiProgress, CheckMark, CompanyMark, SkillMark, Delta, FitBadge, KindLabel, Meter, Notice, Panel, PostingTile, Radar, RequirementLabel, ScoreHero, ScoreRing, Sparkline, Tip, percent } from './GapParts'
import { DeleteReportDialog, removeReport } from './History'
import { AlertIcon, CheckIcon, ClockIcon, LevelIcon, RefreshIcon, TrashIcon } from './Icons'
import { ReviewTab } from './ReportReview'
import { QuestionsTab } from './ReportQuestions'
import { Bullets, label, loadCenter, LoadProgress, NumberedList, primaryButton, Segmented, stagger, Tabs, textArea, toolButton, toolDangerButton } from './ui'

/** 리포트의 탭이에요. 요약, 적합도 설명, 서류 검증, 예상 면접 질문 순서예요. */
export type ReportTab = 'summary' | 'fit' | 'review' | 'questions'

const TABS: ReportTab[] = ['summary', 'fit', 'review', 'questions']

const TEXT = messages({
  ko: {
    tabs: { summary: '리포트', fit: '적합도 설명', review: '서류 검증', questions: '예상 질문' } as Record<ReportTab, string>,
    tabList: '리포트 탭',
    back: '새 진단 화면으로 돌아가기',
    practice: '면접 연습',
    rerun: '재진단',
    rerunDone: '다시 진단하고 있어요.',
    staleTitle: '이력서 업데이트를 감지했어요',
    staleBody: '해당 공고를 현재의 이력서로 다시 검토해 볼까요?',
    staleAction: '다시 진단하기',
    delete: '삭제',
    missing: '이 리포트를 찾을 수 없어요.',
    missingBody: '지웠거나 다른 계정에서 만든 리포트예요.',
    signInTitle: '로그인하면 리포트를 볼 수 있어요.',
    signInBody: '리포트는 계정에 저장돼요.',
    signIn: '로그인',
    failedTitle: '리포트를 만들지 못했어요.',
    failedBody: '잠시 뒤에 다시 진단해 주세요.',
    failedAction: '다시 진단하기',
    goHome: '새 진단 시작하기',
    fitTitle: '적합도',
    verdict: (score: number): string => (score >= 70 ? '잘 맞아요! 바로 지원해 볼 만해요.' : score >= 50 ? '좋아요! 조금만 채우면 돼요.' : '갭이 있어요. 하나씩 채워 봐요.'),
    createdAt: (when: string) => `${when} 진단`,
    radar: '역량 레이더',
    gaps: '갭 목록',
    notFound: (weeks: number) => `약 ${weeks}주의 과정으로 보완할 수 있음`,
    shareTip: '같은 직군 공고 중 이 역량을 적은 비율이에요.',
    gainTip: '이 역량을 채우면 오를 것으로 보는 적합도예요.',
    gain: (value: number) => `+${value}점`,
    level: '난이도',
    duration: '강의 시간',
    groups: { missing: '서류에서 찾지 못한 역량', partial: '서류에 있지만 찾지 못함', strength: '강점' } as Record<SkillGap['kind'], string>,
    kinds: { missing: '부족', partial: '보완', strength: '강점' } as Record<SkillGap['kind'], string>,
    kindCount: (kind: string, count: number) => `${kind} ${count}`,
    weeks: (weeks: number) => `약 ${weeks}주`,
    trends: '시장 요구 변화',
    trendColumns: { skill: '역량', weeks: '최근 12주', share: '공고 비중', change: '6개월 변화' },
    changeTip: '지난 6개월 사이 이 역량을 적은 공고 비율이 얼마나 바뀌었는지예요.',
    courses: '추천 강의',
    hours: (hours: number) => `${hours}시간`,
    breakdown: '점수 구성',
    items: { required: '필수 역량', preferred: '우대 역량', experience: '프로젝트 경험', recency: '기술 최신성' } as Record<ScoreItem['key'], string>,
    weight: (value: number) => `비중 ${value}%`,
    checks: '필수와 우대 역량 점검',
    alternatives: '더 잘 맞는 다른 공고',
    noAlternatives: '지금 이력서로는 이 공고가 같은 직군에서 가장 잘 맞아요.',
    share: (value: string) => `같은 직군 공고의 ${value}가 요구`,
    change: '지난 6개월 변화',
    reason: '판단 근거',
    plan: '보완 방법',
    estimate: (weeks: number, gain: number) => `약 ${weeks}주, 적합도 +${gain}점 예상`,
    addPlan: '보완 계획에 추가',
    inPlan: '보완 계획에 있어요',
    appeal: '면접 어필 포인트',
    questions: '예상 질문과 답변 포인트',
    caution: '주의',
    note: '면접 노트',
    notePlaceholder: '이 역량에 대해 면접에서 말할 내용을 적어 두세요.',
    saveNote: '노트 저장',
    noteSaved: '노트를 저장했어요.',
    close: '닫기',
    planToast: (skill: string) => `${skill}을(를) 보완 계획에 넣었어요.`,
    planRemoved: (skill: string) => `${skill}을(를) 보완 계획에서 뺐어요.`,
  },
  en: {
    tabs: { summary: 'Report', fit: 'Fit breakdown', review: 'Document check', questions: 'Questions' },
    tabList: 'Report tabs',
    back: 'Back to new diagnosis',
    practice: 'Practice',
    rerun: 'Re-run',
    rerunDone: 'Running the diagnosis again.',
    staleTitle: 'Your resume has changed',
    staleBody: 'Review this posting again with your current resume?',
    staleAction: 'Re-run',
    delete: 'Delete',
    missing: "Couldn't find this report.",
    missingBody: 'It may have been deleted or created with another account.',
    signInTitle: 'Sign in to see this report.',
    signInBody: 'Reports are saved to your account.',
    signIn: 'Sign in',
    failedTitle: "We couldn't make this report.",
    failedBody: 'Please run the diagnosis again in a moment.',
    failedAction: 'Run again',
    goHome: 'Start a new diagnosis',
    fitTitle: 'Fit',
    verdict: (score: number) => (score >= 70 ? 'Great fit! Worth applying now.' : score >= 50 ? 'Nice! Just a little more to go.' : 'Some gaps here. Close them one by one.'),
    createdAt: (when: string) => `Diagnosed ${when}`,
    radar: 'Skill radar',
    gaps: 'Gaps',
    notFound: (weeks: number) => `About ${weeks} weeks to close`,
    shareTip: 'Share of postings in this job family that list this skill.',
    gainTip: 'How much your fit score should rise once you close this gap.',
    gain: (value: number) => `+${value}`,
    level: 'Level',
    duration: 'Length',
    groups: { missing: 'Not in your documents', partial: 'Listed but not shown', strength: 'Strengths' },
    kinds: { missing: 'Missing', partial: 'Weak', strength: 'Strengths' },
    kindCount: (kind: string, count: number) => `${kind} ${count}`,
    weeks: (weeks: number) => `About ${weeks} wk`,
    trends: 'Market demand',
    trendColumns: { skill: 'Skill', weeks: 'Last 12 weeks', share: 'Share', change: '6-month change' },
    changeTip: 'How much the share of postings listing this skill moved over the last 6 months.',
    courses: 'Suggested courses',
    hours: (hours: number) => `${hours}h`,
    breakdown: 'Score breakdown',
    items: { required: 'Required skills', preferred: 'Preferred skills', experience: 'Project evidence', recency: 'Recency' },
    weight: (value: number) => `${value}% weight`,
    checks: 'Required and preferred skills',
    alternatives: 'Postings that fit better',
    noAlternatives: 'With your current resume this is the best fit in its job family.',
    share: (value: string) => `Listed in ${value} of postings in this family`,
    change: 'Change over 6 months',
    reason: 'Reasoning',
    plan: 'How to close the gap',
    estimate: (weeks: number, gain: number) => `About ${weeks} weeks, around +${gain} fit points`,
    addPlan: 'Add to plan',
    inPlan: 'In your plan',
    appeal: 'How to highlight it',
    questions: 'Likely questions and answer points',
    caution: 'Watch out',
    note: 'Interview note',
    notePlaceholder: 'Write what you want to say about this skill in the interview.',
    saveNote: 'Save note',
    noteSaved: 'Note saved.',
    close: 'Close',
    planToast: (skill: string) => `Added ${skill} to your plan.`,
    planRemoved: (skill: string) => `Removed ${skill} from your plan.`,
  },
})

interface Props {
  id: string
  tab: ReportTab
  onTab: (tab: ReportTab) => void
  onBack: () => void
  onPractice: (id: string, question?: string) => void
  /** 다른 공고로 진단을 시작해요. */
  onPick: (postingId: string) => void
}

/** 강의 한 줄이에요. 플랫폼 로고와 제목, 아이콘을 붙인 난이도와 강의 시간을 보여줘요. */
function CourseRow({ course }: { course: Course }) {
  const L = useMessages(TEXT)
  return (
    <li>
      <a href={course.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-200/50">
        <img src={PROVIDER_LOGOS[course.provider]} alt={course.provider} width={36} height={36} className="size-9 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[13.5px] leading-snug font-medium text-gray-900 transition-colors group-hover:text-brand">{course.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-gray-500">
            <span>{course.provider}</span>
            <span className="flex items-center gap-1">
              <LevelIcon label={L.level} />
              {course.level}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <ClockIcon label={L.duration} />
              {L.hours(course.hours)}
            </span>
          </span>
        </span>
      </a>
    </li>
  )
}

/** 리포트 탭의 아래 줄에서 칸마다 보여줄 줄 수예요. 한 화면에 다 들어오게 몇 개만 보여줘요. */
const TREND_ROWS = 4
const COURSE_ROWS = 3
const ALTERNATIVE_ROWS = 3

/**
 * 갭 하나를 보여주는 작은 카드예요. 왼쪽에 기술 로고(`SkillMark`), 위에 스킬 이름과 필수, 우대 이름표, 채우면 오를 점수, 아래에 같은 직군 공고 비중 막대가 있어요.
 * 근거는 길어서 카드에 적지 않고, 누르면 오른쪽에 열리는 상세 칸에서 봐요.
 */
function GapTile({ gap, inPlan, order, onOpen }: { gap: SkillGap; inPlan: boolean; order: number; onOpen: () => void }) {
  const L = useMessages(TEXT)
  return (
    <li className="animate-rise" style={stagger(order)}>
      <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3.5 rounded-xl bg-white px-4 py-3 text-left transition-colors hover:bg-gray-100">
        <SkillMark skill={gap.skill} />
        <span className="flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="flex w-full items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-gray-900 transition-colors group-hover:text-brand">{gap.skill}</span>
            <RequirementLabel requirement={gap.requirement} />
            {gap.kind !== 'strength' && inPlan && <CheckIcon className="size-3.5 shrink-0 text-brand" label={L.inPlan} />}
            {gap.kind !== 'strength' && (
              <Tip text={L.gainTip} className="ml-auto inline-flex shrink-0">
                <span className="text-[12.5px] font-medium text-brand tabular-nums">{L.gain(gap.scoreGain)}</span>
              </Tip>
            )}
          </span>
          <Tip text={L.shareTip} className="flex w-full items-center gap-2.5">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200/70" aria-hidden>
              <span className="block h-full rounded-full bg-gray-400" style={{ width: `${Math.round(gap.share * 100)}%` }} />
            </span>
            <span className="shrink-0 text-[12px] text-gray-500 tabular-nums">{percent(gap.share)}</span>
            {gap.kind === 'missing' && <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">{L.weeks(gap.estimatedWeeks)}</span>}
          </Tip>
        </span>
      </button>
    </li>
  )
}

/** 시장 요구 변화를 몇 줄만 보여줘요. 많이 늘어난 역량이 위에 오고, 줄마다 역량, 최근 12주 막대, 6개월 변화예요. */
function TrendList({ report }: { report: ReportData }) {
  const L = useMessages(TEXT)
  const rows = report.trends
    .map((trend) => ({ ...trend, gap: report.gaps.find((item) => item.skill === trend.skill) }))
    .sort((a, b) => (b.gap?.marketChange ?? 0) - (a.gap?.marketChange ?? 0))
    .slice(0, TREND_ROWS)
  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
      {rows.map((row) => (
        <li key={row.skill} className="grid grid-cols-[minmax(0,1fr)_4.5rem_3.5rem] items-center gap-3 px-4 py-2.5">
          <span className="truncate text-[13px] font-medium text-gray-900">{row.skill}</span>
          <Sparkline series={row.series} className="h-6" />
          <span className="text-right">
            {row.gap && (
              <Tip text={L.changeTip}>
                <Delta value={row.gap.marketChange} unit="%p" />
              </Tip>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 더 잘 맞는 다른 공고를 한 줄씩 보여줘요. 기업 로고, 공고 제목과 기업, 적합도예요. 누르면 그 공고로 진단해요. */
function AlternativeList({ ids, onPick }: { ids: string[]; onPick: (postingId: string) => void }) {
  const resume = useResume()
  const postings = ids.flatMap((id) => postingOf(id) ?? []).slice(0, ALTERNATIVE_ROWS)
  return (
    <ul className="-mx-3">
      {postings.map((posting) => {
        const company = companyOf(posting.companyId)
        return (
          <li key={posting.id}>
            <button type="button" onClick={() => onPick(posting.id)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gray-200/50">
              <CompanyMark company={company} className="size-9 text-[13px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-gray-900 transition-colors group-hover:text-brand">{posting.title}</span>
                <span className="mt-0.5 block truncate text-[12px] text-gray-500">{company.name}</span>
              </span>
              <FitBadge fit={fitOf(posting, resume)} compact />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** 갭 상세 칸이에요. 오른쪽에서 미끄러져 들어오고, 부족과 보완은 보완 방법을, 강점은 어필 포인트와 면접 노트를 보여줘요. */
function GapPanel({ gap, trend, onClose }: { gap: SkillGap; trend: number[] | undefined; onClose: () => void }) {
  const L = useMessages(TEXT)
  const plans = usePlans()
  const notes = useNotes()
  const saved = notes.find((note) => note.skill === gap.skill)
  const [note, setNote] = useState(saved?.text ?? '')
  const inPlan = plans.includes(gap.skill)

  useEffect(() => {
    setNote(saved?.text ?? '')
  }, [saved?.text, gap.skill])

  return (
    <SidePanel
      onClose={onClose}
      closeLabel={L.close}
      labelledBy="gap-panel-title"
      header={
        // 갭 카드처럼 왼쪽에 기술 로고(없으면 뜻에 맞는 아이콘)를 크게 붙여요.
        <div className="flex items-center gap-3.5">
          <SkillMark skill={gap.skill} className="size-12 rounded-xl p-2" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <KindLabel kind={gap.kind} />
              <RequirementLabel requirement={gap.requirement} />
            </div>
            <h2 id="gap-panel-title" className="mt-1.5 truncate text-[20px] font-semibold text-gray-900">
              {gap.skill}
            </h2>
          </div>
        </div>
      }
    >
      <div className={panelBody}>
        {/* 공고 안의 비중과 시장 요구 변화 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3.5">
            <p className="text-[11.5px] text-gray-500">{L.share(percent(gap.share))}</p>
            <p className="mt-1 text-[20px] font-semibold text-gray-900 tabular-nums">{percent(gap.share)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3.5">
            <p className="text-[11.5px] text-gray-500">{L.change}</p>
            <p className="mt-1 text-[20px] font-semibold text-gray-900 tabular-nums">
              <Delta value={gap.marketChange} unit="%p" />
            </p>
          </div>
        </div>
        {trend && <Sparkline series={trend} className="mt-3 h-12" />}

        <section className="mt-6">
          <h3 className={label}>{L.reason}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-700">{gap.reason}</p>
        </section>

        {gap.kind !== 'strength' ? (
          <>
            <section className="mt-6">
              <h3 className={label}>{L.plan}</h3>
              <NumberedList items={gap.actionPlan} className="mt-2" />
              <p className="mt-3 text-[12.5px] text-gray-500">{L.estimate(gap.estimatedWeeks, gap.scoreGain)}</p>
            </section>
            {gap.courses.length > 0 && (
              <section className="mt-6">
                <h3 className={label}>{L.courses}</h3>
                <ul className="-mx-3 mt-1">
                  {gap.courses.map((course) => (
                    <CourseRow key={course.id} course={course} />
                  ))}
                </ul>
              </section>
            )}
            <button
              type="button"
              onClick={() => {
                togglePlan(gap.skill)
                track('gap_plan_toggle', { skill: gap.skill, added: !inPlan })
                showToast(inPlan ? pick(TEXT).planRemoved(gap.skill) : pick(TEXT).planToast(gap.skill))
              }}
              className={`${inPlan ? toolButton : primaryButton} mt-6 w-full justify-center`}
            >
              {inPlan && <CheckIcon className="size-3.5 text-brand" />}
              {inPlan ? L.inPlan : L.addPlan}
            </button>
          </>
        ) : (
          <>
            <section className="mt-6">
              <h3 className={label}>{L.appeal}</h3>
              <Bullets items={gap.appealPoints} brand className="mt-1.5" />
            </section>
            <section className="mt-6">
              <h3 className={label}>{L.questions}</h3>
              <ul className="mt-2 space-y-3">
                {gap.expectedQuestions.map((item) => (
                  <li key={item.question} className="rounded-xl bg-gray-50 p-3.5">
                    <p className="text-[13.5px] font-medium text-gray-900">{item.question}</p>
                    <Bullets items={item.points} className="mt-1.5" />
                  </li>
                ))}
              </ul>
            </section>
            {gap.caution && (
              <section className="mt-6">
                <h3 className={label}>{L.caution}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-700">{gap.caution}</p>
              </section>
            )}
            <section className="mt-6">
              <h3 className={label}>{L.note}</h3>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={L.notePlaceholder}
                className={`mt-2 h-28 ${textArea}`}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[12px] text-gray-400 tabular-nums">{saved ? formatDateTime(saved.savedAt) : ''}</span>
                <button
                  type="button"
                  disabled={!note.trim() || note === saved?.text}
                  onClick={() => {
                    saveNote(gap.skill, note.trim())
                    track('gap_note_save', { skill: gap.skill })
                    showToast(pick(TEXT).noteSaved)
                  }}
                  className={primaryButton}
                >
                  {L.saveNote}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </SidePanel>
  )
}

/** 더 잘 맞는 다른 공고 카드 줄이에요. 회색 칸 안에 놓여서 카드는 흰 바탕이에요. */
function Alternatives({ ids, onPick }: { ids: string[]; onPick: (postingId: string) => void }) {
  const resume = useResume()
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {ids.map((id, order) => {
        const alternative = postingOf(id)
        return alternative ? <PostingTile key={id} posting={alternative} resume={resume} tag="fit" onGray order={order} onOpen={() => onPick(id)} /> : null
      })}
    </ul>
  )
}

/**
 * 리포트 탭이에요. 스크롤 없이 한 화면에 들어오게, 맨 위 점수 머리말 아래로 갭과 레이더, 그 아래로 시장 요구 변화, 추천 강의, 더 잘 맞는 공고를 나란히 놓아요.
 * 갭은 부족, 보완, 강점 중 하나를 골라 그 묶음만 카드로 보여줘요.
 */
function SummaryTab({ report, onOpenGap, onPick }: { report: ReportData; onOpenGap: (gap: SkillGap) => void; onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const plans = usePlans()
  const kinds = (['missing', 'partial', 'strength'] as const).filter((kind) => report.gaps.some((gap) => gap.kind === kind))
  const [picked, setPicked] = useState<SkillGap['kind'] | null>(null)
  // 고른 묶음이 이 리포트에 없으면(다른 리포트로 옮겼을 때) 첫 묶음을 보여줘요.
  const kind = picked && kinds.includes(picked) ? picked : kinds[0]
  const gaps = report.gaps.filter((gap) => gap.kind === kind)
  const bottom = [report.trends.length > 0, report.courses.length > 0, report.alternatives.length > 0].filter(Boolean).length
  return (
    <div className="space-y-4">
      <ScoreHero score={report.fitScore} label={L.fitTitle} meta={L.createdAt(formatDateTime(report.createdAt))} title={L.verdict(report.fitScore)} body={report.summary} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel
          title={L.gaps}
          action={
            kinds.length > 1 && (
              <Segmented
                label={L.gaps}
                value={kind}
                options={kinds.map((each) => [each, L.kindCount(L.kinds[each], report.gaps.filter((gap) => gap.kind === each).length)] as const)}
                onChange={(next) => {
                  track('gap_group_select', { kind: next })
                  setPicked(next)
                }}
              />
            )
          }
        >
          <ul key={kind} className="grid gap-2 sm:grid-cols-2">
            {gaps.map((gap, order) => (
              <GapTile key={gap.skill} gap={gap} order={order} inPlan={plans.includes(gap.skill)} onOpen={() => onOpenGap(gap)} />
            ))}
          </ul>
        </Panel>
        <Panel title={L.radar}>
          <Radar axes={report.radar} size={240} />
        </Panel>
      </div>

      {bottom > 0 && (
        <div className={`grid gap-4 ${bottom === 3 ? 'lg:grid-cols-3' : bottom === 2 ? 'lg:grid-cols-2' : ''}`}>
          {report.trends.length > 0 && (
            <Panel title={L.trends} action={<span className="text-[12px] text-gray-400">{L.trendColumns.weeks}</span>}>
              <TrendList report={report} />
            </Panel>
          )}
          {report.courses.length > 0 && (
            <Panel title={L.courses}>
              <ul className="-mx-3">
                {report.courses.slice(0, COURSE_ROWS).map((course) => (
                  <CourseRow key={course.id} course={course} />
                ))}
              </ul>
            </Panel>
          )}
          {report.alternatives.length > 0 && (
            <Panel title={L.alternatives}>
              <AlternativeList ids={report.alternatives} onPick={onPick} />
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

function FitTab({ report, onPick }: { report: ReportData; onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const groups: RequirementCheck['requirement'][] = ['required', 'preferred']
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title={L.breakdown}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <ScoreRing score={report.fitScore} />
            <div className="min-w-0 flex-1 space-y-4">
              {report.breakdown.map((item) => (
                <Meter key={item.key} label={L.items[item.key]} value={item.score} display={`${item.score}`} note={`${L.weight(Math.round(item.weight * 100))}. ${item.note}`} />
              ))}
            </div>
          </div>
          <p className="mt-5 text-[13.5px] leading-relaxed text-gray-700">{report.summary}</p>
        </Panel>

        <Panel title={L.alternatives}>
          {report.alternatives.length === 0 ? (
            <p className="text-[13.5px] text-gray-500">{L.noAlternatives}</p>
          ) : (
            <Alternatives ids={report.alternatives} onPick={onPick} />
          )}
        </Panel>
      </div>

      <Panel title={L.checks}>
        <div className="space-y-5">
          {groups.map((requirement) => (
            <section key={requirement}>
              <h3 className={label}>{requirement === 'required' ? L.items.required : L.items.preferred}</h3>
              <ul className="mt-2 divide-y divide-gray-200">
                {report.checks
                  .filter((check) => check.requirement === requirement)
                  .map((check) => (
                    <li key={check.skill} className="flex items-center gap-3 py-2">
                      <CheckMark status={check.status} />
                      <span className={`flex-1 text-[13.5px] ${check.status === 'missing' ? 'text-gray-400' : 'text-gray-900'}`}>{check.skill}</span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/** 리포트 대시보드예요. 공고 하나와 내 서류를 맞춰 본 결과를 탭으로 나눠 보여줘요. */
export function Report({ id, tab, onTab, onBack, onPractice, onPick }: Props) {
  const L = useMessages(TEXT)
  const load = useLoadProgress()
  const report = useReport(id, load.one)
  const waiting = useLoadHold(report === undefined)
  const resume = useResume()
  const posting = useReportPosting(report?.postingId)
  const company = report ? companyOf(report.companyId) : null
  const [gap, setGap] = useState<SkillGap | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const signedIn = useAuth().tokens !== null

  // 리포트가 바뀌면 열어 둔 갭 상세를 닫아요.
  useEffect(() => setGap(null), [id, tab])

  useShortcuts(
    {
      Digit1: () => onTab('summary'),
      Digit2: () => onTab('fit'),
      Digit3: () => onTab('review'),
      Digit4: () => onTab('questions'),
      Escape: gap ? () => setGap(null) : undefined,
    },
    !deleting,
  )

  // 상세를 받는 동안은 받은 바이트로 센 퍼센트를 보여줘요. 만드는 중(pending)인 리포트는 아래에서 AI 진행 막대를 보여줘요.
  if (waiting || report === undefined) {
    return (
      <main className={pageFrame}>
        <PageHeader title={L.tabs.summary} onBack={onBack} backLabel={L.back} />
        <LoadProgress percent={load.percent} className={loadCenter} />
      </main>
    )
  }

  if (!report || !posting || !company) {
    return (
      <main className={pageFrame}>
        <PageHeader title={L.tabs.summary} onBack={onBack} backLabel={L.back} />
        {signedIn ? (
          <Notice title={L.missing} body={L.missingBody} action={L.goHome} onAction={onBack} className="mt-16" />
        ) : (
          <Notice title={L.signInTitle} body={L.signInBody} action={L.signIn} onAction={requestLogin} className="mt-16" />
        )}
      </main>
    )
  }

  async function rerun(from: 'button' | 'outdated' = 'button') {
    setRerunning(true)
    track('report_rerun', { from })
    const next = await rerunReport(id)
    setRerunning(false)
    if (!next) return
    showToast(pick(TEXT).rerunDone)
    // 새 리포트는 아이디가 바뀌어요. 주소를 새 리포트로 바꿔요.
    window.history.replaceState(null, '', window.location.pathname.replace(id, next.id))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const done = report.status === 'done'
  const failed = report.status === 'failed'
  // 이 리포트를 만든 서류와 지금 별을 누른 대표 이력서가 다르면, 대표 이력서로 다시 진단하자고 알려요.
  const outdated = done && !!resume && report.resumeId !== resume.id

  return (
    <main className={pageFrame}>
      <PageHeader
        title={posting.title}
        owner={company.name}
        mark={<CompanyMark company={company} className="size-11 text-[15px]" />}
        onBack={onBack}
        backLabel={L.back}
        actions={
          <>
            <button type="button" disabled={(!done && !failed) || rerunning} onClick={() => void rerun()} className={`${toolButton} disabled:text-gray-400`}>
              <RefreshIcon className={`size-4 ${rerunning ? 'motion-safe:animate-spin' : ''}`} />
              {L.rerun}
            </button>
            <button type="button" onClick={() => setDeleting(true)} className={toolDangerButton}>
              <TrashIcon className="size-4" />
              {L.delete}
            </button>
            <button type="button" disabled={!done} onClick={() => onPractice(id)} className={primaryButton}>
              {L.practice}
            </button>
          </>
        }
      />

      <Tabs
        label={L.tabList}
        items={TABS.map((item, index) => ({ key: item, label: L.tabs[item], shortcut: String(index + 1) }))}
        current={tab}
        onSelect={(item) => {
          track('report_tab_view', { tab: item })
          onTab(item)
        }}
        trailing={
          done && (
            <span className="hidden sm:inline-flex">
              <FitBadge fit={report.fitScore} />
            </span>
          )
        }
      />

      <div role="tabpanel" className="-mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-5 pb-16 md:-mx-10 md:px-10">
        {outdated && (
          <div role="status" className="mb-5 flex animate-rise flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-brand-soft px-5 py-4">
            <AlertIcon className="size-5 shrink-0 text-brand" />
            {/* 제목과 설명은 두 줄로 나눠 적어요. 한 줄에 이어 붙이면 문장 두 개가 한 문장처럼 읽혀요. */}
            <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
              <p className="font-semibold text-gray-900">{L.staleTitle}</p>
              <p className="mt-0.5 text-gray-700">{L.staleBody}</p>
            </div>
            <button type="button" disabled={rerunning} onClick={() => void rerun('outdated')} className={primaryButton}>
              {L.staleAction}
            </button>
          </div>
        )}
        {failed ? (
          <Notice title={L.failedTitle} body={L.failedBody} action={L.failedAction} onAction={() => void rerun()} className="mt-16" />
        ) : !done ? (
          // 만드는 동안은 서버가 알려 주는 진행 정도를 막대로 보여줘요. 저장소가 1초마다 다시 물어요.
          <AiProgress progress={report.progress ?? 0} stage={report.stage ?? 'queued'} className={loadCenter} />
        ) : tab === 'summary' ? (
          <SummaryTab report={report} onOpenGap={(item) => {
            track('gap_open', { kind: item.kind, skill: item.skill })
            setGap(item)
          }} onPick={onPick} />
        ) : tab === 'fit' ? (
          <FitTab report={report} onPick={onPick} />
        ) : tab === 'review' ? (
          <ReviewTab reportId={id} />
        ) : (
          <QuestionsTab reportId={id} onPractice={(question) => onPractice(id, question)} />
        )}
      </div>

      {gap && <GapPanel gap={gap} trend={report.trends.find((item) => item.skill === gap.skill)?.series} onClose={() => setGap(null)} />}
      {deleting && (
        <DeleteReportDialog
          report={report}
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            removeReport(report, 'history')
            setDeleting(false)
            onBack()
          }}
        />
      )}
    </main>
  )
}
