import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: { loading: '불러오고 있어요.' },
  en: { loading: 'Loading.' },
})

/** 글자나 그림이 올 자리에 두는 옅은 회색 칸이에요. 움직임 줄이기 설정에서는 멈춰 있어요. */
export function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block rounded-full bg-gray-200/60 motion-safe:animate-pulse ${className}`} />
}

/** 목록이 올 자리의 뼈대예요. 줄마다 제목 한 줄과 설명 한 줄이에요. */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  const text = useMessages(TEXT)
  const widths = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2', 'w-3/4', 'w-3/5']
  return (
    <ul aria-busy="true">
      <li className="sr-only">{text.loading}</li>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} aria-hidden className="px-3 py-2.5">
          <Bone className={`h-3.5 ${widths[index % widths.length]}`} />
          <Bone className="mt-2 h-3 w-1/3" />
        </li>
      ))}
    </ul>
  )
}
