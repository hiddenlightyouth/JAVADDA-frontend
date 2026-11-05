import type { Result } from './admin'
import { authFetch } from './auth'

// 외부 API 키예요. 사용자가 권한과 사유를 적어 요청하면 관리자가 승인해야 쓸 수 있어요. 서버는 /api/v1/api-keys,
// 관리자는 /api/v1/admin/manage/api-keys, 키로 부르는 공개 API는 /api/public/v1이에요.

export type KeyStatus = 'pending' | 'approved' | 'rejected' | 'revoked'

export interface ScopeInfo {
  value: string
  label: string
  description: string
}

export interface ApiKeyView {
  id: number
  name: string
  purpose: string
  site: string | null
  /** 화면에 보여줄 키 앞부분(jvd_ab12cd34) */
  prefix: string
  status: KeyStatus
  requestedScopes: string[]
  /** 관리자가 준 권한 */
  scopes: string[]
  perMinute: number
  perDay: number
  expiresAt: string | null
  /** 관리자가 남긴 말(거절 이유 등) */
  note: string | null
  createdAt: string
  reviewedAt: string | null
  lastUsedAt: string | null
  callsToday: number
  /** 관리자 응답에만 있어요. */
  owner: { id: number; name: string; email: string } | null
  reviewedBy: string | null
}

export interface UsageTotals {
  calls: number
  /** 4xx와 5xx */
  errors: number
  /** 그중 한도를 넘은(429) 수 */
  limited: number
  latencyMs: number
}

export interface UsageGroup {
  key: string
  label: string
  total: UsageTotals
}

export interface ApiRequestRow {
  id: number
  apiKeyId: number
  scope: string | null
  method: string
  path: string
  status: number
  latencyMs: number
  createdAt: string
}

export interface ApiUsage {
  days: number
  from: string
  to: string
  total: UsageTotals
  daily: { date: string; calls: number; errors: number }[]
  scopes: UsageGroup[]
  paths: UsageGroup[]
  /** 모든 키의 사용량(관리자)에만 있어요. */
  keys: UsageGroup[]
  recent: ApiRequestRow[]
}

export interface ApiSummary {
  pending: number
  approved: number
  usage: ApiUsage
}

export const STATUS_NAMES: Record<KeyStatus, string> = {
  pending: '심사 중',
  approved: '사용 중',
  rejected: '거절',
  revoked: '해지',
}

/** 사용자가 한 번에 가질 수 있는 키 수(심사 중과 사용 중). 서버의 ApiKeyService.MAX_KEYS와 같아요. */
export const MAX_KEYS = 5

const errors: Record<string, string> = {
  C4094: `API 키는 ${MAX_KEYS}개까지 요청할 수 있어요. 쓰지 않는 키를 해지해 주세요.`,
  C4095: '해지한 키는 바꿀 수 없어요.',
  C404: '키를 찾을 수 없어요.',
  C002: '입력한 값을 확인해 주세요.',
  C001: '사유는 10자 넘게, 권한은 하나 이상 골라 주세요.',
  C403: '권한이 없어요.',
}

/** 로그인한 요청을 보내고 서버의 오류 코드를 쉬운 말로 바꿔요. */
export async function keyRequest<T>(path: string, method = 'GET', body?: unknown): Promise<Result<T>> {
  try {
    const result = await authFetch<T>(path, {
      method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
    if (result.ok) return { ok: true, data: result.data as T }
    return {
      ok: false,
      message: errors[result.code ?? ''] ?? (result.status === 401 ? '로그인이 필요해요.' : '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'),
    }
  } catch {
    return { ok: false, message: '서버와 연결하지 못했어요. 연결 상태를 확인해 주세요.' }
  }
}

export const fetchScopes = () => keyRequest<ScopeInfo[]>('/api-keys/scopes')
export const fetchMyKeys = () => keyRequest<ApiKeyView[]>('/api-keys')
export const requestKey = (body: { name: string; purpose: string; site: string; scopes: string[] }) =>
  keyRequest<{ key: string; apiKey: ApiKeyView }>('/api-keys', 'POST', body)
export const revokeKey = (id: number) => keyRequest<null>(`/api-keys/${id}`, 'DELETE')
export const fetchKeyUsage = (id: number, days: number) => keyRequest<ApiUsage>(`/api-keys/${id}/usage?days=${days}`)

/** 공개 API의 주소예요. 개발 서버는 서버 주소가 비어 있어서 운영 주소를 적어요. */
export const PUBLIC_API_BASE = `${((import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://javadda-api.hidly.dev').replace(/\/+$/, '')}/api/public/v1`

export interface EndpointDoc {
  scope: string
  path: string
  summary: string
  params: [string, string][]
}

/** 공개 API의 문서예요. 서버의 PublicApiController와 같이 고쳐요. */
export const ENDPOINTS: EndpointDoc[] = [
  {
    scope: 'postings:read',
    path: '/postings',
    summary: '열린 채용 공고를 찾아요.',
    params: [
      ['query', '기업 이름, 제목, 지역, 역량에서 찾을 말'],
      ['family', 'backend, frontend, mobile, data, devops, other'],
      ['career', 'entry, junior, any (고른 경력과 경력 무관 공고)'],
      ['company', '기업 아이디'],
      ['sort', 'recent(기본), deadline'],
      ['page, size', '0부터, size는 100까지(기본 20)'],
    ],
  },
  { scope: 'postings:read', path: '/postings/{id}', summary: '공고 하나예요. 마감된 공고는 closedAt이 있어요.', params: [] },
  {
    scope: 'companies:read',
    path: '/companies',
    summary: '기업 목록과 채용 중인 공고 수예요.',
    params: [
      ['query', '기업 이름에서 찾을 말'],
      ['category', 'service, saas, commerce, finance, ai, it-service, manufacturing, public, other'],
      ['page, size', '0부터, size는 100까지(기본 20)'],
    ],
  },
  { scope: 'companies:read', path: '/companies/{id}', summary: '기업 하나예요.', params: [] },
  { scope: 'skills:read', path: '/skills', summary: '스킬 사전이에요. 공고에 적힌 비중(share)과 6개월 변화(change)가 있어요.', params: [['axis', '언어, 프레임워크, 데이터베이스, 인프라, 협업, CS 기초']] },
  { scope: 'skills:read', path: '/skills/{name}', summary: '스킬 하나와 추천 강의예요. 별칭(스프링, k8s)으로도 찾아요.', params: [] },
  { scope: 'stats:read', path: '/stats/postings', summary: '열린 공고를 직군, 경력, 분류, 기업으로 센 수와 많이 찾는 필수, 우대 역량이에요.', params: [] },
  { scope: 'blogs:read', path: '/blogs', summary: '기업 기술 블로그의 글 요약과 주제예요.', params: [] },
  { scope: 'blogs:read', path: '/blogs/outlook', summary: '여러 기업 블로그의 흐름을 정리한 총정리예요.', params: [] },
  { scope: 'contests:read', path: '/contests', summary: '마감하지 않은 공모전이에요.', params: [] },
]

export const ERROR_DOCS: [string, string, string][] = [
  ['401', 'C4014', 'X-API-Key 헤더가 없어요.'],
  ['401', 'C4015', '없는 키예요.'],
  ['403', 'C4031', '아직 승인되지 않았거나 해지한 키예요.'],
  ['403', 'C4032', '사용 기간이 끝났어요.'],
  ['403', 'C4033', '이 API의 권한이 없는 키예요.'],
  ['429', 'C429', '1분이나 하루 한도를 넘었어요. Retry-After 헤더의 초만큼 기다려요.'],
  ['400', 'C002', '파라미터가 잘못됐어요.'],
  ['404', 'C4042, C404', '공고나 기업을 찾을 수 없어요.'],
]
