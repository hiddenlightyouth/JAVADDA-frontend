import type { ReactNode } from 'react'
import { messages, useMessages } from '../lib/i18n'
import { BackIcon } from './Icons'

/**
 * 앱 화면(탐색, 추천, 달력, 지도, 블로그, 기업 상세, 이력서, 진단 시작, 리포트, 관리자, 내 정보, 내 리포트)이 같이 쓰는 틀이에요.
 * 바깥 틀, 제목 줄, 흰 바탕, 스크롤 화면을 한 모양으로 맞춰요.
 * 새 앱 화면도 이것을 써서 따로 만들지 않아요.
 */

const TEXT = messages({
  ko: { back: '뒤로 가기' },
  en: { back: 'Back' },
})

/** 위의 헤더(좁은 화면 56px, 넓은 화면 36px)만큼 비우고 좌우 여백을 두는 여백이에요. 바깥 틀과 스크롤 화면의 제목 줄이 같이 써요. */
const framePad = 'px-6 pt-14 md:px-10 md:pt-9'

/** 앱 화면의 바깥 틀이에요. 위의 헤더만큼 비우고 좌우 여백을 둬요. */
export const pageFrame = `flex min-h-0 flex-1 flex-col ${framePad}`

/** 제목 줄 아래를 좌우 여백 없이 가득 채우는 바탕이에요. 새 진단 화면처럼 흰색이고, 선 없이 여백으로 제목 줄과 나눠요. pageFrame 안에서 써요. */
export const canvas = '-mx-6 flex min-h-0 flex-1 flex-col bg-white md:-mx-10'

/**
 * pageFrame 안에서 제목 줄 아래만 스크롤하는 칸이에요. 스크롤 막대가 창 가장자리에 붙게 좌우 여백 밖까지 넓히고, 내용은 제목 줄 아래 32px(pt-8)에서 시작해요.
 * 진단 시작과 내 리포트가 써요. 제목 줄을 pageFrame 밖에 두는 화면은 `ScrollPage`를 써요.
 */
export const scrollBody = '-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:-mx-10 md:px-10'

/**
 * 제목 줄은 맨 위에 두고 그 아래만 스크롤하는 앱 화면이에요. 공고 탐색, 추천 공고, 마감 달력, 기술 블로그, 기업 상세가 같이 써요.
 * 스크롤 칸이 화면 폭을 다 써서, 스크롤 막대가 창 가장자리에 붙어요. 내용은 제목 줄 아래 32px(pt-8)에서 시작해요.
 */
export function ScrollPage({ header, children, className = '' }: { header: ReactNode; children: ReactNode; className?: string }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className={`shrink-0 ${framePad}`}>{header}</div>
      <div className={`min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10 ${className}`}>{children}</div>
    </main>
  )
}

/**
 * 앱 화면 맨 위의 제목 줄이에요(26px). 기업 상세나 리포트처럼 기업 이름이나 업종이 있으면 제목 위에 작게 적고(owner), 왼쪽에 로고(mark)와 뒤로 가기를 둬요.
 * 오른쪽에는 그 화면의 버튼을 둬요. 탭이 있으면 이 줄 바로 아래에 붙여요.
 */
export function PageHeader({ title, owner, mark, onBack, backLabel, actions }: {
  title: string
  owner?: string
  /** 제목 왼쪽에 두는 그림. 기업 로고 같은 것이에요. */
  mark?: ReactNode
  onBack?: () => void
  backLabel?: string
  actions?: ReactNode
}) {
  const L = useMessages(TEXT)
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-2 pb-4">
      <div className="flex min-h-11 min-w-0 items-center gap-2">
        {onBack && (
          <button
            type="button"
            aria-label={backLabel ?? L.back}
            onClick={onBack}
            className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <BackIcon />
          </button>
        )}
        {mark}
        <div className={`min-w-0 ${mark ? 'ml-1' : ''}`}>
          {owner && <p className="text-[13px] text-gray-500">{owner}</p>}
          <h1 className="truncate text-[26px] leading-tight font-semibold text-gray-900">{title}</h1>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
