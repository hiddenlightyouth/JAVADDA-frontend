import { authFetch, type Slice } from './auth'
import type { Result } from './admin'

export interface Member {
  id: number
  email: string
  name: string
  role: 'USER' | 'ADMIN'
  /** GitHub로만 가입해서 비밀번호가 없는 계정이에요. */
  socialOnly?: boolean
  registeredAt: string | null
}
export interface MemberDetail {
  user: Member
  sessions: {
    id: string
    name: string | null
    ipAddress: string | null
    createdAt: string
    lastUsedAt: string
  }[]
  logins: {
    id: number
    deviceName: string | null
    ipAddress: string | null
    loggedInAt: string
  }[]
}
export interface Posting {
  id: string
  company: string
  title: string
  family: string
  career: string
  location: string
  deadline: string | null
  required: string[]
  preferred: string[]
  summary: string
  url: string
  closedAt: string | null
}
export interface Business {
  id: string
  name: string
  initial: string
  industry: string
  site: string
  techBlog: string | null
  category: string | null
  displayOrder: number
}
export interface Call {
  id: number
  provider: string
  model: string
  purpose: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  error: string | null
  createdAt: string
  /** 설정한 단가로 어림한 달러. 단가를 모르면 null */
  cost: number | null
}
/**
 * AI 호출 하나의 자세한 내용이에요. system은 지금의 프롬프트 파일이라 그때와 다를 수 있어요.
 * input과 output은 보관 기간(retentionDays) 동안만 있고, 지났거나 남기기 전 호출이면 null이에요.
 */
export interface CallDetail {
  call: Call
  system: string | null
  input: string | null
  output: string | null
  retentionDays: number
}
/** 합계예요. cost는 단가를 아는 호출만 더한 달러이고, latencyMs는 합이에요. */
export interface AiTotals {
  calls: number
  failures: number
  inputTokens: number
  outputTokens: number
  cost: number
  unpricedCalls: number
  latencyMs: number
}
export interface AiGroup {
  key: string
  label: string
  provider: string | null
  total: AiTotals
  /** 토큰 100만 개당 달러. 모델 묶음에만 있어요. */
  inputPrice: number | null
  outputPrice: number | null
}
export interface AiUsage {
  days: number
  from: string
  to: string
  krwPerUsd: number
  total: AiTotals
  previous: AiTotals | null
  daily: { date: string; calls: number; failures: number; inputTokens: number; outputTokens: number; cost: number }[]
  models: AiGroup[]
  purposes: AiGroup[]
}
export interface Source {
  id: number
  companyId: string
  kind: string
  target: string | null
  enabled: boolean
  lastRunAt: string | null
  lastAdded: number
  lastError: string | null
}
export interface Overview {
  users: number
  admins: number
  postings: number
  openPostings: number
  companies: number
  resumes: number
  reports: number
  contests: number
  blogs: number
  aiCalls: number
  aiFailures: number
}
const errors: Record<string, string> = {
  C4007: 'GitHub로만 가입한 계정은 비밀번호를 초기화할 수 없어요.',
  C403: '관리자 권한이 필요해요. 내 계정의 권한과 로그인 상태를 확인해 주세요.',
  C404: '자료가 없어요. 목록을 새로고침해 주세요.',
  C002: '입력한 값이나 주소를 확인해 주세요.',
  C001: '입력한 값의 길이와 필수 항목을 확인해 주세요.',
  C4093: '이미 수집 중이에요. 잠시 뒤에 상태를 새로고침해 주세요.',
}
export async function manageRequest<T>(path: string, method = 'GET', body?: unknown): Promise<Result<T>> {
  try {
    const result = await authFetch<T>(path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    })
    if (result.ok) return { ok: true, data: result.data as T }
    return {
      ok: false,
      message:
        errors[result.code ?? ''] ??
        (result.status === 401 ? '로그인이 필요해요.' : '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'),
    }
  } catch {
    return {
      ok: false,
      message: '서버와 연결하지 못했어요. 연결 상태를 확인해 주세요.',
    }
  }
}
export const getManage = <T>(path: string) => manageRequest<T>(`/admin/manage${path}`)
export const updateManage = (path: string, method: string, body?: unknown) =>
  manageRequest<null>(`/admin/manage${path}`, method, body)
export const listManage = <T>(path: string, query: string, filter: Record<string, string>, page: number) =>
  getManage<Slice<T>>(`${path}?${new URLSearchParams({ query, ...filter, page: String(page), size: '20' })}`)
