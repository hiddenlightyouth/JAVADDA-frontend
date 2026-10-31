import { useEffect, useRef, useState } from 'react'
import type { Company } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { unproject } from '../lib/koreaMap'
import { loadNaverMaps, onNaverMapAuthFailure, type NaverMap, type NaverMaps, type NaverMarker } from '../lib/naverMap'
import type { RegionId } from '../lib/regions'
import { groupPins, pinKey, REGION_LABEL, type MapBox, type MapPin, type PinGroup } from './KoreaMap'

/**
 * 네이버 지도로 그린 채용 지도예요. 키가 있을 때 `JobMap`이 SVG 지도(`KoreaMap`) 대신 써요. 인증에 실패하면 onFail로 알려서 SVG 지도로 돌아가요.
 * SVG 지도와 같은 규칙이에요. 멀리서는 권역마다 공고 수 말풍선을, 확대하면(pinZoom) 기업 로고 핀을 꽂고, 겹치는 로고는 묶어서 오른쪽 위에 기업 수를 적어요.
 * 마커는 네이버 지도가 HTML 글자로 받아요. 네이버 지도 안에서는 Tailwind class가 다 먹지 않아서, `LogoPin`과 권역 말풍선과 같은 모양을 인라인 스타일로 적어요.
 * 지도 바탕이 다크 모드에서도 밝아서 색은 고정값(메인 컬러 #2E90FA, 흰색, 회색)이에요.
 */

const TEXT = messages({
  ko: { more: (name: string, rest: number) => `${name} 외 ${rest}` },
  en: { more: (name: string, rest: number) => `${name} +${rest}` },
})

/** 처음 보여주는 전국 자리와 확대 정도예요. */
const NATION_CENTER: [number, number] = [36.1, 127.9]
const NATION_ZOOM = 7

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

const BRAND = '#2E90FA'
const FONT = "font-family:Pretendard,system-ui,sans-serif;letter-spacing:-0.02em"

/** `CompanyMark`와 같은 모양의 둥근 로고(없으면 머리글자)예요. */
function markHtml(company: Company) {
  const box = 'display:flex;width:36px;height:36px;align-items:center;justify-content:center;overflow:hidden;border-radius:9999px;box-sizing:border-box'
  return company.logo
    ? `<span style="${box};border:1px solid #e5e7eb;background:#fff"><img src="${escape(company.logo)}" alt="" style="width:100%;height:100%;object-fit:contain;display:block"></span>`
    : `<span style="${box};background:#f3f4f6;color:#374151;font-size:13px;font-weight:600;${FONT}">${escape(company.initial)}</span>`
}

/** `LogoPin`과 같은 모양의 핀이에요. 둘 이상 묶였으면 오른쪽 위에 기업 수를 적어요. */
function logoPinHtml(pin: PinGroup, active: boolean, label: string) {
  const count =
    pin.companies.length > 1
      ? `<span style="position:absolute;top:-6px;right:-6px;display:flex;height:20px;min-width:20px;padding:0 4px;box-sizing:border-box;align-items:center;justify-content:center;border-radius:9999px;background:${BRAND};color:#fff;font-size:11px;font-weight:600;box-shadow:0 0 0 2px #fff;${FONT}">${pin.companies.length}</span>`
      : ''
  return `<div title="${escape(label)}" role="button" aria-label="${escape(label)}" style="position:relative;cursor:pointer;border-radius:9999px;box-shadow:0 0 0 ${active ? 3 : 2}px ${active ? BRAND : '#fff'}">${markHtml(pin.companies[0])}${count}</div>`
}

/** 권역 말풍선이에요. 글자 폭이 달라서 자리의 가운데로 반만큼 당겨요. */
function regionHtml(text: string, enabled: boolean) {
  return `<div role="button" style="transform:translate(-50%,-50%);display:flex;height:32px;align-items:center;padding:0 12px;border-radius:9999px;white-space:nowrap;font-size:13px;font-weight:600;${FONT};cursor:${enabled ? 'pointer' : 'default'};background:${enabled ? '#fff' : 'rgba(255,255,255,.7)'};color:${enabled ? '#111827' : '#9ca3af'};box-shadow:0 0 0 1px #e5e7eb">${escape(text)}</div>`
}

/** 내 위치예요. `LocationDot`과 같은 파란 점이에요. */
const ME_HTML =
  `<div style="position:relative;width:40px;height:40px"><div style="position:absolute;inset:0;border-radius:9999px;background:rgba(46,144,250,.18)"></div>` +
  `<div style="position:absolute;left:12px;top:12px;width:16px;height:16px;border-radius:9999px;background:${BRAND};border:3px solid #fff;box-sizing:border-box"></div></div>`

export function NaverJobMap({
  target,
  padRight = 0,
  counts,
  regionLabel,
  onRegion,
  pins,
  pinZoom = 9,
  activePin,
  pinLabel,
  onPin,
  onFail,
  me = null,
  className = '',
}: {
  target: MapBox | null
  padRight?: number
  counts: Record<RegionId, number>
  regionLabel: (region: RegionId, count: number) => string
  onRegion: (region: RegionId) => void
  pins: MapPin[]
  /** 이 확대 정도(네이버 지도의 zoom)부터 로고 핀을 꽂아요. 그 아래에서는 권역 말풍선이에요. */
  pinZoom?: number
  activePin: string | null
  pinLabel: (pin: PinGroup) => string
  onPin: (pin: PinGroup) => void
  onFail: () => void
  /** 내 위치. 있으면 파란 점을 찍어요. */
  me?: { lon: number; lat: number } | null
  className?: string
}) {
  const L = useMessages(TEXT)
  const ref = useRef<HTMLDivElement>(null)
  const [api, setApi] = useState<{ maps: NaverMaps; map: NaverMap } | null>(null)
  // 지도를 옮기거나 확대하고 멈출 때마다(idle) 마커를 다시 그려요. 확대 정도에 따라 핀이 묶이고 풀려요.
  const [tick, setTick] = useState(0)
  const failRef = useRef(onFail)
  failRef.current = onFail

  useEffect(() => {
    let map: NaverMap | null = null
    let idle: unknown = null
    let stale = false
    const stop = onNaverMapAuthFailure(() => failRef.current())
    loadNaverMaps().then(
      (maps) => {
        if (stale || !ref.current) return
        map = new maps.Map(ref.current, {
          center: new maps.LatLng(...NATION_CENTER),
          zoom: NATION_ZOOM,
          minZoom: 6,
          zoomControl: true,
          zoomControlOptions: { position: maps.Position.LEFT_BOTTOM, style: maps.ZoomControlStyle.SMALL },
          scaleControl: false,
          mapDataControl: false,
        })
        idle = maps.Event.addListener(map, 'idle', () => setTick((value) => value + 1))
        setApi({ maps, map })
      },
      () => {
        if (!stale) failRef.current()
      },
    )
    return () => {
      stale = true
      stop()
      if (idle && window.naver) window.naver.maps.Event.removeListener(idle)
      map?.destroy()
    }
  }, [])

  // 권역을 고르면 그 권역으로, 전국 보기면 처음 자리로 옮겨 가요. 오른쪽에 칸이 떠 있으면 그만큼 비켜요.
  const targetKey = target?.join() ?? ''
  useEffect(() => {
    if (!api) return
    const { maps, map } = api
    if (!target) {
      map.morph(new maps.LatLng(...NATION_CENTER), NATION_ZOOM)
      return
    }
    const [west, north] = unproject(target[0], target[1])
    const [east, south] = unproject(target[2], target[3])
    const wide = (ref.current?.clientWidth ?? 0) >= 768
    map.fitBounds(new maps.LatLngBounds(new maps.LatLng(south, west), new maps.LatLng(north, east)), { top: 24, bottom: 24, left: 24, right: 24 + (wide ? padRight : 0) })
    // target은 targetKey로 봐요. 칸이 떠서 padRight가 바뀌어도 사용자가 옮긴 지도를 되돌리지 않아요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, targetKey])

  // 마커를 그려요. 클릭은 그때의 함수를 부르게 ref로 들고 있어요.
  const handlers = useRef({ onRegion, onPin })
  handlers.current = { onRegion, onPin }
  useEffect(() => {
    if (!api) return
    const { maps, map } = api
    const markers: NaverMarker[] = []
    const listeners: unknown[] = []
    // 로고 핀(36px)은 가운데를, 권역 말풍선은 글자 폭이 달라서 왼쪽 위를 자리에 맞추고 말풍선 쪽에서 반만큼 당겨요.
    const add = (lat: number, lon: number, content: string, onClick: (() => void) | null, anchor: [number, number], z = 0) => {
      const marker = new maps.Marker({ position: new maps.LatLng(lat, lon), map, icon: { content, anchor: new maps.Point(...anchor) }, zIndex: z })
      markers.push(marker)
      if (onClick) listeners.push(maps.Event.addListener(marker, 'click', onClick))
    }
    if (map.getZoom() < pinZoom) {
      for (const region of Object.keys(REGION_LABEL) as RegionId[]) {
        const count = counts[region] ?? 0
        const [lon, lat] = REGION_LABEL[region]
        add(lat, lon, regionHtml(regionLabel(region, count), count > 0), count > 0 ? () => handlers.current.onRegion(region) : null, [0, 0])
      }
    } else {
      const projection = map.getProjection()
      const toPixel = (lon: number, lat: number): [number, number] => {
        const offset = projection.fromCoordToOffset(new maps.LatLng(lat, lon))
        return [offset.x, offset.y]
      }
      for (const pin of groupPins(pins, toPixel, L.more)) {
        const active = activePin === pinKey(pin)
        add(pin.places[0].lat, pin.places[0].lon, logoPinHtml(pin, active, pinLabel(pin)), () => handlers.current.onPin(pin), [18, 18], active ? 100 : pin.companies.length)
      }
    }
    if (me) add(me.lat, me.lon, ME_HTML, null, [20, 20], 200)
    return () => {
      listeners.forEach((listener) => maps.Event.removeListener(listener))
      markers.forEach((marker) => marker.setMap(null))
    }
    // regionLabel과 pinLabel은 문구만 만들어서 언어가 바뀔 때(L) 같이 바뀌어요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, tick, pins, counts, activePin, pinZoom, me, L])

  return <div ref={ref} className={className} />
}
