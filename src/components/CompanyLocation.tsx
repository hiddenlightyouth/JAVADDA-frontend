import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import type { CompanyProfile } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { MAP_HEIGHT, MAP_WIDTH } from '../lib/koreaMap'
import { loadNaverMaps, naverMapEnabled, naverMapSearchUrl, onNaverMapAuthFailure } from '../lib/naverMap'
import { PLACES, placesOf, type Place } from '../lib/regions'
import { Panel } from './GapParts'
import { ExternalLinkIcon, MapPinIcon } from './Icons'
import { boxAround, KoreaMap, type MapPin } from './KoreaMap'

/**
 * 기업 상세의 위치 칸이에요. 본사 주소를 알면 네이버 지도를 작게 띄워 핀을 꽂고, 아래에 주소와 공고에 적힌 근무지를 적어요.
 * 네이버 지도 키가 없거나 인증에 실패하면 같은 자리에 SVG 지도(`KoreaMap`)를 그려요. 본사를 모르면 공고의 근무지에 핀을 꽂아요.
 */

/** SVG 지도에서 어디인지 알 수 있게 늘 같이 담는 서울 시청 자리예요. */
const SEOUL = PLACES.find((item) => item.id === 'seoul')!

const TEXT = messages({
  ko: {
    title: '위치',
    office: '본사',
    workplaces: '공고에 적힌 근무지',
    openNaver: '네이버 지도',
    openNaverLabel: (name: string) => `네이버 지도에서 ${name} 보기`,
    noPlace: '근무지를 찾지 못했어요.',
    seoul: '서울',
  },
  en: {
    title: 'Location',
    office: 'Office',
    workplaces: 'Workplaces in postings',
    openNaver: 'Naver Map',
    openNaverLabel: (name: string) => `Open ${name} in Naver Map`,
    noPlace: 'We could not find a workplace.',
    seoul: 'Seoul',
  },
})

export function CompanyLocation({ profile }: { profile: CompanyProfile }) {
  const L = useMessages(TEXT)
  const { company, office, postings } = profile

  // 공고에 적힌 근무지와 그 자리의 공고 수예요. 많은 곳이 앞에 와요.
  const workplaces = useMemo(() => {
    const byPlace = new Map<string, { place: Place; postings: string[] }>()
    for (const posting of postings) {
      for (const place of placesOf(posting.location)) {
        const entry = byPlace.get(place.id) ?? { place, postings: [] }
        entry.postings.push(posting.id)
        byPlace.set(place.id, entry)
      }
    }
    return [...byPlace.values()].sort((a, b) => b.postings.length - a.postings.length)
  }, [postings])

  // 본사를 알면 본사 자리에 로고 핀 하나, 모르면 근무지마다 공고 수를 적은 핀이에요.
  const pins = useMemo<MapPin[]>(() => {
    if (office) {
      const region = placesOf(office.address)[0]?.region ?? 'capital'
      return [{ place: { id: 'office', name: L.office, region, lon: office.lon, lat: office.lat, keys: [] }, companies: [company] }]
    }
    return workplaces.map(({ place, postings: ids }) => ({ place, postings: ids, companies: [company] }))
  }, [office, workplaces, company, L.office])

  const query = office ? office.address : company.name
  const [naverFailed, setNaverFailed] = useState(false)
  const useNaver = naverMapEnabled && office && !naverFailed

  if (!office && workplaces.length === 0) {
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
      <div className="overflow-hidden rounded-xl bg-white" style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
        {useNaver ? (
          <NaverMiniMap lat={office.lat} lon={office.lon} title={company.name} onFail={() => setNaverFailed(true)} />
        ) : (
          <KoreaMap box={boxAround([...pins.map((pin) => pin.place), SEOUL], 0.08)} labels={[{ name: L.seoul, lon: SEOUL.lon, lat: SEOUL.lat }]} pins={pins} pinLabel={(pin) => (office ? `${company.name} ${L.office}` : pin.name)} />
        )}
      </div>
      {office && (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-gray-700">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-gray-400" label={L.office} />
          {office.address}
        </p>
      )}
      {workplaces.length > 0 && (
        <div className="mt-3">
          <h3 className="text-[12px] text-gray-500">{L.workplaces}</h3>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {workplaces.map(({ place, postings: ids }) => (
              <span key={place.id} className="flex h-6 items-center gap-1 rounded-md bg-white px-2 text-[12px] text-gray-700">
                {place.name}
                <span className="text-gray-400 tabular-nums">{ids.length}</span>
              </span>
            ))}
          </p>
        </div>
      )}
    </Panel>
  )
}

/** 네이버 지도를 작게 그리고 본사에 핀을 꽂아요. 휠로는 확대하지 않아서 화면을 스크롤하다 지도에 걸리지 않아요. */
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
        new maps.Marker({ position: center, map, title })
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
