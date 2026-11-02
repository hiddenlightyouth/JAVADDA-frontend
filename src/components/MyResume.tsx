import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { track } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import { axisOf, canonical, PROGRESS_START, removeResume, requestLogin, suggestSkills, saveResumeSkills, setPrimaryResume, uploadResume, useResumeShelf, type ProgressState, type Resume, type ResumeSkill } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { canvas, pageFrame, PageHeader } from './AppPage'
import { ConfirmDialog, panelBody, SidePanel } from './Dialog'
import { AiProgress, Notice, SkillChip, Tip } from './GapParts'
import { GitHubMark } from './Social'
import { ChevronRightIcon, CloseIcon, PlusIcon, StarIcon, TrashIcon, UploadIcon } from './Icons'
import { Badge, menuPanel, NumberedList, primaryButton, textFieldSm, toolButton, toolDangerButton } from './ui'

/**
 * 내 이력서 화면이에요. 이력서나 포트폴리오 PDF를 올리면 역량을 읽어 이름표로 보여주고, 잘못 읽은 것은 빼거나 더해요.
 * 올리는 칸(ResumeUploader)과 역량 고치는 칸(SkillEditor)은 진단 시작 화면도 같이 써요.
 */

const TEXT = messages({
  ko: {
    title: '내 이력서',
    fileTitle: 'PDF를 끌어다 놓으세요',
    fileBody: '이력서나 포트폴리오 PDF, 10MB까지 올릴 수 있어요.',
    fileDrop: '여기에 놓으면 바로 읽어요',
    choose: 'PDF 고르기',
    onlyPdf: 'PDF 파일만 올릴 수 있어요.',
    uploaded: '서류를 읽었어요. 뽑은 역량을 확인해 주세요.',
    sources: { pdf: 'PDF', github: 'GitHub', notion: '노션' } as Record<Resume['source'], string>,
    uploadedAt: (when: string) => `${when}에 업로드 됨`,
    skills: '내 역량',
    addPlaceholder: '역량 더하기',
    add: '더하기',
    paragraphs: '주요 경력',
    addDoc: '서류 추가',
    uploadTitle: '이력서 또는 포트폴리오 업로드',
    uploadBody: '가지고 있는 이력서나 포트폴리오 PDF를 올리면 역량을 읽어요.',
    generateTitle: 'GitHub Repository로 이력서와 포트폴리오 생성하기',
    generateBody: '레포지토리의 코드와 기록을 읽어 이력서와 포트폴리오를 만들어 드려요.',
    soon: '준비 중',
    start: '시작하기',
    otherWay: '다른 방법 고르기',
    addTitle: '서류 추가',
    emptyTitle: '아직 올린 이력서가 없어요',
    emptyBody: '이력서나 포트폴리오를 올려 두면 공고마다 얼마나 맞는지 보여줘요. 여러 개 올리고 하나를 대표로 정할 수 있어요.',
    close: '닫기',
    primary: '대표 이력서',
    makePrimary: '대표 이력서로 정하기',
    primaryTip: '적합도와 추천, 진단에 이 서류를 써요',
    primaryChanged: (name: string) => `${name}을(를) 대표 이력서로 정했어요.`,
    remove: '삭제',
    removeTitle: '이 서류를 지울까요?',
    removeBody: '올린 서류와 읽은 역량을 지워요. 리포트는 그대로 남아요.',
    removePrimaryBody: '대표 이력서예요. 지우면 남은 서류 중 가장 최근에 올린 것이 대표가 돼요. 리포트는 그대로 남아요.',
    removed: '서류를 지웠어요.',
    browse: '이 이력서로 공고 보기',
  },
  en: {
    title: 'My resume',
    fileTitle: 'Drop a PDF here',
    fileBody: 'A resume or portfolio PDF, up to 10MB.',
    fileDrop: 'Drop it here and we will read it',
    choose: 'Choose a PDF',
    onlyPdf: 'Only PDF files are supported.',
    uploaded: 'Done. Please check the skills we found.',
    sources: { pdf: 'PDF', github: 'GitHub', notion: 'Notion' },
    uploadedAt: (when: string) => `Uploaded ${when}`,
    skills: 'My skills',
    addPlaceholder: 'Add a skill',
    add: 'Add',
    paragraphs: 'Key experience',
    addDoc: 'Add document',
    uploadTitle: 'Upload a resume or portfolio',
    uploadBody: 'Upload your resume or portfolio PDF and we will read your skills.',
    generateTitle: 'Create a resume and portfolio from a GitHub repository',
    generateBody: 'We read the code and history of your repository and write a resume and portfolio for you.',
    soon: 'Coming soon',
    start: 'Get started',
    otherWay: 'Choose another way',
    addTitle: 'Add a document',
    emptyTitle: 'No resumes yet',
    emptyBody: 'Upload a resume or portfolio to see how well you fit each posting. You can keep several and pick one as your main resume.',
    close: 'Close',
    primary: 'Main resume',
    makePrimary: 'Make main resume',
    primaryTip: 'Fit, recommendations and diagnoses use this document',
    primaryChanged: (name: string) => `${name} is now your main resume.`,
    remove: 'Delete',
    removeTitle: 'Delete this document?',
    removeBody: 'This removes the document and the skills we read. Reports stay.',
    removePrimaryBody: 'This is your main resume. Once deleted, your most recent other document becomes the main one. Reports stay.',
    removed: 'Document deleted.',
    browse: 'Browse jobs with this resume',
  },
})

/** 서류를 올리는 칸이에요. PDF를 끌어다 놓거나 눌러서 골라요. 올리면 onDone으로 알려줘요. */
/** 서류 추가를 열면 먼저 고르는 두 방법이에요. 올리기와, 아직 준비 중인 GitHub 레포지토리로 만들기예요. */
function AddChoice({ onUpload }: { onUpload: () => void }) {
  const L = useMessages(TEXT)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button type="button" onClick={onUpload} className="group flex min-h-60 flex-col items-start rounded-2xl bg-gray-50 p-7 text-left transition-colors hover:bg-gray-100">
        <span className="flex size-14 items-center justify-center rounded-full bg-white text-gray-500 transition-colors group-hover:text-brand">
          <UploadIcon className="size-6" strokeWidth={1.2} />
        </span>
        <span className="mt-6 text-[17px] font-semibold text-gray-900 transition-colors group-hover:text-brand">{L.uploadTitle}</span>
        <span className="mt-2 text-[13.5px] leading-relaxed text-gray-500">{L.uploadBody}</span>
        <span className="mt-auto flex items-center gap-1 pt-6 text-[13px] font-medium text-gray-500 transition-colors group-hover:text-brand">
          {L.start}
          <ChevronRightIcon className="size-3.5 shrink-0" />
        </span>
      </button>
      <div aria-disabled className="flex min-h-60 flex-col items-start rounded-2xl bg-gray-50 p-7">
        <span className="flex size-14 items-center justify-center rounded-full bg-white text-gray-400">
          <GitHubMark className="size-6" />
        </span>
        <span className="mt-6 text-[17px] font-semibold text-gray-400">{L.generateTitle}</span>
        <span className="mt-2 text-[13.5px] leading-relaxed text-gray-400">{L.generateBody}</span>
        <span className="mt-auto pt-6">
          <Badge tone="white">{L.soon}</Badge>
        </span>
      </div>
    </div>
  )
}

export function ResumeUploader({ onDone, onWorking }: {
  onDone?: (resume: Resume) => void
  /** 읽기 시작하고 끝날 때 알려요. 창이 그동안 닫히지 않게 할 때 써요. */
  onWorking?: (working: boolean) => void
}) {
  const L = useMessages(TEXT)
  /** 올리는 동안의 진행 상황과 올리는 것의 이름이에요. 올리지 않을 때는 null이에요. */
  const [working, setWorking] = useState<(ProgressState & { name: string }) | null>(null)
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(input: { file: File }) {
    const name = input.file.name
    setWorking({ ...PROGRESS_START, name })
    onWorking?.(true)
    const resume = await uploadResume(input, (progress) => setWorking({ ...progress, name }))
    setWorking(null)
    onWorking?.(false)
    // 로그인하지 않았으면 로그인 화면으로 갔고, 실패했으면 토스트로 알렸어요.
    if (!resume) return
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

  // 읽는 동안은 서버가 알려 주는 진행 정도를 막대로 보여줘요. 위에 올린 파일 이름을 작게 적어요.
  if (working) {
    return (
      <div className="rounded-2xl bg-gray-50 p-6">
        <AiProgress progress={working.progress} stage={working.stage} title={working.name} />
      </div>
    )
  }

  // PDF를 끌어다 놓는 큰 칸이에요. 칸 어디를 눌러도 파일을 골라요.
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
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => takeFile(event.target.files?.[0])} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`group flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          over ? 'border-brand bg-brand-soft' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        }`}
      >
        <span className={`flex size-12 items-center justify-center rounded-full bg-white transition-colors ${over ? 'text-brand' : 'text-gray-500 group-hover:text-brand'}`}>
          <UploadIcon className="size-6" strokeWidth={1} />
        </span>
        <span className="mt-4 text-[15px] font-semibold text-gray-900">{over ? L.fileDrop : L.fileTitle}</span>
        <span className="mt-1 text-[13px] leading-relaxed text-gray-500">{L.fileBody}</span>
        <span className={`${primaryButton} pointer-events-none mt-5`}>{L.choose}</span>
      </button>
    </div>
  )
}

/** 읽은 역량을 고치는 칸이에요. 이름표를 누르면 숙련도가 오르고, X로 빼고, 아래 입력칸으로 더해요. 바꾸면 바로 저장해요. */
function SkillEditor({ resume }: { resume: Resume }) {
  const L = useMessages(TEXT)
  const [draft, setDraft] = useState('')
  /** 친 글자에 맞는 스킬 목록을 펼쳐 둘지. 고르거나 Esc를 누르면 접어요. */
  const [listing, setListing] = useState(false)
  /** 방향키로 고른 추천 스킬의 순서. 고른 게 없으면 -1이에요. */
  const [active, setActive] = useState(-1)
  const owned = useMemo(() => resume.skills.map((skill) => skill.name), [resume.skills])
  const suggestions = useMemo(() => suggestSkills(draft, owned), [draft, owned])
  const showList = listing && suggestions.length > 0

  function save(skills: ResumeSkill[]) {
    saveResumeSkills(skills, resume.id)
    track('resume_skills_edit', { count: skills.length })
  }

  function addSkill(value: string) {
    const name = canonical(value)
    setDraft('')
    setActive(-1)
    setListing(false)
    if (!name || resume.skills.some((skill) => skill.name === name)) return
    save([...resume.skills, { name, level: 3, evidence: '직접 더한 역량이에요.' }])
  }

  // 방향키로 고른 스킬이 있으면 그걸, 없으면 친 글자 그대로 더해요.
  function add(event: FormEvent) {
    event.preventDefault()
    addSkill(showList && active >= 0 ? suggestions[active] : draft)
  }

  /** 추천 스킬이 보일 때 위아래 방향키로 옮겨 다니고, Esc로 접어요. 새 진단 검색창과 같아요. */
  function moveActive(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && showList) {
      // 바깥의 상세 칸까지 같이 닫히지 않게 여기서 멈춰요.
      event.nativeEvent.stopImmediatePropagation()
      setListing(false)
      return
    }
    if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || suggestions.length === 0) return
    event.preventDefault()
    setListing(true)
    const last = suggestions.length - 1
    if (event.key === 'ArrowDown') setActive((index) => (index >= last ? 0 : index + 1))
    else setActive((index) => (index <= 0 ? last : index - 1))
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
              <CloseIcon className="size-2" strokeWidth={1.8} />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <div className="relative w-56">
          <input
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setActive(-1)
              setListing(true)
            }}
            onKeyDown={moveActive}
            onBlur={() => setListing(false)}
            onFocus={() => setListing(true)}
            placeholder={L.addPlaceholder}
            aria-label={L.addPlaceholder}
            role="combobox"
            aria-expanded={showList}
            aria-controls="skill-suggestions"
            aria-activedescendant={showList && active >= 0 ? `skill-suggestion-${active}` : undefined}
            autoComplete="off"
            className={textFieldSm}
          />
          {showList && (
            <ul id="skill-suggestions" role="listbox" className={`absolute top-full left-0 z-20 mt-1.5 max-h-64 w-full origin-top overflow-y-auto ${menuPanel}`}>
              {suggestions.map((name, index) => (
                <li
                  key={name}
                  id={`skill-suggestion-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // 누르는 동안 입력칸의 포커스가 빠져 목록이 먼저 닫히지 않게 막아요.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addSkill(name)}
                  onMouseMove={() => index !== active && setActive(index)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-900 ${index === active ? 'bg-gray-100' : ''}`}
                >
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 text-[11.5px] text-gray-400">{axisOf(name)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" disabled={!draft.trim()} className={toolButton}>
          <PlusIcon className="size-3.5" />
          {L.add}
        </button>
      </form>
    </div>
  )
}

/** 서류 추가 화면을 목록에서 열었는지예요. 그랬으면 닫을 때 뒤로 가서, 뒤로 가기 기록에 목록이 두 번 쌓이지 않아요. */
let addFromList = false

export function MyResume({ add, onAdd, onList, onExplore }: { add: boolean; onAdd: () => void; onList: () => void; onExplore: () => void }) {
  const L = useMessages(TEXT)
  const shelf = useResumeShelf()
  /** 서류 추가 화면은 먼저 올릴지 만들지 고르고(choose), 올리기를 고르면 올리는 칸(upload)이 나와요. */
  const [step, setStep] = useState<'choose' | 'upload'>('choose')
  /** 서류를 읽는 동안이에요. 그동안은 서류 추가 화면을 떠날 수 없어요. */
  const [uploading, setUploading] = useState(false)
  const signedIn = useAuth().tokens !== null
  const [openId, setOpenId] = useState<string | null>(null)
  const open = shelf.list.find((resume) => resume.id === openId) ?? null

  /** 서류는 계정에 저장돼서, 로그인하지 않았으면 서류 추가 화면 대신 로그인 화면으로 가요. */
  const addDocument = () => {
    if (!signedIn) return requestLogin()
    addFromList = true
    onAdd()
  }
  const backToList = () => {
    if (addFromList) window.history.back()
    else onList()
    addFromList = false
  }
  // 주소로 서류 추가 화면에 바로 들어왔는데 로그인하지 않았으면 로그인 화면으로 가요.
  useEffect(() => {
    if (add && !signedIn) requestLogin()
  }, [add, signedIn])
  // 서류 추가 화면에 들어올 때마다 고르는 단계부터예요.
  useEffect(() => {
    if (add) setStep('choose')
    else addFromList = false
  }, [add])

  function makePrimary(resume: Resume) {
    if (resume.id === shelf.primaryId) return
    setPrimaryResume(resume.id)
    track('resume_primary_change', { count: shelf.list.length })
    showToast(pick(TEXT).primaryChanged(resume.name))
  }

  // 서류 추가는 따로 한 화면이에요(/resume/new). 올리기를 고르면 같은 화면에서 올리는 칸으로 넘어가고, 뒤로 가기로 고르는 단계에 돌아와요.
  if (add) {
    return (
      <main className={pageFrame}>
        <PageHeader
          title={L.addTitle}
          // 읽는 동안 떠나면 결과를 볼 곳이 없어서, 뒤로 가기를 숨겨 둬요.
          onBack={uploading ? undefined : step === 'upload' ? () => setStep('choose') : backToList}
          backLabel={step === 'upload' ? L.otherWay : L.title}
        />
        <div className={canvas}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10">
            <div className="max-w-3xl">
              {step === 'choose' ? (
                <AddChoice onUpload={() => setStep('upload')} />
              ) : (
                <ResumeUploader
                  onWorking={setUploading}
                  onDone={(resume) => {
                    // 다 읽으면 목록으로 돌아가서 그 서류의 상세 칸을 열어요.
                    setOpenId(resume.id)
                    backToList()
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={pageFrame}>
      <PageHeader
        title={L.title}
        actions={
          <button type="button" onClick={addDocument} className={primaryButton}>
            <PlusIcon className="size-3.5" />
            {L.addDoc}
          </button>
        }
      />
      <div className={canvas}>
        {/* 공고 탐색처럼 제목 줄과 같은 폭으로 늘어놓고, 칸 수는 목록 폭을 보고 정해요. */}
        <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10">
          {shelf.list.length === 0 ? (
            <Notice title={L.emptyTitle} body={L.emptyBody} action={L.addDoc} onAction={addDocument} className="mt-16" />
          ) : (
            <ul className="grid gap-4 @2xl:grid-cols-2 @6xl:grid-cols-3">
              {shelf.list.map((resume) => (
                <ResumeCard
                  key={resume.id}
                  resume={resume}
                  primary={resume.id === shelf.primaryId}
                  selected={resume.id === openId}
                  onSelect={() => setOpenId(resume.id)}
                  onPrimary={() => makePrimary(resume)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      {open && (
        <ResumeSheet
          resume={open}
          primary={open.id === shelf.primaryId}
          onPrimary={() => makePrimary(open)}
          onExplore={onExplore}
          onClose={() => setOpenId(null)}
        />
      )}
    </main>
  )
}

/** 서류 하나를 오른쪽에서 열어 보는 칸이에요. 역량을 고치고 읽은 문단을 보고, 대표로 정하거나 지워요. 갭 상세 칸과 같은 모양이에요. */
function ResumeSheet({ resume, primary, onPrimary, onExplore, onClose }: { resume: Resume; primary: boolean; onPrimary: () => void; onExplore: () => void; onClose: () => void }) {
  const L = useMessages(TEXT)
  const [removing, setRemoving] = useState(false)

  return (
    <>
      {/* 지울지 묻는 창이 떠 있는 동안에는 그 창이 먼저라 칸을 닫지 않아요. */}
      <SidePanel
        onClose={onClose}
        closeLabel={L.close}
        labelledBy="resume-sheet-title"
        dismissable={!removing}
        closeOnOutside={false}
        className="max-w-[480px]"
        header={
          <>
            <h2 id="resume-sheet-title" className="truncate text-[20px] font-semibold text-gray-900">
              {resume.name}
            </h2>
            <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-gray-500">
              <Badge tone="gray" strong>{L.sources[resume.source]}</Badge>
              {L.uploadedAt(formatDateTime(resume.uploadedAt))}
            </p>
          </>
        }
      >
        <div className={panelBody}>
          <section>
            <h3 className="text-[13.5px] font-semibold text-gray-900">{L.skills}</h3>
            <div className="mt-3">
              <SkillEditor resume={resume} />
            </div>
          </section>
          <section className="mt-8">
            <h3 className="text-[13.5px] font-semibold text-gray-900">{L.paragraphs}</h3>
            <NumberedList items={resume.paragraphs} className="mt-3" />
          </section>
        </div>
        <div className="flex items-center gap-2 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={() => setRemoving(true)} className={toolDangerButton}>
            <TrashIcon className="size-4" />
            {L.remove}
          </button>
          <span className="flex-1" />
          {primary ? (
            <button type="button" onClick={onExplore} className={primaryButton}>
              {L.browse}
            </button>
          ) : (
            <button type="button" onClick={onPrimary} className={primaryButton}>
              {L.makePrimary}
            </button>
          )}
        </div>
      </SidePanel>
      {removing && (
        <ConfirmDialog
          title={L.removeTitle}
          body={primary ? L.removePrimaryBody : L.removeBody}
          confirm={L.remove}
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            removeResume(resume.id)
            track('resume_delete')
            showToast(pick(TEXT).removed)
            onClose()
          }}
        />
      )}
    </>
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
      {/* 이름 버튼은 키보드로 고르는 자리예요. 누르면 카드(li)까지 올라가서 거기서 열어요. */}
      <button type="button" className="mt-3 truncate text-left text-[16px] leading-snug font-semibold text-gray-900 group-hover:text-brand-hover">
        {resume.name}
      </button>
      <p className="mt-0.5 text-[12px] text-gray-400">
        {formatDateTime(resume.uploadedAt)}
      </p>
      <ul className="mt-4 flex flex-wrap gap-1">
        {resume.skills.slice(0, 4).map((skill) => (
          <li key={skill.name}>
            <Badge tone="white">{skill.name}</Badge>
          </li>
        ))}
      </ul>
    </li>
  )
}
