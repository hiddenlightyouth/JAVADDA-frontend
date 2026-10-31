/**
 * 프로필 사진 대신 이름의 첫 글자를 연한 메인 컬러 동그라미에 넣어요. 이름이 비어 있으면 물음표예요.
 * 사이드바의 계정 버튼과 앱 로그인 화면이 같이 써요. 크기와 글자 크기는 className으로 정해요.
 */
export function Avatar({ name, className = 'size-8 text-[13px]' }: { name: string; className?: string }) {
  // 두 코드 단위로 된 글자도 반으로 잘리지 않게 글자 단위로 꺼내요.
  const initial = [...(name.trim() || '?')][0].toUpperCase()
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-hover ${className}`}>
      {initial}
    </span>
  )
}
