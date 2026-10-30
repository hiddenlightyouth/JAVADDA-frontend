import { useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, companyOf, createReport, daysLeft, familyName, fitOf, postingOf, useResume, useResumeShelf } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, useMessages } from '../lib/i18n'
import { pageFrame, PageHeader, StepLayout } from './AppPage'
import { CompanyMark, FitBadge, Notice, SkillChip, skillTone } from './GapParts'
import { PlusIcon } from './Icons'
import { ResumeUploader } from './MyResume'
import { PostingBrowser, SplitView } from './PostingBrowser'
import { label, primaryButton, toolButton } from './ui'

/**
 * 진단 시작 화면이에요. 한 화면에서 공고의 요구 역량을 훑고, 진단할 서류를 골라 바로 시작해요.
 * 요구 역량 이름표는 고른 서류 기준으로 칠해서, 시작하기 전에 무엇이 비는지 보여요.
 * 역량을 고치는 것은 내 이력서 화면이 맡아요. 서류가 없으면 올리는 칸이 그 자리에 나와요.
 */

const TEXT = messages({
  ko: {
    title: '진단 시작',
    back: '새 진단 화면으로 돌아가기',
    required: '필수 역량',
    preferred: '우대 역량',
    deadline: (days: number) => (days === 0 ? '오늘 마감' : `마감 ${days}일 전`),
    always: '상시 채용',
    openPosting: '원문 보기',
    docs: '진단할 서류',
    uploadedAt: (when: string) => `${when}에 올림`,
    skills: (count: number) => `역량 ${count}개`,
    replace: '다른 서류 올리기',
    keep: '올리지 않고 돌아가기',
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
    openPosting: 'Original',
    docs: 'Document to diagnose',
    uploadedAt: (when: string) => `Uploaded ${when}`,
    skills: (count: number) => `${count} ${count === 1 ? 'skill' : 'skills'}`,
    replace: 'Upload a different document',
    keep: 'Go back without uploading',
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
  const shelf = useResumeShelf()
  const primary = useResume()
  /** 이번 진단에 쓸 서류. 고르지 않았거나 지워졌으면 대표 이력서예요. 대표 이력서는 바꾸지 않아요. */
  const [pickedId, setPickedId] = useState<string | null>(null)
  const resume = shelf.list.find((item) => item.id === pickedId) ?? primary
  const [uploading, setUploading] = useState(false)
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
  const showUploader = !resume || uploading

  async function start() {
    if (!resume || starting) return
    setStarting(true)
    track('diagnose_start', { posting: posting!.id, skills: resume.skills.length, primary: resume.id === shelf.primaryId })
    const report = await createReport(posting!.id, resume.id)
    setStarting(false)
    if (report) onReport(report.id)
  }

  const canStart = resume !== null && resume.skills.length > 0 && !uploading

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
          buttons={
            <button type="button" disabled={!canStart || starting} onClick={() => void start()} className={primaryButton}>
              {starting ? L.starting : L.start}
            </button>
          }
        >
          <div className="animate-rise space-y-8">
            {/* 공고에서 볼 것만 짧게 적어요. 이름표는 고른 서류 기준으로 칠해요. */}
            <section className="rounded-2xl bg-gray-50 p-5">
              <p className="text-[13px] text-gray-500">
                {posting.location}, {familyName(posting.family)}, {careerName(posting.career)}, {left !== null ? L.deadline(left) : L.always}
              </p>
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

            <section>
              <h2 className="text-[15px] font-semibold text-gray-900">{L.docs}</h2>
              <div className="mt-3">
                {showUploader ? (
                  <>
                    <ResumeUploader
                      onDone={(next) => {
                        setUploading(false)
                        setPickedId(next.id)
                      }}
                    />
                    {resume && (
                      <button type="button" onClick={() => setUploading(false)} className="mt-3 w-full text-center text-[13px] text-gray-500 transition-colors hover:text-gray-900">
                        {L.keep}
                      </button>
                    )}
                  </>
                ) : (
                  // 처음에는 대표 이력서가 골라져 있어요. 여기서 골라도 대표 이력서는 바뀌지 않아요. 서류마다 이 공고와의 적합도를 같이 보여줘요.
                  <div className="flex flex-col gap-1 rounded-2xl bg-gray-50 p-1.5">
                    <div role="radiogroup" aria-label={L.docs} className="flex flex-col gap-1">
                      {shelf.list.map((item) => {
                        const checked = item.id === resume.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            onClick={() => setPickedId(item.id)}
                            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${checked ? 'bg-white' : 'hover:bg-gray-100'}`}
                          >
                            <span aria-hidden className={`size-4 shrink-0 rounded-full border transition-all ${checked ? 'border-[5px] border-brand' : 'border-gray-300 bg-white'}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold text-gray-900">{item.name}</span>
                              <span className="block truncate text-[12px] text-gray-500">
                                {L.uploadedAt(formatDateTime(item.uploadedAt))}, {L.skills(item.skills.length)}
                              </span>
                            </span>
                            <FitBadge fit={fitOf(posting, item)} compact />
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploading(true)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <PlusIcon className="size-4 shrink-0" />
                      {L.replace}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </StepLayout>
      </main>
    </SplitView>
  )
}
