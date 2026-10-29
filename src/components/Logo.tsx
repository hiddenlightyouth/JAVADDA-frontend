import { ScriptMark } from './LofyScript'

/** 헤더 왼쪽의 로고예요. 사이드바와 같은 손글씨를 움직임 없이 그려요. */
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        if (!onClick) return
        event.preventDefault()
        onClick()
      }}
      className="inline-flex items-center"
    >
      <ScriptMark className="logo-mark h-6 w-auto" />
    </a>
  )
}
