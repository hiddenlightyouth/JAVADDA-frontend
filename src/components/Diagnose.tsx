import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { careerName, companyOf, daysLeft, familyName, postingOf, startDiagnosis, useResume } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { pageFrame, PageHeader } from './AppPage'
import { CompanyMark, Failed, Notice, SkillChip } from './GapParts'
import { ResumeUploader } from './MyResume'
import { PostingBrowser, SplitView } from './PostingBrowser'
import { label, toolButton } from './ui'

/**
 * 진단 시작 주소(`/diagnose/공고`)의 화면이에요. 공고를 누르면 확인 화면 없이 대표 이력서로 바로 진단하고 리포트로 가서(`startDiagnosis`),
 * 이 화면은 대표 이력서가 없을 때만 보여요. 공고 요약과 서류를 올리는 칸이 있고, 올리면 그 서류가 대표가 되어 바로 진단을 시작해요.
 * 주소로 바로 들어왔는데 대표 이력서가 있으면 그릴 것 없이 바로 진단해요.
 */

const TEXT = messages({
  ko: {
    title: '진단 시작',
    back: '새 진단 화면으로 돌아가기',
    required: '필수 역량',
    preferred: '우대 역량',
    deadline: (days: number) => (days === 0 ? '오늘 마감' : `마감 ${days}일 전`),
    always: '상시 채용',
    upload: '이력서를 올리면 바로 진단해요',
    openPosting: '원문 보기',
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
    upload: 'Upload a resume and we start right away',
    openPosting: 'Original',
    missing: "Couldn't find this posting.",
    missingBody: 'It may have closed or moved.',
    goHome: 'Pick another posting',
  },
})

interface Props {
  postingId: string
  onBack: () => void
  /** 리포트를 만들었어요. 리포트 화면으로 옮겨요. 뒤로 가기 기록에 이 화면을 남기지 않아요. */
  onReport: (id: string) => void
}

export function Diagnose({ postingId, onBack, onReport }: Props) {
  const L = useMessages(TEXT)
  const posting = postingOf(postingId)
  const resume = useResume()
  const [viewing, setViewing] = useState(false)
  const started = useRef(false)
  /** 진단을 시작하지 못했으면 true예요. 다시 시도 버튼을 보여줘요. */
  const [failed, setFailed] = useState(false)

  // 대표 이력서가 생기면(처음부터 있거나, 여기서 올렸거나) 한 번만 바로 진단해요.
  const ready = !!posting && !!resume && resume.skills.length > 0
  useEffect(() => {
    if (!ready || failed || started.current) return
    started.current = true
    void startDiagnosis(postingId).then((report) => {
      if (report === 'failed') {
        started.current = false
        setFailed(true)
        return
      }
      if (!report) return
      track('diagnose_start', { posting: postingId, reused: report.status === 'done' })
      onReport(report.id)
    })
  }, [ready, failed, postingId, onReport])

  if (!posting) {
    return (
      <main className={pageFrame}>
        <PageHeader title={L.title} onBack={onBack} backLabel={L.back} />
        <Notice title={L.missing} body={L.missingBody} action={L.goHome} onAction={onBack} className="mt-24" />
      </main>
    )
  }

  if (ready && failed) {
    return (
      <main className={pageFrame}>
        <PageHeader title={posting.title} onBack={onBack} backLabel={L.back} />
        <Failed onRetry={() => setFailed(false)} className="mt-24" />
      </main>
    )
  }

  // 바로 리포트로 넘어가는 동안은 빈 화면이에요. 리포트가 진행 막대를 보여줘요.
  if (ready) return <main className="flex-1" />

  const company = companyOf(posting.companyId)
  const left = daysLeft(posting)

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
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:-mx-10 md:px-10">
          <div className="mx-auto w-full max-w-[640px] animate-rise space-y-8">
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
                        <SkillChip key={skill} name={skill} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-gray-900">{L.upload}</h2>
              <div className="mt-3">
                <ResumeUploader />
              </div>
            </section>
          </div>
        </div>
      </main>
    </SplitView>
  )
}
