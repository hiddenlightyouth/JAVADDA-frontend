import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { companyOf, fetchPostings, fitOf, useReports, useResume, type Company, type JobPosting } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { placesOf, REGIONS, type Place, type RegionId } from '../lib/regions'
import { PageHeader, ScrollPage } from './AppPage'
import { CompanyMark, Failed, FitTag, PostingMeta, usePickConfirm } from './GapParts'
import { CloseButton } from './Icons'
import { KoreaMap, type MapPin, type PinGroup } from './KoreaMap'
import { Badge, loadCenter, LoadProgress, toolButton } from './ui'

/**
 * 채용 지도예요. 공고의 근무지를 권역(수도권, 강원권, 충청권, 전라권, 경상권, 제주권)으로 묶어 지도에 놓아요.
 * 전국을 볼 때는 권역마다 공고 수를 띄우고, 권역을 고르면 그 권역으로 확대해서 동네마다 기업 로고 핀을 꽂아요.
 * 핀을 누르면 그 자리의 공고만 오른쪽 칸에 남고, 오른쪽 칸의 기업 이름표를 누르면 그 기업 공고만 남아요. 전국이나 원격처럼 지도에 놓을 수 없는 공고는 지역 무관으로 따로 세요.
 * 여러 권역을 적은 공고(서울 또는 충청, 전라, 경상)는 권역마다 한 번씩 세요.
 */

type RegionKey = RegionId | 'anywhere'

const TEXT = messages({
  ko: {
    title: '채용 지도',
    regions: { capital: '수도권', gangwon: '강원권', chungcheong: '충청권', jeolla: '전라권', gyeongsang: '경상권', jeju: '제주권', anywhere: '지역 무관' } as Record<RegionKey, string>,
    regionCount: (name: string, count: number) => `${name} ${count}`,
    byRegion: '권역별 공고',
    count: (count: number) => `${count}개`,
    postings: (count: number) => `${count}개의 공고`,
    companies: (count: number) => `${count}곳`,
    whole: '전국 보기',
    pin: (place: string, count: number, companies: string) => `${place}, 공고 ${count}개, ${companies}`,
    clearPlace: (place: string) => `${place} 풀기`,
    empty: '이 조건에 맞는 공고가 없어요.',
    diagnosed: '진단함',
  },
  en: {
    title: 'Job map',
    regions: { capital: 'Capital area', gangwon: 'Gangwon', chungcheong: 'Chungcheong', jeolla: 'Jeolla', gyeongsang: 'Gyeongsang', jeju: 'Jeju', anywhere: 'Anywhere' },
    regionCount: (name: string, count: number) => `${name} ${count}`,
    byRegion: 'Postings by region',
    count: (count: number) => `${count}`,
    postings: (count: number) => `${count} ${count === 1 ? 'posting' : 'postings'}`,
    companies: (count: number) => `${count} ${count === 1 ? 'company' : 'companies'}`,
    whole: 'Whole country',
    pin: (place: string, count: number, companies: string) => `${place}, ${count} postings, ${companies}`,
    clearPlace: (place: string) => `Clear ${place}`,
    empty: 'No postings match these filters.',
    diagnosed: 'Diagnosed',
  },
})

type Loaded = JobPosting[] | 'failed'

export function JobMap({ onPick }: { onPick: (postingId: string) => void }) {
  const L = useMessages(TEXT)
  const resume = useResume()
  const reports = useReports()
  const [company, setCompany] = useState<string | null>(null)
  const [region, setRegion] = useState<RegionKey | null>(null)
  /** 지도에서 누른 핀의 자리들이에요. 겹쳐서 묶인 핀이면 여러 곳이에요. */
  const [place, setPlace] = useState<PinGroup | null>(null)
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

  // 고른 권역의 동네마다 핀을 만들어요. 공고가 많은 기업의 로고가 앞에 와요.
  const pins = useMemo<MapPin[]>(() => {
    if (!region || region === 'anywhere') return []
    const byPlace = new Map<string, { place: Place; postings: string[]; companies: Map<string, number> }>()
    for (const { posting, places } of located) {
      if (company && posting.companyId !== company) continue
      for (const item of places) {
        if (item.region !== region) continue
        const entry = byPlace.get(item.id) ?? { place: item, postings: [] as string[], companies: new Map<string, number>() }
        entry.postings.push(posting.id)
        entry.companies.set(posting.companyId, (entry.companies.get(posting.companyId) ?? 0) + 1)
        byPlace.set(item.id, entry)
      }
    }
    return [...byPlace.values()].map((entry) => ({
      place: entry.place,
      postings: entry.postings,
      companies: [...entry.companies.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => companyOf(id)),
    }))
  }, [located, region, company])

  // 고른 권역(핀을 골랐으면 그 자리)의 공고예요.
  const inRegion = useMemo(() => {
    if (!region) return []
    return located
      .filter(({ places }) => (region === 'anywhere' ? places.length === 0 : places.some((item) => item.region === region && (!place || place.places.some((picked) => picked.id === item.id)))))
      .map(({ posting }) => posting)
  }, [located, region, place])

  // 오른쪽 칸의 공고예요. 기업을 골랐으면 그 기업 것만이고, 이력서가 있으면 적합도순, 없으면 최근에 올라온 순서예요.
  const list = useMemo(() => {
    const picked = inRegion.filter((posting) => !company || posting.companyId === company)
    return resume ? picked.sort((a, b) => (fitOf(b, resume) ?? 0) - (fitOf(a, resume) ?? 0)) : picked.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  }, [inRegion, company, resume])

  // 고른 권역에 공고를 낸 기업이에요. 공고가 많은 순서예요.
  const regionCompanies = useMemo(() => {
    const byCompany = new Map<string, number>()
    for (const posting of inRegion) byCompany.set(posting.companyId, (byCompany.get(posting.companyId) ?? 0) + 1)
    return [...byCompany.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ company: companyOf(id), count }))
  }, [inRegion])

  function chooseRegion(next: RegionKey | null) {
    setRegion(next)
    setPlace(null)
    setCompany(null)
    if (next) track('map_region_select', { region: next })
  }

  function chooseCompany(next: string | null) {
    setCompany(next)
    track('map_company_select', { company: next ?? 'all' })
  }

  function choosePin(pin: PinGroup) {
    const same = place && place.places.map((item) => item.id).join() === pin.places.map((item) => item.id).join()
    setPlace(same ? null : pin)
    if (!same) track('map_place_select', { place: pin.places.map((item) => item.id).join() })
  }

  // 공고를 누르면 바로 가지 않고 한 번 더 물어요.
  const confirmPick = usePickConfirm()
  function pick(posting: JobPosting) {
    confirmPick.ask(posting, () => {
      track('posting_select', { posting: posting.id, from: 'map' })
      onPick(posting.id)
    })
  }

  const focus = region && region !== 'anywhere' ? region : null
  const regionTotal = region === 'anywhere' ? anywhereCount : region ? counts[region] : 0
  const max = Math.max(1, ...Object.values(counts), anywhereCount)

  return (
    <ScrollPage header={<PageHeader title={L.title} />} className="@container">
      <div>
        {waiting || loaded === undefined ? (
          <LoadProgress percent={load.percent} className={loadCenter} />
        ) : loaded === 'failed' ? (
          <Failed className="mt-16" onRetry={() => setAttempt((value) => value + 1)} />
        ) : (
          // 넓은 화면에서는 지도를 왼쪽에 두고, 권역과 공고를 오른쪽 칸에 나란히 둬요. 좁으면 지도 아래로 내려가요.
          <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_360px] @5xl:items-start @7xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-2xl bg-gray-50 p-4 @3xl:p-6">
              <KoreaMap
                focus={focus}
                counts={counts}
                pins={pins}
                activePlaces={place?.places.map((item) => item.id) ?? []}
                regionLabel={(id, count) => L.regionCount(L.regions[id], count)}
                pinLabel={(pin) => L.pin(pin.places.map((item) => item.name).join(', '), pin.postings?.length ?? 0, pin.companies.map((item) => item.name).join(', '))}
                onRegion={chooseRegion}
                onPin={choosePin}
                overlay={
                  focus && (
                    <button type="button" onClick={() => chooseRegion(null)} className={`${toolButton} bg-white`}>
                      {L.whole}
                    </button>
                  )
                }
                className="mx-auto max-w-[min(640px,calc((100dvh-15rem)*1.07))]"
              />
            </div>

            {/* 오른쪽 칸은 지도 옆에 멈춰 있고, 공고가 많으면 칸 안에서 스크롤해요. */}
            <div className="@container flex flex-col gap-6 @5xl:sticky @5xl:top-0 @5xl:max-h-[calc(100dvh-10rem)] @5xl:overflow-y-auto">
              <section>
                <h2 className="text-[16px] font-semibold text-gray-900">{L.byRegion}</h2>
                <ul className="mt-3 flex flex-col gap-1">
                  {[...REGIONS, 'anywhere' as const].map((id) => {
                    const count = id === 'anywhere' ? anywhereCount : counts[id]
                    const on = region === id
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          disabled={count === 0}
                          onClick={() => chooseRegion(on ? null : id)}
                          className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13.5px] transition-colors disabled:cursor-default disabled:opacity-50 ${
                            on ? 'bg-brand-soft font-semibold text-brand-hover' : 'text-gray-800 enabled:hover:bg-gray-50'
                          }`}
                        >
                          <span className="w-20 shrink-0">{L.regions[id]}</span>
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200/70">
                            <span className="block h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${(count / max) * 100}%` }} />
                          </span>
                          <span className="w-10 shrink-0 text-right text-gray-500 tabular-nums">{L.count(count)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {region && (
                <section>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-semibold text-gray-900">
                      {L.regions[region]} <span className="text-gray-400 tabular-nums">{place || company ? list.length : regionTotal}</span>
                    </h2>
                    {place && (
                      <span className="flex h-7 items-center gap-0.5 rounded-full bg-brand-soft pr-1 pl-3 text-[12.5px] font-medium text-brand-hover">
                        {place.name}
                        <CloseButton label={L.clearPlace(place.name)} onClick={() => setPlace(null)} className="size-5!" />
                      </span>
                    )}
                  </div>
                  {regionCompanies.length > 0 && (
                    <p className="mt-2 flex flex-wrap items-center gap-1.5">
                      {regionCompanies.map(({ company: item, count }) => (
                        <CompanyCount key={item.id} company={item} count={count} active={company === item.id} onClick={() => chooseCompany(company === item.id ? null : item.id)} />
                      ))}
                    </p>
                  )}
                  {list.length === 0 ? (
                    <p className="mt-3 text-[13.5px] text-gray-500">{L.empty}</p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-2">
                      {list.map((posting) => (
                        <MapRow key={posting.id} posting={posting} fit={fitOf(posting, resume)} diagnosed={diagnosed.has(posting.id)} onOpen={() => pick(posting)} />
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
      {confirmPick.dialog}
    </ScrollPage>
  )
}

/** 고른 권역에 공고를 낸 기업 하나예요. 작은 로고와 이름, 공고 수예요. 누르면 그 기업 공고만 남고, 다시 누르면 풀려요. */
function CompanyCount({ company, count, active, onClick }: { company: Company; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-[12.5px] transition-colors ${active ? 'bg-brand-soft font-medium text-brand-hover' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
    >
      <CompanyMark company={company} className="size-6 rounded-full! text-[9px]" />
      {company.name}
      <span className={`tabular-nums ${active ? 'text-brand-hover' : 'text-gray-400'}`}>{count}</span>
    </button>
  )
}

/** 고른 권역의 공고 한 줄이에요. 마감 달력의 줄과 같은 모양이에요. */
function MapRow({ posting, fit, diagnosed, onOpen }: { posting: JobPosting; fit: number | null; diagnosed: boolean; onOpen: () => void }) {
  const L = useMessages(TEXT)
  const company = companyOf(posting.companyId)
  return (
    <li>
      <button type="button" data-no-press onClick={onOpen} className="group flex w-full items-center gap-4 rounded-2xl bg-gray-50 px-4 py-3.5 text-left transition-colors hover:bg-gray-100">
        <CompanyMark company={company} className="size-10 text-[15px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-brand-hover">{posting.title}</span>
          <PostingMeta posting={posting} className="mt-1" careerClass="hidden @xl:flex">
            <span className="truncate font-medium text-gray-700">{company.name}</span>
          </PostingMeta>
        </span>
        {diagnosed && (
          <Badge tone="brand" strong>
            {L.diagnosed}
          </Badge>
        )}
        <span className="hidden @md:inline-flex">
          <FitTag fit={fit} />
        </span>
      </button>
    </li>
  )
}
