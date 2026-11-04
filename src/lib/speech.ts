import { useCallback, useEffect, useRef, useState } from 'react'
import { track } from './analytics'
import { charPose, REST, withLoudness, type MouthPose } from './lipsync'
import { isApp } from './shell'
import { readItem, writeItem } from './storage'
import { createStore, useStore } from './store'

/**
 * 면접 연습의 음성 기능이에요. 말로 답하기는 브라우저의 음성 인식을, 질문 듣기는 사람 목소리(ElevenLabs)를 먼저 쓰고 안 되면 브라우저 음성을 써요.
 * 말한 내용은 글자로 바뀌어 답변 칸에 들어가고, 채점은 글로 쓴 답과 똑같이 받아요.
 * Safari와 Chrome처럼 지원하는 브라우저에서만 켜지고, 나머지(macOS 앱의 웹뷰, Firefox)에서는 버튼을 숨겨요.
 */

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}

interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart?: (() => void) | null
  start: () => void
  abort: () => void
}

type RecognitionClass = new () => Recognition

const recognitionClass = (): RecognitionClass | null => {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

/** 말로 답하기를 쓸 수 있는 브라우저인지예요. */
export const canDictate = () => recognitionClass() !== null

/** 마이크를 미리 받은 결과예요. 'denied'는 권한이 없고, 'missing'은 마이크를 찾지 못한 거예요. */
export type MicResult = 'ready' | 'denied' | 'missing'

/** 음성 인식 허락을 기다리는 가장 긴 시간이에요. 허락 창에 답하는 동안 기다려요. */
const PRIME_TIMEOUT_MS = 15000

/**
 * 면접을 시작하기 전에 마이크 허락을 미리 받아요. 첫 질문에 답할 때 허락 창이 뜨지 않게 해요.
 * 마이크를 한 번 열었다 바로 닫고, Safari와 macOS 앱은 음성 인식 허락을 따로 물어서 음성 인식도 한 번 켰다 꺼요.
 * Chrome은 마이크 허락 하나로 음성 인식까지 되고, 한 번 허락하면 그 사이트에 기억해서 다시 묻지 않아요.
 * 시작 화면의 "마이크 켜기"를 누른 순간에 불러야 브라우저가 허락 창을 띄워요.
 */
export async function prepareMic(lang: string): Promise<MicResult> {
  if (!navigator.mediaDevices?.getUserMedia) return 'ready'
  try {
    const media = await navigator.mediaDevices.getUserMedia({ audio: true })
    media.getTracks().forEach((track) => track.stop())
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing'
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
    return 'ready'
  }
  const Class = recognitionClass()
  const chrome = typeof window !== 'undefined' && 'chrome' in window && !isApp
  if (!Class || chrome) return 'ready'
  return new Promise<MicResult>((resolve) => {
    let done = false
    const recognition = new Class()
    const end = (result: MicResult) => {
      if (done) return
      done = true
      clearTimeout(timer)
      recognition.onstart = recognition.onerror = recognition.onend = recognition.onresult = null
      try {
        recognition.abort()
      } catch {
        // 이미 멈췄으면 그대로 둬요.
      }
      resolve(result)
    }
    const timer = setTimeout(() => end('ready'), PRIME_TIMEOUT_MS)
    recognition.lang = lang
    recognition.onstart = () => end('ready')
    recognition.onerror = (event) => end(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'ready')
    recognition.onend = () => end('ready')
    try {
      recognition.start()
    } catch {
      end('ready')
    }
  })
}

/**
 * 묻지 않아도 이미 말로 답할 수 있는지예요. Chrome은 마이크 허락 하나로 음성 인식까지 되어서, 이 사이트에 마이크를 허락해 뒀으면 참이에요.
 * Safari와 macOS 앱은 음성 인식 허락을 따로 물어서, 늘 "마이크 켜기"를 누를 때 함께 받아요.
 */
export async function micAllowed(): Promise<boolean> {
  const chrome = typeof window !== 'undefined' && 'chrome' in window && !isApp
  if (!chrome || !navigator.permissions?.query) return false
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return status.state === 'granted'
  } catch {
    return false
  }
}

/** 질문을 소리로 읽어 줄 수 있는 브라우저인지예요. */
export const canSpeak = () => typeof window !== 'undefined' && ('Audio' in window || 'speechSynthesis' in window)

/** 글 뒤에 띄어쓰기 하나를 두고 이어 붙여요. */
export const joinSpeech = (text: string, more: string) => (text && more ? `${text.trimEnd()} ${more}` : text || more)

/** 잠깐 말이 없거나 멈춘 것은 오류로 치지 않아요. */
const QUIET_ERRORS = new Set(['no-speech', 'aborted'])

/**
 * 말을 글자로 받아요. 확정된 글자는 onText로, 아직 바뀔 수 있는 글자는 interim으로 줘요.
 * 브라우저는 조용해지면 알아서 듣기를 끝내서, 사용자가 멈추기 전까지는 다시 켜요.
 * finish는 듣기를 멈추고 아직 확정되지 않은 글자를 돌려줘요.
 */
export function useDictation(lang: string, onText: (text: string) => void, onError: (code: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const session = useRef<{ recognition: Recognition | null; stopped: boolean } | null>(null)
  const pending = useRef('')
  const handlers = useRef({ onText, onError })

  useEffect(() => {
    handlers.current = { onText, onError }
  })

  const setPending = (text: string) => {
    pending.current = text
    setInterim(text)
  }

  const finish = useCallback(() => {
    const current = session.current
    const rest = pending.current
    session.current = null
    setPending('')
    setListening(false)
    if (current) {
      current.stopped = true
      current.recognition?.abort()
    }
    return rest
  }, [])

  const start = useCallback(() => {
    const Class = recognitionClass()
    if (!Class || session.current) return
    const current: { recognition: Recognition | null; stopped: boolean } = { recognition: null, stopped: false }
    session.current = current

    const fail = (code: string) => {
      // 실패해도 이미 들은 글자는 잃지 않게 넘겨요.
      const rest = finish()
      if (rest) handlers.current.onText(rest)
      handlers.current.onError(code)
    }

    const listen = () => {
      const recognition = new Class()
      recognition.lang = lang
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        if (current.stopped) return
        let live = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          const text = result[0].transcript.trim()
          if (!result.isFinal) live = joinSpeech(live, text)
          else if (text) handlers.current.onText(text)
        }
        setPending(live)
      }
      recognition.onerror = (event) => {
        if (!current.stopped && !QUIET_ERRORS.has(event.error)) fail(event.error)
      }
      recognition.onend = () => {
        if (current.stopped) return
        // 끝나기 전에 확정되지 못한 글자는 잃지 않게 넘기고 다시 들어요.
        if (pending.current) handlers.current.onText(pending.current)
        setPending('')
        listen()
      }
      current.recognition = recognition
      try {
        recognition.start()
      } catch {
        fail('start-failed')
      }
    }

    setListening(true)
    listen()
  }, [finish, lang])

  useEffect(() => () => void finish(), [finish])

  return { listening, interim, start, finish }
}

/** 사람 목소리 음성이에요. timing은 글자마다 읽기 시작하는 시각(초)이고 맨 끝에 다 읽는 시각이 붙어요. 서버가 주지 않으면 null이에요. */
interface Voice {
  url: string
  timing: number[] | null
}

/** 서버가 만든 음성을 이번 접속 동안 기억해요. 같은 질문을 다시 들어도 사용량을 쓰지 않아요. */
const voices = new Map<string, Voice>()

/** 서버의 글자 시각 헤더(`worker/tts.ts`의 TTS_TIMING_HEADER)를 읽어요. 글과 글자 수가 맞지 않으면 쓰지 않아요. */
function readTiming(header: string | null, text: string): number[] | null {
  if (!header) return null
  const values = header.split(',').map((value) => Number(value) / 100)
  return values.length === text.length + 1 && values.every(Number.isFinite) ? values : null
}

/** 글자 하나를 칠하는 데 이보다 오래 걸리지 않게 해요. 쉬어 가는 자리에서 한 글자가 느리게 칠해지지 않아요. */
const MAX_CHAR_SECONDS = 0.25

/** 재생 위치(초)에서 읽은 글자 수를 셈해요. 읽고 있는 글자는 그 글자를 읽은 만큼만 더해서, 칠하는 경계가 부드럽게 움직여요. */
function spokenChars(timing: number[], time: number) {
  const count = timing.length - 1
  if (time < timing[0]) return 0
  let low = 0
  let high = count
  // 읽기 시작한 글자 중 가장 뒤의 것을 찾아요.
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (timing[middle] <= time) low = middle
    else high = middle - 1
  }
  if (low >= count) return count
  const length = Math.min(MAX_CHAR_SECONDS, timing[low + 1] - timing[low])
  return low + (length > 0 ? Math.min(1, (time - timing[low]) / length) : 1)
}
/** 서버에 키가 없으면 다시 묻지 않고 바로 브라우저 음성으로 읽어요. */
let remoteOff = false


/** 면접관 목소리의 소리 크기(0에서 1)예요. 면접 연습 위쪽에서 바꾸고 이 기기에 기억해요. 띵 소리도 같이 따라가요. */
const VOLUME_KEY = 'javadda:practice-volume'
const readVolume = () => {
  const value = Number(readItem(VOLUME_KEY) ?? 1)
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}
const practiceVolume = createStore<number>(typeof window === 'undefined' ? 1 : readVolume())

export const usePracticeVolume = () => useStore(practiceVolume, (value) => value, 1)

export function setPracticeVolume(value: number) {
  const next = Math.min(1, Math.max(0, value))
  writeItem(VOLUME_KEY, String(next))
  practiceVolume.set(next)
}

/** 다음 질문의 음성을 미리 받아 둬요. 질문이 바뀔 때 기다리지 않고 바로 읽어요. 실패해도 읽을 때 다시 받아요. */
export function prefetchVoice(text: string, voice: string | null) {
  const name = voiceName(text, voice)
  if (voices.has(name) || prefetching.has(name)) return
  const request = fetchVoice(text, voice, new AbortController().signal, false).finally(() => prefetching.delete(name))
  prefetching.set(name, request)
}

const voiceName = (text: string, voice: string | null) => `${voice ?? ''}\n${text}`

/** 미리 받는 중인 음성이에요. 받는 사이에 그 질문을 읽으면 같은 음성을 두 번 만들지 않고 이것을 기다려요. 미리 받기는 멈추지 않아요. */
const prefetching = new Map<string, Promise<Voice | null>>()

/**
 * 한 번에 서버로 보내는 음성 요청 수예요. ElevenLabs는 동시에 만들 수 있는 수가 정해져 있어서(요금제마다 2에서 5), 시작 화면에서 인사와 잡담을 한꺼번에 보내면 일부가 거절돼요.
 * 넘는 요청은 줄을 서고, 지금 읽을 음성은 미리 받는 음성보다 먼저예요.
 */
const MAX_REQUESTS = 2
let activeRequests = 0
const waiting: { name: string; run: () => void }[] = []

function slot(name: string, urgent: boolean): Promise<() => void> {
  return new Promise((resolve) => {
    const run = () => {
      activeRequests += 1
      let released = false
      resolve(() => {
        if (released) return
        released = true
        activeRequests -= 1
        waiting.shift()?.run()
      })
    }
    if (activeRequests < MAX_REQUESTS) run()
    else if (urgent) waiting.unshift({ name, run })
    else waiting.push({ name, run })
  })
}

/** 줄을 서 있는 미리 받기를 맨 앞으로 당겨요. 지금 그 음성을 읽으려고 기다릴 때예요. */
function hurry(name: string) {
  const at = waiting.findIndex((item) => item.name === name)
  if (at > 0) waiting.unshift(...waiting.splice(at, 1))
}

/** 잠깐 몰려서 거절된 요청(동시에 너무 많이, 서버 오류)은 조금 쉬었다가 다시 보내요. */
const RETRY_STATUS = new Set([429, 500, 502, 504])
const RETRY_DELAYS_MS = [700, 1600, 3000]

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
  })

/** 사람 목소리 음성을 받아요. 못 받으면 null이에요. urgent는 지금 읽을 음성이라 줄 맨 앞에 서고 더 여러 번 다시 보내요. */
async function fetchVoice(text: string, voice: string | null, signal: AbortSignal, urgent = true): Promise<Voice | null> {
  const name = voiceName(text, voice)
  const known = voices.get(name)
  if (known) return known
  const ahead = prefetching.get(name)
  if (ahead && urgent) {
    hurry(name)
    // 미리 받기가 실패했으면 아래에서 다시 받아요.
    const got = await ahead
    if (got) return got
  }
  const tries = urgent ? RETRY_DELAYS_MS.length + 1 : 2
  for (let attempt = 0; attempt < tries && !remoteOff && !signal.aborted; attempt += 1) {
    if (attempt > 0) await pause(RETRY_DELAYS_MS[attempt - 1], signal)
    const release = await slot(name, urgent)
    try {
      if (signal.aborted) return null
      const response = await fetch('/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: voice ?? undefined }), signal })
      if (!response.ok) {
        if (response.status === 503 || response.status === 404 || response.status === 405) remoteOff = true
        else track('practice_tts_fallback', { status: response.status, attempt })
        if (!RETRY_STATUS.has(response.status)) return null
        continue
      }
      const timing = readTiming(response.headers.get('X-TTS-Timing'), text)
      const result = { url: URL.createObjectURL(await response.blob()), timing }
      voices.set(name, result)
      return result
    } catch {
      if (signal.aborted) return null
    } finally {
      release()
    }
  }
  return null
}

/** 브라우저 음성이 글자 위치를 알려 주지 않을 때, 한 글자를 읽는 데 걸린다고 보는 시간(초)이에요. */
const SECONDS_PER_CHAR = { ko: 0.14, en: 0.065 }

/** 입은 소리보다 살짝 먼저 움직여야 맞아 보여요. 입을 따라가는 시간만큼 앞을 읽어요. */
const MOUTH_LEAD_SECONDS = 0.05
/** 소리 크기를 재는 구간(초)이에요. 목소리의 떨림 한 번보다 길어야 숫자가 튀지 않아요. */
const LOUDNESS_WINDOW_SECONDS = 0.04

/** 음성의 time초 언저리의 소리 크기(0에서 1)예요. */
function loudnessAt(samples: AudioBuffer, time: number) {
  const data = samples.getChannelData(0)
  const middle = Math.floor(time * samples.sampleRate)
  const half = Math.floor((samples.sampleRate * LOUDNESS_WINDOW_SECONDS) / 2)
  const start = Math.max(0, middle - half)
  const end = Math.min(data.length, middle + half)
  let energy = 0
  for (let index = start; index < end; index += 1) energy += data[index] * data[index]
  const rms = Math.sqrt(energy / Math.max(1, end - start))
  return Math.min(1, Math.max(0, (rms - 0.012) * 9))
}

/**
 * 글자를 사람 목소리로 읽어 줘요(`worker/tts.ts`의 ElevenLabs). 키가 없거나 실패하면 브라우저 음성으로 읽어요.
 * 다른 글을 읽으면 앞의 것은 멈춰요. speak는 다 읽거나 멈추면 끝나는 약속을 돌려줘서, 다 읽은 뒤에 할 일을 이어 붙일 수 있어요.
 * progress는 지금 읽은 정도(0에서 1)예요. 노래방 자막처럼 글자를 칠할 때 써요.
 * 사람 목소리는 서버가 준 글자마다의 시각과 재생 위치로, 브라우저 음성은 읽는 글자 위치(없으면 걸린 시간)로 셈해요.
 */
export function useSpeak() {
  const [speaking, setSpeaking] = useState(false)
  /** 음성을 받는 중인지예요. 처음 쓰는 목소리는 몇 초 걸려요. */
  const [preparing, setPreparing] = useState(false)
  /** 사람 목소리를 쓸 수 있는지예요. 서버에 키가 없으면 목소리를 고를 수 없어요. */
  const [remote, setRemote] = useState(!remoteOff)
  /** 사람 목소리를 끝내 받지 못했는지예요. 브라우저 음성으로 바꿔 읽지 않고, 화면이 준비되지 않았다고 알리고 다시 시도를 받아요. */
  const [failed, setFailed] = useState(false)
  /** 지금 읽는 글이에요. 다시 시도할 때 써요. */
  const current = useRef<{ text: string; voice: string | null; hold: boolean } | null>(null)
  const [progress, setProgress] = useState(0)
  /** 가장 최근의 읽기예요. 음성을 받는 동안 멈추면 늦게 온 음성을 틀지 않아요. */
  const turn = useRef(0)
  /** 지금 입 모양이에요. 매 프레임 바뀌어서 화면을 다시 그리지 않게 ref로 둬요. 면접관 그림이 읽어요. */
  const pose = useRef<MouthPose>(REST)
  const request = useRef<AbortController | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  /** 지금 읽기가 끝나면 풀어 줄 약속이에요. */
  const settle = useRef<(() => void) | null>(null)
  const volume = usePracticeVolume()

  // 읽는 도중에 소리 크기를 바꾸면 바로 따라가요. 브라우저 음성은 다음 질문부터예요.
  useEffect(() => {
    if (audio.current) audio.current.volume = volume
  }, [volume])

  const finish = useCallback(() => {
    const resolve = settle.current
    settle.current = null
    resolve?.()
  }, [])

  const stop = useCallback(() => {
    turn.current += 1
    request.current?.abort()
    request.current = null
    audio.current?.pause()
    audio.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    pose.current = REST
    current.current = null
    setSpeaking(false)
    setPreparing(false)
    setFailed(false)
    finish()
  }, [finish])

  /** 다 읽었을 때예요. 이미 다른 읽기로 넘어갔으면 아무것도 하지 않아요. */
  const ended = useCallback(
    (mine: number) => {
      if (mine !== turn.current) return
      setProgress(1)
      pose.current = REST
      setSpeaking(false)
      finish()
    },
    [finish],
  )

  const speakInBrowser = useCallback(
    (text: string, mine: number) => {
      if (!('speechSynthesis' in window)) return ended(mine)
      const utterance = new SpeechSynthesisUtterance(text)
      // 질문 자료는 화면 언어와 달리 한국어일 수 있어서, 글자를 보고 읽을 언어를 정해요.
      const korean = /[가-힣]/.test(text)
      utterance.lang = korean ? 'ko-KR' : 'en-US'
      utterance.rate = 1.08
      utterance.volume = practiceVolume.get()
      let boundary = -1
      let boundaryIndex = 0
      let finished = false
      let started = 0
      let lastBoundary = 0
      const charMs = SECONDS_PER_CHAR[korean ? 'ko' : 'en'] * 1000
      const estimate = Math.max(1000, text.length * charMs)
      utterance.onstart = () => {
        if (mine !== turn.current) return
        started = performance.now()
        requestAnimationFrame(tick)
      }
      utterance.onboundary = (event) => {
        lastBoundary = performance.now()
        boundaryIndex = event.charIndex
        boundary = Math.min(1, (event.charIndex + (event.charLength || 0)) / Math.max(1, text.length))
      }
      // 다 읽으면 칠하기를 멈춰요. 멈추지 않으면 끝난 뒤에도 매 프레임 돌면서 다 읽은 1을 예전 값으로 덮어써요.
      const tick = () => {
        if (finished || mine !== turn.current) return
        const now = performance.now()
        // 브라우저 음성은 소리를 읽을 수 없어서 글자 위치만으로 입 모양을 정해요. 알림이 끊기면 다 읽은 것으로 보고 닫아요.
        const position = boundary >= 0 ? boundaryIndex + (now - lastBoundary) / charMs : ((now - started) / estimate) * text.length
        const audible = !window.speechSynthesis.paused && (boundary < 0 || now - lastBoundary < 650)
        pose.current = audible ? charPose(text, position) : REST
        setProgress(boundary >= 0 ? boundary : Math.min(0.97, (performance.now() - started) / estimate))
        requestAnimationFrame(tick)
      }
      const done = () => {
        finished = true
        ended(mine)
      }
      utterance.onend = done
      utterance.onerror = done
      window.speechSynthesis.speak(utterance)
    },
    [ended],
  )

  /**
   * 사람 목소리를 끝내 받지 못했을 때예요. 서버에 키가 없으면 브라우저 음성으로 읽고, 있으면 브라우저 음성으로 바꾸지 않아요.
   * hold면 다시 시도하거나 멈출 때까지 끝내지 않고(질문), 아니면 소리 없이 끝내요(인사, 잡담).
   */
  const fail = useCallback(
    (text: string, mine: number, hold: boolean) => {
      if (mine !== turn.current) return
      audio.current = null
      pose.current = REST
      if (remoteOff) return speakInBrowser(text, mine)
      if (!hold) return ended(mine)
      setFailed(true)
    },
    [ended, speakInBrowser],
  )

  /** 음성을 받아 틀어요. speak와 retry가 같이 써요. 끝나는 약속(settle)은 건드리지 않아요. */
  const play = useCallback(
    (text: string, voice: string | null, hold: boolean) => {
      const mine = turn.current
      const controller = new AbortController()
      request.current = controller
      current.current = { text, voice, hold }
      setProgress(0)
      setSpeaking(true)
      setPreparing(true)
      setFailed(false)
      void (async () => {
        const result = await fetchVoice(text, voice, controller.signal)
        if (mine !== turn.current) return
        setPreparing(false)
        setRemote(!remoteOff)
        if (!result) return fail(text, mine, hold)
        const { url, timing } = result
        const player = new Audio(url)
        player.volume = practiceVolume.get()
        audio.current = player
        // Decode a separate copy: never route or interrupt the audible player.
        let samples: AudioBuffer | null = null
        try {
          const context = new AudioContext()
          void fetch(url).then((response) => response.arrayBuffer())
            .then((bytes) => context.decodeAudioData(bytes))
            .then((buffer) => { if (mine === turn.current) samples = buffer })
            .catch(() => {})
            .finally(() => { void context.close().catch(() => {}) })
        } catch { /* Character timing remains available without Web Audio. */ }
        player.onended = () => ended(mine)
        player.onerror = () => {
          // 재생 실패와 오류가 둘 다 와도 한 번만 실패로 쳐요.
          if (mine !== turn.current || audio.current !== player) return
          fail(text, mine, hold)
        }
        const tick = () => {
          if (mine !== turn.current || audio.current !== player || player.ended) return
          if (!player.paused && !player.seeking && player.readyState >= 3) {
            const time = player.currentTime + MOUTH_LEAD_SECONDS
            const perChar = SECONDS_PER_CHAR[/[가-힣]/.test(text) ? 'ko' : 'en']
            const position = timing ? spokenChars(timing, time) : player.duration > 0 ? (time / player.duration) * text.length : time / perChar
            const mouth = charPose(text, position)
            pose.current = samples ? withLoudness(mouth, loudnessAt(samples, time)) : mouth
          } else {
            pose.current = REST
          }
          // 글자 시각이 있으면 지금 읽는 글자까지 정확히 칠하고, 없으면(예전 음성) 재생한 비율로 어림해요.
          if (timing) setProgress(spokenChars(timing, player.currentTime) / Math.max(1, text.length))
          else if (player.duration > 0) setProgress(Math.min(1, player.currentTime / player.duration))
          requestAnimationFrame(tick)
        }
        // 음성을 받는 사이에 브라우저가 재생을 막으면 실패로 쳐요. 다시 시도를 누르면 그 순간이라 막히지 않아요.
        await player.play().then(
          () => requestAnimationFrame(tick),
          () => {
            if (mine !== turn.current || audio.current !== player) return
            fail(text, mine, hold)
          },
        )
      })()
    },
    [ended, fail],
  )

  /** hold는 사람 목소리를 받지 못했을 때 끝내지 않고 다시 시도를 기다릴지예요. 질문을 읽을 때 켜요. */
  const speak = useCallback(
    (text: string, voice: string | null = null, { hold = false }: { hold?: boolean } = {}) => {
      stop()
      const done = new Promise<void>((resolve) => {
        settle.current = resolve
      })
      play(text, voice, hold)
      return done
    },
    [play, stop],
  )

  /** 받지 못한 음성을 다시 받아요. speak가 돌려준 약속은 그대로라, 다 읽으면 이어서 진행돼요. */
  const retry = useCallback(() => {
    const last = current.current
    if (!last) return
    turn.current += 1
    play(last.text, last.voice, last.hold)
  }, [play])

  useEffect(() => stop, [stop])

  return { speaking, preparing, failed, remote, progress, pose, speak, stop, retry }
}

/** 띵 소리를 낼 오디오예요. 처음 누를 때 만들어 둬야 브라우저가 막지 않아요. */
let chimeContext: AudioContext | null = null

/** 띵 소리를 쓸 준비를 해요. 면접 시작 버튼처럼 사용자가 누른 순간에 불러요. */
export function unlockChime() {
  try {
    chimeContext ??= new AudioContext()
    void chimeContext.resume()
  } catch {
    chimeContext = null
  }
}

/** 이제 답할 차례라는 띵 소리예요. 두 음을 짧게 겹쳐 울려요. 소리를 낼 수 없으면 조용히 넘어가요. */
export function chime() {
  const context = chimeContext
  const volume = practiceVolume.get()
  if (!context || volume === 0) return
  const now = context.currentTime
  const notes: [number, number][] = [
    [1318.5, 0],
    [1975.5, 0.08],
  ]
  for (const [frequency, delay] of notes) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, now + delay)
    gain.gain.linearRampToValueAtTime(0.16 * volume, now + delay + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.7)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now + delay)
    oscillator.stop(now + delay + 0.75)
  }
}

/**
 * 말로 답하는 동안 마이크 소리 크기(0에서 1)를 재요. 음성 인식과 따로 마이크를 열어서 오른쪽 위 소리 막대가 내 목소리에도 움직여요.
 * 매 프레임 바뀌어서 ref로 돌려줘요. 마이크를 열 수 없으면 0에 머물러요.
 */
export function useMicLevel(active: boolean) {
  const level = useRef(0)
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return
    let stopped = false
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let frame = 0
    void navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (media) => {
        if (stopped) return media.getTracks().forEach((track) => track.stop())
        stream = media
        context = new AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 1024
        context.createMediaStreamSource(media).connect(analyser)
        const data = new Float32Array(analyser.fftSize)
        const tick = () => {
          analyser.getFloatTimeDomainData(data)
          let energy = 0
          for (const value of data) energy += value * value
          level.current = Math.min(1, Math.max(0, (Math.sqrt(energy / data.length) - 0.01) * 8))
          frame = requestAnimationFrame(tick)
        }
        tick()
      },
      () => {},
    )
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      void context?.close().catch(() => {})
      level.current = 0
    }
  }, [active])
  return level
}
