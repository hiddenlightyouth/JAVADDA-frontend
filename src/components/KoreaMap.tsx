import type { ReactNode } from 'react'
import type { Company } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { MAP_HEIGHT, MAP_WIDTH, METRO, project, PROVINCES, REGION_BOXES } from '../lib/koreaMap'
import type { Place, RegionId } from '../lib/regions'
import { CompanyMark, Tip } from './GapParts'

/**
 * 라이브러리 없이 SVG로 그린 우리나라 지도예요. 채용 지도와 기업 상세의 근무지가 같이 써요.
 * 권역을 고르면 그 권역으로 확대하고(경계선 묶음에 transform을 줘서 부드럽게 움직여요), 핀은 확대해도 크기가 그대로이게 지도 위에 HTML로 올려요.
 * 지금 확대한 크기에서 서로 겹치는 핀은 공고가 많은 핀으로 묶어서 "강남 외 2"처럼 하나로 그려요. 누르면 묶인 자리를 모두 넘겨줘요.
 * 경계는 `src/lib/koreaMap.ts`(scripts/korea-map.mjs가 만들어요)에 있어요.
 */

/** 지도에 꽂는 핀이에요. 한 자리에 공고를 낸 기업의 로고를 셋까지 겹쳐 그리고, 자리 이름과 공고 수를 적어요. */
export interface MapPin {
  place: Place
  companies: Company[]
  /** 그 자리의 공고. 수를 적고, 핀을 묶을 때 두 자리를 함께 적은 공고를 한 번만 세요. 없으면 수를 적지 않아요. */
  postings?: string[]
  /** 핀에 적는 이름. 없으면 자리 이름이에요. */
  name?: string
}

/** 겹치는 핀을 묶은 것이에요. 공고가 가장 많은 핀의 자리에 그려요. */
export interface PinGroup {
  places: Place[]
  companies: Company[]
  postings?: string[]
  name: string
}

const TEXT = messages({
  ko: { more: (name: string, rest: number) => `${name} 외 ${rest}` },
  en: { more: (name: string, rest: number) => `${name} +${rest}` },
})

/** 핀 하나가 차지하는 폭과 높이예요(지도 단위, 지도 칸에서 대체로 px과 같아요). 이보다 가까우면 묶어요. */
const PIN_GAP_X = 76
const PIN_GAP_Y = 32

/** 권역마다 공고 수를 띄우는 자리예요. 경계의 가운데가 아니라 눈으로 보기 좋은 곳에 둬요. */
const REGION_LABEL: Record<RegionId, [number, number]> = {
  capital: [127.05, 37.42],
  gangwon: [128.35, 37.72],
  chungcheong: [127.15, 36.55],
  jeolla: [126.95, 35.3],
  gyeongsang: [128.65, 35.95],
  jeju: [126.55, 33.36],
}

/** 수도권은 서해의 섬까지 감싸면 덜 확대돼서, 서울과 경기 본토를 감싸는 칸으로 확대해요. */
const FOCUS_BOX: Partial<Record<RegionId, [number, number, number, number]>> = {
  capital: [...project(126.7, 37.72), ...project(127.3, 37.2)],
}

/** 자료에 없어 따로 그리는 독도 자리예요. 이 크기에서는 점보다 작아서 작은 점으로 그려요. */
const DOKDO = project(131.8667, 37.2408)

/** 고른 칸이 지도 가운데에 꽉 차게 들어오는 확대와 이동이에요. */
function viewOf(box: [number, number, number, number] | null): { scale: number; x: number; y: number } {
  if (!box) return { scale: 1, x: 0, y: 0 }
  const [left, top, right, bottom] = box
  const scale = Math.min(12, 0.9 * Math.min(MAP_WIDTH / (right - left), MAP_HEIGHT / (bottom - top)))
  return { scale, x: MAP_WIDTH / 2 - scale * ((left + right) / 2), y: MAP_HEIGHT / 2 - scale * ((top + bottom) / 2) }
}

export function KoreaMap({
  focus = null,
  box = null,
  counts,
  pins = [],
  activePlaces = [],
  regionLabel,
  pinLabel,
  onRegion,
  onPin,
  labels = [],
  overlay,
  className = '',
}: {
  /** 확대할 권역. 없으면 전국을 보여줘요. */
  focus?: RegionId | null
  /** 권역 대신 직접 정한 칸으로 확대해요. 기업 상세의 근무지처럼 핀 몇 개만 볼 때 써요. */
  box?: [number, number, number, number] | null
  /** 권역마다 공고 수. 넘기면 수가 많을수록 짙게 칠하고, 전국을 볼 때 권역마다 수를 띄워요. */
  counts?: Record<RegionId, number>
  pins?: MapPin[]
  /** 고른 자리. 이 자리가 든 핀을 메인 컬러로 칠해요. */
  activePlaces?: string[]
  /** 권역 말풍선의 글자. 넘기지 않으면 권역 말풍선을 그리지 않아요. */
  regionLabel?: (region: RegionId, count: number) => string
  /** 핀에 마우스를 올리면 뜨는 설명 */
  pinLabel?: (pin: PinGroup) => string
  onRegion?: (region: RegionId) => void
  onPin?: (pin: PinGroup) => void
  /** 어디인지 알 수 있게 작게 적는 지명이에요. 기업 상세처럼 좁게 확대했을 때 써요. */
  labels?: { name: string; lon: number; lat: number }[]
  /** 지도 위 왼쪽 위에 얹는 버튼 */
  overlay?: ReactNode
  className?: string
}) {
  const L = useMessages(TEXT)
  const view = viewOf(box ?? (focus ? (FOCUS_BOX[focus] ?? REGION_BOXES[focus]) : null))
  const max = counts ? Math.max(1, ...Object.values(counts)) : 1
  // 확대한 지도 위의 자리를 지도 칸에 대한 퍼센트로 바꿔요. 핀과 말풍선은 이 자리에 HTML로 놓여요.
  const at = (lon: number, lat: number) => {
    const [x, y] = project(lon, lat)
    return { left: `${((x * view.scale + view.x) / MAP_WIDTH) * 100}%`, top: `${((y * view.scale + view.y) / MAP_HEIGHT) * 100}%` }
  }
  const moving = 'transition-[left,top] duration-500 ease-out'

  function fill(region: RegionId) {
    if (focus && region !== focus) return 'fill-gray-100'
    const count = counts?.[region] ?? 0
    if (!counts || count === 0) return 'fill-gray-200/70'
    return 'fill-brand'
  }
  // 수가 많을수록 짙어요. 적은 권역도 보이게 제곱근으로 펴요.
  const opacity = (region: RegionId) => (!counts || !counts[region] || (focus && region !== focus) ? 1 : focus ? 0.14 : 0.16 + 0.5 * Math.sqrt(counts[region] / max))

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="absolute inset-0 size-full" aria-hidden>
        <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: 'transform 500ms ease-out' }}>
          {PROVINCES.map((province) => (
            <path
              key={province.code}
              d={province.d}
              fillOpacity={opacity(province.region)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1}
              stroke="var(--color-white)"
              strokeLinejoin="round"
              onClick={onRegion && (counts?.[province.region] ?? 0) > 0 ? () => onRegion(province.region) : undefined}
              className={`${fill(province.region)} transition-[fill-opacity] duration-300 ${onRegion && (counts?.[province.region] ?? 0) > 0 && !focus ? 'cursor-pointer hover:[fill-opacity:0.85]' : ''}`}
            />
          ))}
          {(focus === 'capital' || box) &&
            METRO.map((area) => <path key={area.name + area.d.length} d={area.d} fill="none" stroke="var(--color-white)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" opacity={0.9} />)}
          <circle cx={DOKDO[0]} cy={DOKDO[1]} r={1.6} className="fill-gray-300" />
        </g>
      </svg>

      {/* 전국을 볼 때는 권역마다 공고 수를 띄워요. */}
      {!focus &&
        !box &&
        counts &&
        regionLabel &&
        (Object.keys(REGION_LABEL) as RegionId[]).map((region) => {
          const count = counts[region] ?? 0
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

      {labels.map((label) => (
        <span key={label.name} style={at(label.lon, label.lat)} className={`absolute -translate-x-1/2 -translate-y-1/2 text-[12px] font-medium text-gray-400 ${moving}`}>
          {label.name}
        </span>
      ))}

      {groupPins(pins, view, L.more).map((pin) => {
        const active = pin.places.some((item) => activePlaces.includes(item.id))
        const body = (
          <>
            <span className="flex -space-x-2">
              {pin.companies.slice(0, 3).map((company) => (
                <CompanyMark key={company.id} company={company} className="size-6 rounded-full! text-[9px] ring-2 ring-white" />
              ))}
            </span>
            <span className={!pin.postings ? 'pr-1.5' : ''}>{pin.name}</span>
            {pin.postings && <span className={`pr-1 tabular-nums ${active ? 'text-white/80' : 'text-gray-400'}`}>{pin.postings.length}</span>}
          </>
        )
        const look = `flex h-8 items-center gap-1.5 rounded-full py-1 pr-2 pl-1 text-[12.5px] font-semibold whitespace-nowrap ring-1 transition-colors ${
          active ? 'bg-brand text-white ring-brand' : 'bg-white text-gray-900 ring-gray-200 hover:ring-brand'
        }`
        return (
          <span key={pin.places.map((item) => item.id).join()} style={at(pin.places[0].lon, pin.places[0].lat)} className={`absolute -translate-x-1/2 -translate-y-1/2 ${moving} ${active ? 'z-10' : 'hover:z-10'}`}>
            <Tip text={pinLabel?.(pin) ?? pin.name}>
              {onPin ? (
                <button type="button" onClick={() => onPin(pin)} aria-pressed={active} className={look}>
                  {body}
                </button>
              ) : (
                <span className={look}>{body}</span>
              )}
            </Tip>
          </span>
        )
      })}

      {overlay && <div className="absolute top-3 left-3 flex gap-2">{overlay}</div>}
    </div>
  )
}

/**
 * 지금 확대한 크기에서 겹치는 핀을 묶어요. 공고가 많은 핀부터 자리를 잡고, 그 둘레에 겹치는 핀은 그 핀에 더해요.
 * 묶인 핀의 기업은 공고가 많은 자리의 기업부터 늘어놓아요.
 */
function groupPins(pins: MapPin[], view: { scale: number; x: number; y: number }, more: (name: string, rest: number) => string): PinGroup[] {
  const groups: (PinGroup & { x: number; y: number; first: string })[] = []
  for (const pin of [...pins].sort((a, b) => (b.postings?.length ?? 0) - (a.postings?.length ?? 0))) {
    const [px, py] = project(pin.place.lon, pin.place.lat)
    const x = px * view.scale + view.x
    const y = py * view.scale + view.y
    const near = groups.find((group) => Math.abs(group.x - x) < PIN_GAP_X && Math.abs(group.y - y) < PIN_GAP_Y)
    if (!near) {
      groups.push({ places: [pin.place], companies: [...pin.companies], postings: pin.postings, name: pin.name ?? pin.place.name, first: pin.name ?? pin.place.name, x, y })
      continue
    }
    near.places.push(pin.place)
    for (const company of pin.companies) if (!near.companies.some((item) => item.id === company.id)) near.companies.push(company)
    if (pin.postings) near.postings = [...new Set([...(near.postings ?? []), ...pin.postings])]
    near.name = more(near.first, near.places.length - 1)
  }
  return groups.map(({ places, companies, postings, name }) => ({ places, companies, postings, name }))
}

/** 핀 몇 개가 다 들어오는 칸이에요. 핀이 한 곳뿐이면 그 둘레를 조금 넓혀 잡아요. */
export function boxAround(places: Place[], margin = 0.12): [number, number, number, number] | null {
  if (places.length === 0) return null
  const points = places.map((item) => project(item.lon, item.lat))
  const pad = margin * 100
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
}
