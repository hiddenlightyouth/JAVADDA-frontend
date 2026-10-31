import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import type { CompanyProfile } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { loadNaverMaps, naverMapEnabled, naverMapSearchUrl, onNaverMapAuthFailure } from '../lib/naverMap'
import { PLACES, placesOf } from '../lib/regions'
import { Panel } from './GapParts'
import { ExternalLinkIcon, MapPinIcon } from './Icons'
import { boxAround, KoreaMap, type MapMarker } from './KoreaMap'

/**
 * 기업 상세의 위치 칸이에요. 본사 주소를 알면 작은 지도에 현위치처럼 파란 점을 찍고, 아래에 주소를 적어요.
 * 네이버 지도 키가 있으면 네이버 지도에, 없거나 인증에 실패하면 같은 자리의 SVG 지도(`KoreaMap`)에 찍어요. 본사를 모르면 공고의 근무지마다 점을 찍어요.
 */

/** SVG 지도에서 어디인지 알 수 있게 늘 같이 담는 서울 시청 자리예요. */
const SEOUL = PLACES.find((item) => item.id === 'seoul')!

const TEXT = messages({
  ko: {
    title: '위치',
    office: (name: string) => `${name} 본사`,
    openNaver: '네이버 지도',
    openNaverLabel: (name: string) => `네이버 지도에서 ${name} 보기`,
    noPlace: '근무지를 찾지 못했어요.',
    seoul: '서울',
  },
  en: {
    title: 'Location',
    office: (name: string) => `${name} office`,
    openNaver: 'Naver Map',
    openNaverLabel: (name: string) => `Open ${name} in Naver Map`,
    noPlace: 'We could not find a workplace.',
    seoul: 'Seoul',
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
  const [naverFailed, setNaverFailed] = useState(false)
  const useNaver = naverMapEnabled && office && !naverFailed

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
          className="flex items-center gap-1 text-[12.5px] font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          {L.openNaver}
          <ExternalLinkIcon className="size-3.5" />
        </a>
      }
    >
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white">
        {useNaver ? (
          <NaverMiniMap lat={office.lat} lon={office.lon} title={L.office(company.name)} onFail={() => setNaverFailed(true)} />
        ) : (
          <KoreaMap target={boxAround([...markers, SEOUL], 0.08)} labels={[{ name: L.seoul, lon: SEOUL.lon, lat: SEOUL.lat }]} markers={markers} className="size-full" />
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
 * 네이버 지도의 마커는 HTML 글자로 받아서, 현위치 같은 파란 점을 `LocationDot`과 같은 모양으로 직접 적어요.
 * 메인 컬러(#2E90FA)와 옅은 테(15%)예요.
 */
const DOT_HTML =
  '<div style="position:relative;width:40px;height:40px">' +
  '<div style="position:absolute;inset:0;border-radius:9999px;background:rgba(46,144,250,.15)"></div>' +
  '<div style="position:absolute;left:12px;top:12px;width:16px;height:16px;border-radius:9999px;background:#2E90FA;border:3px solid #fff;box-sizing:border-box"></div>' +
  '</div>'

/** 네이버 지도를 작게 그리고 본사에 파란 점을 찍어요. 휠로는 확대하지 않아서 화면을 스크롤하다 지도에 걸리지 않아요. */
function NaverMiniMap({ lat, lon, title, onFail }: { lat: number; lon: number; title: string; onFail: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const failRef = useRef(onFail)
  failRef.current = onFail

  useEffect(() => {
    let map: { destroy: () => void } | null = null
    let stale = false
    const stop = onNaverMapAuthFailure(() => failRef.current())
    loadNaverMaps().then(
      (maps) => {
        if (stale || !ref.current) return
        const center = new maps.LatLng(lat, lon)
        map = new maps.Map(ref.current, { center, zoom: 16, scrollWheel: false, scaleControl: false, mapDataControl: false, logoControl: true })
        new maps.Marker({ position: center, map, title, icon: { content: DOT_HTML, anchor: new maps.Point(20, 20) } })
      },
      () => {
        if (!stale) failRef.current()
      },
    )
    return () => {
      stale = true
      stop()
      map?.destroy()
    }
  }, [lat, lon, title])

  return <div ref={ref} className="size-full" />
}
