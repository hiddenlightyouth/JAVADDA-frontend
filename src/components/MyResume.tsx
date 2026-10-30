import { useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { track } from '../lib/analytics'
import { axisOf, canonical, removeResume, suggestSkills, saveResumeSkills, setPrimaryResume, uploadResume, useResumeShelf, type Resume, type ResumeSkill } from '../lib/gap'
import { formatDateTime } from '../lib/format'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { canvas, pageFrame, PageHeader } from './AppPage'
import { ConfirmDialog, Modal, panelBody, SidePanel } from './Dialog'
import { Notice, SkillChip, Tip } from './GapParts'
import { CloseButton, CloseIcon, LinkIcon, PlusIcon, StarIcon, TrashIcon, UploadIcon } from './Icons'
import { Bone } from './Skeleton'
import { Badge, Busy, FormError, menuPanel, NumberedList, primaryButton, textField, textFieldSm, toolButton, toolDangerButton } from './ui'

/**
 * 내 이력서 화면이에요. PDF나 GitHub, 노션 링크를 올리면 역량을 읽어 이름표로 보여주고, 잘못 읽은 것은 빼거나 더해요.
 * 올리는 칸(ResumeUploader)과 역량 고치는 칸(SkillEditor)은 진단 시작 화면도 같이 써요.
 */

const TEXT = messages({
  ko: {
    title: '내 이력서',
    fileTitle: 'PDF 파일',
    fileBody: '이력서나 포트폴리오 PDF를 여기로 끌어다 놓거나 눌러서 골라요.',
    fileDrop: '여기에 놓으면 바로 읽어요',
    choose: 'PDF 고르기',
    linkTitle: 'GitHub나 노션 링크',
    linkBody: '레포나 포트폴리오 페이지의 주소를 붙여 넣어요.',
    linkPlaceholder: 'https://github.com/...',
    linkLabel: 'GitHub나 노션 링크',
    linkSubmit: '링크로 올리기',
    invalidLink: '올바른 링크가 맞는지 확인해 주세요',
    onlyPdf: 'PDF 파일만 올릴 수 있어요.',
    reading: '서류를 읽고 있어요. 역량을 뽑는 데 몇 초 걸려요.',
    uploaded: '서류를 읽었어요. 뽑은 역량을 확인해 주세요.',
    sources: { pdf: 'PDF', github: 'GitHub', notion: '노션' } as Record<Resume['source'], string>,
    uploadedAt: (when: string) => `${when}에 업로드 됨`,
    skills: '내 역량',
    addPlaceholder: '역량 더하기',
    add: '더하기',
    paragraphs: '주요 경력',
    addDoc: '서류 추가',
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
    fileTitle: 'PDF file',
    fileBody: 'Drop your resume or portfolio PDF here, or click to choose one.',
    fileDrop: 'Drop it here and we will read it',
    choose: 'Choose a PDF',
    linkTitle: 'GitHub or Notion link',
    linkBody: 'Paste the address of a repository or portfolio page.',
    linkPlaceholder: 'https://github.com/...',
    linkLabel: 'GitHub or Notion link',
    linkSubmit: 'Use link',
    invalidLink: 'Please check that the link is correct',
    onlyPdf: 'Only PDF files are supported.',
    reading: 'Reading your document. Extracting skills takes a few seconds.',
    uploaded: 'Done. Please check the skills we found.',
    sources: { pdf: 'PDF', github: 'GitHub', notion: 'Notion' },
    uploadedAt: (when: string) => `Uploaded ${when}`,
    skills: 'My skills',
    addPlaceholder: 'Add a skill',
    add: 'Add',
    paragraphs: 'Key experience',
    addDoc: 'Add document',
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

const LINK = /^https?:\/\/(?:www\.)?(?:github\.com|notion\.so|[\w-]+\.notion\.site)\/\S+/i

/** 서류를 올리는 칸이에요. PDF 끌어다 놓기와 링크 두 가지를 받아요. 올리면 onDone으로 알려줘요. */
export function ResumeUploader({ onDone }: { onDone?: (resume: Resume) => void }) {
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
      <div className="rounded-2xl bg-gray-50 p-6">
        <p role="status" className="text-[13.5px] text-gray-500">
          {L.reading}
        </p>
        <Busy label="" className="mt-5 flex flex-wrap gap-2">
          {['w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-32', 'w-16'].map((width, index) => (
            <Bone key={index} className={`h-7 rounded-md! ${width}`} />
          ))}
        </Busy>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => takeFile(event.target.files?.[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`group flex flex-col items-start rounded-2xl border-2 border-dashed text-left transition-colors min-h-48 p-[22px] ${
            over ? 'border-brand bg-brand-soft' : 'border-transparent bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <span className={`flex size-12 items-center justify-center rounded-full bg-white transition-colors ${over ? 'text-brand' : 'text-gray-500 group-hover:text-brand'}`}>
            <UploadIcon className="size-6" strokeWidth={1} />
          </span>
          <span className="mt-4 text-[15px] font-semibold text-gray-900">{over ? L.fileDrop : L.fileTitle}</span>
          <span className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{L.fileBody}</span>
          <span className="mt-auto w-full pt-5">
            <span className={`${primaryButton} pointer-events-none flex h-10! w-full items-center justify-center`}>{L.choose}</span>
          </span>
        </button>

        <form onSubmit={submitLink} noValidate className="flex min-h-48 flex-col rounded-2xl bg-gray-50 p-6">
          <span className="flex size-12 items-center justify-center rounded-full bg-white text-gray-500">
            <LinkIcon className="size-6" strokeWidth={1} />
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
              className={`${textField} ${invalid ? 'border-red-400! focus:border-red-400!' : ''}`}
            />
            {invalid && <FormError className="mt-1.5">{L.invalidLink}</FormError>}
            <button type="submit" disabled={!link.trim()} className={`${toolButton} mt-2 h-10! w-full justify-center rounded-full! disabled:text-gray-400`}>
              {L.linkSubmit}
            </button>
          </div>
        </form>
      </div>
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
  const owned = resume.skills.map((skill) => skill.name)
  const suggestions = useMemo(() => suggestSkills(draft, owned), [draft, owned.join()])
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
        <button type="submit" disabled={!draft.trim()} className={`${toolButton} disabled:text-gray-400`}>
          <PlusIcon className="size-3.5" />
          {L.add}
        </button>
      </form>
    </div>
  )
}

export function MyResume({ onExplore }: { onExplore: () => void }) {
  const L = useMessages(TEXT)
  const shelf = useResumeShelf()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = shelf.list.find((resume) => resume.id === openId) ?? null

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
          <button type="button" onClick={() => setAdding(true)} className={`${primaryButton} flex items-center gap-1.5`}>
            <PlusIcon className="size-3.5" />
            {L.addDoc}
          </button>
        }
      />
      <div className={canvas}>
        {/* 공고 탐색처럼 제목 줄과 같은 폭으로 늘어놓고, 칸 수는 목록 폭을 보고 정해요. */}
        <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10">
          {shelf.list.length === 0 ? (
            <Notice title={L.emptyTitle} body={L.emptyBody} action={L.addDoc} onAction={() => setAdding(true)} className="mt-24" />
          ) : (
            <ul className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
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
      {adding && (
        <Modal onClose={() => setAdding(false)} labelledBy="resume-add-title" className="w-full max-w-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 id="resume-add-title" className="text-[17px] font-semibold text-gray-900">
                {L.addTitle}
              </h2>
            </div>
            <CloseButton label={L.close} size="md" onClick={() => setAdding(false)} />
          </div>
          <ResumeUploader
            onDone={(resume) => {
              setAdding(false)
              setOpenId(resume.id)
            }}
          />
        </Modal>
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
      <button type="button" onClick={onSelect} className="mt-3 truncate text-left text-[14.5px] font-semibold text-gray-900 group-hover:text-brand">
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
