import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { PROGRESS_START, revisePortfolio, reviseProject, saveProjects, writePortfolio, type PortfolioKey, type PortfolioRevision, type PortfolioSection, type ProgressState, type ProjectRevision, type Resume, type ResumeProblem, type ResumeProject } from '../lib/gap'
import { portfolioHtml } from '../lib/portfolioMarkdown'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { Dropdown } from './Dropdown'
import { AiProgress } from './GapParts'
import { ExternalLinkIcon, PencilIcon, PlusIcon, TrashIcon } from './Icons'
import { panelAction } from './ScreenParts'
import { Badge, ghostDangerButton, Segmented, toolButton } from './ui'

/**
 * GitHub 레포로 만든 서류의 프로젝트 경험(포트폴리오)이에요. 서류 상세 화면이 보여줘요.
 * 글자마다 마우스를 올리면 연필이 뜨고, 누르면 그 자리가 입력칸으로 바뀌어 바로 고쳐요(`Editable`). 바깥을 누르거나 Enter로 저장하고 Esc로 되돌려요.
 * 문제 해결 경험과 포트폴리오 항목은 고치기 메뉴 하나에 직접 고치기와 AI로 고치기를 모아 두고, 제거해요.
 * 프로젝트마다 이력서와 포트폴리오를 오가며 봐요. 포트폴리오가 비어 있으면(예전에 만든 서류) 프로젝트마다 하나씩 차례로 써요.
 */

const TEXT = messages({
  ko: {
    openRepo: '레포 열기',
    kinds: { team: '팀 프로젝트', personal: '개인 프로젝트' } as Record<ResumeProject['kind'], string>,
    role: '맡은 역할',
    parts: { problem: '문제', cause: '원인', solution: '개선', effect: '효과', decision: '판단' },
    editTip: '눌러서 고쳐요',
    saved: '고친 내용을 저장했어요.',
    fix: '고치기',
    fixSelf: '직접 고치기',
    fixAi: 'AI로 고치기',
    revisions: { shorter: '더 짧게', concrete: '더 구체적으로', numbers: '수치 넣기', rewrite: '다시 쓰기', another: '다른 경험으로 바꾸기' } as Record<Exclude<ProjectRevision, 'add'>, string>,
    revised: '고쳐 썼어요.',
    add: '경험 더하기',
    added: '경험을 하나 더했어요.',
    remove: '제거',
    removed: '제거했어요.',
    empty: { name: '프로젝트 이름', headline: '한 줄 소개 적기', summary: '요약 적기', role: '맡은 역할 적기', stack: '기술 스택 적기 (쉼표로 나눠요)', title: '제목 적기', part: (name: string) => `${name} 적기` },
    placeholderTip: '직접 채워 넣을 곳이에요',
    views: { resume: '이력서', portfolio: '포트폴리오' },
    viewLabel: '보기',
    portfolioFailed: '포트폴리오를 쓰지 못했어요.',
    retry: '다시 시도',
    writeMissing: (count: number) => `빠진 항목 쓰기 ${count}`,
    portfolioWritten: '포트폴리오를 썼어요. 빈칸을 채워 주세요.',
    copy: '마크다운 복사',
    copied: '마크다운을 복사했어요. 노션에 붙여 넣으면 돼요.',
    copyFailed: '복사하지 못했어요. 항목을 눌러 글을 복사해 주세요.',
    portfolioRevisions: { shorter: '더 짧게', longer: '더 자세하게', numbers: '수치 넣기', formal: '더 단정하게', list: '목록으로', story: '문장으로', rewrite: '다시 쓰기' } as Record<PortfolioRevision, string>,
  },
  en: {
    openRepo: 'Open repository',
    kinds: { team: 'Team project', personal: 'Personal project' },
    role: 'Role',
    parts: { problem: 'Problem', cause: 'Cause', solution: 'Fix', effect: 'Result', decision: 'Trade-off' },
    editTip: 'Click to edit',
    saved: 'Saved your changes.',
    fix: 'Edit',
    fixSelf: 'Edit yourself',
    fixAi: 'Rewrite with AI',
    revisions: { shorter: 'Shorter', concrete: 'More concrete', numbers: 'Add numbers', rewrite: 'Rewrite', another: 'Swap for another' },
    revised: 'Rewritten.',
    add: 'Add experience',
    added: 'Added one more experience.',
    remove: 'Delete',
    removed: 'Deleted.',
    empty: { name: 'Project name', headline: 'Add a headline', summary: 'Add a summary', role: 'Add your role', stack: 'Add tech stack (comma separated)', title: 'Add a title', part: (name: string) => `Add ${name.toLowerCase()}` },
    placeholderTip: 'Fill this in yourself',
    views: { resume: 'Resume', portfolio: 'Portfolio' },
    viewLabel: 'View',
    portfolioFailed: "Couldn't write the portfolio.",
    retry: 'Try again',
    writeMissing: (count: number) => `Write missing ${count}`,
    portfolioWritten: 'Portfolio written. Please fill in the blanks.',
    copy: 'Copy markdown',
    copied: 'Markdown copied. Paste it into Notion.',
    copyFailed: "Couldn't copy. Click a section to copy its text.",
    portfolioRevisions: { shorter: 'Shorter', longer: 'More detail', numbers: 'Add numbers', formal: 'More formal', list: 'As a list', story: 'As prose', rewrite: 'Rewrite' },
  },
})

const PARTS = ['problem', 'cause', 'solution', 'effect', 'decision'] as const
const REVISIONS = ['shorter', 'concrete', 'numbers', 'rewrite', 'another'] as const
const PORTFOLIO_REVISIONS: PortfolioRevision[] = ['shorter', 'longer', 'numbers', 'formal', 'list', 'story', 'rewrite']
const PORTFOLIO_KEYS: PortfolioKey[] = ['intro', 'period', 'team', 'stack', 'role', 'features', 'trouble', 'result']

/** AI가 "[직접 입력: 개선 전후 응답 시간]"처럼 비워 둔 곳을 연한 메인 컬러로 칠해서 채울 곳이 눈에 띄게 해요. */
function Marked({ text }: { text: string }) {
  const L = useMessages(TEXT)
  const pieces = text.split(/(\[(?:직접 입력|Fill in):[^\]]*\])/)
  return (
    <>
      {pieces.map((piece, order) =>
        /^\[(?:직접 입력|Fill in):/.test(piece) ? (
          <mark key={order} title={L.placeholderTip} className="rounded bg-brand-soft px-1 text-brand-hover">
            {piece}
          </mark>
        ) : (
          piece
        ),
      )}
    </>
  )
}

/**
 * 그 자리에서 바로 고치는 글자예요. 마우스를 올리면 옅은 바탕과 연필이 뜨고, 누르면 같은 자리가 입력칸으로 바뀌어요.
 * 바깥을 누르거나 Enter(여러 줄이면 Cmd나 Ctrl과 Enter)로 저장하고, Esc로 되돌려요. 비어 있으면 placeholder를 옅게 보여줘서 채울 수 있어요.
 * editing을 넘기면 고치기 메뉴의 직접 고치기처럼 바깥에서 열고 닫아요.
 */
function Editable({ value, onSave, placeholder, multiline = false, mono = false, editing, onEditing, className = '', children }: {
  value: string
  onSave: (next: string) => void
  placeholder: string
  multiline?: boolean
  mono?: boolean
  editing?: boolean
  onEditing?: (editing: boolean) => void
  className?: string
  children?: ReactNode
}) {
  const L = useMessages(TEXT)
  const [own, setOwn] = useState(false)
  const open = editing ?? own
  const setOpen = onEditing ?? setOwn
  const [draft, setDraft] = useState(value)
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])
  // 여러 줄 칸은 글이 늘면 같이 길어져서, 고치는 동안에도 글 전체가 보여요.
  useLayoutEffect(() => {
    const element = field.current
    if (!open || !multiline || !element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight + 2}px`
  }, [open, multiline, draft])
  useEffect(() => {
    const element = field.current
    if (!open || !element) return
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }, [open])

  const commit = () => {
    setOpen(false)
    if (draft !== value) onSave(draft)
  }
  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setDraft(value)
      setOpen(false)
    } else if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
    }
  }

  if (open) {
    const shape = `-mx-2 block w-[calc(100%+1rem)] rounded-lg border border-brand bg-white px-2 py-1 text-inherit leading-[inherit] outline-none ${mono ? 'font-mono text-[13px]' : ''} ${className}`
    return multiline ? (
      <textarea ref={field} value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={onKey} className={`${shape} resize-none`} />
    ) : (
      <input ref={field} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={onKey} className={shape} />
    )
  }
  return (
    <div
      role="button"
      tabIndex={0}
      title={L.editTip}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        // 포트폴리오 글 안의 링크는 그대로 열어요.
        if ((event.target as HTMLElement).closest('a')) return
        setOpen(true)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setOpen(true)
        }
      }}
      className={`group/edit relative -mx-2 cursor-text rounded-lg border border-transparent px-2 py-1 pr-7 transition-colors hover:bg-gray-900/[0.04] ${className}`}
    >
      {value ? children ?? value : <span className="text-gray-400">{placeholder}</span>}
      <PencilIcon className="pointer-events-none absolute top-1.5 right-1.5 size-3.5 text-gray-400 opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100" />
    </div>
  )
}

/** 직접 고치기와 AI로 고치기를 한 메뉴에 모아요. */
function FixMenu({ onSelf, ai }: { onSelf: () => void; ai: { label: string; onSelect: () => void }[] }) {
  const L = useMessages(TEXT)
  return (
    <Dropdown
      label={L.fix}
      groups={[
        { items: [{ label: L.fixSelf, onSelect: onSelf }] },
        { title: L.fixAi, items: ai },
      ]}
    />
  )
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  const L = useMessages(TEXT)
  return (
    <button type="button" onClick={onRemove} className={`${ghostDangerButton} inline-flex items-center gap-1`}>
      <TrashIcon className="size-3.5" />
      {L.remove}
    </button>
  )
}

export function ResumeProjects({ resume }: { resume: Resume }) {
  // 포트폴리오가 빈 프로젝트(예전에 만든 서류나 AI가 쓰지 못한 것)는 하나씩 차례로 써요. 나란히 쓰면 서버에서 서로의 저장을 덮을 수 있어요.
  const [tried, setTried] = useState<string[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const next = running ? null : resume.projects.find((project) => project.portfolio.length === 0 && !tried.includes(project.repo))
  return (
    <ul className="flex flex-col gap-3">
      {resume.projects.map((project, index) => (
        <ProjectCard
          key={project.repo}
          resume={resume}
          index={index}
          project={project}
          autoWrite={next?.repo === project.repo}
          queued={project.portfolio.length === 0 && !tried.includes(project.repo)}
          onAutoStart={() => {
            setTried((list) => [...list, project.repo])
            setRunning(project.repo)
          }}
          onAutoEnd={() => setRunning(null)}
        />
      ))}
    </ul>
  )
}

/** 지금 AI가 쓰고 있는 곳이에요. problem:0, add(경험 더하기), portfolio(포트폴리오 쓰기), section:intro(항목 고치기)예요. */
type Busy = { target: string; progress: ProgressState }

function ProjectCard({ resume, index, project, autoWrite, queued, onAutoStart, onAutoEnd }: {
  resume: Resume
  index: number
  project: ResumeProject
  /** 이 프로젝트의 빈 포트폴리오를 지금 쓸 차례예요. */
  autoWrite: boolean
  /** 빈 포트폴리오를 쓸 차례를 기다리는 중이에요. */
  queued: boolean
  onAutoStart: () => void
  onAutoEnd: () => void
}) {
  const L = useMessages(TEXT)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [view, setView] = useState<'resume' | 'portfolio'>('resume')

  /** AI 일 하나를 돌려요. 그동안 이 프로젝트의 다른 버튼은 흐려져요. */
  async function run(target: string, work: (onProgress: (progress: ProgressState) => void) => Promise<Resume | null>): Promise<boolean> {
    setBusy({ target, progress: PROGRESS_START })
    const done = await work((progress) => setBusy({ target, progress }))
    setBusy(null)
    return !!done
  }

  async function writeSections(keys: PortfolioKey[]) {
    const done = await run('portfolio', (onProgress) => writePortfolio(resume.id, index, keys, onProgress))
    track('resume_portfolio_write', { sections: keys.length || PORTFOLIO_KEYS.length, success: done })
    if (done && keys.length > 0) showToast(pick(TEXT).portfolioWritten)
  }

  useEffect(() => {
    if (!autoWrite) return
    onAutoStart()
    void writeSections([]).finally(onAutoEnd)
    // 차례가 오면 한 번만 써요.
  }, [autoWrite])

  const update = (patch: Partial<ResumeProject>) => {
    saveProjects(resume.id, resume.projects.map((item, order) => (order === index ? { ...item, ...patch } : item)))
    track('resume_project_edit', { part: 'project' })
  }

  async function revise(problem: number | null, revision: ProjectRevision) {
    const done = await run(problem === null ? 'add' : `problem:${problem}`, (onProgress) => reviseProject(resume.id, index, problem, revision, onProgress))
    track('resume_project_revise', { revision, success: done })
    if (done) showToast(revision === 'add' ? pick(TEXT).added : pick(TEXT).revised)
  }

  return (
    <li className="rounded-2xl bg-gray-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Editable value={project.name} placeholder={L.empty.name} onSave={(name) => name.trim() && update({ name: name.trim() })} className="text-[15px] font-semibold text-gray-900" />
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-gray-400">
            <span>{L.kinds[project.kind] ?? project.kind}</span>
            {project.period && <span>{project.period}</span>}
          </p>
        </div>
        <a href={project.url} target="_blank" rel="noreferrer" className={`${panelAction} mt-1 shrink-0`}>
          {L.openRepo}
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </div>

      <Segmented
        label={L.viewLabel}
        options={[['resume', L.views.resume], ['portfolio', L.views.portfolio]] as const}
        value={view}
        onChange={(next) => {
          setView(next)
          track('resume_project_view', { view: next })
        }}
        className="mt-4"
      />

      {view === 'portfolio' ? (
        <Portfolio project={project} busy={busy} queued={queued} onRun={run} onWrite={(keys) => void writeSections(keys)} resumeId={resume.id} index={index} onUpdate={update} />
      ) : (
        <div className="mt-3 flex flex-col gap-1">
          <Editable value={project.headline} placeholder={L.empty.headline} onSave={(headline) => update({ headline: headline.trim() })} className="text-[13.5px] font-medium text-gray-800" />
          <Editable value={project.summary} placeholder={L.empty.summary} multiline onSave={(summary) => update({ summary: summary.trim() })} className="text-[13px] leading-relaxed text-gray-600" />
          <Editable value={project.role} placeholder={L.empty.role} multiline onSave={(role) => update({ role: role.trim() })} className="mt-1 text-[13px] leading-relaxed text-gray-600">
            <span className="mr-2 font-medium text-gray-900">{L.role}</span>
            {project.role}
          </Editable>
          <Editable
            value={project.stack.join(', ')}
            placeholder={L.empty.stack}
            onSave={(stack) => update({ stack: [...new Set(stack.split(',').map((item) => item.trim()).filter(Boolean))] })}
            className="mt-1 text-[13px]"
          >
            <ul className="flex flex-wrap gap-1">
              {project.stack.map((name) => (
                <li key={name}>
                  <Badge tone="white">{name}</Badge>
                </li>
              ))}
            </ul>
          </Editable>
        </div>
      )}

      {view === 'resume' && project.problems.length > 0 && (
        <ol className="mt-4 flex flex-col gap-3">
          {project.problems.map((problem, order) => (
            <ProblemCard
              key={`${order}:${problem.title}`}
              problem={problem}
              progress={busy?.target === `problem:${order}` ? busy.progress : null}
              locked={!!busy}
              onRevise={(revision) => void revise(order, revision)}
              onSave={(next) => {
                update({ problems: project.problems.map((item, at) => (at === order ? next : item)) })
                track('resume_project_edit', { part: 'problem' })
              }}
              onRemove={() => {
                update({ problems: project.problems.filter((_, at) => at !== order) })
                track('resume_project_edit', { part: 'remove' })
                showToast(pick(TEXT).removed)
              }}
            />
          ))}
        </ol>
      )}

      {view === 'resume' &&
        (busy?.target === 'add' ? (
          <div className="mt-3 rounded-xl bg-white p-4">
            <AiProgress progress={busy.progress.progress} stage={busy.progress.stage} />
          </div>
        ) : (
          <button type="button" onClick={() => void revise(null, 'add')} disabled={!!busy} className={`${toolButton} mt-3`}>
            <PlusIcon className="size-3.5" />
            {L.add}
          </button>
        ))}
    </li>
  )
}

/**
 * 프로젝트의 포트폴리오예요. 항목마다 흰 칸에 마크다운을 그려요. 비어 있으면 차례가 오는 대로 써서, 그동안은 진행 칸이에요.
 * 빠진 항목만 골라 쓰고, 전체를 마크다운으로 복사해서 노션에 붙여 넣어요.
 */
function Portfolio({ project, busy, queued, onRun, onWrite, resumeId, index, onUpdate }: {
  project: ResumeProject
  busy: Busy | null
  queued: boolean
  onRun: (target: string, work: (onProgress: (progress: ProgressState) => void) => Promise<Resume | null>) => Promise<boolean>
  onWrite: (keys: PortfolioKey[]) => void
  resumeId: string
  index: number
  onUpdate: (patch: Partial<ResumeProject>) => void
}) {
  const L = useMessages(TEXT)
  const sections = project.portfolio
  const missing = PORTFOLIO_KEYS.filter((key) => !sections.some((section) => section.key === key))

  async function copy() {
    const markdown = [`# ${project.name}`, ...sections.map((section) => `## ${section.title}\n\n${section.content}`)].join('\n\n')
    try {
      await navigator.clipboard.writeText(markdown)
      track('resume_portfolio_copy', { sections: sections.length })
      showToast(pick(TEXT).copied)
    } catch {
      showToast(pick(TEXT).copyFailed)
    }
  }

  if (busy?.target === 'portfolio' || (sections.length === 0 && queued)) {
    const progress = busy?.target === 'portfolio' ? busy.progress : PROGRESS_START
    return (
      <div className="mt-4 rounded-xl bg-white p-4">
        <AiProgress progress={progress.progress} stage={progress.stage} />
      </div>
    )
  }
  if (sections.length === 0) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white p-5">
        <p className="text-[13px] text-gray-500">{L.portfolioFailed}</p>
        <button type="button" onClick={() => onWrite([])} disabled={!!busy} className={toolButton}>
          {L.retry}
        </button>
      </div>
    )
  }
  return (
    <div className="mt-4">
      <div className="flex items-center justify-end gap-3">
        {missing.length > 0 && (
          <button type="button" onClick={() => onWrite(missing)} disabled={!!busy} className={panelAction}>
            {L.writeMissing(missing.length)}
          </button>
        )}
        <button type="button" onClick={() => void copy()} className={panelAction}>
          {L.copy}
        </button>
      </div>
      <ol className="mt-3 flex flex-col gap-3">
        {sections.map((section) => (
          <PortfolioCard
            key={section.key}
            section={section}
            progress={busy?.target === `section:${section.key}` ? busy.progress : null}
            locked={!!busy}
            onRevise={(revision) =>
              void onRun(`section:${section.key}`, (onProgress) => revisePortfolio(resumeId, index, section.key, revision, onProgress)).then((done) => {
                track('resume_portfolio_revise', { section: section.key, revision, success: done })
                if (done) showToast(pick(TEXT).revised)
              })
            }
            onSave={(content) => {
              onUpdate({ portfolio: sections.map((item) => (item.key === section.key ? { ...item, content } : item)) })
              track('resume_project_edit', { part: 'portfolio' })
            }}
            onRemove={() => {
              onUpdate({ portfolio: sections.filter((item) => item.key !== section.key) })
              track('resume_project_edit', { part: 'portfolio-remove' })
              showToast(pick(TEXT).removed)
            }}
          />
        ))}
      </ol>
    </div>
  )
}

/** 포트폴리오 항목 하나예요. 본문을 누르면 마크다운 그대로 고치고, 아래 줄에 고치기 메뉴와 제거가 있어요. */
function PortfolioCard({ section, progress, locked, onRevise, onSave, onRemove }: {
  section: PortfolioSection
  progress: ProgressState | null
  locked: boolean
  onRevise: (revision: PortfolioRevision) => void
  onSave: (content: string) => void
  onRemove: () => void
}) {
  const L = useMessages(TEXT)
  const [editing, setEditing] = useState(false)
  const html = useMemo(() => portfolioHtml(section.content), [section.content])

  if (progress) {
    return (
      <li className="rounded-xl bg-white p-4">
        <AiProgress progress={progress.progress} stage={progress.stage} title={section.title} />
      </li>
    )
  }
  return (
    <li className="rounded-xl bg-white p-4">
      <p className="text-[13.5px] font-semibold text-gray-900">{section.title}</p>
      <Editable
        value={section.content}
        placeholder={L.empty.part(section.title)}
        multiline
        mono
        editing={editing}
        onEditing={setEditing}
        onSave={(content) => content.trim() && onSave(content.trim())}
        className="mt-1"
      >
        {/* portfolioHtml이 HTML 태그를 글자로 바꾸고 링크를 http와 https로만 남겨서 그대로 그려요. */}
        <div className="portfolio-md" dangerouslySetInnerHTML={{ __html: html }} />
      </Editable>
      <div className={`mt-3 flex flex-wrap items-center gap-1 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
        <FixMenu onSelf={() => setEditing(true)} ai={PORTFOLIO_REVISIONS.map((revision) => ({ label: L.portfolioRevisions[revision], onSelect: () => onRevise(revision) }))} />
        <span className="flex-1" />
        <RemoveButton onRemove={onRemove} />
      </div>
    </li>
  )
}

/** 문제 해결 경험 하나예요. 제목과 칸마다 눌러서 고치고, AI로 고치는 동안은 그 자리에 진행 칸이 보여요. */
function ProblemCard({ problem, progress, locked, onRevise, onSave, onRemove }: {
  problem: ResumeProblem
  progress: ProgressState | null
  /** 이 프로젝트에서 AI가 다른 글을 쓰는 중이라 손대지 못할 때예요. */
  locked: boolean
  onRevise: (revision: Exclude<ProjectRevision, 'add'>) => void
  onSave: (problem: ResumeProblem) => void
  onRemove: () => void
}) {
  const L = useMessages(TEXT)
  /** 고치고 있는 칸이에요. 고치기 메뉴의 직접 고치기는 제목부터 열어요. */
  const [editing, setEditing] = useState<keyof ResumeProblem | null>(null)
  const field = (key: keyof ResumeProblem) => ({ editing: editing === key, onEditing: (on: boolean) => setEditing(on ? key : null) })
  const save = (key: keyof ResumeProblem, value: string) => onSave({ ...problem, [key]: key === 'title' ? value.trim() || problem.title : value.trim() })

  if (progress) {
    return (
      <li className="rounded-xl bg-white p-4">
        <AiProgress progress={progress.progress} stage={progress.stage} title={problem.title} />
      </li>
    )
  }
  return (
    <li className="group/card rounded-xl bg-white p-4">
      <Editable value={problem.title} placeholder={L.empty.title} onSave={(value) => save('title', value)} {...field('title')} className="text-[13.5px] font-semibold text-gray-900" />
      <dl className="mt-1 flex flex-col text-[12.5px] leading-relaxed">
        {PARTS.map((part) => (
          // 빈 칸은 카드에 마우스를 올리거나 고치는 중일 때만 보여서 채울 수 있어요.
          <div key={part} className={`flex gap-3 ${problem[part] || editing === part ? '' : 'hidden group-hover/card:flex group-focus-within/card:flex'}`}>
            <dt className="w-10 shrink-0 py-1 text-gray-400">{L.parts[part]}</dt>
            <dd className="min-w-0 flex-1">
              <Editable value={problem[part]} placeholder={L.empty.part(L.parts[part])} multiline onSave={(value) => save(part, value)} {...field(part)} className="whitespace-pre-line text-gray-700">
                <Marked text={problem[part]} />
              </Editable>
            </dd>
          </div>
        ))}
      </dl>
      <div className={`mt-3 flex flex-wrap items-center gap-1 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
        <FixMenu onSelf={() => setEditing('title')} ai={REVISIONS.map((revision) => ({ label: L.revisions[revision], onSelect: () => onRevise(revision) }))} />
        <span className="flex-1" />
        <RemoveButton onRemove={onRemove} />
      </div>
    </li>
  )
}
