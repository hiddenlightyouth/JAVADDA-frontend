import { useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, companyOf, createReport, daysLeft, familyName, fitOf, postingOf, useResume } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { pageFrame, PageHeader, StepLayout } from './AppPage'
import { CompanyMark, FitBadge, Notice, SkillChip, skillTone } from './GapParts'
import { ResumeUploader } from './MyResume'
import { PostingBrowser, SplitView } from './PostingBrowser'
import { label, primaryButton, toolButton } from './ui'

/**
 * 진단 시작 화면이에요. 공고의 요구 역량을 훑고 바로 시작해요. 진단은 늘 대표 이력서(별을 누른 서류)로 해서 고르는 칸이 없어요.
 * 요구 역량 이름표는 대표 이력서 기준으로 칠해서, 시작하기 전에 무엇이 비는지 보여요.
 * 대표를 바꾸거나 역량을 고치는 것은 내 이력서 화면이 맡아요. 서류가 없으면 올리는 칸이 그 자리에 나와요.
 */

const TEXT = messages({
  ko: {
    title: '진단 시작',
    back: '새 진단 화면으로 돌아가기',
    required: '필수 역량',
    preferred: '우대 역량',
    deadline: (days: number) => (days === 0 ? '오늘 마감' : `마감 ${days}일 전`),
    always: '상시 채용',
    upload: '이력서를 올리면 진단할 수 있어요',
    basis: (name: string) => `${name}으로 진단해요`,
    openPosting: '원문 보기',
    start: '진단 시작',
    starting: '시작하는 중',
    missing: '이 공고를 찾을 수 없어요.',
    missingBody: '마감되었거나 주소가 바뀐 공고예요.',
    goHome: '다른 공고 고르기',
  },
  en: {
    title: 'Start a diagnosis',
    back: 'Back to new diagnosis',
    required: 'Required',
    preferred: 'Preferred',
    deadline: (days: number) => (days === 0 ? 'Closes today' : `Closes in ${days} ${days === 1 ? 'day' : 'days'}`),
    always: 'Rolling',
    upload: 'Upload a resume to start',
    basis: (name: string) => `Using ${name}`,
    openPosting: 'Original',
    start: 'Start diagnosis',
    starting: 'Starting',
    missing: "Couldn't find this posting.",
    missingBody: 'It may have closed or moved.',
    goHome: 'Pick another posting',
  },
})

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
  const [starting, setStarting] = useState(false)
  const [viewing, setViewing] = useState(false)

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

  async function start() {
    if (!resume || starting) return
    setStarting(true)
    track('diagnose_start', { posting: posting!.id, skills: resume.skills.length })
    const report = await createReport(posting!.id, resume.id)
    setStarting(false)
    if (report) onReport(report.id)
  }

  const canStart = resume !== null && resume.skills.length > 0

  return (
    <SplitView side={viewing && <PostingBrowser posting={posting} onClose={() => setViewing(false)} />}>
      <main className={pageFrame}>
        <PageHeader
          title={posting.title}
          owner={company.name}
          mark={<CompanyMark company={company} className="size-11 text-[15px]" />}
          onBack={onBack}
          backLabel={L.back}
          actions={
            // 원문은 새 탭 대신 앱 안의 미니 브라우저로 열어요.
            <button type="button" aria-expanded={viewing} onClick={() => setViewing(true)} className={toolButton}>
              {L.openPosting}
            </button>
          }
        />
        <StepLayout
          note={resume ? L.basis(resume.name) : undefined}
          buttons={
            <button type="button" disabled={!canStart || starting} onClick={() => void start()} className={primaryButton}>
              {starting ? L.starting : L.start}
            </button>
          }
        >
          <div className="animate-rise space-y-8">
            {/* 공고에서 볼 것만 짧게 적어요. 이름표는 고른 서류 기준으로 칠해요. */}
            <section className="rounded-2xl bg-gray-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] text-gray-500">
                  {posting.location}, {familyName(posting.family)}, {careerName(posting.career)}, {left !== null ? L.deadline(left) : L.always}
                </p>
                <FitBadge fit={fitOf(posting, resume)} compact />
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">{posting.summary}</p>
              <div className="mt-5 space-y-4">
                {(['required', 'preferred'] as const).map((kind) => (
                  <div key={kind}>
                    <h3 className={label}>{L[kind]}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {posting[kind].map((skill) => (
                        <SkillChip key={skill} name={skill} tone={skillTone(skill, resume)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 서류가 없을 때만 올리는 칸이 나와요. 올리면 그 서류가 대표가 되어 바로 진단할 수 있어요. */}
            {!resume && (
              <section>
                <h2 className="text-[15px] font-semibold text-gray-900">{L.upload}</h2>
                <div className="mt-3">
                  <ResumeUploader />
                </div>
              </section>
            )}
          </div>
        </StepLayout>
      </main>
    </SplitView>
  )
}
