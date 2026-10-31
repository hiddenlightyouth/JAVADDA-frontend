import { messages, useMessages } from '../lib/i18n'
import { softButton } from './ui'

const TEXT = messages({
  ko: { loading: (percent: number) => `불러오고 있어요 ${percent}%`, more: '더 보기' },
  en: { loading: (percent: number) => `Loading ${percent}%`, more: 'Show more' },
})

/** 목록 아래의 더 보기 버튼이에요. 받는 동안은 버튼 글자에 받은 정도(퍼센트)를 적어요. 관리자 화면의 표와 내 정보의 로그인 기록이 같이 써요. */
export function MoreButton({ loading, percent = 0, onClick, className = 'mt-4' }: { loading: boolean; percent?: number; onClick: () => void; className?: string }) {
  const L = useMessages(TEXT)
  return (
    <button type="button" disabled={loading} onClick={onClick} className={`${className} tabular-nums ${softButton}`}>
      {loading ? L.loading(percent) : L.more}
    </button>
  )
}
