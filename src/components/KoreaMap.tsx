import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Company } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { MAP_HEIGHT, MAP_WIDTH, METRO, project, PROVINCES, REGION_BOXES, RIVERS } from '../lib/koreaMap'
import type { Place, RegionId } from '../lib/regions'
import { CompanyMark, Tip } from './GapParts'
import { MinusIcon, PlusIcon } from './Icons'

/**
 * 라이브러리 없이 SVG로 그린 우리나라 지도예요. 채용 지도와 기업 상세의 위치 칸이 같이 써요.
 * 지도 칸의 크기를 재서 그 칸을 꽉 채워 그리고, interactive면 휠(트랙패드 두 손가락과 핀치 포함)로 확대하고 끌어서 옮겨요.
 * 칸(target)이 바뀌면 그 칸이 가운데에 꽉 차게 부드럽게 옮겨 가요.
 * 전국을 볼 때는 권역마다 공고 수 말풍선을, 어느 정도(pinZoom) 확대하면 동네마다 핀을 보여줘요. 핀과 말풍선은 확대해도 크기가 그대로이게 HTML로 올려요.
 * 핀은 기업 로고만 그리고, 지금 크기에서 서로 겹치는 로고는 공고가 많은 핀으로 묶어서 오른쪽 위에 묶인 기업 수를 적어요.
 * 경계와 강은 `src/lib/koreaMap.ts`(scripts/korea-map.mjs가 만들어요)에 있어요.
 */

/** 지도에 꽂는 핀이에요. 한 기업이 한 자리에 낸 공고마다 하나이고, 기업 로고만 그려요. */
export interface MapPin {
  place: Place
  company: Company
  /** 그 자리에 낸 공고. 공고가 많은 핀이 묶음의 앞에 와요. */
  postings: string[]
}

/** 겹치는 핀을 묶은 것이에요. 공고가 가장 많은 핀의 자리에 그 기업 로고를 그리고, 둘 이상 묶였으면 오른쪽 위에 기업 수를 적어요. */
export interface PinGroup {
  places: Place[]
  companies: Company[]
  postings: string[]
  /** 칸 제목에 쓰는 이름. 묶인 자리가 여럿이면 "강남 외 1"이에요. 지도에는 적지 않아요. */
  name: string
}

/** 현위치처럼 파란 점으로 찍는 자리예요. 기업 상세의 본사 자리예요. */
export interface MapMarker {
  lon: number
  lat: number
  label: string
}

export type MapBox = [number, number, number, number]

const TEXT = messages({
  ko: { more: (name: string, rest: number) => `${name} 외 ${rest}`, zoomIn: '확대', zoomOut: '축소' },
  en: { more: (name: string, rest: number) => `${name} +${rest}`, zoomIn: 'Zoom in', zoomOut: 'Zoom out' },
})

/** 로고 핀 하나가 차지하는 폭(px)이에요. 이보다 가까우면 묶어요. */
const PIN_GAP = 38

/** 권역마다 공고 수를 띄우는 자리예요. 경계의 가운데가 아니라 눈으로 보기 좋은 곳에 둬요. */
export const REGION_LABEL: Record<RegionId, [number, number]> = {
  capital: [127.05, 37.42],
  gangwon: [128.35, 37.72],
  chungcheong: [127.15, 36.55],
  jeolla: [126.95, 35.3],
  gyeongsang: [128.65, 35.95],
  jeju: [126.55, 33.36],
}

/** 수도권은 서해의 섬까지 감싸면 덜 확대돼서, 서울과 경기 본토를 감싸는 칸으로 확대해요. */
const FOCUS_BOX: Partial<Record<RegionId, MapBox>> = {
  capital: [...project(126.7, 37.72), ...project(127.3, 37.2)],
}

/** 권역을 고르면 확대할 칸이에요. */
export const regionBox = (region: RegionId): MapBox => FOCUS_BOX[region] ?? REGION_BOXES[region]

const NATION: MapBox = [0, 0, MAP_WIDTH, MAP_HEIGHT]

/** 자료에 없어 따로 그리는 독도 자리예요. 이 크기에서는 점보다 작아서 작은 점으로 그려요. */
const DOKDO = project(131.8667, 37.2408)

interface View {
  /** 지도 단위 하나가 몇 px인지 */
  scale: number
  x: number
  y: number
}

/** 칸이 지도 칸 가운데에 꽉 차게 들어오는 확대와 이동이에요. */
function fit(box: MapBox, width: number, height: number, max = Infinity): View {
  const [left, top, right, bottom] = box
  const scale = Math.min(max, 0.9 * Math.min(width / (right - left), height / (bottom - top)))
  return { scale, x: width / 2 - scale * ((left + right) / 2), y: height / 2 - scale * ((top + bottom) / 2) }
}

export function KoreaMap({
  target = null,
  counts,
  regionLabel,
  onRegion,
  pins = [],
  pinZoom = 0,
  activePin = null,
  pinLabel,
  onPin,
  markers = [],
  labels = [],
  interactive = false,
  padRight = 0,
  overlay,
  className = '',
}: {
  /** 가운데에 꽉 차게 보여줄 칸. 없으면 전국이에요. 바뀌면 부드럽게 옮겨 가요. */
  target?: MapBox | null
  /** 권역마다 공고 수. 넘기면 전국을 볼 때 수가 많을수록 짙게 칠하고 권역마다 수를 띄워요. */
  counts?: Record<RegionId, number>
  /** 권역 말풍선의 글자. 넘기지 않으면 권역 말풍선을 그리지 않아요. */
  regionLabel?: (region: RegionId, count: number) => string
  onRegion?: (region: RegionId) => void
  pins?: MapPin[]
  /** 전국 크기의 몇 배부터 핀을 보여줄지. 그 아래에서는 권역 말풍선이에요. 0이면 늘 핀이에요. */
  pinZoom?: number
  /** 고른 핀의 열쇠(`pinKey`). 그 핀에 메인 컬러 테두리를 둘러요. */
  activePin?: string | null
  /** 핀에 마우스를 올리면 뜨는 설명 */
  pinLabel?: (pin: PinGroup) => string
  onPin?: (pin: PinGroup) => void
  markers?: MapMarker[]
  /** 어디인지 알 수 있게 작게 적는 지명이에요. */
  labels?: { name: string; lon: number; lat: number }[]
  /** 휠로 확대하고 끌어서 옮겨요. 확대와 축소 버튼도 생겨요. */
  interactive?: boolean
  /** 지도 오른쪽을 덮는 칸의 폭(px). 칸을 가운데에 놓을 때 이만큼 비켜요. 좁은 지도(768px 미만)에서는 칸이 아래에 떠서 비키지 않아요. */
  padRight?: number
  /** 지도 위 왼쪽 위에 얹는 것 */
  overlay?: ReactNode
  /** 지도 칸의 크기는 바깥에서 정해요. */
  className?: string
}) {
  const L = useMessages(TEXT)
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  // 칸을 바꾸거나 버튼으로 확대할 때만 부드럽게 옮겨요. 휠과 끌기는 손을 바로 따라와야 해서 옮기는 움직임을 꺼요.
  const [smooth, setSmooth] = useState(false)
  const nation = fit(NATION, size.width || 1, size.height || 1)
  const minScale = nation.scale * 0.8
  const maxScale = nation.scale * 24

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const targetKey = target?.join() ?? ''
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (!size.width || !size.height) return
    // 처음 그릴 때는 바로 그 자리에 두고, 그 뒤로 칸이 바뀌면 부드럽게 옮겨요.
    setSmooth(fitted.current)
    fitted.current = true
    const pad = size.width >= 768 ? padRight : 0
    setView(fit(target ?? NATION, size.width - pad, size.height, maxScale))
    // target은 targetKey로 봐요. 같은 칸을 새 배열로 넘겨도 다시 옮기지 않아요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, size.width, size.height])

  const viewRef = useRef(view)
  viewRef.current = view

  function zoomAt(px: number, py: number, factor: number, animate: boolean) {
    const current = viewRef.current
    const scale = Math.min(maxScale, Math.max(minScale, current.scale * factor))
    const ratio = scale / current.scale
    setSmooth(animate)
    setView({ scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio })
  }

  // 휠로 확대해요. 페이지가 같이 스크롤되지 않게 passive가 아닌 리스너로 막아요.
  const zoomRef = useRef(zoomAt)
  zoomRef.current = zoomAt
  useEffect(() => {
    const element = ref.current
    if (!element || !interactive) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.012 : 0.0025))
      zoomRef.current(event.clientX - rect.left, event.clientY - rect.top, factor, false)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [interactive])

  // 끌어서 옮겨요. 조금(4px)이라도 끌었으면 손을 뗄 때의 클릭은 버려서, 끌다가 권역이나 핀이 눌리지 않아요.
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  const zoom = view.scale / nation.scale
  const detail = zoom >= pinZoom
  const max = counts ? Math.max(1, ...Object.values(counts)) : 1
  const at = (lon: number, lat: number) => {
    const [x, y] = project(lon, lat)
    return { left: x * view.scale + view.x, top: y * view.scale + view.y }
  }
  const moving = smooth ? 'transition-[left,top] duration-500 ease-out' : ''
  const shaded = counts && !detail
  // 수가 많을수록 짙어요. 적은 권역도 보이게 제곱근으로 펴요.
  const opacity = (region: RegionId) => (shaded && counts[region] ? 0.16 + 0.5 * Math.sqrt(counts[region] / max) : 1)
  const fill = (region: RegionId) => (shaded && counts[region] ? 'fill-brand' : detail && pinZoom > 0 ? 'fill-gray-100' : 'fill-gray-200/70')

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden select-none ${interactive ? 'touch-none cursor-grab active:cursor-grabbing' : ''} ${className}`}
      onPointerDown={
        interactive
          ? (event) => {
              if (event.button !== 0) return
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
              dragged.current = false
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (event) => {
              const state = drag.current
              if (!state || state.id !== event.pointerId) return
              const dx = event.clientX - state.x
              const dy = event.clientY - state.y
              if (!state.moved && Math.hypot(dx, dy) < 4) return
              if (!state.moved) {
                state.moved = true
                event.currentTarget.setPointerCapture(event.pointerId)
              }
              state.x = event.clientX
              state.y = event.clientY
              setSmooth(false)
              setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
            }
          : undefined
      }
      onPointerUp={(event) => {
        if (drag.current?.moved) dragged.current = true
        if (drag.current?.id === event.pointerId) drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onClickCapture={(event) => {
        if (!dragged.current) return
        dragged.current = false
        event.stopPropagation()
        event.preventDefault()
      }}
    >
      <svg width={size.width} height={size.height} className="absolute inset-0" aria-hidden>
        <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: smooth ? 'transform 500ms ease-out' : undefined }}>
          {PROVINCES.map((province) => {
            const clickable = onRegion && !detail && (counts?.[province.region] ?? 0) > 0
            return (
              <path
                key={province.code}
                d={province.d}
                fillOpacity={opacity(province.region)}
                vectorEffect="non-scaling-stroke"
                strokeWidth={1}
                stroke="var(--color-white)"
                strokeLinejoin="round"
                onClick={clickable ? () => onRegion(province.region) : undefined}
                className={`${fill(province.region)} transition-[fill-opacity] duration-300 ${clickable ? 'cursor-pointer hover:[fill-opacity:0.85]' : ''}`}
              />
            )
          })}
          {/* 시군구 경계는 서울이 알아볼 만큼 확대했을 때만 그려요. */}
          {zoom >= 3 &&
            METRO.map((area, index) => <path key={index} d={area.d} fill="none" stroke="var(--color-white)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />)}
          {/* 강은 실제 폭(지도 단위)으로 그려서 확대하면 같이 굵어져요. 멀리서도 보이게 1px보다는 굵게 둬요. */}
          {RIVERS.map((river, index) => (
            <path
              key={index}
              d={river.d}
              fill="none"
              stroke="var(--color-brand)"
              strokeOpacity={0.35}
              strokeWidth={Math.max(river.width, 1 / view.scale)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <circle cx={DOKDO[0]} cy={DOKDO[1]} r={Math.max(0.4, 2 / view.scale)} className="fill-gray-300" />
        </g>
      </svg>

      {labels.map((label) => (
        <span key={label.name} style={at(label.lon, label.lat)} className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[12px] font-medium text-gray-400 ${moving}`}>
          {label.name}
        </span>
      ))}

      {/* 전국을 볼 때는 권역마다 공고 수를 띄워요. */}
      {!detail &&
        counts &&
        regionLabel &&
        (Object.keys(REGION_LABEL) as RegionId[]).map((region) => {
          const count = counts[region] ?? 0
          // 공고가 없는 권역은 이름표를 두지 않아요. 0이 지도를 덮어요.
          if (count === 0) return null
          return (
            <button
              key={region}
              type="button"
              disabled={!onRegion || count === 0}
              onClick={() => onRegion?.(region)}
              style={at(...REGION_LABEL[region])}
              className={`absolute flex h-8 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap ring-1 transition-colors ${moving} ${
                count > 0 ? 'bg-white text-gray-900 ring-gray-200 hover:text-brand-hover hover:ring-brand' : 'cursor-default bg-white/70 text-gray-400 ring-gray-200/70'
              }`}
            >
              {regionLabel(region, count)}
            </button>
          )
        })}

      {detail &&
        groupPins(pins, (lon, lat) => {
          const point = at(lon, lat)
          return [point.left, point.top]
        }, L.more).map((pin) => {
          const active = activePin === pinKey(pin)
          return (
            <span key={pinKey(pin)} style={at(pin.places[0].lon, pin.places[0].lat)} className={`absolute -translate-x-1/2 -translate-y-1/2 ${moving} ${active ? 'z-10' : 'hover:z-10'}`}>
              <Tip text={pinLabel?.(pin) ?? pin.name}>
                <button type="button" onClick={() => onPin?.(pin)} aria-pressed={active} aria-label={pinLabel?.(pin) ?? pin.name} className="relative block rounded-full">
                  <LogoPin company={pin.companies[0]} count={pin.companies.length} active={active} />
                </button>
              </Tip>
            </span>
          )
        })}

      {markers.map((marker) => (
        <span key={`${marker.lon},${marker.lat}`} style={at(marker.lon, marker.lat)} className={`absolute -translate-x-1/2 -translate-y-1/2 ${moving}`}>
          <Tip text={marker.label}>
            <LocationDot />
          </Tip>
        </span>
      ))}

      {overlay && <div className="absolute top-3 left-3 flex flex-wrap gap-2">{overlay}</div>}

      {interactive && (
        <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
          <button type="button" aria-label={L.zoomIn} onClick={() => zoomAt(size.width / 2, size.height / 2, 1.6, true)} className="flex size-9 items-center justify-center text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
            <PlusIcon className="size-4" />
          </button>
          <span className="h-px bg-gray-200" />
          <button type="button" aria-label={L.zoomOut} onClick={() => zoomAt(size.width / 2, size.height / 2, 1 / 1.6, true)} className="flex size-9 items-center justify-center text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
            <MinusIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/** 지도 앱의 현위치처럼 흰 테두리를 두른 파란 점이에요. 둘레에 옅은 테가 천천히 퍼져요. */
export function LocationDot() {
  return (
    <span className="relative flex size-5 items-center justify-center">
      <span className="absolute size-10 rounded-full bg-brand/15" />
      <span className="absolute size-5 rounded-full bg-brand/40 motion-safe:animate-ping" />
      <span className="relative size-4 rounded-full border-[3px] border-white bg-brand" />
    </span>
  )
}

/** 기업 로고만 그린 둥근 핀이에요. 둘 이상 묶였으면 오른쪽 위에 기업 수를 적어요. 고른 핀은 메인 컬러 테두리예요. 네이버 지도의 핀도 같은 모양이에요(`logoPinHtml`). */
export function LogoPin({ company, count, active }: { company: Company; count: number; active: boolean }) {
  return (
    <span className={`relative block rounded-full ring-2 transition-[box-shadow] ${active ? 'ring-brand' : 'ring-white hover:ring-brand/60'}`}>
      <CompanyMark company={company} className="size-9 rounded-full! text-[13px]" />
      {count > 1 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white tabular-nums ring-2 ring-white">{count}</span>
      )}
    </span>
  )
}

/** 묶음을 알아보는 열쇠예요. 고른 핀이 그대로인지 볼 때도 써요. */
export const pinKey = (pin: PinGroup) => `${pin.places.map((item) => item.id).join()}|${pin.companies.map((item) => item.id).join()}`

/**
 * 지금 크기에서 겹치는 로고 핀을 묶어요. 공고가 많은 핀부터 자리를 잡고, 그 둘레에 겹치는 핀은 그 핀에 더해요.
 * 자리를 화면의 px로 바꾸는 방법(toPixel)을 받아서, SVG 지도와 네이버 지도가 같이 써요.
 */
export function groupPins(pins: MapPin[], toPixel: (lon: number, lat: number) => [number, number], more: (name: string, rest: number) => string): PinGroup[] {
  const groups: (PinGroup & { x: number; y: number; first: string })[] = []
  for (const pin of [...pins].sort((a, b) => b.postings.length - a.postings.length)) {
    const [x, y] = toPixel(pin.place.lon, pin.place.lat)
    const near = groups.find((group) => Math.hypot(group.x - x, group.y - y) < PIN_GAP)
    if (!near) {
      groups.push({ places: [pin.place], companies: [pin.company], postings: pin.postings, name: pin.place.name, first: pin.place.name, x, y })
      continue
    }
    if (!near.places.some((item) => item.id === pin.place.id)) near.places.push(pin.place)
    if (!near.companies.some((item) => item.id === pin.company.id)) near.companies.push(pin.company)
    near.postings = [...new Set([...near.postings, ...pin.postings])]
    near.name = near.places.length > 1 ? more(near.first, near.places.length - 1) : near.first
  }
  return groups.map(({ places, companies, postings, name }) => ({ places, companies, postings, name }))
}

/** 자리 몇 곳이 다 들어오는 칸이에요. 한 곳뿐이면 그 둘레를 margin(도)만큼 넓혀 잡아요. */
export function boxAround(points: { lon: number; lat: number }[], margin = 0.12): MapBox | null {
  if (points.length === 0) return null
  const projected = points.map((item) => project(item.lon, item.lat))
  const pad = margin * 100
  const xs = projected.map(([x]) => x)
  const ys = projected.map(([, y]) => y)
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
}
