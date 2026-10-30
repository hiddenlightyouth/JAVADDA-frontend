import type { ReactNode } from 'react'
import { messages, useMessages } from '../lib/i18n'
import { BackIcon } from './Icons'
import { FormError } from './ui'

/**
 * 앱 화면(새 진단, 탐색, 추천, 이력서, 진단 시작, 리포트, 관리자, 내 정보)이 같이 쓰는 틀이에요.
 * 제목 줄, 흰 바탕, 아래 버튼 줄, 복사를 한 모양으로 맞춰요.
 * 새 앱 화면도 이것을 써서 따로 만들지 않아요.
 */

const TEXT = messages({
  ko: { back: '뒤로 가기' },
  en: { back: 'Back' },
})

/** 앱 화면의 바깥 틀이에요. 위의 헤더(좁은 화면 56px, 넓은 화면 36px)만큼 비우고 좌우 여백을 둬요. */
export const pageFrame = 'flex min-h-0 flex-1 flex-col px-6 pt-14 md:px-10 md:pt-9'

/** 제목 줄 아래를 좌우 여백 없이 가득 채우는 바탕이에요. 새 진단 화면처럼 흰색이고, 선 없이 여백으로 제목 줄과 나눠요. pageFrame 안에서 써요. */
export const canvas = '-mx-6 flex min-h-0 flex-1 flex-col bg-white md:-mx-10'

/**
 * 제목 줄은 맨 위에 두고 그 아래만 스크롤하는 앱 화면이에요. 공고 탐색, 추천 공고, 면접 연습이 같이 써요.
 * 스크롤 칸이 화면 폭을 다 써서, 스크롤 막대가 창 가장자리에 붙어요.
 */
export function ScrollPage({ header, children, className = '' }: { header: ReactNode; children: ReactNode; className?: string }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-6 pt-14 md:px-10 md:pt-9">{header}</div>
      <div className={`min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-10 ${className}`}>{children}</div>
    </main>
  )
}

/**
 * 앱 화면 맨 위의 제목 줄이에요. 레포를 보는 화면이면 제목 위에 소유자를 작게 적고, 왼쪽에 뒤로 가기를 둬요.
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

/** 내용 칸과 아래 버튼 줄이에요. 흰 바탕 위에 640px 폭으로 가운데에 둬요. 진단 시작 화면이 써요. */
export function StepLayout({ top, children, error, buttons }: {
  /** 내용 위에 두는 단계 표시 */
  top?: ReactNode
  children: ReactNode
  /** 아래 줄 왼쪽에 빨갛게 보여줄 오류 */
  error?: string
  buttons: ReactNode
}) {
  return (
    <div className={canvas}>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-[640px]">
          {top && <div className="mb-8">{top}</div>}
          {children}
        </div>
      </div>
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 md:px-10">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3">
          {error ? <FormError className="min-w-0">{error}</FormError> : <span />}
          <div className="flex shrink-0 items-center gap-2">{buttons}</div>
        </div>
      </div>
    </div>
  )
}

/** 글을 클립보드에 복사하고 됐는지 알려줘요. */
export const copyText = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  )
