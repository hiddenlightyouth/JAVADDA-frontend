import { useCallback, useEffect, useRef, useState } from 'react'
import { track } from './analytics'

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

/** 서버가 만든 음성을 이번 접속 동안 기억해요. 같은 질문을 다시 들어도 사용량을 쓰지 않아요. */
const voices = new Map<string, string>()
/** 서버에 키가 없으면 다시 묻지 않고 바로 브라우저 음성으로 읽어요. */
let remoteOff = false

/** 사람 목소리 음성의 주소를 받아요. 못 받으면 null이에요. */
async function fetchVoice(text: string, signal: AbortSignal): Promise<string | null> {
  const known = voices.get(text)
  if (known) return known
  if (remoteOff) return null
  try {
    const response = await fetch('/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal })
    if (!response.ok) {
      if (response.status === 503 || response.status === 404 || response.status === 405) remoteOff = true
      else track('practice_tts_fallback', { status: response.status })
      return null
    }
    const url = URL.createObjectURL(await response.blob())
    voices.set(text, url)
    return url
  } catch {
    return null
  }
}

/**
 * 글자를 사람 목소리로 읽어 줘요(`worker/tts.ts`의 ElevenLabs). 키가 없거나 실패하면 브라우저 음성으로 읽어요.
 * 다른 글을 읽으면 앞의 것은 멈춰요.
 */
export function useSpeak() {
  const [speaking, setSpeaking] = useState(false)
  /** 가장 최근의 읽기예요. 음성을 받는 동안 멈추면 늦게 온 음성을 틀지 않아요. */
  const turn = useRef(0)
  const request = useRef<AbortController | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    turn.current += 1
    request.current?.abort()
    request.current = null
    audio.current?.pause()
    audio.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speakInBrowser = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return setSpeaking(false)
    const utterance = new SpeechSynthesisUtterance(text)
    // 질문 자료는 화면 언어와 달리 한국어일 수 있어서, 글자를 보고 읽을 언어를 정해요.
    utterance.lang = /[가-힣]/.test(text) ? 'ko-KR' : 'en-US'
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      stop()
      const mine = turn.current
      const controller = new AbortController()
      request.current = controller
      setSpeaking(true)
      const url = await fetchVoice(text, controller.signal)
      if (mine !== turn.current) return
      if (!url) return speakInBrowser(text)
      const player = new Audio(url)
      audio.current = player
      player.onended = () => setSpeaking(false)
      player.onerror = () => {
        if (mine === turn.current) speakInBrowser(text)
      }
      // 음성을 받는 사이에 브라우저가 재생을 막으면 브라우저 음성으로 넘어가요.
      await player.play().catch(() => {
        if (mine === turn.current) speakInBrowser(text)
      })
    },
    [speakInBrowser, stop],
  )

  useEffect(() => stop, [stop])

  return { speaking, speak, stop }
}
