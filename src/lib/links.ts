import type { MouseEvent } from 'react'

/** 보조 키 없이 왼쪽 버튼으로 누른 것인지예요. 아니면 새 탭으로 열기 같은 브라우저 기본 동작에 맡겨요. */
export const isPlainClick = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)

/**
 * 링크를 눌렀을 때 페이지를 새로 열지 않고 화면만 바꾸는 onClick이에요.
 * Cmd, Ctrl, Shift, Option이나 가운데 버튼으로 누르면 막지 않아서, 새 탭으로 여는 동작이 그대로예요.
 */
export const followLink = (go: () => void) => (event: MouseEvent) => {
  if (!isPlainClick(event)) return
  event.preventDefault()
  go()
}
