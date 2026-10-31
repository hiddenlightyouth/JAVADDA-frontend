import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { companyOf, daysLeft, fetchPostings, officeOf, fitOf, useReports, useResume, type Company, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { naverMapEnabled } from '../lib/naverMap'
import { isBroad, kmBetween, placesOf, REGIONS, type Place, type RegionId } from '../lib/regions'
import { PageHeader } from './AppPage'
import { CompanyMark, Failed, FitTag, PostingMeta, usePickConfirm } from './GapParts'
import { CloseButton, CrosshairIcon } from './Icons'
import { DeadlineTag } from './JobCard'
import { NaverJobMap } from './NaverJobMap'
import { showToast } from '../lib/toast'
import { boxAround, KoreaMap, pinKey, regionBox, type MapBox, type MapPin, type PinGroup } from './KoreaMap'
import { Badge, loadCenter, LoadProgress, toolButton } from './ui'

/**
 * 채용 지도예요. 화면을 나누지 않고 지도만 크게 띄워요. 네이버 지도 키가 있으면 네이버 지도(`NaverJobMap`), 없으면 SVG 지도(`KoreaMap`)예요. 공고의 근무지를 권역(수도권, 강원권, 충청권, 전라권, 경상권, 제주권)으로 묶어 지도에 놓아요.
 * 전국을 볼 때는 권역마다 공고 수를 띄우고, 권역을 누르거나 휠로 확대하면 동네마다 기업 로고 핀을 꽂아요. 끌어서 옮길 수 있어요.
 * 권역이나 핀을 누르면 지도 위 오른쪽에 그 자리의 기업과 공고 칸이 떠요. 기업 이름표를 누르면 그 기업 공고와 핀만 남아요.
 * 전국이나 원격처럼 지도에 놓을 수 없는 공고는 지역 무관으로 따로 세요. 여러 권역을 적은 공고(서울 또는 충청, 전라, 경상)는 권역마다 한 번씩 세요.
 */

type Selection = { kind: 'region'; region: RegionId } | { kind: 'pin'; pin: PinGroup } | { kind: 'anywhere' }

/** 칸이 지도 오른쪽을 덮는 폭(px)이에요. 권역으로 확대할 때 이만큼 비켜서 가운데를 잡아요. */
const PANEL_WIDTH = 396

const TEXT = messages({
  ko: {
    title: '채용 지도',
    regions: { capital: '수도권', gangwon: '강원권', chungcheong: '충청권', jeolla: '전라권', gyeongsang: '경상권', jeju: '제주권' } as Record<RegionId, string>,
    anywhere: '지역 무관',
    regionCount: (name: string, count: number) => `${name} ${count}`,
    whole: '전국 보기',
    close: '닫기',
    pin: (place: string, count: number, companies: string) => `${place}, 공고 ${count}개, ${companies}`,
    empty: '이 조건에 맞는 공고가 없어요.',
    diagnosed: '진단함',
    locate: '내 위치',
    pinTitle: (name: string, rest: number) => (rest > 0 ? `${name} 외 ${rest}곳` : name),
    locating: '위치 찾는 중',
    locateFailed: '위치를 알 수 없어요. 브라우저의 위치 권한을 확인해 주세요.',
    locateUnsupported: '이 환경에서는 위치를 알 수 없어요.',
    me: '내 위치',
    distance: (text: string) => `내 위치에서 ${text}`,
  },
  en: {
    title: 'Job map',
    regions: { capital: 'Capital area', gangwon: 'Gangwon', chungcheong: 'Chungcheong', jeolla: 'Jeolla', gyeongsang: 'Gyeongsang', jeju: 'Jeju' },
    anywhere: 'Anywhere',
    regionCount: (name: string, count: number) => `${name} ${count}`,
    whole: 'Whole country',
    close: 'Close',
    pin: (place: string, count: number, companies: string) => `${place}, ${count} postings, ${companies}`,
    empty: 'No postings match these filters.',
    diagnosed: 'Diagnosed',
    locate: 'My location',
    pinTitle: (name: string, rest: number) => (rest > 0 ? `${name} +${rest}` : name),
    locating: 'Locating',
    locateFailed: 'We could not find your location. Check the location permission of your browser.',
    locateUnsupported: 'Location is not available here.',
    me: 'My location',
    distance: (text: string) => `${text} away`,
  },
})

type Loaded = JobPosting[] | 'failed'

type Spot = { lon: number; lat: number }

/**
 * 공고가 지도에 놓이는 자리들이에요. 본사를 아는 기업은 공고가 "서울"처럼 넓게만 적혔거나 본사가 그 동네 안(4km)이면 본사 자리예요.
 * 토스의 구로 공고처럼 다른 동네를 적었으면 그 동네 가운데에 둬요.
 */
function spotOf(companyId: string, place: Place): Place {
  const office = officeOf(companyId)
  return office && (isBroad(place) || kmBetween(place, office) < 4) ? { ...place, lon: office.lon, lat: office.lat } : place
}

/** 거리를 1km 안이면 m로, 넘으면 km로 적어요. */
const distanceText = (km: number) => (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m` : `${km < 10 ? km.toFixed(1) : Math.round(km)}km`)

export function JobMap({ onPick }: { onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const reports = useReports()
  const [company, setCompany] = useState<string | null>(null)
  /** 내 위치예요. "내 위치"를 눌러 브라우저에 물어본 뒤에만 있어요. */
  const [me, setMe] = useState<Spot | null>(null)
  const [locating, setLocating] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  /** 지도가 가운데에 꽉 차게 보여줄 칸이에요. 권역을 고르면 그 권역, 전국 보기면 없어요. */
  const [target, setTarget] = useState<MapBox | null>(null)
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const load = useLoadProgress()

  useEffect(() => {
    let stale = false
    setLoaded(undefined)
    void fetchPostings({}, load.one()).then(
      (list) => {
        if (!stale) setLoaded(list)
      },
      () => {
        if (!stale) setLoaded('failed')
      },
    )
    return () => {
      stale = true
    }
  }, [attempt, load.one])
  const waiting = useLoadHold(loaded === undefined)

  const diagnosed = useMemo(() => new Set(reports.map((report) => report.postingId)), [reports])

  // 공고마다 근무지를 찾아 둬요. 근무지를 하나도 모르면 지역 무관이에요.
  const located = useMemo(() => (Array.isArray(loaded) ? loaded.map((posting) => ({ posting, places: placesOf(posting.location) })) : []), [loaded])

  const counts = useMemo(() => {
    const counts = Object.fromEntries(REGIONS.map((id) => [id, 0])) as Record<RegionId, number>
    for (const { places } of located) for (const id of new Set(places.map((item) => item.region))) counts[id] += 1
    return counts
  }, [located])
  const anywhereCount = located.filter((item) => item.places.length === 0).length

  // 기업이 한 자리에 낸 공고마다 로고 핀을 하나씩 만들어요. 기업을 골랐으면 그 기업의 핀만이에요. 핀은 `spotOf`의 자리에 꽂아서, 확대하면 본사를 아는 기업은 실제 위치에 있어요.
  const pins = useMemo<MapPin[]>(() => {
    const byKey = new Map<string, MapPin>()
    for (const { posting, places } of located) {
      if (company && posting.companyId !== company) continue
      for (const item of places) {
        const key = `${posting.companyId}@${item.id}`
        const pin = byKey.get(key) ?? { place: spotOf(posting.companyId, item), company: companyOf(posting.companyId), postings: [] }
        pin.postings.push(posting.id)
        byKey.set(key, pin)
      }
    }
    return [...byKey.values()]
  }, [located, company])

  // 고른 권역이나 핀의 공고예요.
  const selected = useMemo(() => {
    if (!selection) return []
    const match = ({ posting, places }: { posting: JobPosting; places: Place[] }) =>
      selection.kind === 'anywhere'
        ? places.length === 0
        : selection.kind === 'region'
          ? places.some((item) => item.region === selection.region)
          : selection.pin.postings.includes(posting.id)
    return located.filter(match).map(({ posting }) => posting)
  }, [located, selection])

  // 내 위치에서 공고까지의 거리(km)예요. 공고가 여러 자리를 적었으면 가장 가까운 자리로 재요.
  const distanceOf = useMemo(() => {
    const places = new Map(located.map(({ posting, places }) => [posting.id, places.map((item) => spotOf(posting.companyId, item))]))
    return (posting: JobPosting): number | null => {
      const spots = places.get(posting.id) ?? []
      return me && spots.length > 0 ? Math.min(...spots.map((spot) => kmBetween(spot, me))) : null
    }
  }, [located, me])

  // 칸의 공고예요. 기업을 골랐으면 그 기업 것만이에요. 내 위치를 켰으면 가까운 순서, 아니면 이력서가 있을 때 적합도순, 없으면 최근에 올라온 순서예요.
  const list = useMemo(() => {
    const picked = selected.filter((posting) => !company || posting.companyId === company)
    if (me) return picked.sort((a, b) => (distanceOf(a) ?? Infinity) - (distanceOf(b) ?? Infinity))
    return resume ? picked.sort((a, b) => (fitOf(b, resume) ?? 0) - (fitOf(a, resume) ?? 0)) : picked.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  }, [selected, company, resume, me, distanceOf])

  // 고른 자리에 공고를 낸 기업이에요. 공고가 많은 순서예요.
  const selectedCompanies = useMemo(() => {
    const byCompany = new Map<string, number>()
    for (const posting of selected) byCompany.set(posting.companyId, (byCompany.get(posting.companyId) ?? 0) + 1)
    return [...byCompany.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ company: companyOf(id), count }))
  }, [selected])

  function chooseRegion(region: RegionId) {
    setSelection({ kind: 'region', region })
    setTarget(regionBox(region))
    setCompany(null)
    track('map_region_select', { region })
  }

  function chooseAnywhere() {
    setSelection({ kind: 'anywhere' })
    setCompany(null)
    track('map_region_select', { region: 'anywhere' })
  }

  function choosePin(pin: PinGroup) {
    if (selection?.kind === 'pin' && pinKey(selection.pin) === pinKey(pin)) return close()
    setSelection({ kind: 'pin', pin })
    track('map_place_select', { place: pin.places.map((item) => item.id).join(), companies: pin.companies.length })
  }

  function chooseCompany(next: string | null) {
    setCompany(next)
    track('map_company_select', { company: next ?? 'all' })
  }

  // 내 위치를 브라우저에 물어요. 찾으면 파란 점을 찍고 그 둘레(대체로 3km)로 옮겨 가요. 공고 줄에는 내 위치에서의 거리가 붙어요.
  function locate() {
    if (!('geolocation' in navigator)) return showToast(L.locateUnsupported)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const spot = { lon: coords.longitude, lat: coords.latitude }
        setMe(spot)
        setTarget(boxAround([spot], 0.03))
        track('map_locate', { success: true })
      },
      () => {
        setLocating(false)
        showToast(L.locateFailed)
        track('map_locate', { success: false })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function close() {
    setSelection(null)
    setCompany(null)
  }

  function whole() {
    close()
    setTarget(null)
  }

  // 공고를 누르면 바로 가지 않고 한 번 더 물어요.
  const confirmPick = usePickConfirm()
  function pick(posting: JobPosting) {
    confirmPick.ask(posting, () => {
      track('posting_select', { posting: posting.id, from: 'map' })
      onPick(posting.id)
    }, 'analyze')
  }

  // 네이버 지도 키가 있으면 네이버 지도로, 없거나 인증에 실패하면 SVG 지도로 그려요. 핀과 칸은 같아요.
  const [naverFailed, setNaverFailed] = useState(false)
  const useNaver = naverMapEnabled && !naverFailed
  const activePin = selection?.kind === 'pin' ? pinKey(selection.pin) : null
  const regionText = (id: RegionId, count: number) => L.regionCount(L.regions[id], count)
  const pinText = (pin: PinGroup) => L.pin(pin.places.map((item) => item.name).join(', '), pin.postings.length, pin.companies.map((item) => item.name).join(', '))
  const overlay = (
    <>
      {target && (
        <button type="button" onClick={whole} className={`${toolButton} bg-white`}>
          {L.whole}
        </button>
      )}
      <button type="button" onClick={locate} disabled={locating} aria-pressed={Boolean(me)} className={`${toolButton} gap-1.5 bg-white aria-pressed:border-brand aria-pressed:text-brand-hover`}>
        <CrosshairIcon className="size-4" />
        {locating ? L.locating : L.locate}
      </button>
      {anywhereCount > 0 && (
        <button type="button" aria-pressed={selection?.kind === 'anywhere'} onClick={chooseAnywhere} className={`${toolButton} bg-white aria-pressed:border-brand aria-pressed:text-brand-hover`}>
          {L.regionCount(L.anywhere, anywhereCount)}
        </button>
      )}
    </>
  )

  const title = !selection ? '' : selection.kind === 'region' ? L.regions[selection.region] : selection.kind === 'pin' ? L.pinTitle(selection.pin.companies[0].name, selection.pin.companies.length - 1) : L.anywhere
  const total = company ? list.length : selected.length

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-6 pt-14 md:px-10 md:pt-9">
        <PageHeader title={L.title} />
      </div>
      <div className="min-h-0 flex-1 px-6 pt-4 pb-6 md:px-10 md:pb-8">
        {waiting || loaded === undefined ? (
          <LoadProgress percent={load.percent} className={loadCenter} />
        ) : loaded === 'failed' ? (
          <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
        ) : (
          <div className="relative size-full min-h-[420px] overflow-hidden rounded-2xl bg-gray-50">
            {useNaver ? (
              <>
                <NaverJobMap
                  target={target}
                  padRight={selection ? PANEL_WIDTH : 0}
                  counts={counts}
                  regionLabel={regionText}
                  onRegion={chooseRegion}
                  pins={pins}
                  activePin={activePin}
                  pinLabel={pinText}
                  onPin={choosePin}
                  onFail={() => setNaverFailed(true)}
                  me={me}
                  className="size-full"
                />
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">{overlay}</div>
              </>
            ) : (
              <KoreaMap
                interactive
                target={target}
                padRight={selection ? PANEL_WIDTH : 0}
                counts={counts}
                regionLabel={regionText}
                onRegion={chooseRegion}
                pins={pins}
                pinZoom={2.2}
                activePin={activePin}
                pinLabel={pinText}
                onPin={choosePin}
                markers={me ? [{ ...me, label: L.me }] : []}
                overlay={overlay}
                className="size-full"
              />
            )}

            {/* 고른 자리의 기업과 공고예요. 지도 위 오른쪽에 떠 있고, 좁은 화면에서는 아래에서 올라와요. 안에서 스크롤해요. */}
            {selection && (
              <aside className="@container absolute inset-x-3 bottom-3 max-h-[60%] overflow-y-auto rounded-2xl bg-white p-4 ring-1 ring-gray-200 md:inset-x-auto md:top-3 md:right-3 md:max-h-none md:w-[372px]">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="min-w-0 truncate text-[16px] font-semibold text-gray-900">
                    {title} <span className="text-gray-400 tabular-nums">{total}</span>
                  </h2>
                  <CloseButton label={L.close} onClick={close} />
                </div>
                {selectedCompanies.length > 0 && (
                  // 기업이 많아도 공고 목록이 밀리지 않게 이름표는 한 줄로 두고 옆으로 넘겨요.
                  <p className="-mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                    {selectedCompanies.map(({ company: item, count }) => (
                      <CompanyCount key={item.id} company={item} count={count} active={company === item.id} onClick={() => chooseCompany(company === item.id ? null : item.id)} />
                    ))}
                  </p>
                )}
                {list.length === 0 ? (
                  <p className="mt-3 text-[13.5px] text-gray-500">{L.empty}</p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-2">
                    {list.map((posting) => (
                      <MapRow key={posting.id} posting={posting} fit={fitOf(posting, resume)} distance={distanceOf(posting)} diagnosed={diagnosed.has(posting.id)} onOpen={() => pick(posting)} />
                    ))}
                  </ul>
                )}
              </aside>
            )}
          </div>
        )}
      </div>
      {confirmPick.dialog}
    </main>
  )
}

/** 고른 권역에 공고를 낸 기업 하나예요. 작은 로고와 이름, 공고 수예요. 누르면 그 기업 공고만 남고, 다시 누르면 풀려요. */
function CompanyCount({ company, count, active, onClick }: { company: Company; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full py-0.5 whitespace-nowrap pr-2.5 pl-0.5 text-[12.5px] transition-colors ${active ? 'bg-brand-soft font-medium text-brand-hover' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
    >
      <CompanyMark company={company} className="size-6 rounded-full! text-[9px]" />
      {company.name}
      <span className={`tabular-nums ${active ? 'text-brand-hover' : 'text-gray-400'}`}>{count}</span>
    </button>
  )
}

/** 고른 자리의 공고 한 줄이에요. 제목과 기업, 직군과 지역 아래에 마감까지 남은 날, 얼마나 맞는지, 진단했는지, 내 위치에서의 거리를 붙여요. */
function MapRow({ posting, fit, distance, diagnosed, onOpen }: { posting: JobPosting; fit: number | null; distance: number | null; diagnosed: boolean; onOpen: () => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  return (
    <li>
      <button type="button" data-no-press onClick={onOpen} className="group flex w-full items-start gap-3.5 rounded-2xl bg-gray-50 px-4 py-3.5 text-left transition-colors hover:bg-gray-100">
        <CompanyMark company={company} className="size-10 text-[15px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{posting.title}</span>
          <PostingMeta posting={posting} className="mt-1" careerClass="hidden @xl:flex">
            <span className="truncate font-medium text-gray-700">{company.name}</span>
          </PostingMeta>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <DeadlineTag left={daysLeft(posting)} />
            <FitTag fit={fit} />
            {diagnosed && (
              <Badge tone="brand" strong>
                {L.diagnosed}
              </Badge>
            )}
            {distance !== null && <span className="text-[12px] text-gray-500 tabular-nums">{L.distance(distanceText(distance))}</span>}
          </span>
        </span>
      </button>
    </li>
  )
}
