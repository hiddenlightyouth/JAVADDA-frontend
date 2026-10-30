import { useEffect, useState } from 'react'
import { deviceLabels, fetchAdminFeedback, fetchFeedbackSummary, type AdminFeedback as Item, type FeedbackSummary } from '../lib/admin'
import { formatDateTime } from '../lib/format'
import { Empty, Failed, full, MoreButton, TableLoading, share, Stat, StatsLoading, tableWrap, td, th, usePaged } from './AdminParts'
import { Segmented, ghostButton, tag } from './ui'
import { messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'

type Filter = 'ALL' | 'RATING' | 'BUG'

const TEXT = messages({
  ko: {
    filters: [['ALL', '전체'], ['RATING', '평가'], ['BUG', '버그 신고']] as [Filter, string][],
    bug: '버그 신고',
    bad: '아쉬웠어요',
    good: '좋았어요',
    ofTotal: '전체의',
    ofRatings: '평가의',
    kind: '피드백 종류',
    empty: '아직 받은 피드백이 없어요.',
    when: '때',
    type: '종류',
    content: '내용',
    sender: '보낸 사람',
    device: '기기',
    screen: '화면',
    noComment: '남긴 말이 없어요',
    guest: '비회원',
    removedUser: '지워진 회원',
    openChat: '채팅 열기',
  },
  en: {
    filters: [['ALL', 'All'], ['RATING', 'Ratings'], ['BUG', 'Bug reports']],
    bug: 'Bug report',
    bad: 'Not great',
    good: 'Helpful',
    ofTotal: 'of total',
    ofRatings: 'of ratings',
    kind: 'Feedback type',
    empty: 'No feedback yet.',
    when: 'When',
    type: 'Type',
    content: 'Message',
    sender: 'From',
    device: 'Device',
    screen: 'Page',
    noComment: 'No message',
    guest: 'Guest',
    removedUser: 'Deleted member',
    openChat: 'Open chat',
  },
})

function KindTag({ item }: { item: Item }) {
  const L = useMessages(TEXT)
  if (item.kind === 'BUG') return <span className={`${tag} text-red-500`}>{L.bug}</span>
  return item.rating === 'BAD' ? <span className={tag}>{L.bad}</span> : <span className={`${tag} text-brand-hover`}>{L.good}</span>
}

/** 관리자 화면의 피드백 탭이에요. 사용자가 보낸 평가와 버그 신고를 최근 순서로 봐요. */
export function AdminFeedback({ onOpenChat }: { onOpenChat: (id: string) => void }) {
  const L = useMessages(TEXT)
  const [filter, setFilter] = useState<Filter>('ALL')
  // 'failed'는 합계를 받지 못했을 때예요. 합계 칸만 비우고 아래 목록은 그대로 보여줘요.
  const [summary, setSummary] = useState<FeedbackSummary | 'failed' | null>(null)
  const list = usePaged<Item>((page, onLoad) => fetchAdminFeedback(filter, page, onLoad), filter)
  const summaryLoad = useLoadProgress()
  const waitingSummary = useLoadHold(summary === null)

  useEffect(() => {
    let stale = false
    void fetchFeedbackSummary(summaryLoad.one()).then((result) => {
      if (!stale) setSummary(result.ok ? result.data : 'failed')
    })
    return () => {
      stale = true
    }
  }, [summaryLoad.one])

  const rated = summary && summary !== 'failed' ? summary.good + summary.bad : 0

  return (
    <>
      {waitingSummary || summary === null ? (
        <div className="-mt-3">
          <StatsLoading percent={summaryLoad.percent} />
        </div>
      ) : summary !== 'failed' ? (
        <dl className="grid grid-cols-3 gap-3">
          <Stat label={L.good} value={full(summary.good)} note={rated > 0 ? share(summary.good, rated).replace(L.ofTotal, L.ofRatings) : undefined} />
          <Stat label={L.bad} value={full(summary.bad)} note={rated > 0 ? share(summary.bad, rated).replace(L.ofTotal, L.ofRatings) : undefined} />
          <Stat label={L.bug} value={full(summary.bugs)} />
        </dl>
      ) : null}

      <div className="mt-8 flex justify-end">
        <Segmented label={L.kind} options={L.filters} value={filter} onChange={setFilter} />
      </div>

      {list.waiting ? (
        <TableLoading percent={list.percent} />
      ) : list.items === null ? (
        <Failed message={list.error} onRetry={list.retry} />
      ) : list.items.length === 0 ? (
        <Empty>{L.empty}</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>{L.when}</th>
                  <th className={th}>{L.type}</th>
                  <th className={th}>{L.content}</th>
                  <th className={th}>{L.sender}</th>
                  <th className={th}>{L.device}</th>
                  <th className={th}>{L.screen}</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 align-top">
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatDateTime(item.createdAt)}</td>
                    <td className={td}>
                      <KindTag item={item} />
                    </td>
                    <td className={`${td} max-w-[360px] leading-relaxed break-words whitespace-pre-wrap text-gray-900`}>{item.comment ?? <span className="text-gray-400">{L.noComment}</span>}</td>
                    <td className={td}>
                      {item.userId === null ? (
                        <span className="text-gray-400">{L.guest}</span>
                      ) : (
                        <>
                          <p className="max-w-[180px] truncate text-gray-900">{item.userName ?? L.removedUser}</p>
                          <p className="mt-0.5 max-w-[180px] truncate text-[12px] text-gray-400">{item.userEmail ?? ''}</p>
                        </>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{deviceLabels()[item.device]}</td>
                    <td className={td}>
                      <p className="max-w-[160px] truncate font-mono text-[12px] tracking-normal text-gray-500" title={item.page ?? undefined}>
                        {item.page ?? ''}
                      </p>
                      {/* 공유되지 않은 채팅은 관리자도 열 수 없어서, 열리지 않으면 열 수 없다는 화면이 나와요. */}
                      {item.chatId && (
                        <button type="button" onClick={() => onOpenChat(item.chatId!)} className={`${ghostButton} -ml-2 mt-0.5`}>
                          {L.openChat}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.hasNext && <MoreButton loading={list.loadingMore} percent={list.percent} onClick={() => void list.more()} />}
        </>
      )}
    </>
  )
}
