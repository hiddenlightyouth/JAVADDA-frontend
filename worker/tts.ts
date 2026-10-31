/**
 * 면접 질문을 사람 목소리로 읽어 주는 경로(POST /tts)예요. ElevenLabs API 키를 브라우저에 보이지 않게 서버 쪽에서만 써요.
 * 배포에서는 Cloudflare Worker(`worker/index.ts`)가, 개발 서버에서는 `vite.config.ts`가 이 함수를 불러요.
 * 키가 없거나 실패하면 오류로 답하고, 화면은 브라우저 음성으로 읽어요.
 */

import { VOICES, voiceOf } from '../shared/voices'

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
/** 면접관답게 흔들림 없이, 평소보다 조금 빠르게 말해요. style은 0이어야 또렷하고 빨라요. */
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.1 }

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

/** 글자 시각을 헤더 값으로 줄여요. 보낸 글과 글자 수가 다르면(맞출 수 없으면) 보내지 않아요. */
function timingOf(alignment: Timestamped['alignment'], text: string): string | null {
  const starts = alignment?.character_start_times_seconds
  const ends = alignment?.character_end_times_seconds
  if (!starts?.length || !ends?.length || starts.length !== text.length) return null
  return [...starts, ends[ends.length - 1]].map((second) => Math.round(second * 100)).join(',')
}

const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

async function cacheKey(voice: string, model: string, text: string) {
  // 글자 시각을 함께 담기 시작하면서(v2) 예전 음성과 섞이지 않게 열쇠를 바꿨어요.
  const bytes = new TextEncoder().encode(`v2\n${voice}\n${model}\n${text}`)
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
  const voice = picked?.id ?? (env.ELEVENLABS_VOICE_ID || VOICES[0].id)
  const model = env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID
  const key = options.cache ? await cacheKey(voice, model, text) : null
  if (key) {
    const hit = await options.cache?.match(key)
    if (hit) return hit
  }
  if (options.allow && !(await options.allow(request))) return reply(429, 'rate_limited')

  const base = (env.ELEVENLABS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  // with-timestamps는 음성과 함께 글자마다 읽는 시각을 돌려줘요. 화면의 자막을 소리와 맞추는 데 써요.
  const upstream = await fetch(`${base}/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY },
    // v3는 설정의 허용 범위가 달라서 목소리에 저장된 값을 그대로 써요.
    body: JSON.stringify({ text, model_id: model, ...(model.startsWith('eleven_v3') ? {} : { voice_settings: VOICE_SETTINGS }) }),
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
  const timing = timingOf(data.alignment, text)
  if (timing) headers[TTS_TIMING_HEADER] = timing
  const response = new Response(audio, { headers })
  if (key) options.defer?.(options.cache?.put(key, response.clone()) ?? Promise.resolve())
  return response
}
