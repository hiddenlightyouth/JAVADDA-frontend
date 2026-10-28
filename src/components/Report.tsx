import { useEffect, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import {
  companyOf,
  postingOf,
  rerunReport,
  saveNote,
  togglePlan,
  useNotes,
  usePlans,
  useReport,
  useResume,
  type Course,
  type JobPosting,
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
import { primaryButton } from './Dialog'
import { toolButton } from './DeepParts'
import { CheckMark, Delta, FitBadge, KindLabel, Meter, Notice, Panel, PostingTile, Radar, RequirementLabel, ScoreRing, Sparkline, percent } from './GapParts'
import { DeleteReportDialog, removeReport } from './History'
import { CheckIcon, CloseButton, RefreshIcon, TrashIcon } from './Icons'
import { ReviewTab } from './ReportReview'
import { QuestionsTab } from './ReportQuestions'
import { Kbd } from './Shortcuts'
import { Bone } from './Skeleton'

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
    createdAt: (when: string) => `${when} 진단`,
    radar: '역량 레이더',
    gaps: '갭 목록',
    gapsHint: '칸을 누르면 판단 근거와 보완 방법이 열려요.',
    groups: { missing: '부족한 역량', partial: '보완할 역량', strength: '강점' } as Record<SkillGap['kind'], string>,
    trends: '시장 요구 변화',
    trendsHint: '같은 직군 공고에서 지난 12주 동안 이 스킬을 적은 수예요.',
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
    signal: (count: number) => `${count}개의 요구 역량을 서류와 맞춰 봤어요. 적합도 숫자는 판결이 아니라 참고할 신호예요.`,
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
    createdAt: (when: string) => `Diagnosed ${when}`,
    radar: 'Skill radar',
    gaps: 'Gaps',
    gapsHint: 'Tap a card to see the reasoning and how to close the gap.',
    groups: { missing: 'Missing', partial: 'Needs work', strength: 'Strengths' },
    trends: 'Market demand',
    trendsHint: 'How many postings in this job family listed each skill over the last 12 weeks.',
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
    signal: (count: number) => `We compared ${count} listed skills with your documents. Fit numbers are signals, not verdicts.`,
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
function Loading() {
  const L = useMessages(TEXT)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
      <span className="sr-only">{L.pending}</span>
      <div aria-hidden className="flex flex-col gap-4">
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
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="rounded-xl border border-gray-200 p-4">
                <Bone className="h-3.5 w-24" />
                <Bone className="mt-3 h-3 w-full" />
                <Bone className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="rounded-2xl bg-gray-50 p-5">
        <Bone className="h-3.5 w-24" />
        <Bone className="mx-auto mt-6 size-56 rounded-full!" />
      </div>
    </div>
  )
}

function CourseRow({ course }: { course: Course }) {
  const L = useMessages(TEXT)
  return (
    <li>
      <a href={course.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-200/50">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-semibold text-gray-600">{course.provider[0]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-gray-900">{course.title}</span>
          <span className="block text-[12px] text-gray-400">
            {course.provider}, {course.level}, {L.hours(course.hours)}
          </span>
        </span>
      </a>
    </li>
  )
}

/** 갭 하나를 보여주는 카드예요. 누르면 오른쪽에 자세한 칸이 열려요. */
function GapCard({ gap, inPlan, onOpen }: { gap: SkillGap; inPlan: boolean; onOpen: () => void }) {
  const L = useMessages(TEXT)
  return (
    <li className="min-h-0 animate-rise">
      <button type="button" onClick={onOpen} className="flex h-full w-full flex-col rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-brand">
        <span className="flex w-full items-center justify-between gap-2">
          <span className="truncate text-[14px] font-semibold text-gray-900">{gap.skill}</span>
          <RequirementLabel requirement={gap.requirement} />
        </span>
        <span className="mt-2 line-clamp-2 flex-1 text-[12.5px] leading-relaxed text-gray-500">{gap.reason}</span>
        <span className="mt-3 flex w-full items-center justify-between gap-2 text-[12px] text-gray-400">
          <span>{L.share(percent(gap.share))}</span>
          {gap.kind !== 'strength' && inPlan && <CheckIcon className="size-3.5 shrink-0 text-brand" label={L.inPlan} />}
        </span>
      </button>
    </li>
  )
}

/** 갭 상세 칸이에요. 오른쪽에서 미끄러져 들어오고, 부족과 보완은 보완 방법을, 강점은 어필 포인트와 면접 노트를 보여줘요. */
function GapPanel({ gap, trend, onClose }: { gap: SkillGap; trend: number[] | undefined; onClose: () => void }) {
  const L = useMessages(TEXT)
  const ref = useRef<HTMLElement>(null)
  const plans = usePlans()
  const notes = useNotes()
  const saved = notes.find((note) => note.skill === gap.skill)
  const [note, setNote] = useState(saved?.text ?? '')
  const inPlan = plans.includes(gap.skill)
  useDismiss(true, ref, onClose)

  useEffect(() => {
    setNote(saved?.text ?? '')
  }, [saved?.text, gap.skill])

  return (
    <aside ref={ref} role="dialog" aria-labelledby="gap-panel-title" className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[440px] animate-slide-in flex-col border-l border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KindLabel kind={gap.kind} />
            <RequirementLabel requirement={gap.requirement} />
          </div>
          <h2 id="gap-panel-title" className="mt-2 text-[20px] font-semibold text-gray-900">
            {gap.skill}
          </h2>
        </div>
        <CloseButton label={L.close} size="md" onClick={onClose} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {/* 공고 안의 비중과 시장 요구 변화 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 p-3.5">
            <p className="text-[11.5px] text-gray-400">{L.share(percent(gap.share))}</p>
            <p className="mt-1 text-[20px] font-semibold text-gray-900 tabular-nums">{percent(gap.share)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-3.5">
            <p className="text-[11.5px] text-gray-400">{L.change}</p>
            <p className="mt-1 text-[20px] font-semibold text-gray-900 tabular-nums">
              <Delta value={gap.marketChange} unit="p" />
            </p>
          </div>
        </div>
        {trend && <Sparkline series={trend} className="mt-3 h-12" />}

        <section className="mt-6">
          <h3 className="text-[12.5px] font-medium text-gray-400">{L.reason}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-700">{gap.reason}</p>
        </section>

        {gap.kind !== 'strength' ? (
          <>
            <section className="mt-6">
              <h3 className="text-[12.5px] font-medium text-gray-400">{L.plan}</h3>
              <ol className="mt-2 space-y-2">
                {gap.actionPlan.map((step, index) => (
                  <li key={step} className="flex gap-3 text-[13.5px] leading-relaxed text-gray-700">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-600 tabular-nums">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[12.5px] text-gray-500">{L.estimate(gap.estimatedWeeks, gap.scoreGain)}</p>
            </section>
            {gap.courses.length > 0 && (
              <section className="mt-6">
                <h3 className="text-[12.5px] font-medium text-gray-400">{L.courses}</h3>
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
              <h3 className="text-[12.5px] font-medium text-gray-400">{L.appeal}</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-gray-700 marker:text-gray-300">
                {gap.appealPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
            <section className="mt-6">
              <h3 className="text-[12.5px] font-medium text-gray-400">{L.questions}</h3>
              <ul className="mt-2 space-y-3">
                {gap.expectedQuestions.map((item) => (
                  <li key={item.question} className="rounded-xl border border-gray-200 p-3.5">
                    <p className="text-[13.5px] font-medium text-gray-900">{item.question}</p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px] leading-relaxed text-gray-600 marker:text-gray-300">
                      {item.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
            {gap.caution && (
              <section className="mt-6">
                <h3 className="text-[12.5px] font-medium text-gray-400">{L.caution}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-700">{gap.caution}</p>
              </section>
            )}
            <section className="mt-6">
              <h3 className="text-[12.5px] font-medium text-gray-400">{L.note}</h3>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={L.notePlaceholder}
                className="mt-2 h-28 w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-[13.5px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand"
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
    </aside>
  )
}

function SummaryTab({ report, posting, onOpenGap, onPick }: { report: ReportData; posting: JobPosting; onOpenGap: (gap: SkillGap) => void; onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const plans = usePlans()
  const resume = useResume()
  const groups: SkillGap['kind'][] = ['missing', 'partial', 'strength']
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ScoreRing score={report.fitScore} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-gray-400">{L.createdAt(formatDateTime(report.createdAt))}</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-gray-800">{report.summary}</p>
            </div>
          </div>
        </Panel>

        <Panel title={L.gaps} action={<span className="text-[12px] text-gray-400">{L.gapsHint}</span>}>
          <div className="space-y-6">
            {groups.map((kind) => {
              const list = report.gaps.filter((gap) => gap.kind === kind)
              if (list.length === 0) return null
              return (
                <section key={kind}>
                  <h3 className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
                    {L.groups[kind]}
                    <span className="text-[12px] font-normal text-gray-400 tabular-nums">{list.length}</span>
                  </h3>
                  <ul className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                    {list.map((gap) => (
                      <GapCard key={gap.skill} gap={gap} inPlan={plans.includes(gap.skill)} onOpen={() => onOpenGap(gap)} />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </Panel>

        <Panel title={L.trends} action={<span className="text-[12px] text-gray-400">{L.trendsHint}</span>}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {report.trends.map((trend) => {
              const gap = report.gaps.find((item) => item.skill === trend.skill)
              return (
                <li key={trend.skill} className="rounded-xl border border-gray-200 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-gray-900">{trend.skill}</span>
                    {gap && <Delta value={gap.marketChange} unit="p" />}
                  </div>
                  <Sparkline series={trend.series} className="mt-3 h-10" />
                </li>
              )
            })}
          </ul>
        </Panel>

        {report.alternatives.length > 0 && (
          <Panel title={L.alternatives}>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {report.alternatives.map((id, order) => {
                const alternative = postingOf(id)
                return alternative ? <PostingTile key={id} posting={alternative} resume={resume} tag="fit" onGray order={order} onOpen={() => onPick(id)} /> : null
              })}
            </ul>
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
        <p className="px-1 text-[12px] leading-relaxed text-gray-400">{L.signal(posting.required.length + posting.preferred.length)}</p>
      </div>
    </div>
  )
}

function FitTab({ report, onPick }: { report: ReportData; onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
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
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {report.alternatives.map((id, order) => {
                const alternative = postingOf(id)
                return alternative ? <PostingTile key={id} posting={alternative} resume={resume} tag="fit" onGray order={order} onOpen={() => onPick(id)} /> : null
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={L.checks}>
        <div className="space-y-5">
          {groups.map((requirement) => (
            <section key={requirement}>
              <h3 className="text-[12.5px] font-medium text-gray-400">{requirement === 'required' ? L.items.required : L.items.preferred}</h3>
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
        onBack={onBack}
        backLabel={L.back}
        actions={
          <>
            <button type="button" disabled={!done || rerunning} onClick={() => void rerun()} className={`${toolButton} disabled:text-gray-400`}>
              <RefreshIcon className={`size-4 ${rerunning ? 'motion-safe:animate-spin' : ''}`} />
              {L.rerun}
            </button>
            <button type="button" onClick={() => setDeleting(true)} className={`${toolButton} text-red-500! hover:border-red-200!`}>
              <TrashIcon className="size-4" />
              {L.delete}
            </button>
            <button type="button" disabled={!done} onClick={() => onPractice(id)} className={primaryButton}>
              {L.practice}
            </button>
          </>
        }
      />

      <div role="tablist" aria-label={L.tabList} className="flex shrink-0 gap-1 border-b border-gray-200">
        {TABS.map((item, index) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === tab}
            onClick={() => {
              track('report_tab_view', { tab: item })
              onTab(item)
            }}
            className={`relative -mb-px h-10 border-b-2 px-2 text-[13.5px] font-medium whitespace-nowrap transition-colors sm:px-3 ${item === tab ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            {L.tabs[item]}
            <Kbd corner>{String(index + 1)}</Kbd>
          </button>
        ))}
        {done && (
          <div className="mb-1.5 ml-auto hidden items-center self-end sm:flex">
            <FitBadge fit={report.fitScore} />
          </div>
        )}
      </div>

      <div role="tabpanel" className="-mx-6 -mb-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5 md:-mx-10 md:px-10">
        {!done ? (
          <>
            <Loading />
            <p className="mt-6 text-center text-[13px] text-gray-500">
              {L.pending} {L.pendingBody}
            </p>
          </>
        ) : tab === 'summary' ? (
          <SummaryTab report={report} posting={posting} onOpenGap={(item) => {
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
