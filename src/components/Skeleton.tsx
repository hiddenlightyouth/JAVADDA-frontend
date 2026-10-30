/** 글자나 그림이 올 자리에 두는 옅은 회색 칸이에요. 움직임 줄이기 설정에서는 멈춰 있어요. 여러 개를 묶을 때는 `ui`의 `Busy`로 감싸요. */
export function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block rounded-full bg-gray-200/60 motion-safe:animate-pulse ${className}`} />
}
