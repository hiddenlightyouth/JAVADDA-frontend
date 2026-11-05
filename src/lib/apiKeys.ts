import type { Result } from './admin'
import { authFetch } from './auth'

// 외부 API 키예요. 사용자가 권한과 사유를 적어 요청하면 관리자가 승인하고, 승인된 뒤 사용자가 발급(재발급)해서 써요. 서버는 /api/v1/api-keys,
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
  /** 화면에 보여줄 키 앞부분(jvd_ab12cd34). 발급 전에는 null이에요. */
  prefix: string | null
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
  /** 마지막으로 발급(재발급)한 때 */
  issuedAt: string | null
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
  pending: '대기 중',
  approved: '사용 중',
  rejected: '거절',
  revoked: '해지',
}

/** 사용자가 한 번에 가질 수 있는 키 수(심사 중과 사용 중). 서버의 ApiKeyService.MAX_KEYS와 같아요. */
export const MAX_KEYS = 5

const errors: Record<string, string> = {
  C4094: `API 키는 ${MAX_KEYS}개까지 요청할 수 있습니다. 사용하지 않는 키를 해지하십시오.`,
  C4095: '해지한 키는 변경할 수 없습니다.',
  C4099: '승인된 키만 발급할 수 있습니다.',
  C404: '키를 찾을 수 없습니다.',
  C002: '입력한 값을 확인하십시오.',
  C001: '사유는 10자 이상 입력하고, 권한은 하나 이상 선택하십시오.',
  C403: '권한이 없습니다.',
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
      message: errors[result.code ?? ''] ?? (result.status === 401 ? '로그인이 필요합니다.' : '요청을 처리하지 못했습니다. 잠시 뒤에 다시 시도하십시오.'),
    }
  } catch {
    return { ok: false, message: '서버와 연결하지 못했습니다. 연결 상태를 확인하십시오.' }
  }
}

export const fetchScopes = () => keyRequest<ScopeInfo[]>('/api-keys/scopes')
export const fetchMyKeys = () => keyRequest<ApiKeyView[]>('/api-keys')
export const requestKey = (body: { name: string; purpose: string; site: string; scopes: string[] }) =>
  keyRequest<ApiKeyView>('/api-keys', 'POST', body)
/** 승인된 키를 발급해요. 이미 발급했으면 새 키로 바꾸고 예전 키는 바로 막혀요. key는 이때 한 번만 받아요. */
export const issueKey = (id: number) => keyRequest<{ key: string; apiKey: ApiKeyView }>(`/api-keys/${id}/issue`, 'POST')
export const revokeKey = (id: number) => keyRequest<null>(`/api-keys/${id}`, 'DELETE')
export const fetchKeyUsage = (id: number, days: number) => keyRequest<ApiUsage>(`/api-keys/${id}/usage?days=${days}`)

/** 공개 API의 주소예요. 개발 서버는 서버 주소가 비어 있어서 운영 주소를 적어요. */
export const PUBLIC_API_BASE = `${((import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://javadda-api.hidly.dev').replace(/\/+$/, '')}/api/public/v1`
