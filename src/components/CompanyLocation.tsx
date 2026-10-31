import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import type { CompanyProfile } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { loadNaverMaps, naverMapEnabled, naverMapSearchUrl, onNaverMapAuthFailure, type NaverMap } from '../lib/naverMap'
import { placesOf } from '../lib/regions'
import { Panel } from './GapParts'
import { ExternalLinkIcon, MapPinIcon } from './Icons'
import type { MapMarker } from './KoreaMap'
import { LOCATION_DOT_HTML } from './mapDot'
import { panelAction } from './ScreenParts'

/**
 * 기업 상세의 위치 칸이에요. 본사 주소를 알면 작은 지도에 현위치처럼 파란 점을 찍고, 아래에 주소를 적어요.
 * 늘 네이버 지도로 그리고, 본사를 모르면 공고의 근무지(동네 가운데)마다 점을 찍어요. 네이버 지도를 불러오지 못하면 지도 자리에 안내만 적어요.
 */

const TEXT = messages({
  ko: {
    title: '위치',
    office: (name: string) => `${name} 본사`,
    openNaver: '네이버 지도',
    openNaverLabel: (name: string) => `네이버 지도에서 ${name} 보기`,
    noPlace: '근무지를 찾지 못했어요.',
    mapFailed: '지도를 불러오지 못했어요.',
  },
  en: {
    title: 'Location',
    office: (name: string) => `${name} office`,
    openNaver: 'Naver Map',
    openNaverLabel: (name: string) => `Open ${name} in Naver Map`,
    noPlace: 'We could not find a workplace.',
    mapFailed: 'We could not load the map.',
  },
})

export function CompanyLocation({ profile }: { profile: CompanyProfile }) {
  const L = useMessages(TEXT)
  const { company, office, postings } = profile

  // 본사를 알면 본사 한 곳, 모르면 공고에 적힌 근무지마다 점을 찍어요.
  const markers = useMemo<MapMarker[]>(() => {
    if (office) return [{ lon: office.lon, lat: office.lat, label: L.office(company.name) }]
    const places = new Map(postings.flatMap((posting) => placesOf(posting.location)).map((place) => [place.id, place]))
    return [...places.values()].map((place) => ({ lon: place.lon, lat: place.lat, label: place.name }))
  }, [office, postings, company.name, L])

  const query = office ? office.address : company.name
  const [failed, setFailed] = useState(!naverMapEnabled)

  if (markers.length === 0) {
    return (
      <Panel title={L.title}>
        <p className="text-[13px] text-gray-500">{L.noPlace}</p>
      </Panel>
    )
  }

  return (
    <Panel
      title={L.title}
      action={
        <a
          href={naverMapSearchUrl(query)}
          target="_blank"
          rel="noreferrer"
          aria-label={L.openNaverLabel(company.name)}
          onClick={() => track('company_map_open', { company: company.id })}
          className={panelAction}
        >
          {L.openNaver}
          <ExternalLinkIcon className="size-3.5" />
        </a>
      }
    >
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white">
        {failed ? (
          <p className="flex size-full items-center justify-center px-6 text-center text-[13px] text-gray-500">{L.mapFailed}</p>
        ) : (
          <NaverMiniMap markers={markers} exact={Boolean(office)} onFail={() => setFailed(true)} />
        )}
      </div>
      {office && (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-gray-700">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-gray-400" />
          {office.address}
        </p>
      )}
    </Panel>
  )
}

/**
 * 네이버 지도를 작게 그리고 점을 찍어요. 휠로는 확대하지 않아서 화면을 스크롤하다 지도에 걸리지 않아요.
 * 점이 한 곳이면 그 둘레로(본사처럼 정확한 자리면 더 가까이), 여러 곳이면 모두 들어오게 맞춰요.
 */
function NaverMiniMap({ markers, exact, onFail }: { markers: MapMarker[]; exact: boolean; onFail: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const failRef = useRef(onFail)
  failRef.current = onFail
  const key = markers.map((marker) => `${marker.lon},${marker.lat}`).join('|')

  useEffect(() => {
    let map: NaverMap | null = null
    let stale = false
    const stop = onNaverMapAuthFailure(() => failRef.current())
    loadNaverMaps().then(
      (maps) => {
        if (stale || !ref.current) return
        const points = markers.map((marker) => new maps.LatLng(marker.lat, marker.lon))
        // 등록하지 않은 주소에서는 스크립트가 반쯤만 준비돼서 지도를 만들다 멈춰요. 그때도 불러오지 못했다고 적어요.
        try {
          map = new maps.Map(ref.current, { center: points[0], zoom: exact ? 16 : 14, scrollWheel: false, scaleControl: false, mapDataControl: false, logoControl: true })
          for (const [index, position] of points.entries()) new maps.Marker({ position, map, title: markers[index].label, icon: { content: LOCATION_DOT_HTML, anchor: new maps.Point(20, 20) } })
          if (points.length > 1) {
            const lats = markers.map((marker) => marker.lat)
            const lons = markers.map((marker) => marker.lon)
            map.fitBounds(new maps.LatLngBounds(new maps.LatLng(Math.min(...lats), Math.min(...lons)), new maps.LatLng(Math.max(...lats), Math.max(...lons))), { top: 40, right: 40, bottom: 40, left: 40 })
          }
        } catch {
          map = null
          failRef.current()
        }
      },
      () => {
        if (!stale) failRef.current()
      },
    )
    return () => {
      stale = true
      stop()
      // 인증에 실패하면 네이버 스크립트가 지도 속을 비워서, 지우다 멈추지 않게 감싸요.
      try {
        map?.destroy()
      } catch {
        // 이미 무너진 지도는 그대로 둬요.
      }
    }
    // markers는 자리(key)로 봐요. 같은 자리를 새 배열로 넘겨도 지도를 다시 만들지 않아요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, exact])

  return <div ref={ref} className="size-full" />
}
