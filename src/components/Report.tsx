import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import {
  companyOf,
  postingOf,
  PROVIDER_LOGOS,
  rerunReport,
  saveNote,
  togglePlan,
  useNotes,
  usePlans,
  useReport,
  useResume,
  type Course,
  type Report as ReportData,
  type RequirementCheck,
  type ScoreItem,
  type SkillGap,
} from '../lib/gap'
import { useShortcuts } from '../lib/shortcuts'
import { formatDateTime } from '../lib/format'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { pageFrame, PageHeader } from './AppPage'
import { panelBody, SidePanel } from './Dialog'
import { CheckMark, CompanyMark, Delta, FitBadge, KindLabel, Meter, Notice, Panel, PostingTile, Radar, RequirementLabel, ScoreHero, ScoreRing, Sparkline, Tip, percent } from './GapParts'
import { DeleteReportDialog, removeReport } from './History'
import { CheckIcon, ChevronRightIcon, ClockIcon, LevelIcon, RefreshIcon, TrashIcon } from './Icons'
import { ReviewTab } from './ReportReview'
import { QuestionsTab } from './ReportQuestions'
import { Bone } from './Skeleton'
import { Bullets, Busy, label, NumberedList, primaryButton, Tabs, textArea, toolButton, toolDangerButton } from './ui'

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
    delete: '삭제',
    missing: '이 리포트를 찾을 수 없어요.',
    missingBody: '지웠거나 다른 기기에서 만든 리포트예요.',
    goHome: '새 진단 시작하기',
    pending: '공고와 서류를 맞춰 보고 있어요.',
    pendingBody: '보통 몇 초 안에 끝나요.',
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
    trends: '시장 요구 변화',
    trendsHint: '같은 직군 공고에서 지난 12주 동안 이 스킬을 적은 수예요.',
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
    nothing: '해당하는 역량이 없어요.',
  },
  en: {
    tabs: { summary: 'Report', fit: 'Fit breakdown', review: 'Document check', questions: 'Questions' },
    tabList: 'Report tabs',
    back: 'Back to new diagnosis',
    practice: 'Practice',
    rerun: 'Re-run',
    rerunDone: 'Running the diagnosis again.',
    delete: 'Delete',
    missing: "Couldn't find this report.",
    missingBody: 'It may have been deleted or created on another device.',
    goHome: 'Start a new diagnosis',
    pending: 'Comparing the posting with your documents.',
    pendingBody: 'This usually takes a few seconds.',
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
    trends: 'Market demand',
    trendsHint: 'How many postings in this job family listed each skill over the last 12 weeks.',
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
    nothing: 'Nothing here.',
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

/** 받는 동안 보여주는 뼈대예요. 요약 탭의 배치와 같아요. */
function ReportSkeleton() {
  const L = useMessages(TEXT)
  return (
    <Busy label={L.pending} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-6 rounded-2xl bg-gray-50 p-5">
          <Bone className="size-28 shrink-0" />
          <div className="min-w-0 flex-1">
            <Bone className="h-3 w-full" />
            <Bone className="mt-2 h-3 w-11/12" />
            <Bone className="mt-2 h-3 w-2/3" />
          </div>
        </div>
        <div className="rounded-2xl bg-gray-50 p-5">
          <Bone className="h-3.5 w-20" />
          <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <Bone className="h-3.5 w-24" />
                  <Bone className="mt-2 h-3 w-3/5" />
                </div>
                <Bone className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-gray-50 p-5">
        <Bone className="h-3.5 w-24" />
        <Bone className="mx-auto mt-6 size-56 rounded-full!" />
      </div>
    </Busy>
  )
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

/** 갭 하나를 보여주는 줄이에요. 이름과 근거 한 줄, 오른쪽에 공고 비중과 오를 점수를 맞춰 세워요. 누르면 오른쪽에 자세한 칸이 열려요. */
function GapRow({ gap, inPlan, onOpen }: { gap: SkillGap; inPlan: boolean; onOpen: () => void }) {
  const L = useMessages(TEXT)
  const line = gap.kind === 'missing' ? L.notFound(gap.estimatedWeeks) : (gap.evidence ?? gap.reason)
  return (
    <li className="animate-rise">
      <button type="button" onClick={onOpen} className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-gray-50">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-gray-900 transition-colors group-hover:text-brand">{gap.skill}</span>
            <RequirementLabel requirement={gap.requirement} />
            {gap.kind !== 'strength' && inPlan && <CheckIcon className="size-3.5 shrink-0 text-brand" label={L.inPlan} />}
          </span>
          <span className="mt-1 block truncate text-[12.5px] text-gray-500">{line}</span>
        </span>
        <span className="hidden shrink-0 sm:block">
          <Tip text={L.shareTip}>
            <span className="block w-16">
              <span className="block text-right text-[12.5px] font-medium text-gray-700 tabular-nums">{percent(gap.share)}</span>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-gray-200/70">
                <span className="block h-full rounded-full bg-gray-400" style={{ width: `${Math.round(gap.share * 100)}%` }} />
              </span>
            </span>
          </Tip>
        </span>
        <span className="w-11 shrink-0 text-right text-[12.5px] font-medium tabular-nums">
          {gap.kind !== 'strength' && (
            <Tip text={L.gainTip}>
              <span className="text-brand">{L.gain(gap.scoreGain)}</span>
            </Tip>
          )}
        </span>
        <ChevronRightIcon />
      </button>
    </li>
  )
}

/** 시장 요구 변화를 표처럼 한 줄씩 보여줘요. 많이 늘어난 역량이 위에 와요. */
function TrendList({ report }: { report: ReportData }) {
  const L = useMessages(TEXT)
  const rows = report.trends
    .map((trend) => ({ ...trend, gap: report.gaps.find((item) => item.skill === trend.skill) }))
    .sort((a, b) => (b.gap?.marketChange ?? 0) - (a.gap?.marketChange ?? 0))
  const columns = 'grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_3.5rem_4.5rem] items-center gap-4 px-4 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4rem_5rem]'
  return (
    <div className="overflow-hidden rounded-xl bg-white">
      <div className={`${columns} pt-3 pb-2 text-[11.5px] text-gray-400`}>
        <span>{L.trendColumns.skill}</span>
        <span>{L.trendColumns.weeks}</span>
        <span className="text-right">{L.trendColumns.share}</span>
        <span className="text-right">{L.trendColumns.change}</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => (
          <li key={row.skill} className={`${columns} py-3`}>
            <span className="truncate text-[13.5px] font-medium text-gray-900">{row.skill}</span>
            <Sparkline series={row.series} className="h-7 max-w-56" />
            <span className="text-right text-[12.5px] text-gray-700 tabular-nums">{row.gap ? percent(row.gap.share) : ''}</span>
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
    </div>
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
        <>
          <div className="flex items-center gap-2">
            <KindLabel kind={gap.kind} />
            <RequirementLabel requirement={gap.requirement} />
          </div>
          <h2 id="gap-panel-title" className="mt-2 text-[20px] font-semibold text-gray-900">
            {gap.skill}
          </h2>
        </>
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

function SummaryTab({ report, onOpenGap, onPick }: { report: ReportData; onOpenGap: (gap: SkillGap) => void; onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const plans = usePlans()
  const groups: SkillGap['kind'][] = ['missing', 'partial', 'strength']
  return (
    <div className="space-y-10">
      <ScoreHero score={report.fitScore} label={L.fitTitle} meta={L.createdAt(formatDateTime(report.createdAt))} title={L.verdict(report.fitScore)} body={report.summary} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">

          <Panel title={L.gaps}>
            <div className="space-y-6">
              {groups.map((kind) => {
                const list = report.gaps.filter((gap) => gap.kind === kind)
                if (list.length === 0) return null
                return (
                  <section key={kind}>
                    <h3 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-gray-800">
                      {L.groups[kind]}
                      <span className="font-normal text-gray-400 tabular-nums">{list.length}</span>
                    </h3>
                    <ul className="mt-2.5 divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                      {list.map((gap) => (
                        <GapRow key={gap.skill} gap={gap} inPlan={plans.includes(gap.skill)} onOpen={() => onOpenGap(gap)} />
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          </Panel>

          <Panel title={L.trends} action={<span className="text-[12px] text-gray-400">{L.trendsHint}</span>}>
            <TrendList report={report} />
          </Panel>

          {report.alternatives.length > 0 && (
            <Panel title={L.alternatives}>
              <Alternatives ids={report.alternatives} onPick={onPick} />
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={L.radar}>
            <Radar axes={report.radar} size={280} />
          </Panel>
          {report.courses.length > 0 && (
            <Panel title={L.courses}>
              <ul className="-mx-3">
                {report.courses.map((course) => (
                  <CourseRow key={course.id} course={course} />
                ))}
              </ul>
            </Panel>
          )}
          </div>
      </div>
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
  const report = useReport(id)
  const posting = report ? postingOf(report.postingId) : null
  const company = report ? companyOf(report.companyId) : null
  const [gap, setGap] = useState<SkillGap | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [rerunning, setRerunning] = useState(false)

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

  if (!report || !posting || !company) {
    return (
      <main className={pageFrame}>
        <PageHeader title={L.tabs.summary} onBack={onBack} backLabel={L.back} />
        <Notice title={L.missing} body={L.missingBody} action={L.goHome} onAction={onBack} className="mt-24" />
      </main>
    )
  }

  async function rerun() {
    setRerunning(true)
    track('report_rerun')
    const next = await rerunReport(id)
    setRerunning(false)
    if (!next) return
    showToast(pick(TEXT).rerunDone)
    // 새 리포트는 아이디가 바뀌어요. 주소를 새 리포트로 바꿔요.
    window.history.replaceState(null, '', window.location.pathname.replace(id, next.id))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const done = report.status === 'done'

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
            <button type="button" disabled={!done || rerunning} onClick={() => void rerun()} className={`${toolButton} disabled:text-gray-400`}>
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

      <div role="tabpanel" className="-mx-6 -mb-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5 md:-mx-10 md:px-10">
        {!done ? (
          <>
            <ReportSkeleton />
            <p className="mt-6 text-center text-[13px] text-gray-500">
              {L.pending} {L.pendingBody}
            </p>
          </>
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
