import { useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { PROGRESS_START, reviseProject, saveProjects, type ProgressState, type ProjectRevision, type Resume, type ResumeProblem, type ResumeProject } from '../lib/gap'
import { messages, pick, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { Dropdown } from './Dropdown'
import { AiProgress } from './GapParts'
import { ExternalLinkIcon, LockIcon, PlusIcon, TrashIcon } from './Icons'
import { panelAction } from './ScreenParts'
import { Badge, ghostButton, ghostDangerButton, label, primaryButton, quietButton, textArea, textFieldSm, toolButton } from './ui'

/**
 * GitHub 레포로 만든 서류의 프로젝트 경험(포트폴리오)이에요. 서류 상세 칸이 보여줘요.
 * 문제 해결 경험마다 AI로 고치고(더 짧게, 더 구체적으로, 수치 넣기, 다시 쓰기, 다른 경험으로 바꾸기), 직접 고치고, 빼요.
 * 프로젝트마다 AI로 경험을 하나 더하고, 소개와 역할과 기술 스택을 직접 고쳐요. 예전 Lofy의 이력서 고치기를 옮겼어요.
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
  },
})

const PARTS = ['problem', 'cause', 'solution', 'effect', 'decision'] as const
const REVISIONS = ['shorter', 'concrete', 'numbers', 'rewrite', 'another'] as const

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

/** 지금 AI가 고치고 있는 경험이에요. problem이 null이면 새로 더하는 중이에요. */
type Busy = { problem: number | null; progress: ProgressState }

function ProjectCard({ resume, index, project }: { resume: Resume; index: number; project: ResumeProject }) {
  const L = useMessages(TEXT)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<Busy | null>(null)

  const update = (patch: Partial<ResumeProject>) => saveProjects(resume.id, resume.projects.map((item, order) => (order === index ? { ...item, ...patch } : item)))

  async function revise(problem: number | null, revision: ProjectRevision) {
    setBusy({ problem, progress: PROGRESS_START })
    const done = await reviseProject(resume.id, index, problem, revision, (progress) => setBusy({ problem, progress }))
    setBusy(null)
    track('resume_project_revise', { revision, success: !!done })
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

      {editing ? (
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

      {project.problems.length > 0 && (
        <ol className="mt-4 flex flex-col gap-3">
          {project.problems.map((problem, order) => (
            <ProblemCard
              key={`${order}:${problem.title}`}
              problem={problem}
              progress={busy?.problem === order ? busy.progress : null}
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

      {busy?.problem === null ? (
        <div className="mt-3 rounded-xl bg-white p-4">
          <AiProgress progress={busy.progress.progress} stage={busy.progress.stage} />
        </div>
      ) : (
        <button type="button" onClick={() => void revise(null, 'add')} disabled={!!busy} className={`${toolButton} mt-3`}>
          <PlusIcon className="size-3.5" />
          {L.add}
        </button>
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
