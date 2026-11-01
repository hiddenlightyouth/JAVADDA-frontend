import { useEffect, useRef, useState, type ReactNode } from 'react'

/** 한 칸 넘어가는 간격과 넘어가는 동안의 시간(ms)이에요. */
const EVERY = 2600
const SLIDE = 600

/**
 * 한 줄에 들어가는 만큼 칸을 보여주고, 칸이 더 있으면 잠깐마다 왼쪽으로 한 칸씩 밀려나며 새 칸이 오른쪽에서 들어오는 줄이에요.
 * 새 진단 화면의 기업으로 둘러보기와 마감 달력의 지금 뜨는 기업이 같이 써요.
 * 끝에 닿으면 처음 칸으로 이어져서 계속 돌아요. 움직이는 칸은 누르기 어려워서 마우스를 올리거나 키보드로 들어오면 멈추고,
 * 줄이 화면 밖에 있거나 탭을 보고 있지 않을 때도 멈춰요. 움직임 줄이기 설정이면 움직이지 않아요.
 * 칸 폭은 늘 같아서 화면이 넓어도 칸 사이가 벌어지지 않고, 오른쪽 끝에 걸친 칸은 잘린 채로 보여서 뒤에 더 있다는 걸 알려요.
 */
export function Carousel<T>({ items, itemWidth, gap, keyOf, render, className = '' }: {
  items: readonly T[]
  itemWidth: number
  gap: number
  keyOf: (item: T) => string
  /** hidden은 오른쪽에 걸쳐 있거나 들어올 차례를 기다리는 칸이에요. 키보드로 들어가지 않게 tabIndex를 -1로 둬요. */
  render: (item: T, hidden: boolean) => ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [first, setFirst] = useState(0)
  const [sliding, setSliding] = useState(false)
  const [paused, setPaused] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => !document.hidden)
  const [still] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    const seen = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting))
    seen.observe(element)
    const onVisibility = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      seen.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // 칸이 바뀌어(걸러서 줄어드는 등) 첫 칸이 목록 밖으로 나가면 처음으로 돌아가요.
  useEffect(() => {
    if (first >= items.length) setFirst(0)
  }, [first, items.length])

  // 다 보이는 칸 수예요. 그 뒤로 걸친 칸은 잘려 보이고, 누를 수 없어요.
  const visible = Math.max(1, Math.floor((width + gap) / (itemWidth + gap)))
  const moving = !still && items.length > visible

  // 한 칸을 다 밀고 나서 다음 칸을 기다려요. 따로 도는 타이머를 두면 밀리는 중과 겹치거나, 멈췄다 풀릴 때 간격이 들쭉날쭉해요.
  useEffect(() => {
    if (!moving || paused || !onScreen || !tabVisible || sliding) return
    const timer = window.setTimeout(() => setSliding(true), EVERY)
    return () => window.clearTimeout(timer)
  }, [moving, paused, onScreen, tabVisible, sliding, first])

  // 밀기가 끝나면 첫 칸을 하나 넘기고 자리를 되돌려요. transitionend가 오지 않는 때(탭을 옮긴 사이 등)에도 멈춰 있지 않게, 시간이 지나면 직접 끝내요.
  const finishing = useRef(false)
  const finish = () => {
    if (finishing.current) return
    finishing.current = true
    setSliding(false)
    setFirst((value) => (value + 1) % Math.max(1, items.length))
  }
  useEffect(() => {
    if (!sliding) {
      finishing.current = false
      return
    }
    const timer = window.setTimeout(finish, SLIDE + 150)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliding])

  if (items.length === 0) return null
  // 걸친 칸과 그다음 칸까지 그려 두고, 밀려날 때 그 칸들이 들어와요. 다 밀리면 첫 칸을 하나 넘기고 자리를 되돌려요.
  const count = Math.min(items.length, moving ? visible + 2 : visible + 1)
  const start = first % items.length
  const shown = Array.from({ length: count }, (_, index) => items[(start + index) % items.length])
  return (
    <div
      ref={ref}
      className={`overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul
        className="flex"
        style={{
          gap,
          transform: sliding ? `translateX(-${itemWidth + gap}px)` : undefined,
          transition: sliding ? `transform ${SLIDE}ms cubic-bezier(0.4, 0, 0.2, 1)` : undefined,
        }}
        onTransitionEnd={(event) => {
          // 안쪽 버튼의 hover 색 바뀜도 transitionend로 올라와서, 줄이 밀린 것(transform)만 받아요. 안 거르면 마우스를 올릴 때마다 한 칸씩 넘어가요.
          if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
          finish()
        }}
      >
        {shown.map((item, index) => {
          const hidden = index >= visible
          return (
            <li key={keyOf(item)} className="shrink-0" style={{ width: itemWidth }} aria-hidden={hidden || undefined}>
              {render(item, hidden)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
