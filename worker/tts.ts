/**
 * 면접 질문을 사람 목소리로 읽어 주는 경로(POST /tts)예요. ElevenLabs API 키를 브라우저에 보이지 않게 서버 쪽에서만 써요.
 * 배포에서는 Cloudflare Worker(`worker/index.ts`)가, 개발 서버에서는 `vite.config.ts`가 이 함수를 불러요.
 * 키가 없거나 실패하면 오류로 답하고, 화면은 브라우저 음성으로 읽어요.
 */

import { DEFAULT_VOICE, voiceOf } from '../shared/voices'

export const TTS_PATH = '/tts'
/**
 * 글자마다 읽기 시작하는 때를 담은 응답 헤더예요. 화면이 노래방 자막처럼 읽는 글자를 칠할 때 써요(`src/lib/speech.ts`).
 * 값은 글자 순서대로 시작 시각을 1/100초 단위 정수로 쉼표로 이은 것이고, 맨 끝에 마지막 글자가 끝나는 시각이 하나 더 붙어요.
 */
export const TTS_TIMING_HEADER = 'X-TTS-Timing'

/** 질문 하나의 길이를 넉넉히 잡았어요. 다른 글을 읽히는 데 쓰이지 않게 막아요. */
const MAX_CHARS = 300
const DEFAULT_BASE_URL = 'https://api.elevenlabs.io'
/** 한국어를 지원하는 모델 중 가장 자연스러워요. 최신 v4는 이 API로 쓸 수 없어요. */
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'
const OUTPUT_FORMAT = 'mp3_44100_128'
/** 면접관답게 흔들림 없이 말해요. 한국어는 빠르게 읽히면 음절이 뭉개져서 보통 빠르기로 두고, stability를 조금 높여 억양과 숨 쉬는 자리가 튀지 않게 해요. style은 0이어야 또렷해요. */
const VOICE_SETTINGS = { stability: 0.65, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.0 }

/**
 * 한국어 문장 속 영어 기술 용어를 한국어 발음으로 바꿔 읽혀요. 그대로 두면 영어 억양으로 튀거나 글자를 이상하게 끊어 읽어요.
 * 사전에 있는 낱말은 그 발음으로, 사전에 없고 대문자로만 적힌 약어(HTTP, TLS)는 알파벳을 하나씩 읽어요. 나머지는 그대로 둬요.
 */
const LETTERS: Record<string, string> = {
  A: '에이', B: '비', C: '씨', D: '디', E: '이', F: '에프', G: '지', H: '에이치', I: '아이', J: '제이', K: '케이', L: '엘', M: '엠',
  N: '엔', O: '오', P: '피', Q: '큐', R: '알', S: '에스', T: '티', U: '유', V: '브이', W: '더블유', X: '엑스', Y: '와이', Z: '지',
}
const WORDS: Record<string, string> = {
  java: '자바', javascript: '자바스크립트', typescript: '타입스크립트', js: '제이에스', ts: '티에스', python: '파이썬', kotlin: '코틀린', swift: '스위프트',
  go: '고', golang: '고랭', rust: '러스트', scala: '스칼라', ruby: '루비', php: '피에이치피', dart: '다트',
  spring: '스프링', boot: '부트', cloud: '클라우드', batch: '배치', security: '시큐리티', webflux: '웹플럭스', jpa: '제이피에이', hibernate: '하이버네이트',
  querydsl: '쿼리디에스엘', mybatis: '마이바티스', junit: '제이유닛', gradle: '그레이들', maven: '메이븐',
  react: '리액트', vue: '뷰', next: '넥스트', nuxt: '넉스트', node: '노드', nest: '네스트', express: '익스프레스', angular: '앵귤러', svelte: '스벨트',
  redux: '리덕스', recoil: '리코일', zustand: '주스탠드', webpack: '웹팩', vite: '비트', tailwind: '테일윈드', storybook: '스토리북',
  android: '안드로이드', ios: '아이오에스', flutter: '플러터', compose: '컴포즈', swiftui: '스위프트유아이',
  django: '장고', flask: '플라스크', fastapi: '패스트에이피아이',
  mysql: '마이에스큐엘', postgresql: '포스트그레스큐엘', postgres: '포스트그레스', mongodb: '몽고디비', redis: '레디스', oracle: '오라클',
  elasticsearch: '엘라스틱서치', kafka: '카프카', rabbitmq: '래빗엠큐', spark: '스파크', hadoop: '하둡', airflow: '에어플로우',
  docker: '도커', kubernetes: '쿠버네티스', jenkins: '젠킨스', terraform: '테라폼', ansible: '앤서블', nginx: '엔진엑스', linux: '리눅스',
  prometheus: '프로메테우스', grafana: '그라파나', github: '깃허브', gitlab: '깃랩', git: '깃', actions: '액션스', lambda: '람다',
  graphql: '그래프큐엘', rest: '레스트', restful: '레스트풀', grpc: '지알피씨', websocket: '웹소켓', oauth: '오어스',
  handshake: '핸드셰이크', deadlock: '데드락', index: '인덱스', cache: '캐시', query: '쿼리', thread: '스레드', transaction: '트랜잭션',
  frontend: '프론트엔드', backend: '백엔드', devops: '데브옵스', server: '서버', client: '클라이언트', test: '테스트', code: '코드', data: '데이터',
}

function pronounce(word: string): string {
  const known = WORDS[word.toLowerCase()]
  if (known) return known
  if (/^[A-Z]+$/.test(word) && word.length <= 6) return [...word].map((letter) => LETTERS[letter]).join('')
  return word
}

/** 화면에 보이는 글 조각과 소리 내어 읽을 조각이에요. 둘이 같으면 바꾸지 않은 조각이에요. */
interface Piece { shown: string; spoken: string }

function piecesOf(text: string): Piece[] {
  const pieces: Piece[] = []
  let last = 0
  // Node.js처럼 점으로 이은 이름은 한 덩어리로 읽고, C#, N+1의 기호도 말로 바꿔요.
  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*#?|\+/g)) {
    const index = match.index ?? 0
    if (index > last) pieces.push({ shown: text.slice(last, index), spoken: text.slice(last, index) })
    const shown = match[0]
    const spoken = shown === '+' ? '플러스' : shown.replace(/#$/, '').split('.').map(pronounce).join('') + (shown.endsWith('#') ? '샵' : '')
    pieces.push({ shown, spoken })
    last = index + shown.length
  }
  if (last < text.length) pieces.push({ shown: text.slice(last), spoken: text.slice(last) })
  return text.length >= PAUSE_MIN_CHARS ? pieces.flatMap(withPauses) : pieces
}

/** 이보다 짧은 문장은 쉼표 없이도 한 호흡에 자연스럽게 읽어요. */
const PAUSE_MIN_CHARS = 30
/**
 * 쉼표 없이 긴 문장을 주면 모델이 엉뚱한 자리에서 숨을 쉬어요. 절이 이어지는 어미(~는데, ~면서, ~하고) 뒤에 읽기용 쉼표를 넣어 사람이 쉬는 자리에서 쉬게 해요.
 * 화면 글자에는 없는 쉼표라 보이는 글자 수가 0인 조각으로 넣고, 글자 시각을 되돌릴 때 건너뛰어요.
 */
const PAUSE_AFTER = /(?:는데|은데|면서|지만|했고|하고|되고|있고|다면|려면|어서|아서|해서|었는데|했는데)(?= )/g

function withPauses(piece: Piece): Piece[] {
  if (piece.shown !== piece.spoken) return [piece]
  const out: Piece[] = []
  let last = 0
  for (const match of piece.shown.matchAll(PAUSE_AFTER)) {
    const end = (match.index ?? 0) + match[0].length
    out.push({ shown: piece.shown.slice(last, end), spoken: piece.shown.slice(last, end) }, { shown: '', spoken: ',' })
    last = end
  }
  out.push({ shown: piece.shown.slice(last), spoken: piece.shown.slice(last) })
  return out
}

export interface TtsEnv {
  ELEVENLABS_API_KEY?: string
  ELEVENLABS_VOICE_ID?: string
  ELEVENLABS_MODEL_ID?: string
  ELEVENLABS_BASE_URL?: string
}

export interface TtsOptions {
  /** 만든 음성을 다시 쓰는 곳이에요. 같은 질문은 ElevenLabs 사용량을 쓰지 않아요. */
  cache?: { match: (key: Request) => Promise<Response | undefined>; put: (key: Request, response: Response) => Promise<void> }
  /** 새 음성을 만들어도 되는지 물어요. false면 429로 답해요. */
  allow?: (request: Request) => Promise<boolean>
  /** 응답을 보낸 뒤에 끝내도 되는 일을 맡겨요. */
  defer?: (work: Promise<unknown>) => void
}

/** with-timestamps의 응답이에요. 음성은 base64로, 시각은 글자마다 초 단위로 와요. */
interface Timestamped {
  audio_base64?: string
  alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] } | null
}

/**
 * 글자 시각을 헤더 값으로 줄여요. 시각은 읽은 글(spoken) 기준으로 오니까, 화면에 보이는 글자 기준으로 되돌려요.
 * 바꾼 조각(HTTP를 에이치티티피로)은 조각의 시작과 끝 사이를 글자 수만큼 고르게 나눠요. 읽은 글과 글자 수가 다르면(맞출 수 없으면) 보내지 않아요.
 */
function timingOf(alignment: Timestamped['alignment'], pieces: Piece[]): string | null {
  const starts = alignment?.character_start_times_seconds
  const ends = alignment?.character_end_times_seconds
  const spokenLength = pieces.reduce((sum, piece) => sum + piece.spoken.length, 0)
  if (!starts?.length || !ends?.length || starts.length !== spokenLength) return null
  const end = ends[ends.length - 1]
  const shown: number[] = []
  let at = 0
  for (const piece of pieces) {
    if (piece.shown === piece.spoken) {
      shown.push(...starts.slice(at, at + piece.spoken.length))
    } else {
      const from = starts[at]
      const to = at + piece.spoken.length < starts.length ? starts[at + piece.spoken.length] : end
      for (let index = 0; index < piece.shown.length; index++) shown.push(from + ((to - from) * index) / piece.shown.length)
    }
    at += piece.spoken.length
  }
  return [...shown, end].map((second) => Math.round(second * 100)).join(',')
}

const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

async function cacheKey(voice: string, model: string, text: string) {
  // 글자 시각을 함께 담기 시작하면서(v2), 영어 용어를 한국어 발음으로 읽고 설정을 바꾸면서(v3), 숨 쉬는 자리를 넣으면서(v4) 예전 음성과 섞이지 않게 열쇠를 바꿨어요.
  const bytes = new TextEncoder().encode(`v4\n${voice}\n${model}\n${text}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const name = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return new Request(`https://tts.cache/${name}`)
}

export async function handleTts(request: Request, env: TtsEnv, options: TtsOptions = {}): Promise<Response> {
  if (request.method !== 'POST') return reply(405, 'method_not_allowed')
  if (!env.ELEVENLABS_API_KEY) return reply(503, 'not_configured')
  // 다른 사이트의 화면에서 이 경로를 쓰지 못하게 해요.
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply(403, 'forbidden')

  const body = (await request.json().catch(() => null)) as { text?: unknown; voice?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > MAX_CHARS) return reply(400, 'invalid_text')

  // 사용자가 고른 목소리는 목록에 있는 것만 받아요. 고르지 않았으면 기본 목소리예요.
  const picked = typeof body?.voice === 'string' ? voiceOf(body.voice) : undefined
  if (body?.voice !== undefined && !picked) return reply(400, 'invalid_voice')
  const voice = picked?.id ?? (env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE.id)
  const model = env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID
  const key = options.cache ? await cacheKey(voice, model, text) : null
  if (key) {
    const hit = await options.cache?.match(key)
    if (hit) return hit
  }
  if (options.allow && !(await options.allow(request))) return reply(429, 'rate_limited')

  const pieces = piecesOf(text)
  const base = (env.ELEVENLABS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  // with-timestamps는 음성과 함께 글자마다 읽는 시각을 돌려줘요. 화면의 자막을 소리와 맞추는 데 써요.
  const upstream = await fetch(`${base}/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY },
    // v3는 설정의 허용 범위가 달라서 목소리에 저장된 값을 그대로 써요.
    body: JSON.stringify({ text: pieces.map((piece) => piece.spoken).join(''), model_id: model, ...(model.startsWith('eleven_v3') ? {} : { voice_settings: VOICE_SETTINGS }) }),
  }).catch(() => null)
  if (!upstream?.ok) {
    console.error('ElevenLabs request failed', upstream?.status ?? 'network')
    return reply(502, 'upstream_failed')
  }

  const data = (await upstream.json().catch(() => null)) as Timestamped | null
  if (!data?.audio_base64) {
    console.error('ElevenLabs response had no audio')
    return reply(502, 'upstream_failed')
  }
  const audio = Uint8Array.from(atob(data.audio_base64), (char) => char.charCodeAt(0))
  const headers: Record<string, string> = { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=2592000' }
  const timing = timingOf(data.alignment, pieces)
  if (timing) headers[TTS_TIMING_HEADER] = timing
  const response = new Response(audio, { headers })
  if (key) options.defer?.(options.cache?.put(key, response.clone()) ?? Promise.resolve())
  return response
}
