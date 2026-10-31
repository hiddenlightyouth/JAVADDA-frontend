import { useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { companyOf, daysLeft, deleteReport, postingOf, useReportPosting, useReports, useResumeShelf, type Report, type Resume, type ResumeShelf } from '../lib/gap'
import { formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { pageFrame, PageHeader, scrollBody } from './AppPage'
import { ConfirmDialog } from './Dialog'
import { Dropdown } from './Dropdown'
import { CompanyMark, FitBadge, Notice } from './GapParts'
import { DotsIcon } from './Icons'
import { iconButton, menuDangerItem, menuPanel } from './ui'
import { messages, pick, useMessages } from '../lib/i18n'

export const REPORT_LIST_TEXT = messages({
  ko: {
    deleteTitle: '이 리포트를 삭제할까요?',
    deleteBody: (company: string, title: string) => `${company}의 ${title} 리포트를 삭제해요. 삭제한 리포트는 되돌릴 수 없어요.`,
    delete: '삭제',
    deleted: '리포트를 삭제했어요.',
    pin: '고정',
    unpin: '고정 해제',
    pinned: '고정됨',
    manage: (title: string) => `${title} 리포트 관리`,
    title: '내 리포트',
    pending: (progress: number) => `진단 중 ${progress}%`,
    failed: '만들지 못했어요',
    none: '아직 진단한 공고가 없어요.',
    start: '첫 진단을 시작해볼까요?',
    diagnose: '진단하기',
    all: '모두 보기',
    always: '상시',
    closed: '마감',
    dday: (days: number) => (days === 0 ? 'D-day' : `D-${days}`),
    active: '준비 중',
    ended: '마감된 공고',
    resume: '이력서',
    allResumes: '전체',
    deletedResume: '지운 이력서',
    resumeCount: (name: string, count: number) => `${name} ${count}`,
    toggle: (name: string) => `${name}에서 만든 리포트`,
  },
  en: {
    deleteTitle: 'Delete this report?',
    deleteBody: (company: string, title: string) => `This deletes the report for ${title} at ${company}. Deleted reports can't be recovered.`,
    delete: 'Delete',
    deleted: 'Report deleted.',
    pin: 'Pin',
    unpin: 'Unpin',
    pinned: 'Pinned',
    manage: (title: string) => `Manage ${title} report`,
    title: 'My reports',
    pending: (progress: number) => `Analyzing ${progress}%`,
    failed: 'Failed',
    none: "You haven't diagnosed any postings yet.",
    start: 'Ready for your first diagnosis?',
    diagnose: 'Start a diagnosis',
    all: 'See all',
    always: 'Rolling',
    closed: 'Closed',
    dday: (days: number) => (days === 0 ? 'D-day' : `D-${days}`),
    active: 'In progress',
    ended: 'Closed postings',
    resume: 'Resume',
    allResumes: 'All',
    deletedResume: 'Deleted resume',
    resumeCount: (name: string, count: number) => `${name} ${count}`,
    toggle: (name: string) => `Reports made with ${name}`,
  },
})

/**
 * 리포트가 지금 얼마나 급한지예요. 진단 중, 마감이 남은 공고(남은 날), 상시 채용, 만들지 못함, 마감된 공고로 나눠요.
 * 공고 목록에서 사라진 공고(채용 페이지에서 내려간 것)는 마감된 것으로 봐요.
 */
export type Urgency = { kind: 'pending' } | { kind: 'open'; left: number } | { kind: 'always' } | { kind: 'failed' } | { kind: 'closed' }

export function urgencyOf(report: Report): Urgency {
  if (report.status === 'pending') return { kind: 'pending' }
  if (report.status === 'failed') return { kind: 'failed' }
  const posting = postingOf(report.postingId)
  if (!posting) return { kind: 'closed' }
  if (!posting.deadline) return { kind: 'always' }
  if (new Date(posting.deadline).getTime() < Date.now()) return { kind: 'closed' }
  return { kind: 'open', left: daysLeft(posting) ?? 0 }
}

const RANK: Record<Urgency['kind'], number> = { pending: 0, open: 1, always: 2, failed: 3, closed: 4 }

/**
 * 지금 챙길 것부터 늘어놓아요. 진단 중인 것, 마감이 가까운 공고, 상시 채용, 만들지 못한 것, 마감된 공고 순서예요.
 * 같은 묶음에서는 남은 날이 적은 것, 그다음 최근에 만든 것이 앞이에요. 사이드바와 내 리포트 화면이 같이 써요.
 */
export function byUrgency(reports: Report[]): { report: Report; urgency: Urgency }[] {
  return reports
    .map((report) => ({ report, urgency: urgencyOf(report) }))
    .sort((a, b) => {
      const rank = RANK[a.urgency.kind] - RANK[b.urgency.kind]
      if (rank !== 0) return rank
      if (a.urgency.kind === 'open' && b.urgency.kind === 'open' && a.urgency.left !== b.urgency.left) return a.urgency.left - b.urgency.left
      return b.report.createdAt.localeCompare(a.report.createdAt)
    })
}

/** 같은 이력서로 만든 리포트 묶음이에요. 지운 이력서로 만든 리포트는 resume이 null이에요. */
export interface ResumeGroup {
  id: string
  resume: Resume | null
  primary: boolean
  items: { report: Report; urgency: Urgency }[]
}

/**
 * 리포트를 만든 이력서마다 묶어요. 대표 이력서가 맨 앞이고, 그다음은 올린 서류 목록의 순서, 지운 이력서로 만든 리포트는 맨 뒤예요.
 * 묶음 안은 받은 순서(byUrgency) 그대로예요. 사이드바와 내 리포트 화면이 같이 써요.
 */
export function byResume(ranked: { report: Report; urgency: Urgency }[], shelf: ResumeShelf): ResumeGroup[] {
  const order = [...shelf.list].sort((a, b) => Number(b.id === shelf.primaryId) - Number(a.id === shelf.primaryId))
  const known = new Set(order.map((resume) => resume.id))
  const groups: ResumeGroup[] = order.map((resume) => ({ id: resume.id, resume, primary: resume.id === shelf.primaryId, items: [] }))
  const deleted: ResumeGroup = { id: 'deleted', resume: null, primary: false, items: [] }
  for (const item of ranked) {
    const group = known.has(item.report.resumeId) ? groups.find((each) => each.id === item.report.resumeId) : deleted
    group?.items.push(item)
  }
  return [...groups, deleted].filter((group) => group.items.length > 0)
}

/** 리포트 줄 오른쪽의 작은 글이에요. 진단 중이면 퍼센트, 마감이 사흘 안이면 메인 컬러의 D-day, 마감됐으면 옅게 적어요. */
export function UrgencyLabel({ report, urgency, className = '' }: { report: Report; urgency: Urgency; className?: string }) {
  const text = useMessages(REPORT_LIST_TEXT)
  const value =
    urgency.kind === 'pending'
      ? text.pending(report.progress ?? 0)
      : urgency.kind === 'failed'
        ? text.failed
        : urgency.kind === 'open'
          ? text.dday(urgency.left)
          : urgency.kind === 'always'
            ? text.always
            : text.closed
  const strong = urgency.kind === 'open' && urgency.left <= 3
  return <span className={`shrink-0 tabular-nums ${strong ? 'font-semibold text-brand' : 'text-gray-400'} ${className}`}>{value}</span>
}

/** 리포트를 지우기 전에 한 번 더 묻는 창이에요. 사이드바와 내 리포트 화면이 같이 써요. */
export function DeleteReportDialog({ report, onCancel, onConfirm }: { report: Report; onCancel: () => void; onConfirm: () => void }) {
  const text = useMessages(REPORT_LIST_TEXT)
  const company = companyOf(report.companyId)
  const posting = useReportPosting(report.postingId)
  return <ConfirmDialog title={text.deleteTitle} body={text.deleteBody(company.name, posting?.title ?? '')} confirm={text.delete} danger onCancel={onCancel} onConfirm={onConfirm} />
}

/** 리포트를 지우고 토스트로 알려줘요. */
export function removeReport(report: Report, from: 'sidebar' | 'history' | 'report') {
  deleteReport(report.id)
  track('report_delete', { from })
  showToast(pick(REPORT_LIST_TEXT).deleted)
}

function Row({ report, urgency, onOpen, onDelete }: { report: Report; urgency: Urgency; onOpen: () => void; onDelete: () => void }) {
  const text = useMessages(REPORT_LIST_TEXT)
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null)
  useDismiss(menuOpen, ref, () => setMenuOpen(false))
  const company = companyOf(report.companyId)
  const posting = useReportPosting(report.postingId)
  return (
    // 마감된 줄은 내용만 흐리게 해요. 줄 전체를 흐리게 하면 그 안의 메뉴까지 흐려지고 아래 줄에 가려져요. 메뉴가 열린 줄은 위로 올려요.
    <li ref={ref} className={`relative flex items-center gap-3 rounded-2xl px-3 transition-colors hover:bg-gray-50 ${menuOpen ? 'z-20' : ''}`}>
      <button type="button" onClick={onOpen} className={`flex min-w-0 flex-1 items-center gap-3 py-3 text-left ${urgency.kind === 'closed' ? 'opacity-60' : ''}`}>
        <CompanyMark company={company} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-gray-900">{posting?.title ?? report.postingId}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-gray-500">{company.name}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {report.status === 'done' && <FitBadge fit={report.fitScore} compact />}
          <span className="flex items-center gap-2 text-[12px]">
            <UrgencyLabel report={report} urgency={urgency} />
            <span className="text-gray-400">{formatWhen(report.createdAt)}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={text.manage(posting?.title ?? '')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className={iconButton.md}
      >
        <DotsIcon />
      </button>
      {menuOpen && (
        <div role="menu" className={`absolute top-full right-3 z-10 -mt-2 w-36 origin-top-right ${menuPanel}`}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              onDelete()
            }}
            className={menuDangerItem}
          >
            {text.delete}
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * 내 리포트 화면이에요. 진단한 공고를 준비 중(마감이 가까운 것부터)과 마감된 공고로 나눠 보여주고, 누르면 리포트로 가요.
 * 사이드바는 챙길 것 몇 개만 보여주고, 나머지는 이 화면에서 봐요.
 */
export function History({ onOpenReport, onHome }: { onOpenReport: (id: string) => void; onHome: () => void }) {
  const text = useMessages(REPORT_LIST_TEXT)
  const reports = useReports()
  const shelf = useResumeShelf()
  const urgent = byUrgency(reports)
  const resumeGroups = byResume(urgent, shelf)
  // 이력서를 여러 개로 진단했으면 이력서 메뉴로 하나만 골라 봐요. 고른 이력서가 사라지면 전체로 돌아가요.
  const [resumeId, setResumeId] = useState<string | null>(null)
  const picked = resumeGroups.find((group) => group.id === resumeId) ?? null
  // 전체를 볼 때는 이력서와 상관없이 마감이 가까운 순서예요.
  const ranked = picked ? picked.items : urgent
  const nameOf = (group: ResumeGroup) => group.resume?.name ?? text.deletedResume
  const [deleting, setDeleting] = useState<Report | null>(null)

  return (
    <main className={pageFrame}>
      <PageHeader title={text.title} />
      <div className={scrollBody}>
        {reports.length === 0 ? (
          <Notice title={text.none} body={text.start} action={text.diagnose} onAction={onHome} className="mt-16" />
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            {resumeGroups.length > 1 && (
              <Dropdown
                label={text.resume}
                value={picked ? nameOf(picked) : text.allResumes}
                className="mb-4 ml-3 max-w-full"
                groups={[
                  {
                    items: [null, ...resumeGroups].map((group) => ({
                      label: group ? text.resumeCount(nameOf(group), group.items.length) : text.allResumes,
                      checked: (group?.id ?? null) === (picked?.id ?? null),
                      onSelect: () => {
                        track('history_resume_select', { resume: group ? (group.resume ? 'resume' : 'deleted') : 'all' })
                        setResumeId(group?.id ?? null)
                      },
                    })),
                  },
                ]}
              />
            )}
            {[
              { title: text.active, items: ranked.filter((item) => item.urgency.kind !== 'closed') },
              { title: text.ended, items: ranked.filter((item) => item.urgency.kind === 'closed') },
            ]
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <section key={group.title} className="mt-8 first:mt-0">
                  <h2 className="px-3 text-[12.5px] font-medium text-gray-400">
                    {group.title} <span className="tabular-nums">{group.items.length}</span>
                  </h2>
                  <ul className="mt-1 divide-y divide-gray-100">
                    {group.items.map(({ report, urgency }) => (
                      <Row key={report.id} report={report} urgency={urgency} onOpen={() => onOpenReport(report.id)} onDelete={() => setDeleting(report)} />
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </div>
      {deleting && (
        <DeleteReportDialog
          report={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            removeReport(deleting, 'history')
            setDeleting(null)
          }}
        />
      )}
    </main>
  )
}
