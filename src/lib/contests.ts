import { apiUrl, readWithLoad, type OnLoad } from './http'

/**
 * 잡아따 Labs의 공모전이에요. 서버가 매일 새벽 링커리어, 캠퍼스픽, 위비티, 씽굿의 공모전 목록을 모아 두고(같은 공모전은 한 줄로 합쳐요),
 * 화면은 GET /contests로 마감하지 않은 것만 받아요. 분야로 거르기와 검색, 정렬은 화면이 해요.
 */

export type ContestCategory = 'it' | 'idea' | 'marketing' | 'video' | 'design' | 'naming' | 'writing' | 'science' | 'startup' | 'thesis' | 'arts' | 'etc'
export type ContestSite = 'linkareer' | 'campuspick' | 'wevity' | 'thinkgood'

export interface ContestLink {
  site: ContestSite
  url: string
}

/**
 * 공모전을 모은 사이트의 이름과 로고(`public/contest-sites`, 사이트 아이콘을 받아 둔 거예요)예요. 카드의 출처 동그라미가 써요.
 * glyph는 바탕 없이 글자 모양만 있는 아이콘이라, 동그라미 안에 여백을 두고 그려요.
 */
export const CONTEST_SITES: Record<ContestSite, { name: string; logo: string; glyph?: boolean }> = {
  linkareer: { name: '링커리어', logo: '/contest-sites/linkareer.png' },
  campuspick: { name: '캠퍼스픽', logo: '/contest-sites/campuspick.png', glyph: true },
  wevity: { name: '위비티', logo: '/contest-sites/wevity.png', glyph: true },
  thinkgood: { name: '씽굿', logo: '/contest-sites/thinkgood.png' },
}

export interface Contest {
  id: string
  title: string
  organizer: string | null
  categories: ContestCategory[]
  /** YYYY-MM-DD, 모르면 null */
  startDate: string | null
  deadline: string | null
  imageUrl: string | null
  prize: string | null
  links: ContestLink[]
  firstSeenAt: string
}

/** 분야 버튼의 순서예요. 개발자가 보는 서비스라 IT가 맨 앞이에요. */
export const CONTEST_CATEGORIES: readonly ContestCategory[] = ['it', 'idea', 'startup', 'science', 'design', 'marketing', 'video', 'naming', 'writing', 'thesis', 'arts', 'etc']

export async function fetchContests(onLoad?: OnLoad): Promise<Contest[]> {
  const result = await readWithLoad<Contest[]>(await fetch(apiUrl('/contests')), onLoad)
  if (!result.ok || !Array.isArray(result.data)) throw new Error(result.code ?? 'bad response')
  return result.data.map((contest) => ({ ...contest, categories: contest.categories ?? [], links: contest.links ?? [] }))
}

/** 마감까지 남은 날이에요. 오늘 마감이면 0, 모르면 null이에요. */
export function contestDaysLeft(contest: Contest): number | null {
  if (!contest.deadline) return null
  const [year, month, day] = contest.deadline.split('-').map(Number)
  const end = new Date(year, month - 1, day).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.max(0, Math.round((end - today) / 86_400_000))
}
