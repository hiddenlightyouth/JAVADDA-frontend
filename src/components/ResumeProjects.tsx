import { useMemo, useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { PROGRESS_START, revisePortfolio, reviseProject, saveProjects, writePortfolio, type PortfolioKey, type PortfolioRevision, type PortfolioSection, type ProgressState, type ProjectRevision, type Resume, type ResumeProblem, type ResumeProject } from '../lib/gap'
import { portfolioHtml } from '../lib/portfolioMarkdown'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { Dropdown } from './Dropdown'
import { AiProgress } from './GapParts'
import { ExternalLinkIcon, LockIcon, PlusIcon, TrashIcon } from './Icons'
import { panelAction } from './ScreenParts'
import { Badge, ghostButton, ghostDangerButton, label, primaryButton, quietButton, Segmented, textArea, textFieldSm, toolButton } from './ui'

/**
 * GitHub 레포로 만든 서류의 프로젝트 경험(포트폴리오)이에요. 서류 상세 화면이 보여줘요.
 * 문제 해결 경험마다 AI로 고치고(더 짧게, 더 구체적으로, 수치 넣기, 다시 쓰기, 다른 경험으로 바꾸기), 직접 고치고, 빼요.
 * 프로젝트마다 AI로 경험을 하나 더하고, 소개와 역할과 기술 스택을 직접 고쳐요. 예전 Lofy의 이력서 고치기를 옮겼어요.
 * 프로젝트마다 이력서와 포트폴리오를 오가며 봐요. 포트폴리오는 여덟 항목의 마크다운 글이고, 항목마다 AI로 고치고 직접 고치고 빼요. 예전 Lofy의 포트폴리오 만들기를 옮겼어요.
 */

const TEXT = messages({
  ko: {
    openRepo: '레포 열기',
    privateRepo: '비공개',
    kinds: { team: '팀 프로젝트', personal: '개인 프로젝트' } as Record<ResumeProject['kind'], string>,
    role: '맡은 역할',
    parts: { problem: '문제', cause: '원인', solution: '개선', effect: '효과', decision: '판단' },
    edit: '직접 고치기',
    save: '저장',
    cancel: '취소',
    saved: '고친 내용을 저장했어요.',
    revise: 'AI로 고치기',
    revisions: { shorter: '더 짧게', concrete: '더 구체적으로', numbers: '수치 넣기', rewrite: '다시 쓰기', another: '다른 경험으로 바꾸기' } as Record<Exclude<ProjectRevision, 'add'>, string>,
    revised: '경험을 고쳐 썼어요.',
    add: '경험 더하기',
    added: '경험을 하나 더했어요.',
    remove: '빼기',
    removed: '경험을 뺐어요.',
    fields: { name: '이름', headline: '한 줄 소개', summary: '요약', role: '맡은 역할', stack: '기술 스택 (쉼표로 나눠요)', title: '제목' },
    placeholderTip: '직접 채워 넣을 곳이에요',
    views: { resume: '이력서', portfolio: '포트폴리오' },
    viewLabel: '보기',
    portfolioEmpty: '이 레포로 노션에 그대로 붙여 넣을 포트폴리오를 써 드려요. 프로젝트 소개, 개발 기간, 팀 구성, 기술 스택, 맡은 역할, 주요 기능, 문제 해결 경험, 성과와 배운 점 여덟 항목이에요.',
    writePortfolio: '포트폴리오 쓰기',
    writeMissing: (count: number) => `빠진 항목 쓰기 ${count}`,
    portfolioWritten: '포트폴리오를 썼어요. 빈칸을 채워 주세요.',
    copy: '마크다운 복사',
    copied: '마크다운을 복사했어요. 노션에 붙여 넣으면 돼요.',
    copyFailed: '복사하지 못했어요. 직접 고치기에서 글을 복사해 주세요.',
    portfolioRevisions: { shorter: '더 짧게', longer: '더 자세하게', numbers: '수치 넣기', formal: '더 단정하게', list: '목록으로', story: '문장으로', rewrite: '다시 쓰기' } as Record<PortfolioRevision, string>,
  },
  en: {
    openRepo: 'Open repository',
    privateRepo: 'Private',
    kinds: { team: 'Team project', personal: 'Personal project' },
    role: 'Role',
    parts: { problem: 'Problem', cause: 'Cause', solution: 'Fix', effect: 'Result', decision: 'Trade-off' },
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Saved your changes.',
    revise: 'Rewrite with AI',
    revisions: { shorter: 'Shorter', concrete: 'More concrete', numbers: 'Add numbers', rewrite: 'Rewrite', another: 'Swap for another' },
    revised: 'Rewrote this experience.',
    add: 'Add experience',
    added: 'Added one more experience.',
    remove: 'Remove',
    removed: 'Experience removed.',
    fields: { name: 'Name', headline: 'Headline', summary: 'Summary', role: 'Role', stack: 'Tech stack (comma separated)', title: 'Title' },
    placeholderTip: 'Fill this in yourself',
    views: { resume: 'Resume', portfolio: 'Portfolio' },
    viewLabel: 'View',
    portfolioEmpty: 'We write a portfolio from this repository that you can paste straight into Notion: overview, timeline, team, tech stack, role, key features, problem solving, and results.',
    writePortfolio: 'Write portfolio',
    writeMissing: (count: number) => `Write missing ${count}`,
    portfolioWritten: 'Portfolio written. Please fill in the blanks.',
    copy: 'Copy markdown',
    copied: 'Markdown copied. Paste it into Notion.',
    copyFailed: "Couldn't copy. Copy the text from Edit instead.",
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

export function ResumeProjects({ resume }: { resume: Resume }) {
  return (
    <ul className="flex flex-col gap-3">
      {resume.projects.map((project, index) => (
        <ProjectCard key={project.repo} resume={resume} index={index} project={project} />
      ))}
    </ul>
  )
}

/** 지금 AI가 쓰고 있는 곳이에요. problem:0, add(경험 더하기), portfolio(포트폴리오 쓰기), section:intro(항목 고치기)예요. */
type Busy = { target: string; progress: ProgressState }

function ProjectCard({ resume, index, project }: { resume: Resume; index: number; project: ResumeProject }) {
  const L = useMessages(TEXT)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [view, setView] = useState<'resume' | 'portfolio'>('resume')

  /** AI 일 하나를 돌려요. 그동안 이 프로젝트의 다른 버튼은 흐려져요. */
  async function run(target: string, work: (onProgress: (progress: ProgressState) => void) => Promise<Resume | null>): Promise<boolean> {
    setBusy({ target, progress: PROGRESS_START })
    const done = await work((progress) => setBusy({ target, progress }))
    setBusy(null)
    return !!done
  }

  const update = (patch: Partial<ResumeProject>) => saveProjects(resume.id, resume.projects.map((item, order) => (order === index ? { ...item, ...patch } : item)))

  async function revise(problem: number | null, revision: ProjectRevision) {
    const done = await run(problem === null ? 'add' : `problem:${problem}`, (onProgress) => reviseProject(resume.id, index, problem, revision, onProgress))
    track('resume_project_revise', { revision, success: done })
    if (done) showToast(revision === 'add' ? pick(TEXT).added : pick(TEXT).revised)
  }

  return (
    <li className="rounded-2xl bg-gray-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-gray-900">{project.name}</span>
            {project.privateRepo && (
              <Badge tone="white" className="gap-1">
                <LockIcon className="size-3" />
                {L.privateRepo}
              </Badge>
            )}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-gray-400">
            <span>{L.kinds[project.kind] ?? project.kind}</span>
            {project.period && <span>{project.period}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} disabled={!!busy} className={panelAction}>
              {L.edit}
            </button>
          )}
          <a href={project.url} target="_blank" rel="noreferrer" className={panelAction}>
            {L.openRepo}
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </div>
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
        <Portfolio project={project} busy={busy} onRun={run} resumeId={resume.id} index={index} onUpdate={update} />
      ) : editing ? (
        <ProjectEditor
          project={project}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            update(patch)
            setEditing(false)
            track('resume_project_edit', { part: 'project' })
            showToast(pick(TEXT).saved)
          }}
        />
      ) : (
        <>
          {project.headline && <p className="mt-3 text-[13.5px] font-medium text-gray-800">{project.headline}</p>}
          {project.summary && <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{project.summary}</p>}
          {project.role && (
            <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
              <span className="mr-2 font-medium text-gray-900">{L.role}</span>
              {project.role}
            </p>
          )}
          {project.stack.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1">
              {project.stack.map((name) => (
                <li key={name}>
                  <Badge tone="white">{name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
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
                showToast(pick(TEXT).saved)
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
 * 프로젝트의 포트폴리오예요. 아직 없으면 쓰기 버튼만, 있으면 항목마다 흰 칸에 마크다운을 그려요.
 * 빠진 항목만 골라 쓰고, 전체를 마크다운으로 복사해서 노션에 붙여 넣어요.
 */
function Portfolio({ project, busy, onRun, resumeId, index, onUpdate }: {
  project: ResumeProject
  busy: Busy | null
  onRun: (target: string, work: (onProgress: (progress: ProgressState) => void) => Promise<Resume | null>) => Promise<boolean>
  resumeId: string
  index: number
  onUpdate: (patch: Partial<ResumeProject>) => void
}) {
  const L = useMessages(TEXT)
  const sections = project.portfolio
  const missing = PORTFOLIO_KEYS.filter((key) => !sections.some((section) => section.key === key))

  async function write(keys: PortfolioKey[]) {
    const done = await onRun('portfolio', (onProgress) => writePortfolio(resumeId, index, keys, onProgress))
    track('resume_portfolio_write', { sections: keys.length || PORTFOLIO_KEYS.length, success: done })
    if (done) showToast(pick(TEXT).portfolioWritten)
  }

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

  if (busy?.target === 'portfolio') {
    return (
      <div className="mt-4 rounded-xl bg-white p-4">
        <AiProgress progress={busy.progress.progress} stage={busy.progress.stage} />
      </div>
    )
  }
  if (sections.length === 0) {
    return (
      <div className="mt-4 rounded-xl bg-white p-5">
        <p className="text-[13px] leading-relaxed text-gray-500">{L.portfolioEmpty}</p>
        <button type="button" onClick={() => void write([])} disabled={!!busy} className={`${primaryButton} mt-4`}>
          {L.writePortfolio}
        </button>
      </div>
    )
  }
  return (
    <div className="mt-4">
      <div className="flex items-center justify-end gap-3">
        {missing.length > 0 && (
          <button type="button" onClick={() => void write(missing)} disabled={!!busy} className={panelAction}>
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
              showToast(pick(TEXT).saved)
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

/** 포트폴리오 항목 하나예요. 제목, 마크다운 본문, 아래 줄에 AI로 고치기와 직접 고치기와 빼기가 있어요. */
function PortfolioCard({ section, progress, locked, onRevise, onSave, onRemove }: {
  section: PortfolioSection
  progress: ProgressState | null
  locked: boolean
  onRevise: (revision: PortfolioRevision) => void
  onSave: (content: string) => void
  onRemove: () => void
}) {
  const L = useMessages(TEXT)
  const [draft, setDraft] = useState<string | null>(null)
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
      {draft !== null ? (
        <div className="mt-2 flex flex-col gap-3">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={10} aria-label={section.title} className={`${textArea} font-mono`} />
          <EditorButtons
            onCancel={() => setDraft(null)}
            onSave={() => {
              if (draft.trim()) onSave(draft.trim())
              setDraft(null)
            }}
          />
        </div>
      ) : (
        <>
          {/* portfolioHtml이 HTML 태그를 글자로 바꾸고 링크를 http와 https로만 남겨서 그대로 그려요. */}
          <div className="portfolio-md mt-2" dangerouslySetInnerHTML={{ __html: html }} />
          <div className={`mt-3 flex flex-wrap items-center gap-1 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
            <Dropdown label={L.revise} groups={[{ items: PORTFOLIO_REVISIONS.map((revision) => ({ label: L.portfolioRevisions[revision], onSelect: () => onRevise(revision) })) }]} />
            <button type="button" onClick={() => setDraft(section.content)} className={ghostButton}>
              {L.edit}
            </button>
            <span className="flex-1" />
            <button type="button" onClick={onRemove} className={`${ghostDangerButton} inline-flex items-center gap-1`}>
              <TrashIcon className="size-3.5" />
              {L.remove}
            </button>
          </div>
        </>
      )}
    </li>
  )
}

/** 프로젝트의 이름, 소개, 역할, 기술 스택을 직접 고치는 칸이에요. */
function ProjectEditor({ project, onSave, onCancel }: { project: ResumeProject; onSave: (patch: Partial<ResumeProject>) => void; onCancel: () => void }) {
  const L = useMessages(TEXT)
  const [name, setName] = useState(project.name)
  const [headline, setHeadline] = useState(project.headline)
  const [summary, setSummary] = useState(project.summary)
  const [role, setRole] = useState(project.role)
  const [stack, setStack] = useState(project.stack.join(', '))
  return (
    <div className="mt-4 flex flex-col gap-3">
      <Field title={L.fields.name}>
        <input value={name} onChange={(event) => setName(event.target.value)} className={textFieldSm} />
      </Field>
      <Field title={L.fields.headline}>
        <input value={headline} onChange={(event) => setHeadline(event.target.value)} className={textFieldSm} />
      </Field>
      <Field title={L.fields.summary}>
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} className={textArea} />
      </Field>
      <Field title={L.fields.role}>
        <textarea value={role} onChange={(event) => setRole(event.target.value)} rows={2} className={textArea} />
      </Field>
      <Field title={L.fields.stack}>
        <input value={stack} onChange={(event) => setStack(event.target.value)} className={textFieldSm} />
      </Field>
      <EditorButtons
        onCancel={onCancel}
        onSave={() =>
          onSave({
            name: name.trim() || project.name,
            headline: headline.trim(),
            summary: summary.trim(),
            role: role.trim(),
            stack: [...new Set(stack.split(',').map((item) => item.trim()).filter(Boolean))],
          })
        }
      />
    </div>
  )
}

/** 문제 해결 경험 하나예요. AI로 고치는 동안은 그 자리에 진행 칸이 보여요. */
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
  const [editing, setEditing] = useState(false)

  if (progress) {
    return (
      <li className="rounded-xl bg-white p-4">
        <AiProgress progress={progress.progress} stage={progress.stage} title={problem.title} />
      </li>
    )
  }
  if (editing) {
    return (
      <li className="rounded-xl bg-white p-4">
        <ProblemEditor
          problem={problem}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            onSave(next)
            setEditing(false)
          }}
        />
      </li>
    )
  }
  return (
    <li className="rounded-xl bg-white p-4">
      <p className="text-[13.5px] font-semibold text-gray-900">{problem.title}</p>
      <dl className="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-relaxed">
        {PARTS.filter((part) => problem[part]).map((part) => (
          <div key={part} className="flex gap-3">
            <dt className="w-10 shrink-0 text-gray-400">{L.parts[part]}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-line text-gray-700">
              <Marked text={problem[part]} />
            </dd>
          </div>
        ))}
      </dl>
      <div className={`mt-3 flex flex-wrap items-center gap-1 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
        <Dropdown
          label={L.revise}
          groups={[{ items: REVISIONS.map((revision) => ({ label: L.revisions[revision], onSelect: () => onRevise(revision) })) }]}
        />
        <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
          {L.edit}
        </button>
        <span className="flex-1" />
        <button type="button" onClick={onRemove} className={`${ghostDangerButton} inline-flex items-center gap-1`}>
          <TrashIcon className="size-3.5" />
          {L.remove}
        </button>
      </div>
    </li>
  )
}

/** 문제 해결 경험을 칸마다 직접 고치는 칸이에요. AI가 비워 둔 "[직접 입력: ...]"을 여기서 채워요. */
function ProblemEditor({ problem, onSave, onCancel }: { problem: ResumeProblem; onSave: (problem: ResumeProblem) => void; onCancel: () => void }) {
  const L = useMessages(TEXT)
  const [draft, setDraft] = useState(problem)
  const set = (key: keyof ResumeProblem, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <div className="flex flex-col gap-3">
      <Field title={L.fields.title}>
        <input value={draft.title} onChange={(event) => set('title', event.target.value)} className={textFieldSm} />
      </Field>
      {PARTS.map((part) => (
        <Field key={part} title={L.parts[part]}>
          <textarea value={draft[part]} onChange={(event) => set(part, event.target.value)} rows={part === 'solution' ? 3 : 2} className={textArea} />
        </Field>
      ))}
      <EditorButtons onCancel={onCancel} onSave={() => onSave({ ...draft, title: draft.title.trim() || problem.title })} />
    </div>
  )
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{title}</span>
      {children}
    </label>
  )
}

function EditorButtons({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const L = useMessages(TEXT)
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onCancel} className={quietButton}>
        {L.cancel}
      </button>
      <button type="button" onClick={onSave} className={primaryButton}>
        {L.save}
      </button>
    </div>
  )
}
