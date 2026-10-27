import { useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, companyOf, createReport, daysLeft, familyName, fitOf, postingOf, useResume } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { pageFrame, PageHeader, StepLayout, Steps, StepTitle } from './AppPage'
import { primaryButton, quietButton } from './Dialog'
import { CompanyMark, FitBadge, Notice, SkillChip, type ChipTone } from './GapParts'
import { ResumeUploader, SkillEditor } from './MyResume'

/**
 * 진단 시작 화면이에요. 공고를 확인하고, 이력서를 올리거나 확인한 뒤에 진단을 시작해요.
 * 포트폴리오 만들기와 같은 단계 화면 틀(Steps, StepLayout)을 써요.
 */

type Step = 'posting' | 'resume'

const TEXT = messages({
  ko: {
    title: '진단 시작',
    back: '새 진단 화면으로 돌아가기',
    steps: { posting: '공고 확인', resume: '이력서' } as Record<Step, string>,
    postingTitle: '이 공고에 맞춰 볼까요?',
    postingHint: '공고에 적힌 필수와 우대 역량이에요. 이력서가 있으면 이미 갖춘 역량은 파랗게 보여요.',
    required: '필수 역량',
    preferred: '우대 역량',
    deadline: (days: number) => (days === 0 ? '오늘 마감' : `마감 ${days}일 전`),
    always: '상시 채용',
    openPosting: '원문 보기',
    resumeTitle: '어떤 서류로 진단할까요?',
    resumeHintNone: '이력서나 포트폴리오를 올리면 역량을 읽어요. 한 번 올리면 다음 진단부터는 바로 시작해요.',
    resumeHint: '올려 둔 서류로 진단해요. 잘못 읽은 역량이 있으면 여기서 고쳐요.',
    uploadedAt: (when: string) => `${when}에 올림`,
    replace: '다른 서류 올리기',
    keep: '지금 서류 그대로 두기',
    next: '다음',
    prev: '이전',
    start: '진단 시작',
    starting: '시작하는 중',
    missing: '이 공고를 찾을 수 없어요.',
    missingBody: '마감되었거나 주소가 바뀐 공고예요.',
    goHome: '다른 공고 고르기',
  },
  en: {
    title: 'Start a diagnosis',
    back: 'Back to new diagnosis',
    steps: { posting: 'Posting', resume: 'Resume' },
    postingTitle: 'Measure against this posting?',
    postingHint: 'Required and preferred skills from the posting. Skills you already show are highlighted once a resume is uploaded.',
    required: 'Required',
    preferred: 'Preferred',
    deadline: (days: number) => (days === 0 ? 'Closes today' : `Closes in ${days} ${days === 1 ? 'day' : 'days'}`),
    always: 'Rolling',
    openPosting: 'Open original',
    resumeTitle: 'Which document should we use?',
    resumeHintNone: 'Upload a resume or portfolio and we read the skills. After the first upload, later diagnoses start right away.',
    resumeHint: "We'll use your uploaded document. Fix any skills we misread here.",
    uploadedAt: (when: string) => `Uploaded ${when}`,
    replace: 'Upload a different document',
    keep: 'Keep the current document',
    next: 'Next',
    prev: 'Back',
    start: 'Start diagnosis',
    starting: 'Starting',
    missing: "Couldn't find this posting.",
    missingBody: 'It may have closed or moved.',
    goHome: 'Pick another posting',
  },
})

const STEPS: Step[] = ['posting', 'resume']

interface Props {
  postingId: string
  onBack: () => void
  /** 리포트를 만들기 시작했어요. 리포트 화면으로 옮겨요. */
  onReport: (id: string) => void
}

export function Diagnose({ postingId, onBack, onReport }: Props) {
  const L = useMessages(TEXT)
  const posting = postingOf(postingId)
  const resume = useResume()
  const [step, setStep] = useState<Step>('posting')
  const [replacing, setReplacing] = useState(false)
  const [starting, setStarting] = useState(false)

  if (!posting) {
    return (
      <main className={pageFrame}>
        <PageHeader title={L.title} onBack={onBack} backLabel={L.back} />
        <Notice title={L.missing} body={L.missingBody} action={L.goHome} onAction={onBack} className="mt-24" />
      </main>
    )
  }

  const company = companyOf(posting.companyId)
  const left = daysLeft(posting)
  const fit = fitOf(posting, resume)
  const tone = (skill: string): ChipTone => {
    const level = resume?.skills.find((item) => item.name === skill)?.level ?? 0
    return !resume ? 'plain' : level >= 3 ? 'met' : level > 0 ? 'partial' : 'missing'
  }

  async function start() {
    if (!resume || starting) return
    setStarting(true)
    track('diagnose_start', { posting: posting!.id, skills: resume.skills.length })
    const report = await createReport(posting!.id)
    setStarting(false)
    if (report) onReport(report.id)
  }

  const canStart = resume !== null && resume.skills.length > 0 && !replacing

  return (
    <main className={pageFrame}>
      <PageHeader title={L.title} owner={company.name} onBack={onBack} backLabel={L.back} />
      <StepLayout
        top={<Steps steps={STEPS.map((key) => ({ key, label: L.steps[key] }))} current={step} onSelect={setStep} />}
        buttons={
          step === 'posting' ? (
            <button type="button" onClick={() => setStep('resume')} className={primaryButton}>
              {L.next}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setStep('posting')} className={quietButton}>
                {L.prev}
              </button>
              <button type="button" disabled={!canStart || starting} onClick={() => void start()} className={primaryButton}>
                {starting ? L.starting : L.start}
              </button>
            </>
          )
        }
      >
        {step === 'posting' ? (
          <div className="animate-rise">
            <StepTitle title={L.postingTitle} hint={L.postingHint} />
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <CompanyMark company={company} />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold text-gray-900">{posting.title}</p>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    {company.name}, {posting.location}, {familyName(posting.family)}, {careerName(posting.career)}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-gray-400">{left !== null ? L.deadline(left) : L.always}</p>
                </div>
                <FitBadge fit={fit} compact />
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-gray-700">{posting.summary}</p>
              <div className="mt-5">
                <h3 className="text-[12.5px] font-medium text-gray-400">{L.required}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {posting.required.map((skill) => (
                    <SkillChip key={skill} name={skill} tone={tone(skill)} />
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-[12.5px] font-medium text-gray-400">{L.preferred}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {posting.preferred.map((skill) => (
                    <SkillChip key={skill} name={skill} tone={tone(skill)} />
                  ))}
                </div>
              </div>
              <a href={posting.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand">
                {L.openPosting}
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                  <path d="M5 11l6-6M6 5h5v5" />
                </svg>
              </a>
            </div>
          </div>
        ) : (
          <div className="animate-rise">
            <StepTitle title={L.resumeTitle} hint={resume ? L.resumeHint : L.resumeHintNone} />
            <div className="mt-6">
              {!resume || replacing ? (
                <>
                  <ResumeUploader compact onDone={() => setReplacing(false)} />
                  {resume && (
                    <button type="button" onClick={() => setReplacing(false)} className="mt-3 w-full text-center text-[13px] text-gray-500 transition-colors hover:text-gray-900">
                      {L.keep}
                    </button>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold text-gray-900">{resume.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-gray-400">{L.uploadedAt(formatDateTime(resume.uploadedAt))}</p>
                    </div>
                    <button type="button" onClick={() => setReplacing(true)} className="shrink-0 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand">
                      {L.replace}
                    </button>
                  </div>
                  <div className="mt-5">
                    <SkillEditor resume={resume} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </StepLayout>
    </main>
  )
}
