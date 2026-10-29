import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { track } from '../lib/analytics'
import { canonical, removeResume, saveResumeSkills, setPrimaryResume, uploadResume, useResumeShelf, type Resume, type ResumeSkill } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { canvas, pageFrame, PageHeader } from './AppPage'
import { ConfirmDialog, primaryButton } from './Dialog'
import { toolButton } from './DeepParts'
import { Panel, SkillChip, Tip } from './GapParts'
import { PlusIcon, StarIcon, TrashIcon } from './Icons'
import { Bone } from './Skeleton'

/**
 * 내 이력서 화면이에요. PDF나 GitHub, 노션 링크를 올리면 역량을 읽어 이름표로 보여주고, 잘못 읽은 것은 빼거나 더해요.
 * 올리는 칸(ResumeUploader)과 역량 고치는 칸(SkillEditor)은 진단 시작 화면도 같이 써요.
 */

const TEXT = messages({
  ko: {
    title: '내 이력서',
    intro: '이력서를 올려 주세요',
    introBody: '서류에서 역량을 읽어 두면, 공고마다 얼마나 맞는지 바로 보여줘요. 두 가지 방법 중 편한 쪽으로 올려요.',
    fileTitle: 'PDF 파일',
    fileBody: '이력서나 포트폴리오 PDF를 여기로 끌어다 놓거나 눌러서 골라요.',
    fileDrop: '여기에 놓으면 바로 읽어요',
    choose: 'PDF 고르기',
    linkTitle: 'GitHub나 노션 링크',
    linkBody: '레포나 포트폴리오 페이지의 주소를 붙여 넣어요.',
    linkPlaceholder: 'https://github.com/...',
    linkLabel: 'GitHub나 노션 링크',
    linkSubmit: '링크로 올리기',
    steps: ['서류를 올려요', '읽은 역량을 확인해요', '공고와 맞춰 봐요'],
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
    addDoc: '서류 올리기',
    cancel: '올리지 않고 돌아가기',
    shelfHint: '별을 누른 서류가 대표 이력서예요. 적합도와 추천 공고, 진단은 대표 이력서로 해요.',
    primary: '대표 이력서',
    makePrimary: '대표 이력서로 정하기',
    primaryTip: '적합도와 추천, 진단에 이 서류를 써요',
    primaryChanged: (name: string) => `${name}을(를) 대표 이력서로 정했어요.`,
    skillCount: (count: number) => `역량 ${count}개`,
    remove: '삭제',
    removeTitle: '이 서류를 지울까요?',
    removeBody: '올린 서류와 읽은 역량을 지워요. 리포트는 그대로 남아요.',
    removePrimaryBody: '대표 이력서예요. 지우면 남은 서류 중 가장 최근에 올린 것이 대표가 돼요. 리포트는 그대로 남아요.',
    removed: '서류를 지웠어요.',
    evidence: '근거',
    privacy: '서류는 이 기기와 내 계정에만 저장되고, 공고와 맞춰 보는 데만 써요.',
    browse: '이 이력서로 공고 보기',
    keep: '지금 서류 그대로 두기',
  },
  en: {
    title: 'My resume',
    intro: 'Upload your resume',
    introBody: 'Once we read the skills in your document, every posting shows how well you fit. Pick whichever way is easier.',
    fileTitle: 'PDF file',
    fileBody: 'Drop your resume or portfolio PDF here, or click to choose one.',
    fileDrop: 'Drop it here and we will read it',
    choose: 'Choose a PDF',
    linkTitle: 'GitHub or Notion link',
    linkBody: 'Paste the address of a repository or portfolio page.',
    linkPlaceholder: 'https://github.com/...',
    linkLabel: 'GitHub or Notion link',
    linkSubmit: 'Use link',
    steps: ['Upload a document', 'Check the skills we read', 'Compare with postings'],
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
    addDoc: 'Upload a document',
    cancel: 'Go back without uploading',
    shelfHint: 'The starred document is your main resume. Fit scores, recommendations and diagnoses all use it.',
    primary: 'Main resume',
    makePrimary: 'Make main resume',
    primaryTip: 'Fit, recommendations and diagnoses use this document',
    primaryChanged: (name: string) => `${name} is now your main resume.`,
    skillCount: (count: number) => `${count} ${count === 1 ? 'skill' : 'skills'}`,
    remove: 'Delete',
    removeTitle: 'Delete this document?',
    removeBody: 'This removes the document and the skills we read. Reports stay.',
    removePrimaryBody: 'This is your main resume. Once deleted, your most recent other document becomes the main one. Reports stay.',
    removed: 'Document deleted.',
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
      <div className={`rounded-2xl bg-gray-50 ${compact ? 'p-6' : 'p-8'}`} aria-busy="true">
        <p className="text-[13.5px] text-gray-500">{L.reading}</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-hidden>
          {['w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-32', 'w-16'].map((width, index) => (
            <Bone key={index} className={`h-7 rounded-md! ${width}`} />
          ))}
        </div>
      </div>
    )
  }

  // 올리는 방법 두 가지를 나란히 놓아요. PDF 칸은 전체가 눌리는 버튼이고, 파일을 이 칸 어디에 끌어 와도 받아요.
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={drop}
    >
      {!compact && (
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-gray-900">{L.intro}</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">{L.introBody}</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => takeFile(event.target.files?.[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`group flex flex-col items-start rounded-2xl border-2 border-dashed text-left transition-colors ${compact ? 'min-h-48 p-[22px]' : 'min-h-60 p-[30px]'} ${
            over ? 'border-brand bg-brand-soft' : 'border-transparent bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <span className={`flex size-12 items-center justify-center rounded-full bg-white transition-colors ${over ? 'text-brand' : 'text-gray-500 group-hover:text-brand'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
              <path d="M12 15.5v-10M8 9.5l4-4 4 4M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15" />
            </svg>
          </span>
          <span className="mt-4 text-[15px] font-semibold text-gray-900">{over ? L.fileDrop : L.fileTitle}</span>
          <span className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{L.fileBody}</span>
          <span className="mt-auto w-full pt-5">
            <span className={`${primaryButton} pointer-events-none flex h-10! w-full items-center justify-center rounded-lg!`}>{L.choose}</span>
          </span>
        </button>

        <form onSubmit={submitLink} noValidate className={`flex flex-col rounded-2xl bg-gray-50 ${compact ? 'min-h-48 p-6' : 'min-h-60 p-8'}`}>
          <span className="flex size-12 items-center justify-center rounded-full bg-white text-gray-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
              <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
            </svg>
          </span>
          <span className="mt-4 text-[15px] font-semibold text-gray-900">{L.linkTitle}</span>
          <span className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{L.linkBody}</span>
          <div className="mt-auto pt-5">
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
              className={`h-10 w-full rounded-lg border bg-white px-3 text-[13.5px] text-gray-900 outline-none placeholder:text-gray-400 ${invalid ? 'border-red-400' : 'border-gray-200 focus:border-brand'}`}
            />
            {invalid && <p className="mt-1.5 text-[12px] text-red-500">{L.invalidLink}</p>}
            <button type="submit" disabled={!link.trim()} className={`${toolButton} mt-2 h-10! w-full justify-center disabled:text-gray-400`}>
              {L.linkSubmit}
            </button>
          </div>
        </form>
      </div>
      {!compact && (
        <ol className="mt-6 grid grid-cols-3 gap-3">
          {L.steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2 text-[12.5px] text-gray-500">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** 읽은 역량을 고치는 칸이에요. 이름표를 누르면 숙련도가 오르고, X로 빼고, 아래 입력칸으로 더해요. 바꾸면 바로 저장해요. */
export function SkillEditor({ resume }: { resume: Resume }) {
  const L = useMessages(TEXT)
  const [draft, setDraft] = useState('')

  function save(skills: ResumeSkill[]) {
    saveResumeSkills(skills, resume.id)
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
  const shelf = useResumeShelf()
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Resume | null>(null)
  // 고른 서류가 없거나 지워졌으면 대표 서류를 보여줘요.
  const selected = shelf.list.find((resume) => resume.id === selectedId) ?? shelf.list.find((resume) => resume.id === shelf.primaryId) ?? shelf.list[0] ?? null
  const empty = shelf.list.length === 0

  function makePrimary(resume: Resume) {
    if (resume.id === shelf.primaryId) return
    setPrimaryResume(resume.id)
    track('resume_primary_change', { count: shelf.list.length })
    showToast(pick(TEXT).primaryChanged(resume.name))
  }

  return (
    <main className={pageFrame}>
      <PageHeader
        title={L.title}
        actions={
          !empty && !adding ? (
            <button type="button" onClick={() => setAdding(true)} className={toolButton}>
              <PlusIcon className="size-3.5" />
              {L.addDoc}
            </button>
          ) : undefined
        }
      />
      <div className={canvas}>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-6 md:px-10">
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
            {empty || adding ? (
              <>
                <ResumeUploader
                  onDone={(resume) => {
                    setAdding(false)
                    setSelectedId(resume.id)
                  }}
                />
                {!empty && (
                  <button type="button" onClick={() => setAdding(false)} className="self-center text-[13px] text-gray-500 transition-colors hover:text-gray-900">
                    {L.cancel}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-[13px] text-gray-500">{L.shelfHint}</p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shelf.list.map((resume) => (
                    <ResumeCard
                      key={resume.id}
                      resume={resume}
                      primary={resume.id === shelf.primaryId}
                      selected={resume.id === selected?.id}
                      onSelect={() => setSelectedId(resume.id)}
                      onPrimary={() => makePrimary(resume)}
                    />
                  ))}
                </ul>
                {selected && (
                  <>
                    <Panel>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-gray-900">{selected.name}</p>
                          <p className="mt-0.5 text-[12.5px] text-gray-400">
                            {L.sources[selected.source]}, {L.uploadedAt(formatDateTime(selected.uploadedAt))}
                          </p>
                        </div>
                        <button type="button" onClick={() => setRemoving(selected)} className={`${toolButton} text-red-500! hover:border-red-200!`}>
                          <TrashIcon className="size-4" />
                          {L.remove}
                        </button>
                        {selected.id === shelf.primaryId ? (
                          <button type="button" onClick={onExplore} className={primaryButton}>
                            {L.browse}
                          </button>
                        ) : (
                          <button type="button" onClick={() => makePrimary(selected)} className={primaryButton}>
                            {L.makePrimary}
                          </button>
                        )}
                      </div>
                    </Panel>
                    <Panel title={L.skills}>
                      <SkillEditor resume={selected} />
                    </Panel>
                    <Panel title={L.paragraphs} action={<span className="text-[12px] text-gray-400">{L.paragraphsHint}</span>}>
                      <ol className="space-y-3">
                        {selected.paragraphs.map((paragraph, index) => (
                          <li key={index} className="flex gap-3 text-[13.5px] leading-relaxed text-gray-700">
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-gray-600 tabular-nums">{index + 1}</span>
                            {paragraph}
                          </li>
                        ))}
                      </ol>
                    </Panel>
                  </>
                )}
              </>
            )}
            <p className="text-center text-[12px] text-gray-400">{L.privacy}</p>
          </div>
        </div>
      </div>
      {removing && (
        <ConfirmDialog
          title={L.removeTitle}
          body={removing.id === shelf.primaryId ? L.removePrimaryBody : L.removeBody}
          confirm={L.remove}
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeResume(removing.id)
            track('resume_delete')
            setRemoving(null)
            showToast(pick(TEXT).removed)
          }}
        />
      )}
    </main>
  )
}

/** 올려 둔 서류 하나의 카드예요. 누르면 아래에 그 서류의 역량과 문단을 보여주고, 별을 누르면 대표 이력서로 정해요. */
function ResumeCard({ resume, primary, selected, onSelect, onPrimary }: { resume: Resume; primary: boolean; selected: boolean; onSelect: () => void; onPrimary: () => void }) {
  const L = useMessages(TEXT)
  return (
    // 안쪽 별 버튼과 겹치지 않게, 카드(li)가 직접 클릭을 받아요. 공고 탐색의 카드와 같아요.
    <li
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`group flex cursor-pointer flex-col rounded-2xl p-5 transition-colors ${selected ? 'bg-gray-200/60' : 'bg-gray-50 hover:bg-gray-100'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-white px-2 text-[11px] font-semibold text-gray-600">{L.sources[resume.source]}</span>
        <Tip text={primary ? L.primaryTip : L.makePrimary}>
          <button
            type="button"
            aria-label={primary ? L.primary : L.makePrimary}
            aria-pressed={primary}
            onClick={(event) => {
              event.stopPropagation()
              onPrimary()
            }}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${primary ? 'text-brand' : 'text-gray-300 hover:bg-white hover:text-gray-500'}`}
          >
            <StarIcon filled={primary} className="size-[18px]" />
          </button>
        </Tip>
      </div>
      <button type="button" onClick={onSelect} className="mt-3 truncate text-left text-[14.5px] font-semibold text-gray-900 group-hover:text-brand">
        {resume.name}
      </button>
      <p className="mt-0.5 text-[12px] text-gray-400">
        {primary && <span className="font-medium text-brand">{L.primary}, </span>}
        {formatDateTime(resume.uploadedAt)}, {L.skillCount(resume.skills.length)}
      </p>
      <ul className="mt-4 flex flex-wrap gap-1">
        {resume.skills.slice(0, 4).map((skill) => (
          <li key={skill.name} className="rounded-md bg-white px-2 py-0.5 text-[12px] text-gray-600">
            {skill.name}
          </li>
        ))}
      </ul>
    </li>
  )
}
