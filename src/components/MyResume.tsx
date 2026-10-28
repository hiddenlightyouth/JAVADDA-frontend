import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { track } from '../lib/analytics'
import { canonical, clearResume, saveResumeSkills, uploadResume, useResume, type Resume, type ResumeSkill } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { canvas, pageFrame, PageHeader } from './AppPage'
import { ConfirmDialog, primaryButton } from './Dialog'
import { toolButton } from './DeepParts'
import { Panel, SkillChip } from './GapParts'
import { PlusIcon, TrashIcon } from './Icons'
import { Bone } from './Skeleton'

/**
 * 내 이력서 화면이에요. PDF나 GitHub, 노션 링크를 올리면 역량을 읽어 이름표로 보여주고, 잘못 읽은 것은 빼거나 더해요.
 * 올리는 칸(ResumeUploader)과 역량 고치는 칸(SkillEditor)은 진단 시작 화면도 같이 써요.
 */

const TEXT = messages({
  ko: {
    title: '내 이력서',
    dropTitle: '이력서나 포트폴리오를 올려 주세요',
    dropBody: 'PDF 파일을 여기에 끌어다 놓거나, 아래에 GitHub나 노션 링크를 붙여 넣어요.',
    choose: 'PDF 고르기',
    or: '또는',
    linkPlaceholder: 'https://github.com/... 또는 https://notion.so/...',
    linkLabel: 'GitHub나 노션 링크',
    linkSubmit: '링크로 올리기',
    invalidLink: '올바른 링크가 맞는지 확인해 주세요',
    onlyPdf: 'PDF 파일만 올릴 수 있어요.',
    reading: '서류를 읽고 있어요. 역량을 뽑는 데 몇 초 걸려요.',
    uploaded: '서류를 읽었어요. 뽑은 역량을 확인해 주세요.',
    sources: { pdf: 'PDF', github: 'GitHub', notion: '노션' } as Record<Resume['source'], string>,
    uploadedAt: (when: string) => `${when}에 올림`,
    skills: '서류에서 읽은 역량',
    skillsHint: '숙련도는 1부터 5까지예요. 이름표를 누르면 숙련도가 한 단계 올라가고, 5에서는 1로 돌아가요. 잘못 읽었으면 X로 빼요.',
    addPlaceholder: '역량 더하기',
    add: '더하기',
    saved: '역량을 저장했어요.',
    paragraphs: '읽은 문단',
    paragraphsHint: '서류 검증과 예상 질문에 이 문단을 써요.',
    replace: '다른 서류 올리기',
    remove: '삭제',
    removeTitle: '이력서를 지울까요?',
    removeBody: '올린 서류와 읽은 역량을 지워요. 리포트는 그대로 남지만, 새 진단과 추천 공고에는 다시 올려야 해요.',
    removed: '이력서를 지웠어요.',
    evidence: '근거',
    privacy: '서류는 이 기기와 내 계정에만 저장되고, 공고와 맞춰 보는 데만 써요.',
    browse: '이 이력서로 공고 보기',
    keep: '지금 서류 그대로 두기',
  },
  en: {
    title: 'My resume',
    dropTitle: 'Upload your resume or portfolio',
    dropBody: 'Drop a PDF here, or paste a GitHub or Notion link below.',
    choose: 'Choose a PDF',
    or: 'or',
    linkPlaceholder: 'https://github.com/... or https://notion.so/...',
    linkLabel: 'GitHub or Notion link',
    linkSubmit: 'Use link',
    invalidLink: 'Please check that the link is correct',
    onlyPdf: 'Only PDF files are supported.',
    reading: 'Reading your document. Extracting skills takes a few seconds.',
    uploaded: 'Done. Please check the skills we found.',
    sources: { pdf: 'PDF', github: 'GitHub', notion: 'Notion' },
    uploadedAt: (when: string) => `Uploaded ${when}`,
    skills: 'Skills found in your document',
    skillsHint: 'Levels go from 1 to 5. Tap a chip to raise the level by one, and it wraps back to 1 after 5. Remove anything we got wrong with the X.',
    addPlaceholder: 'Add a skill',
    add: 'Add',
    saved: 'Skills saved.',
    paragraphs: 'Paragraphs we read',
    paragraphsHint: 'The document check and likely questions use these paragraphs.',
    replace: 'Upload a different document',
    remove: 'Delete',
    removeTitle: 'Delete your resume?',
    removeBody: 'This removes the uploaded document and the skills we read. Reports stay, but new diagnoses and recommendations need a new upload.',
    removed: 'Resume deleted.',
    evidence: 'Evidence',
    privacy: 'Your document stays on this device and in your account, and is only used to compare against postings.',
    browse: 'Browse jobs with this resume',
    keep: 'Keep the current document',
  },
})

const LINK = /^https?:\/\/(?:www\.)?(?:github\.com|notion\.so|[\w-]+\.notion\.site)\/\S+/i

/** 서류를 올리는 칸이에요. PDF 끌어다 놓기와 링크 두 가지를 받아요. 올리면 onDone으로 알려줘요. */
export function ResumeUploader({ onDone, compact = false }: { onDone?: (resume: Resume) => void; compact?: boolean }) {
  const L = useMessages(TEXT)
  const [working, setWorking] = useState(false)
  const [over, setOver] = useState(false)
  const [link, setLink] = useState('')
  const [invalid, setInvalid] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(input: { file?: File; link?: string }) {
    setWorking(true)
    const resume = await uploadResume(input)
    setWorking(false)
    track('resume_upload', { source: resume.source, skills: resume.skills.length })
    showToast(pick(TEXT).uploaded)
    onDone?.(resume)
  }

  function takeFile(file: File | undefined) {
    if (!file) return
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      showToast(pick(TEXT).onlyPdf)
      return
    }
    void upload({ file })
  }

  function drop(event: DragEvent) {
    event.preventDefault()
    setOver(false)
    takeFile(event.dataTransfer.files[0])
  }

  function submitLink(event: FormEvent) {
    event.preventDefault()
    const value = link.trim()
    if (!LINK.test(value)) {
      setInvalid(true)
      return
    }
    void upload({ link: value })
  }

  if (working) {
    return (
      <div className="rounded-2xl bg-gray-50 p-6" aria-busy="true">
        <p className="text-[13.5px] text-gray-500">{L.reading}</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-hidden>
          {['w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-32', 'w-16'].map((width, index) => (
            <Bone key={index} className={`h-7 rounded-md! ${width}`} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={`rounded-2xl border border-dashed bg-white transition-colors ${over ? 'border-brand bg-brand-soft' : 'border-gray-300'} ${compact ? 'p-6' : 'p-10'}`}
    >
      <div className="flex flex-col items-center text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-8 text-gray-300" aria-hidden="true">
          <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z" />
          <path d="M14 3.5v4h4M12 16.5v-6M9.5 13 12 10.5l2.5 2.5" />
        </svg>
        <p className="mt-3 text-[15px] font-semibold text-gray-900">{L.dropTitle}</p>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-gray-500">{L.dropBody}</p>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => takeFile(event.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} className={`${primaryButton} mt-4`}>
          {L.choose}
        </button>
      </div>
      <div className="my-5 flex items-center gap-3 text-[12px] text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        {L.or}
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <form onSubmit={submitLink} noValidate className="flex gap-2">
        <input
          type="url"
          value={link}
          onChange={(event) => {
            setLink(event.target.value)
            setInvalid(false)
          }}
          placeholder={L.linkPlaceholder}
          aria-label={L.linkLabel}
          aria-invalid={invalid}
          className={`h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-[13.5px] text-gray-900 outline-none placeholder:text-gray-400 ${invalid ? 'border-red-400' : 'border-gray-200 focus:border-brand'}`}
        />
        <button type="submit" disabled={!link.trim()} className={`${toolButton} shrink-0 disabled:text-gray-400`}>
          {L.linkSubmit}
        </button>
      </form>
      {invalid && <p className="mt-1.5 text-[12px] text-red-500">{L.invalidLink}</p>}
    </div>
  )
}

/** 읽은 역량을 고치는 칸이에요. 이름표를 누르면 숙련도가 오르고, X로 빼고, 아래 입력칸으로 더해요. 바꾸면 바로 저장해요. */
export function SkillEditor({ resume }: { resume: Resume }) {
  const L = useMessages(TEXT)
  const [draft, setDraft] = useState('')

  function save(skills: ResumeSkill[]) {
    saveResumeSkills(skills)
    track('resume_skills_edit', { count: skills.length })
  }

  function add(event: FormEvent) {
    event.preventDefault()
    const name = canonical(draft)
    if (!name || resume.skills.some((skill) => skill.name === name)) {
      setDraft('')
      return
    }
    save([...resume.skills, { name, level: 3, evidence: '직접 더한 역량이에요.' }])
    setDraft('')
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-1.5">
        {resume.skills.map((skill) => (
          <li key={skill.name} className="relative flex items-center">
            <SkillChip
              name={skill.name}
              hint={`Lv.${skill.level}`}
              tone={skill.level >= 3 ? 'met' : 'partial'}
              onClick={() => save(resume.skills.map((item) => (item.name === skill.name ? { ...item, level: item.level >= 5 ? 1 : item.level + 1 } : item)))}
            />
            <button
              type="button"
              aria-label={`${skill.name} ${L.remove}`}
              onClick={() => save(resume.skills.filter((item) => item.name !== skill.name))}
              className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 transition-colors hover:text-gray-900"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-2" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={L.addPlaceholder}
          aria-label={L.addPlaceholder}
          className="h-9 w-48 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand"
        />
        <button type="submit" disabled={!draft.trim()} className={`${toolButton} disabled:text-gray-400`}>
          <PlusIcon className="size-3.5" />
          {L.add}
        </button>
      </form>
      <p className="mt-2.5 text-[12px] leading-relaxed text-gray-400">{L.skillsHint}</p>
    </div>
  )
}

export function MyResume({ onExplore }: { onExplore: () => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const [replacing, setReplacing] = useState(false)
  const [removing, setRemoving] = useState(false)

  return (
    <main className={pageFrame}>
      <PageHeader
        title={L.title}
        actions={
          resume && !replacing ? (
            <>
              <button type="button" onClick={() => setRemoving(true)} className={`${toolButton} text-red-500! hover:border-red-200!`}>
                <TrashIcon className="size-4" />
                {L.remove}
              </button>
              <button type="button" onClick={() => setReplacing(true)} className={toolButton}>
                <PlusIcon className="size-3.5" />
                {L.replace}
              </button>
            </>
          ) : undefined
        }
      />
      <div className={canvas}>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-6 md:px-10">
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
            {!resume || replacing ? (
              <>
                <ResumeUploader onDone={() => setReplacing(false)} />
                {resume && (
                  <button type="button" onClick={() => setReplacing(false)} className="self-center text-[13px] text-gray-500 transition-colors hover:text-gray-900">
                    {L.keep}
                  </button>
                )}
              </>
            ) : (
              <>
                <Panel>
                  <div className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-[11.5px] font-semibold text-gray-600">{L.sources[resume.source]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-gray-900">{resume.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-gray-400">{L.uploadedAt(formatDateTime(resume.uploadedAt))}</p>
                    </div>
                    <button type="button" onClick={onExplore} className={primaryButton}>
                      {L.browse}
                    </button>
                  </div>
                </Panel>
                <Panel title={L.skills}>
                  <SkillEditor resume={resume} />
                </Panel>
                <Panel title={L.paragraphs} action={<span className="text-[12px] text-gray-400">{L.paragraphsHint}</span>}>
                  <ol className="space-y-3">
                    {resume.paragraphs.map((paragraph, index) => (
                      <li key={index} className="flex gap-3 text-[13.5px] leading-relaxed text-gray-700">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-600 tabular-nums">{index + 1}</span>
                        {paragraph}
                      </li>
                    ))}
                  </ol>
                </Panel>
              </>
            )}
            <p className="text-center text-[12px] text-gray-400">{L.privacy}</p>
          </div>
        </div>
      </div>
      {removing && resume && (
        <ConfirmDialog
          title={L.removeTitle}
          body={L.removeBody}
          confirm={L.remove}
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            clearResume()
            track('resume_delete')
            setRemoving(false)
            showToast(pick(TEXT).removed)
          }}
        />
      )}
    </main>
  )
}
