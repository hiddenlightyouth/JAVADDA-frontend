import { followLink } from '../lib/links'
import { ScriptMark } from './LofyScript'

/** 헤더 왼쪽의 로고예요. 사이드바와 같은 손글씨를 움직임 없이 그려요. 보조 키를 누르고 누르면 새 탭으로 열려요. */
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a href="/" onClick={onClick && followLink(onClick)} className="inline-flex items-center">
      <ScriptMark className="logo-mark h-6 w-auto" />
    </a>
  )
}
