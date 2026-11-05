import { isAdmin, useAuth } from '../lib/auth'
import { bleed, gutter, pageFrame, PageHeader } from './AppPage'
import { Tabs } from './ui'
import {
  ManagementOverview,
  ManagementUsers,
  ManagementPostings,
  ManagementCompanies,
  ManagementCrawl,
  ManagementAi,
} from './AdminManage'

export type AdminTab = 'overview' | 'users' | 'postings' | 'companies' | 'crawl' | 'ai' | 'chats' | 'feedback'
const tabs = [
  { key: 'overview', label: '운영 현황' },
  { key: 'users', label: '회원' },
  { key: 'postings', label: '채용공고' },
  { key: 'companies', label: '기업' },
  { key: 'crawl', label: '데이터 수집' },
  { key: 'ai', label: 'AI 호출' },
] as const

interface Props {
  tab: AdminTab
  onTab: (tab: AdminTab) => void
  full: boolean
  feedback: boolean
  onOpenChat: (id: string) => void
}
export function Admin({ tab, onTab, full }: Props) {
  const { me } = useAuth()
  const current = tab === 'chats' || tab === 'feedback' ? 'overview' : tab
  if (!isAdmin(me))
    return (
      <main className={pageFrame}>
        <PageHeader title="관리자" />
        <p className="py-8 text-sm text-gray-500">관리자 계정으로 로그인해 주세요.</p>
      </main>
    )
  return (
    <main className={pageFrame}>
      <PageHeader title="관리자" owner="Javadda, 서비스 운영" />
      {!full ? (
        <p className="py-8 text-sm text-gray-500">서버 연결과 관리자 API 지원 여부를 확인해 주세요.</p>
      ) : (
        <>
          <Tabs label="관리 메뉴" items={[...tabs]} current={current} onSelect={onTab} />
          <div role="tabpanel" className={`${bleed} ${gutter} min-h-0 flex-1 overflow-y-auto pt-6 pb-10`}>
            {current === 'overview' ? (
              <ManagementOverview onTab={onTab} />
            ) : current === 'users' ? (
              <ManagementUsers />
            ) : current === 'postings' ? (
              <ManagementPostings />
            ) : current === 'companies' ? (
              <ManagementCompanies />
            ) : current === 'crawl' ? (
              <ManagementCrawl />
            ) : (
              <ManagementAi />
            )}
          </div>
        </>
      )}
    </main>
  )
}
