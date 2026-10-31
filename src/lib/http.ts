const OWNER_KEY_STORAGE = 'whoisloafing:owner'

/**
 * 이 브라우저에서 만든 채팅을 알아보기 위한 무작위 값이에요. 로그인 정보나 토큰이 아니에요.
 * 서버는 이 값의 해시만 저장하고, 공유하기 전의 채팅은 같은 값을 가진 브라우저만 열 수 있어요.
 */
function ownerKey(): string {
  try {
    let key = localStorage.getItem(OWNER_KEY_STORAGE)
    if (!key) {
      key = `${crypto.randomUUID()}${crypto.randomUUID()}`
      localStorage.setItem(OWNER_KEY_STORAGE, key)
    }
    return key
  } catch {
    return ''
  }
}

export const ownerHeaders = (): Record<string, string> => {
  const key = ownerKey()
  return key ? { 'X-Owner-Key': key } : {}
}

const API_BASE = `${((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')}/api/v1`

export const apiUrl = (path: string) => `${API_BASE}${path}`

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  code: string | null
}

type Body<T> = { data?: T; error?: { code?: string | null } } | null

const toResult = <T,>(res: Response, body: Body<T>): ApiResult<T> => ({ ok: res.ok, status: res.status, data: body?.data ?? null, code: body?.error?.code ?? null })

export async function readResult<T>(res: Response): Promise<ApiResult<T>> {
  const body = (await res.json().catch(() => null)) as Body<T>
  return toResult(res, body)
}

/** 받은 바이트(loaded)와 전체 바이트(total)를 알려요. 전체를 모르면 total은 null이에요. */
type OnBytes = (loaded: number, total: number | null) => void

/**
 * readResult와 같은 결과를 돌려주면서, 본문을 조금씩 읽어 받은 바이트를 알려요. 전체는 서버가 붙여 주는 Content-Length예요.
 * Content-Length가 없거나 본문을 조금씩 읽을 수 없으면 readResult로 한 번에 읽고, 다 읽은 뒤에 끝났다고 한 번 알려요(loaded와 total이 같아요).
 * 압축해서 보내면 받은 바이트가 Content-Length보다 커질 수 있어서 total을 넘지 않게 잘라요.
 */
async function readJsonWithProgress<T>(res: Response, onBytes?: OnBytes): Promise<ApiResult<T>> {
  const header = res.headers.get('Content-Length')
  const total = header !== null && /^\d+$/.test(header.trim()) ? Number(header) : null
  if (!onBytes || !total || !res.body || typeof TextDecoder === 'undefined') {
    const result = await readResult<T>(res)
    onBytes?.(total ?? 0, total ?? 0)
    return result
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  onBytes(0, total)
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.byteLength
      onBytes(Math.min(loaded, total), total)
    }
  } catch {
    // res.json()이 실패했을 때처럼 본문 없이 돌려줘요.
    onBytes(total, total)
    return toResult<T>(res, null)
  }
  onBytes(total, total)
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let body: Body<T> = null
  try {
    body = JSON.parse(new TextDecoder().decode(bytes)) as Body<T>
  } catch {
    body = null
  }
  return toResult(res, body)
}

/** 요청 하나가 얼마나 받았는지(0에서 1)를 알려요. 화면은 `src/lib/load.ts`의 `useLoadProgress`로 여러 요청을 묶어 퍼센트로 봐요. */
export type OnLoad = (fraction: number) => void

/** 응답의 머리(헤더)가 오면 이만큼 온 것으로 쳐요. 나머지는 받은 바이트의 비율이에요. */
const HEADERS_FRACTION = 0.1

/**
 * 응답을 읽으면서 onLoad로 알려요. 헤더가 오면 10%, 그 뒤로 10% + 90% x 받은 바이트의 비율, 다 읽으면 100%예요.
 * onLoad가 없으면 readResult와 같아요. 요청이 실패해 응답이 없을 때는 부른 쪽이 onLoad(1)을 불러요.
 */
export async function readWithLoad<T>(res: Response, onLoad?: OnLoad): Promise<ApiResult<T>> {
  if (!onLoad) return readResult<T>(res)
  onLoad(HEADERS_FRACTION)
  const result = await readJsonWithProgress<T>(res, (loaded, total) => {
    if (total === null) return
    onLoad(HEADERS_FRACTION + (1 - HEADERS_FRACTION) * (total === 0 ? 1 : loaded / total))
  })
  onLoad(1)
  return result
}
