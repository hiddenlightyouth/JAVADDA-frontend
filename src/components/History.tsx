import { useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { companyOf, deleteReport, postingOf, useReports, type Report } from '../lib/gap'
import { formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { pageFrame, PageHeader } from './AppPage'
import { ConfirmDialog } from './Dialog'
import { CompanyMark, FitBadge, Notice } from './GapParts'
import { DotsIcon } from './Icons'
import { menuDangerItem, menuPanel } from './ui'
import { messages, pick, useMessages } from '../lib/i18n'

export const REPORT_LIST_TEXT = messages({
  ko: {
    deleteTitle: '이 리포트를 지울까요?',
    deleteBody: (company: string, title: string) => `${company}의 ${title} 리포트를 지워요. 지운 리포트는 되돌릴 수 없어요.`,
    delete: '지우기',
    deleted: '리포트를 지웠어요.',
    manage: (title: string) => `${title} 리포트 관리`,
    title: '내 리포트',
    pending: '진단하는 중',
    failed: '만들지 못했어요',
    none: '아직 진단한 공고가 없어요.',
    start: '첫 진단을 시작해볼까요?',
    diagnose: '진단하기',
    loading: '불러오고 있어요.',
    more: '더 보기',
    working: '처리 중',
  },
  en: {
    deleteTitle: 'Delete this report?',
    deleteBody: (company: string, title: string) => `This deletes the report for ${title} at ${company}. Deleted reports can't be recovered.`,
    delete: 'Delete',
    deleted: 'Report deleted.',
    manage: (title: string) => `Manage ${title} report`,
    title: 'My reports',
    pending: 'Analyzing',
    failed: 'Failed',
    none: "You haven't diagnosed any postings yet.",
    start: 'Ready for your first diagnosis?',
    diagnose: 'Start a diagnosis',
    loading: 'Loading.',
    more: 'Show more',
    working: 'Working',
  },
})

/** 리포트를 지우기 전에 한 번 더 묻는 창이에요. 사이드바와 내 리포트 화면이 같이 써요. */
export function DeleteReportDialog({ report, onCancel, onConfirm }: { report: Report; onCancel: () => void; onConfirm: () => void }) {
  const text = useMessages(REPORT_LIST_TEXT)
  const company = companyOf(report.companyId)
  const posting = postingOf(report.postingId)
  return <ConfirmDialog title={text.deleteTitle} body={text.deleteBody(company.name, posting?.title ?? '')} confirm={text.delete} danger onCancel={onCancel} onConfirm={onConfirm} />
}

/** 리포트를 지우고 토스트로 알려줘요. */
export function removeReport(report: Report, from: 'sidebar' | 'history') {
  deleteReport(report.id)
  track('report_delete', { from })
  showToast(pick(REPORT_LIST_TEXT).deleted)
}

function Row({ report, onOpen, onDelete }: { report: Report; onOpen: () => void; onDelete: () => void }) {
  const text = useMessages(REPORT_LIST_TEXT)
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null)
  useDismiss(menuOpen, ref, () => setMenuOpen(false))
  const company = companyOf(report.companyId)
  const posting = postingOf(report.postingId)
  return (
    <li ref={ref} className="relative flex items-center gap-3 rounded-2xl px-3 transition-colors hover:bg-gray-50">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
        <CompanyMark company={company} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-gray-900">{posting?.title ?? report.postingId}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-gray-500">{company.name}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {report.status === 'done' ? <FitBadge fit={report.fitScore} compact /> : <span className="text-[12px] text-gray-400">{report.status === 'failed' ? text.failed : text.pending}</span>}
          <span className="text-[12px] text-gray-400">{formatWhen(report.createdAt)}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label={text.manage(posting?.title ?? '')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
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

/** 내 리포트 화면이에요. 진단한 공고를 최근 순서로 보여주고, 누르면 리포트로 가요. */
export function History({ onOpenReport, onHome }: { onOpenReport: (id: string) => void; onHome: () => void }) {
  const text = useMessages(REPORT_LIST_TEXT)
  const reports = useReports()
  const [deleting, setDeleting] = useState<Report | null>(null)

  return (
    <main className={pageFrame}>
      <PageHeader title={text.title} />
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {reports.length === 0 ? (
          <Notice title={text.none} body={text.start} action={text.diagnose} onAction={onHome} className="mt-16" />
        ) : (
          <ul className="mx-auto w-full max-w-2xl divide-y divide-gray-100">
            {reports.map((report) => (
              <Row key={report.id} report={report} onOpen={() => onOpenReport(report.id)} onDelete={() => setDeleting(report)} />
            ))}
          </ul>
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
