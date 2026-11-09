import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { track } from '../lib/analytics'
import { companyOf, fetchQuestions, PROGRESS_START, submitAnswer, useReport, useReportPosting, type InterviewQuestion, type PracticeFeedback, type ProgressState } from '../lib/gap'
import { messages, pick, useLang, useMessages } from '../lib/i18n'
import { greetingOf, INTERVIEWERS, setInterviewer, useInterviewer, type InterviewerKey, type InterviewerProfile } from '../lib/interviewers'
import { canDictate, canSpeak, chime, joinSpeech, micAllowed, prefetchVoice, prepareMic, setPracticeVolume, unlockChime, useDictation, useMicLevel, usePracticeVolume, useSpeak } from '../lib/speech'
import { REST, type MouthPose } from '../lib/lipsync'
import { showToast } from '../lib/toast'
import { AiProgress, CompanyMark, Notice, ScoreRing } from './GapParts'
import { isApp } from '../lib/app'
import { ChevronRightIcon, CloseIcon, MicIcon, SpeakerIcon } from './Icons'
import { Interviewer } from './Interviewer'
import { InterviewerPicker } from './InterviewerPicker'
import { darkButton, lightButton, ResultCard } from './ReportParts'
import { buttonRadius, Skeleton } from './ui'
import { useHidePet } from '../lib/pet'

const TEXT = messages({
  ko: {
    title: '면접 연습',
    missing: '연습할 질문이 없어요',
    missingBody: '리포트가 지워졌거나 아직 질문을 만들지 못했어요.',
    back: '돌아가기',
    exit: '면접 나가기',
    volume: '면접관 소리 크기',
    mute: '소리 끄기',
    unmute: '소리 켜기',
    exitTitle: '면접을 여기서 마칠까요?',
    exitBody: '지금까지 답변한 질문은 안전하게 저장돼요.',
    stay: '계속하기',
    leave: '여기까지 평가받기',
    progress: (current: number, total: number) => `${current} / ${total}`,
    introTitle: '가상 면접 시작',
    introBody: '함께할 면접관을 골라 주세요. 면접관의 성격에 따라 묻는 질문과 채점이 달라져요.',
    introBodyLab: '함께할 면접관을 골라 주세요. 면접관의 성격에 따라 채점과 꼬리 질문이 달라져요.',
    start: '면접 시작하기',
    startNote: (name: string) => `${name} 면접관과 면접을 시작해요`,
    startNoteShort: (name: string) => `${name} 선택 됨`,
    writing: '질문을 만들고 있어요',
    ready: '이제 면접 질문이 준비되었어요. 첫 번째 질문을 시작할게요.',
    gradedBy: (name: string) => `${name} 면접관의 평가예요`,
    preparing: '면접관이 질문을 준비하고 있어요',
    voiceFailed: '면접관 목소리를 아직 준비하지 못했어요',
    retryVoice: '다시 시도',
    speaking: '질문 중',
    answerNow: '바로 답하기',
    listening: '답변을 기다리는 중',
    silenceNote: '마이크 사용 중',
    speakNow: '사용자의 응답을 기다리는 중',
    typePlaceholder: '면접관 앞에서 말하듯이 적어 보세요.',
    typeInstead: '텍스트로 입력',
    speakInstead: '말로 답하기',
    replay: '다시 듣기',
    done: '답변 끝내기',
    skip: '건너뛰기',
    moving: '다음 질문을 준비하는 중',
    last: '면접을 마무리하고 있어요',
    micDenied: '마이크 권한이 없어서 글로 답해요.',
    micMissing: '마이크를 찾지 못해서 글로 답해요.',
    micFailed: '음성을 알아듣지 못했어요. 다시 말해 주세요.',
    micIdle: '마이크 활성화 필요',
    micAsking: '브라우저 창에서 허용을 눌러 주세요',
    micReady: '마이크 활성화 됨',
    micBlocked: '마이크가 막혀 있어서 글로 답해요. 주소창 옆 설정에서 허용할 수 있어요',
    micNone: '마이크를 찾지 못해서 글로 답해요',
    micUnsupported: '이 브라우저는 음성 인식이 안 돼서 글로 답해요',
    micOn: '마이크 켜기',
    micRetry: '다시 시도',
    doneTitle: '가상 면접이 종료됨',
    doneBody: (count: number) => `${count}개의 질문에 답했어요. 질문마다 보완할 점을 하나씩 다듬어 보세요.`,
    singleDone: '답변 피드백',
    singleDoneBody: '이런 부분은 이렇게 말해 보세요. 다시 답해 보면 차이가 보여요.',
    score: '점수',
    answerAgain: '다시 답하기',
    average: '평균 점수',
    grading: '채점하고 있어요',
    gradeFailed: '채점하지 못했어요',
    skipped: '답변하지 않음',
    again: '다시 연습하기',
    toReport: '리포트로 돌아가기',
  },
  en: {
    title: 'Interview practice',
    missing: 'Nothing to practice yet',
    missingBody: 'The report was deleted or questions are not ready.',
    back: 'Go back',
    exit: 'Leave interview',
    volume: 'Interviewer volume',
    mute: 'Mute',
    unmute: 'Unmute',
    exitTitle: 'End the interview here?',
    exitBody: 'Your answers so far are saved safely.',
    stay: 'Keep going',
    leave: 'Get feedback so far',
    progress: (current: number, total: number) => `${current} / ${total}`,
    introTitle: 'Start a mock interview',
    introBody: "Pick your interviewer. Their personality changes the questions they ask and how they grade.",
    introBodyLab: 'Pick your interviewer. Their personality changes how they grade and follow up.',
    start: 'Start interview',
    startNote: (name: string) => `Your interview with ${name}`,
    startNoteShort: (name: string) => `${name} selected`,
    writing: 'Writing your questions',
    ready: 'Your interview questions are ready. Let us start with the first one.',
    gradedBy: (name: string) => `Graded by ${name}`,
    preparing: 'The interviewer is getting ready',
    voiceFailed: "The interviewer's voice isn't ready yet",
    retryVoice: 'Try again',
    speaking: 'Asking',
    answerNow: 'Answer now',
    listening: 'Waiting for your answer',
    silenceNote: 'Microphone on',
    speakNow: 'Waiting for your response',
    typePlaceholder: 'Write it the way you would say it.',
    typeInstead: 'Type',
    speakInstead: 'Answer by voice',
    replay: 'Replay',
    done: 'Finish answer',
    skip: 'Skip',
    moving: 'Preparing the next question',
    last: 'Wrapping up the interview',
    micDenied: 'No microphone access, so you can type your answer.',
    micMissing: "We couldn't find a microphone, so you can type your answer.",
    micFailed: "We couldn't recognize your voice. Please say it again.",
    micIdle: 'Microphone required',
    micAsking: 'Click Allow in the browser prompt',
    micReady: 'Microphone enabled',
    micBlocked: 'Microphone access is blocked, so you can type. You can allow it in the site settings',
    micNone: "We couldn't find a microphone, so you can type",
    micUnsupported: "This browser can't recognize speech, so you can type",
    micOn: 'Turn on mic',
    micRetry: 'Try again',
    doneTitle: 'Mock interview ended',
    doneBody: (count: number) => `You answered ${count} ${count === 1 ? 'question' : 'questions'}. Work on one improvement per question.`,
    singleDone: 'Answer feedback',
    singleDoneBody: 'Try saying these parts like this. Answer again to feel the difference.',
    score: 'Score',
    answerAgain: 'Answer again',
    average: 'Average score',
    grading: 'Grading',
    gradeFailed: "Couldn't grade this one",
    skipped: 'Not answered',
    again: 'Practice again',
    toReport: 'Back to the report',
  },
})

/** 답이 이보다 짧으면 말이 끊겨도 저절로 넘어가지 않아요. "음…"처럼 생각하느라 낸 소리에서 끊지 않게요. 답변 끝내기를 누르면 짧아도 채점해요. */
const MIN_CHARS = 10
/** 말이 이만큼 끊기면 답을 마친 것으로 봐요. 생각하느라 잠깐 멈춘 것까지 끊지 않게 넉넉히 둬요. */
const SILENCE_MS = 3200
/** 다음 질문으로 넘어가기 전에 잠깐 쉬어요. 면접관이 고개를 끄덕이는 정도예요. */
const MOVE_MS = 1100
/** 질문을 기다리며 잡담할 때 한 말과 다음 말 사이에 쉬는 시간(ms)이에요. */
const CHAT_PAUSE_MS = 1400
/** 소리를 낼 수 없을 때 말풍선을 바꾸는 간격(ms)이에요. */
const CHAT_SILENT_MS = 3600
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** 시작 화면에서 면접관 카드에 이만큼(ms) 머물면 그 면접관의 질문을 미리 만들어요. */
const PREFETCH_DELAY_MS = 900
/** 띵 소리가 마이크에 들어가지 않게, 소리가 끝난 뒤에 듣기 시작해요. */
const LISTEN_AFTER_MS = 450

/**
 * 리포트 없이 하는 면접이에요. 잡아따 Labs의 기술 면접이 써요. 질문은 미리 골라 오고, 채점은 grade로 받아요.
 * 질문이 하나면 질문 하나만 연습할 때처럼 답하자마자 피드백을 보여줘요.
 */
export interface LabSession {
  /** 위 줄에 적는 이름이에요(백엔드 기술 면접 등). */
  title: string
  questions: InterviewQuestion[]
  grade: (question: InterviewQuestion, answer: string, interviewer: InterviewerKey) => Promise<PracticeFeedback | null>
  /** 결과 화면에서 돌아가는 버튼의 글자예요. */
  backLabel: string
}

/** 면접의 단계예요. 시작 전, 면접관이 묻는 중, 내가 답하는 중, 다음 질문으로 넘어가는 중, 끝. */
type Phase = 'intro' | 'asking' | 'answering' | 'moving' | 'finished'

/** 질문 하나의 결과예요. 채점은 다음 질문을 하는 동안 뒤에서 받아요. */
interface Answer {
  question: InterviewQuestion
  text: string
  spoken: boolean
  feedback: PracticeFeedback | 'grading' | 'failed' | 'skipped'
}

/**
 * 면접 연습 화면이에요. 들어오면 화면이 검게 바뀌고, 실제 면접처럼 질문을 하나씩 주고받아요.
 * 면접관이 질문을 소리로 읽는 동안 글자가 노래방 자막처럼 차례로 밝아지고(`useSpeak`의 progress), 다 읽으면 띵 소리가 나요.
 * 그 뒤로 말하는 내용이 음성 인식으로 화면에 바로 나오고, 말을 마치고 잠시(SILENCE_MS) 조용하면 다음 질문으로 넘어가요.
 * 채점은 다음 질문을 하는 동안 뒤에서 받아서, 면접이 끝나면 질문마다 점수와 피드백을 한 번에 보여줘요.
 * 음성 인식이 없는 브라우저(Firefox)나 마이크를 쓸 수 없으면(macOS 앱 2.0 등) 글로 답해요. 면접관은 시작 화면에서 고르고, 면접관마다 목소리와 질문, 채점이 달라요(`interviewers.ts`).
 * 질문 하나를 골라 들어오면 그 질문만 연습하고, 답하면 바로 점수와 피드백, 모범 답변을 보여줘요. 시작 화면은 전체 연습과 같은 "가상 면접 시작"이에요.
 */
export function Practice({ id = '', question: startId, onBack, lab }: { id?: string; question?: string; onBack: () => void; lab?: LabSession }) {
  const L = useMessages(TEXT)
  const lang = useLang()
  // 검은 면접 화면에서는 펫을 숨겨요.
  useHidePet()
  // 실험실의 기술 면접은 리포트 없이 해서 리포트를 받지 않아요.
  const report = useReport(lab ? null : id)
  // 리포트 상세는 자료를 받는 것이라 뼈대로, 질문은 AI가 만드는 것이라 서버의 단계로 퍼센트를 보여줘요.
  /** 면접관마다 AI가 따로 만든 질문이에요. 받는 중이면 없고, 받지 못했거나 비었으면 null이에요. */
  const [sets, setSets] = useState<Partial<Record<InterviewerKey, InterviewQuestion[] | null>>>({})
  const [progresses, setProgresses] = useState<Partial<Record<InterviewerKey, ProgressState>>>({})
  /** 시작을 눌렀지만 질문이 아직 오지 않아서 기다리는 중이에요. 오면 바로 첫 질문을 읽어요. */
  const [starting, setStarting] = useState(false)
  /** 질문 하나를 골라 들어왔는지예요. 그 질문은 예상 질문 탭의 질문(실무 팀장)이라, 고른 면접관과 상관없이 그 묶음에서 찾고 채점만 면접관을 따라요. */
  const single = lab ? lab.questions.length === 1 : !!startId
  const interviewer = useInterviewer()
  const setKey: InterviewerKey = single && !lab ? 'balanced' : interviewer.key
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answers, setAnswers] = useState<Answer[]>([])
  /** 면접 중에 나가기를 눌러서, 정말 나갈지 묻는 중이에요. */
  const [confirming, setConfirming] = useState(false)
  /** 글로 답하는지예요. 음성 인식이 없거나 마이크를 쓸 수 없으면 켜져요. */
  const [typing, setTyping] = useState(!canDictate())
  /** 질문을 다 읽은 뒤에 볼 최신 값이에요. 읽는 동안 글로 답하기로 바꿀 수 있어요. */
  const typingRef = useRef(typing)
  typingRef.current = typing
  // 고른 면접관은 시작 화면에서만 바꿔서, 면접 중에는 그대로예요. 면접관마다 목소리가 정해져 있어요.
  const speaker = interviewer.voice
  const voice = useSpeak()
  /** 지금 진행 중인 질문 차례예요. 건너뛰거나 나가면 하나 올려서, 늦게 끝난 읽기와 타이머가 다음 단계를 건드리지 않게 해요. */
  const run = useRef(0)
  /** 이번 답을 말로 했는지. 분석과 결과에서 글로 쓴 답과 나눠 봐요. */
  const spoken = useRef(false)
  const speechLang = lang === 'ko' ? 'ko-KR' : 'en-US'
  const dictation = useDictation(
    speechLang,
    (text) => {
      spoken.current = true
      setAnswer((prev) => joinSpeech(prev, text))
    },
    (code) => {
      track('practice_voice_error', { code })
      const denied = code === 'not-allowed' || code === 'service-not-allowed'
      if (denied || code === 'audio-capture') setTyping(true)
      showToast(denied ? L.micDenied : code === 'audio-capture' ? L.micMissing : L.micFailed)
    },
  )
  /** 마이크 칸의 상태예요. 시작 화면에서 "마이크 켜기"를 눌러야 허락 창이 떠요. 묻지 않고 들어오자마자 창을 띄우지 않아요. */
  const [micState, setMicState] = useState<MicState>(() => (canDictate() ? 'idle' : 'unsupported'))
  /** "마이크 켜기"로 받는 중인 허락이에요. 허락 창에 답하기 전에 면접을 시작하면 첫 답을 듣기 전에 이것을 기다려요. */
  const micReady = useRef<Promise<void> | null>(null)

  /** 마이크와 음성 인식 허락을 받아요. Safari와 macOS 앱은 음성 인식 창이 하나 더 떠요. */
  function enableMic() {
    if (micReady.current) return
    setMicState('asking')
    track('practice_mic_enable', { from: micState })
    micReady.current = prepareMic(speechLang).then((result) => {
      micReady.current = null
      setMicState(result)
      if (result === 'ready') return
      track('practice_voice_error', { code: result, from: 'prepare' })
      // 허락을 기다리는 동안 면접을 시작했으면 글로 답해요.
      typingRef.current = true
      setTyping(true)
    })
  }

  // Chrome에서 이 사이트에 마이크를 허락해 뒀으면 묻지 않고 켜진 것으로 둬요.
  useEffect(() => {
    if (micState !== 'idle') return
    void micAllowed().then((allowed) => {
      if (allowed) setMicState((prev) => (prev === 'idle' ? 'ready' : prev))
    })
  }, [])

  /** 말로 답하는 동안의 마이크 소리 크기예요. 오른쪽 위 소리 막대가 읽어요. */
  // 시작 화면에서는 마이크를 켰을 때 소리 막대로 잘 들리는지 보여줘요. 면접관이 인사하는 동안은 휴대폰이 소리를 통화 모드로 바꾸지 않게 열지 않아요.
  const micCheck = phase === 'intro' && !starting && micState === 'ready' && !voice.speaking
  const mic = useMicLevel(dictation.listening || micCheck)

  /** 말하는 동안에는 아직 확정되지 않은 글자까지 보여줘요. */
  const shown = joinSpeech(answer, dictation.interim)
  const transcript = useRef<HTMLDivElement>(null)

  /** 이미 요청한 면접관이에요. 시작 화면에서 면접관을 고르는 순간 그 면접관의 질문을 미리 받아서, 시작을 누를 때 덜 기다려요. */
  const requested = useRef(new Set<InterviewerKey>())

  useEffect(() => {
    if (requested.current.has(setKey)) return
    // 카드를 넘겨 보기만 해도 질문을 만들지 않게, 처음 면접관과 시작을 누른 때가 아니면 잠깐 머문 뒤에 받아요.
    const first = requested.current.size === 0
    const timer = setTimeout(() => load(setKey), first || starting ? 0 : PREFETCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [id, startId, setKey, starting])

  function load(key: InterviewerKey) {
    if (requested.current.has(key)) return
    requested.current.add(key)
    // 실험실의 기술 면접은 질문을 이미 골라 왔어요. 면접관이 달라도 같은 질문이고 채점만 달라요.
    if (lab) {
      setSets((prev) => ({ ...prev, [key]: lab.questions.length > 0 ? lab.questions : null }))
      return
    }
    void fetchQuestions(
      id,
      (next) => setProgresses((prev) => ({ ...prev, [key]: next })),
      false,
      key,
    ).then((list) => {
      // 질문 하나를 골라 들어오면 그 질문 하나만 연습하고 바로 피드백을 보여줘요.
      const picked = startId ? list.filter((item) => item.id === startId) : list
      setSets((prev) => ({ ...prev, [key]: picked.length > 0 ? picked : null }))
    })
  }

  // 화면을 떠나면 진행 중인 차례를 끊어서, 늦게 끝난 읽기가 듣기를 다시 켜지 않게 해요.
  useEffect(
    () => () => {
      run.current += 1
    },
    [],
  )

  // 글자가 늘어나도 방금 말한 부분이 보이게 끝까지 내려요.
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [shown])

  const questions = sets[setKey]
  const loadProgress = progresses[setKey] ?? PROGRESS_START
  const posting = useReportPosting(report?.postingId)
  const company = report ? companyOf(report.companyId) : null
  const current = questions?.[index]

  /** 질문을 읽고, 다 읽으면 띵 소리를 내고 듣기 시작해요. keep이면 지금까지 한 답을 그대로 두고 다시 읽어요. */
  async function ask(at: number, keep = false) {
    if (!questions) return
    const mine = ++run.current
    // 다시 들을 때는 듣던 중에 확정되지 않은 글자도 답에 남겨요.
    const rest = dictation.finish()
    setIndex(at)
    if (keep) setAnswer((prev) => joinSpeech(prev, rest))
    else {
      setAnswer('')
      spoken.current = false
    }
    setPhase('asking')
    const question = questions[at]
    const upcoming = questions[at + 1]
    if (upcoming && canSpeak()) prefetchVoice(upcoming.question, speaker)
    // 바로 답하기를 누르면 읽기가 멈추면서 여기서 이어져요. 목소리를 받지 못하면 다시 시도나 바로 답하기를 누를 때까지 기다려요.
    if (canSpeak()) await voice.speak(question.question, speaker, { hold: true })
    if (mine !== run.current) return
    // 시작할 때 띄운 마이크 허락 창에 아직 답하지 않았으면 기다려요.
    if (micReady.current) await micReady.current
    if (mine !== run.current) return
    chime()
    setPhase('answering')
    if (!typingRef.current) {
      setTimeout(() => {
        if (mine === run.current) dictation.start()
      }, LISTEN_AFTER_MS)
    }
  }

  /** 질문을 기다리는 동안 면접관이 하고 있는 잡담이에요. 구름 말풍선에 보여요. */
  const [chatLine, setChatLine] = useState('')

  /**
   * AI가 질문을 만드는 동안 면접관이 자기 목소리로 잡담을 해요. 첫 말은 늘 같고, 그 뒤는 섞어서 돌아가며 해요.
   * 첫 질문을 읽거나(ask) 나가면 차례(run)가 바뀌어서 멈춰요. 소리를 낼 수 없으면 말풍선만 바꿔요.
   */
  async function chatter(who: InterviewerProfile) {
    const mine = ++run.current
    const [first, ...rest] = who.smallTalk[lang]
    const lines = [first, ...rest.sort(() => Math.random() - 0.5)]
    const say = async (line: string) => {
      setChatLine(line)
      if (canSpeak()) await voice.speak(line, who.voice)
      else await wait(CHAT_SILENT_MS)
    }
    for (let at = 0; mine === run.current; at += 1) {
      // 한 바퀴를 다 돌면 첫 말은 빼고 다시 돌아요.
      await say(at < lines.length ? lines[at] : lines[1 + ((at - 1) % (lines.length - 1))])
      if (mine !== run.current) return
      // 질문이 오면 하던 말을 끝까지 하고, 준비됐다고 알린 뒤에 첫 질문을 읽어요.
      if (questionsReady.current) {
        await wait(CHAT_PAUSE_MS / 2)
        if (mine !== run.current) return
        await say(L.ready)
        if (mine !== run.current) return
        setStarting(false)
        return startRef.current()
      }
      await wait(CHAT_PAUSE_MS)
    }
  }
  /** 잡담하는 동안 질문이 왔는지예요. 잡담이 한 말을 마칠 때마다 봐요. */
  const questionsReady = useRef(false)

  /** 시작 화면에서 면접관이 인사하는 중인지예요. 인사하는 동안 오른쪽 위 음량 조절에 테두리를 둘러요. */
  const [greeting, setGreeting] = useState(false)

  /** 면접관이 자기 목소리로 인사 한 줄과 음량 안내를 읽어요. 카드를 누른 순간이라 브라우저가 소리를 막지 않아요. */
  function greet(next: InterviewerProfile) {
    if (!canSpeak()) return
    unlockChime()
    setGreeting(true)
    void voice.speak(greetingOf(next, lang), next.voice).then(() => setGreeting(false))
  }

  // 시작 화면에 오면 세 면접관의 인사를 미리 받아 둬서, 카드를 바꾸는 순간 바로 들려요.
  useEffect(() => {
    if (phase !== 'intro' || !canSpeak()) return
    for (const item of INTERVIEWERS) prefetchVoice(greetingOf(item, lang), item.voice)
  }, [phase, lang])

  // 고른 면접관의 잡담도 미리 받아 둬서, 질문을 기다릴 때 바로 말을 걸어요.
  useEffect(() => {
    if (phase !== 'intro' || !canSpeak()) return
    for (const line of [...interviewer.smallTalk[lang], L.ready]) prefetchVoice(line, interviewer.voice)
  }, [phase, lang, interviewer, L.ready])

  function begin() {
    // 띵 소리와 음성은 사용자가 누른 순간에 준비해야 브라우저가 막지 않아요.
    unlockChime()
    // 마이크를 켰거나 허락 창에 답하는 중이면 말로, 아니면 글로 답해요. 답하는 중에 "말로 답하기"로 바꿀 수 있어요.
    const speakAnswers = micState === 'ready' || micState === 'asking'
    typingRef.current = !speakAnswers
    setTyping(!speakAnswers)
    if (questions) return start()
    // 받지 못했으면 한 번 더 받아 봐요.
    if (questions === null) {
      requested.current.delete(setKey)
      setSets((prev) => ({ ...prev, [setKey]: undefined }))
      setProgresses((prev) => ({ ...prev, [setKey]: PROGRESS_START }))
    }
    questionsReady.current = false
    setStarting(true)
    // 누른 순간에 말을 시작해야 브라우저가 소리를 막지 않아요.
    void chatter(interviewer)
  }

  function start() {
    if (!questions) return
    track('practice_start', { count: questions.length, voice: !typing, interviewer: interviewer.key })
    setAnswers([])
    void ask(0)
  }
  const startRef = useRef(start)
  startRef.current = start

  // 시작을 누른 뒤에 질문이 오면 잡담이 하던 말을 마치고 첫 질문으로 넘어가요(chatter). 받지 못했으면 기다리기를 멈추고 안내를 보여줘요.
  useEffect(() => {
    if (!starting || questions === undefined) return
    if (questions) {
      questionsReady.current = true
      return
    }
    setStarting(false)
    // 받지 못했으면 잡담을 멈춰요.
    run.current += 1
    voice.stop()
  }, [starting, questions, voice.stop])

  /** 질문 하나의 답을 결과에 남기고, 답했으면 뒤에서 채점을 받아요. 한 글자라도 답했으면 채점하고, 아무 말도 없으면 답변하지 않음이에요. */
  function record(at: number, question: InterviewQuestion, text: string) {
    const gradable = text.length > 0
    const entry: Answer = { question, text, spoken: spoken.current, feedback: gradable ? 'grading' : 'skipped' }
    setAnswers((prev) => [...prev.slice(0, at), entry])
    if (gradable) {
      track('practice_submit', { voice: spoken.current })
      void (lab ? lab.grade(question, text, interviewer.key) : submitAnswer(id, question, text, undefined, interviewer.key)).then((result) => {
        setAnswers((prev) => prev.map((item, order) => (order === at ? { ...item, feedback: result ?? 'failed' } : item)))
      })
    } else track('practice_skip')
  }

  /**
   * 면접 중에 나가기를 누르면 여기까지만 평가해요. 지금 답하던 질문도 한 말이 있으면 채점에 넣어요.
   * 아직 아무것도 답하지 않았으면 볼 결과가 없어서 그냥 나가요.
   */
  function finishHere() {
    if (!questions || !current) return exit()
    run.current += 1
    voice.stop()
    const text = phase === 'answering' ? joinSpeech(answer, dictation.finish()).trim() : ''
    dictation.finish()
    setConfirming(false)
    // 다음 질문으로 넘어가던 중이면 지금 질문의 답은 이미 남겼어요.
    const answeredNow = phase === 'answering' && text.length > 0
    const kept = answers.slice(0, phase === 'moving' ? index + 1 : index).filter((item) => item.feedback !== 'skipped')
    if (kept.length === 0 && !answeredNow) return exit()
    track('practice_finish_early', { answered: kept.length + (answeredNow ? 1 : 0), total: questions.length })
    // 답하지 않은 뒤의 질문은 결과에 넣지 않아요.
    setAnswers((prev) => prev.slice(0, phase === 'moving' ? index + 1 : index))
    if (answeredNow) record(index, current, text)
    setPhase('finished')
  }

  /** 지금 질문의 답을 마치고 다음 질문으로 넘어가요. 채점은 뒤에서 받아요. */
  function complete(skip = false) {
    if (!questions || !current) return
    const mine = ++run.current
    voice.stop()
    const text = skip ? '' : joinSpeech(answer, dictation.finish()).trim()
    dictation.finish()
    const at = index
    record(at, current, text)
    setPhase('moving')
    setTimeout(() => {
      if (mine !== run.current) return
      if (at + 1 >= questions.length) {
        track('practice_finish', { count: questions.length })
        setPhase('finished')
      } else void ask(at + 1)
    }, MOVE_MS)
  }
  const completeRef = useRef(complete)
  completeRef.current = complete

  // 말을 마치고 잠시 조용하면 답을 마친 것으로 보고 넘어가요. 글로 답할 때는 버튼으로만 넘어가요.
  useEffect(() => {
    // 나갈지 묻는 동안에는 넘어가지 않아요. 계속하기를 누르면 그때부터 다시 기다려요.
    if (phase !== 'answering' || typing || confirming || !dictation.listening || shown.trim().length < MIN_CHARS) return
    const timer = setTimeout(() => completeRef.current(), SILENCE_MS)
    return () => clearTimeout(timer)
  }, [phase, typing, confirming, dictation.listening, shown])

  function exit() {
    run.current += 1
    voice.stop()
    dictation.finish()
    setConfirming(false)
    onBack()
  }

  /** 면접이 진행 중이면(질문을 묻거나 답하는 중) 나갈지 먼저 묻고, 시작 전이나 끝난 뒤에는 바로 나가요. */
  const inProgress = phase === 'asking' || phase === 'answering' || phase === 'moving'
  function requestExit() {
    if (inProgress) setConfirming(true)
    else exit()
  }

  const exitRef = useRef({ requestExit, confirming })
  exitRef.current = { requestExit, confirming }

  // Esc를 누르면 나가기를 눌렀을 때와 같고, 나갈지 묻는 중이면 묻기를 닫아요. 화면 아래의 칸이나 창이 같은 Esc로 또 닫히지 않게 여기서 멈춰요.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      if (exitRef.current.confirming) setConfirming(false)
      else exitRef.current.requestExit()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  function switchTyping(next: boolean) {
    setTyping(next)
    if (next) {
      const rest = dictation.finish()
      setAnswer((prev) => joinSpeech(prev, rest))
    } else if (phase === 'answering') dictation.start()
  }

  const progressValue = phase === 'asking' && canSpeak() ? (voice.preparing ? 0 : voice.progress) : 1
  const total = questions?.length ?? 0

  let body
  if ((!lab && report === null) || (questions === null && phase !== 'intro')) {
    body = <Notice title={L.missing} body={L.missingBody} action={L.back} onAction={exit} className="mt-[18vh]" />
  } else if (!lab && report === undefined) {
    body = <Skeleton shape="lines" count={4} className="mx-auto mt-[18vh] w-full max-w-md opacity-30" />
  } else if (questions === null && single) {
    body = <Notice title={L.missing} body={L.missingBody} action={L.back} onAction={exit} className="mt-[18vh]" />
  } else if (starting) {
    // AI가 고른 면접관의 질문을 만드는 동안이에요. 면접관이 구름 말풍선으로 잡담하며 시간을 때우고, 아래에 만든 정도를 적어요.
    body = (
      <div className="flex min-h-full flex-col items-center justify-center pb-16 text-center">
        <p key={chatLine} aria-live="polite" className="interviewer-cloud mb-10 animate-fade">
          {chatLine}
        </p>
        <Interviewer key={interviewer.key} pose={voice.pose} portrait={interviewer.portrait} label={`${pick(interviewer.role)} ${pick(interviewer.name)}`} />
        <p className="-mt-2 text-[17px] font-bold text-white">{pick(interviewer.name)}</p>
        <p className="mt-0.5 text-[12.5px] text-[#fff]/50">{pick(interviewer.role)}</p>
        <div className="mt-7 w-56" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadProgress.progress} aria-label={L.writing}>
          <div className="h-1 overflow-hidden rounded-full bg-[#fff]/15">
            <div className="h-full rounded-full bg-[#fff]/80 transition-[width] duration-500" style={{ width: `${loadProgress.progress}%` }} />
          </div>
          <p className="mt-2 text-[12.5px] text-[#fff]/50 tabular-nums">
            {L.writing} {loadProgress.progress}%
          </p>
        </div>
      </div>
    )
  } else if (phase !== 'intro' && phase !== 'finished' && !current) {
    // 시작을 누른 뒤 AI가 이 면접관의 질문을 만드는 동안이에요. 이미 만들어 둔 질문이면 금방 지나가요.
    // 시작 화면처럼 위의 나가기 줄 높이만큼 아래를 비워서, 화면 전체의 가운데에 오게 해요.
    body = (
      <div className="flex min-h-full items-center justify-center pb-16">
        <AiProgress progress={loadProgress.progress} stage={loadProgress.stage} className="w-full max-w-md" />
      </div>
    )
  } else if (phase === 'intro') {
    body = (
      // 위의 나가기 줄 높이만큼 아래를 비워서, 화면 전체의 가운데에 오게 해요. 옆 카드는 여백에서 잘리지 않고 화면 끝까지 보이고, 화면 밖은 바깥 칸이 잘라요.
      <div className="mx-auto flex h-full max-w-5xl animate-rise flex-col items-center justify-center pt-2 pb-4 text-center sm:pt-4 sm:pb-10">
        <h1 className="text-[24px] leading-tight font-bold tracking-tight text-white sm:text-[28px] md:text-[34px]">{L.introTitle}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed break-keep text-[#fff]/60 sm:mt-3 sm:text-[14.5px]">{lab ? L.introBodyLab : L.introBody}</p>
        {/* 화면이 낮으면 면접관 카드가 줄어들어서, 시작 줄까지 스크롤 없이 한 화면에 들어와요. */}
        <div className="mt-5 flex min-h-0 w-full flex-col sm:mt-8">
          <InterviewerPicker
            value={interviewer}
            onChange={(next) => {
              if (next.key !== interviewer.key) {
                setInterviewer(next.key)
                track('practice_interviewer_select', { interviewer: next.key })
              }
              // 고르거나 고른 카드를 다시 누르면 그 면접관이 자기 목소리로 인사하고 음량 안내를 해요.
              greet(next)
            }}
          />
        </div>
        <MicCheck state={micState} level={mic} onEnable={enableMic} />
        {/* 시작 줄이에요. 누구와 면접하는지 한 번 더 적고 바로 시작해요. 휴대폰은 폭이 좁아서 "서도윤 선택 됨"으로 줄여요. */}
        <div className="mt-2.5 flex w-full max-w-xl shrink-0 items-center justify-between gap-4 rounded-[22px] bg-[#fff] py-3 pr-3 pl-6">
          <p className="min-w-0 truncate text-left text-[15px] font-semibold text-[#000]/85">
            <span className="sm:hidden">{L.startNoteShort(pick(interviewer.name))}</span>
            <span className="hidden sm:inline">{L.startNote(pick(interviewer.name))}</span>
          </p>
          <button type="button" onClick={begin} className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#1c1c1e] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-85">
            {L.start}
            <ChevronRightIcon className="size-4 text-white" strokeWidth={2} />
          </button>
        </div>
      </div>
    )
  } else if (phase === 'finished') {
    body = <Summary answers={answers} single={single} interviewer={pick(interviewer.name)} onAgain={begin} onBack={exit} backLabel={lab?.backLabel} />
  } else if (current) {
    body = (
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
        {/* 면접관은 질문이 바뀌어도 같은 자리에 그대로 있어요. 위에서부터 놓아서 질문 길이나 답변 칸 때문에 얼굴이 움직이지 않아요. */}
        <div className="flex min-h-0 flex-1 flex-col pt-[3svh] pb-4 sm:pt-[5svh] sm:pb-6">
          <Interviewer key={interviewer.key} pose={voice.pose} portrait={interviewer.portrait} label={`${pick(interviewer.role)} ${pick(interviewer.name)}`} />
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#fff]/45">
            <span>{phase === 'asking' ? (voice.failed ? L.voiceFailed : voice.preparing ? L.preparing : L.speaking) : phase === 'moving' ? (index + 1 >= total ? L.last : L.moving) : L.listening}</span>
          </p>
          <Karaoke key={current.id} text={current.question} progress={progressValue} dim={phase === 'moving'} />

          {/* 내 답이에요. 말하는 동안 확정된 글자는 밝게, 아직 바뀔 수 있는 글자는 옅게 보여요. */}
          {phase !== 'asking' && (
            <div className="mt-6 flex min-h-0 flex-1 animate-fade flex-col sm:mt-10">
              {typing ? (
                <textarea
                  autoFocus
                  value={answer}
                  readOnly={phase !== 'answering'}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder={L.typePlaceholder}
                  className="min-h-20 w-full flex-1 resize-none rounded-lg border border-[#fff]/10 bg-[#fff]/[0.06] p-5 text-[18px] leading-relaxed text-white outline-none placeholder:text-[#fff]/30 focus:border-[#fff]/25"
                />
              ) : (
                <div ref={transcript} className="max-h-[30svh] min-h-0 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,#000_24px)] pt-6">
                  {shown ? (
                    <p className="text-[20px] leading-relaxed font-medium break-keep text-[#fff]/85 md:text-[24px]">
                      {answer}
                      {dictation.interim && <span className="text-[#fff]/40"> {dictation.interim}</span>}
                    </p>
                  ) : (
                    <p className="text-[18px] text-[#fff]/35">{L.speakNow}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 마이크 사용 중은 버튼 줄 바로 위 가운데에 한 줄로 둬요. 버튼 사이에 끼면 어중간해 보여요. */}
        {phase === 'answering' && !typing && dictation.listening && (
          <p className="mb-3 flex items-center justify-center gap-2 text-[13px] text-[#fff]/55">
            <span className="relative flex size-2.5">
              <span className="absolute inset-0 rounded-full bg-red-500 motion-safe:animate-ping" />
              <span className="relative size-2.5 rounded-full bg-red-500" />
            </span>
            {L.silenceNote}
          </p>
        )}
        <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-center gap-3 pb-2">
          {phase === 'asking' && canSpeak() && voice.failed && (
            <button type="button" onClick={voice.retry} className={darkButton}>
              {L.retryVoice}
            </button>
          )}
          {phase === 'asking' && canSpeak() && (
            <button type="button" onClick={() => voice.stop()} className={darkButton}>
              {L.answerNow}
            </button>
          )}
          {phase === 'answering' && (
            <>
              {canSpeak() && (
                <button type="button" onClick={() => void ask(index, true)} className={darkButton}>
                  {L.replay}
                </button>
              )}
              {canDictate() && (
                <button type="button" onClick={() => switchTyping(!typing)} className={darkButton}>
                  {typing ? L.speakInstead : L.typeInstead}
                </button>
              )}
              {/* 건너뛰기는 아직 아무 말도 하지 않았을 때만 보여요. 답한 뒤에 누르면 답이 버려져서, 그때는 답변 끝내기만 둬요. */}
              {!shown.trim() && (
                <button type="button" onClick={() => complete(true)} className={darkButton}>
                  {L.skip}
                </button>
              )}
              <button
                type="button"
                disabled={!shown.trim()}
                onClick={() => complete()}
                className={lightButton}
              >
                {L.done}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const live = phase === 'asking' || phase === 'answering'
  return createPortal(
    // 검은 화면 안은 다크 모드 색으로 그려서, 같이 쓰는 부품(진행 고리, 점수 고리, 안내)도 어두운 바탕에 맞게 보여요.
    <div role="dialog" aria-modal="true" aria-label={L.title} className="dark fixed inset-0 z-[45] flex animate-fade flex-col overflow-clip overscroll-none bg-[#000] text-white">
      <div aria-hidden className={`interview-glow interview-glow-a ${live ? 'opacity-100' : 'opacity-50'}`} />
      <div aria-hidden className={`interview-glow interview-glow-b ${live ? 'opacity-100' : 'opacity-50'}`} />

      {/* 앱에서는 창 버튼과 겹치지 않게 그 아래에서 시작하고, 위쪽 빈 자리로 창을 옮겨요. */}
      <header data-app-drag={isApp || undefined} className={`relative flex shrink-0 items-center gap-3 px-4 sm:gap-4 sm:px-5 md:px-8 ${isApp ? 'pt-11' : 'pt-4 sm:pt-5'}`}>
        <button type="button" onClick={requestExit} aria-label={L.exit} className="flex size-10 items-center justify-center rounded-full bg-[#fff]/10 text-white transition-colors hover:bg-[#fff]/20">
          <CloseIcon className="size-4" strokeWidth={1.8} />
        </button>
        {/* 어느 공고의 면접인지 기업 로고와 공고 이름으로 보여줘요. 기업 이름은 로고가 대신해서 읽기 프로그램에만 알려요. */}
        {posting && company ? (
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <CompanyMark company={company} className="size-7 shrink-0 rounded-lg text-[11px]" />
            <span className="sr-only">{company.name}</span>
            <span className="truncate text-[14px] font-medium text-[#fff]/80">{posting.title}</span>
          </span>
        ) : (
          <p className="min-w-0 flex-1 truncate text-[13px] text-[#fff]/55">{lab?.title ?? L.title}</p>
        )}
        {total > 0 && phase !== 'intro' && phase !== 'finished' && <span className="shrink-0 text-[13px] font-medium text-[#fff]/55 tabular-nums">{L.progress(index + 1, total)}</span>}
        {phase !== 'finished' && <AudioMeter voice={voice.pose} mic={mic} />}
        {canSpeak() && <VolumeControl highlight={greeting && voice.speaking} />}
      </header>
      {/* 질문 수만큼 나눈 가는 막대예요. 답한 질문은 밝게 채워요. */}
      {total > 0 && phase !== 'intro' && phase !== 'finished' && (
        <div aria-hidden className="relative mt-3 flex gap-1 px-4 sm:mt-4 sm:px-5 md:px-8">
          {questions?.map((item, order) => (
            <span key={item.id} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${order < index || (order === index && phase === 'moving') ? 'bg-[#fff]/80' : order === index ? 'bg-[#fff]/35' : 'bg-[#fff]/12'}`} />
          ))}
        </div>
      )}

      {/* 면접 중에는 화면이 움직이지 않게 스크롤하지 않아요. 결과 화면만 길어서 스크롤해요. */}
      <main className={`relative min-h-0 flex-1 px-4 sm:px-6 md:px-12 ${phase === 'finished' ? 'overflow-y-auto overscroll-contain pb-8' : 'overflow-clip pb-4 sm:pb-8'}`}>{body}</main>

      {/* 확인 창(`ConfirmDialog`)은 이 검은 화면보다 아래 층에 떠서, 같은 모양을 이 화면 안에 그려요. */}
      {confirming && (
        <div
          className="absolute inset-0 z-10 flex animate-fade items-center justify-center bg-[#000]/60 px-5 backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setConfirming(false)
          }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="interview-exit-title" className="w-full max-w-sm animate-pop rounded-2xl border border-[#fff]/10 bg-[#1c1c1e] p-5">
            <h2 id="interview-exit-title" className="text-[15px] font-semibold text-white">
              {L.exitTitle}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed break-keep text-[#fff]/60">{L.exitBody}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setConfirming(false)} className={`h-10 ${buttonRadius} px-4 text-[13px] font-medium text-[#fff]/80 transition-colors hover:bg-[#fff]/10`}>
                {L.stay}
              </button>
              <button type="button" onClick={finishHere} className={`h-10 ${buttonRadius} bg-[#fff] px-4 text-[13px] font-semibold text-[#000] transition-opacity hover:opacity-90`}>
                {L.leave}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

/**
 * 면접관이 읽는 질문이에요. 노래방 자막처럼 읽은 만큼 낱말이 왼쪽부터 밝아져요.
 * 낱말마다 흰색과 옅은 흰색을 가르는 그러데이션을 글자 모양으로 잘라서(bg-clip-text), 읽고 있는 낱말은 중간까지만 밝아요.
 * 읽기 프로그램에는 질문 전체를 한 번에 읽어 줘요.
 */
function Karaoke({ text, progress, dim }: { text: string; progress: number; dim: boolean }) {
  const lit = progress * text.length
  let offset = 0
  return (
    <h2 aria-label={text} className={`mt-4 shrink-0 text-[24px] leading-[1.3] font-bold sm:text-[30px] tracking-tight break-keep text-white transition-opacity duration-700 md:text-[44px] ${dim ? 'opacity-40' : ''}`}>
      {text.split(/(\s+)/).map((part, order) => {
        const start = offset
        offset += part.length
        if (!part.trim()) return <span key={order} aria-hidden>{part}</span>
        const fill = Math.min(1, Math.max(0, (lit - start) / part.length)) * 100
        return (
          <span
            key={order}
            aria-hidden
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(90deg, #fff ${fill}%, rgb(255 255 255 / 0.26) ${fill}%)` }}
          >
            {part}
          </span>
        )
      })}
    </h2>
  )
}

/** 면접관 목소리의 소리 크기예요. 스피커를 누르면 끄고 켜고, 옆 막대로 크기를 맞춰요. 면접관이 음량 안내를 하는 동안에는 테두리로 자리를 알려요(highlight). */
/** 막대마다 소리를 받는 정도예요. 가운데가 가장 크게 움직여서 애플의 음성 표시처럼 보여요. */
const METER_BARS = [0.45, 0.75, 1, 0.75, 0.45]

/**
 * 오른쪽 위의 작은 소리 막대예요. 면접관이 말하는 소리(입 모양의 열림)와 내가 말하는 소리(마이크)를 하나로 합쳐 보여줘요.
 * 매 프레임 바뀌어서 React 상태 대신 막대의 높이를 직접 바꿔요. 조용하면 작은 점으로 남아요.
 */
type MicState = 'idle' | 'asking' | 'ready' | 'denied' | 'missing' | 'unsupported'

/** 소리 막대가 면접관 소리 없이 내 마이크만 읽게 하는 빈 입 모양이에요. */
const SILENT = { current: REST }

/**
 * 시작 화면의 마이크 칸이에요. "마이크 켜기"를 눌러야 허락 창이 떠서, 왜 묻는지 알고 허락해요.
 * 켜지면 내 목소리에 맞춰 소리 막대가 움직여서 잘 들리는지 바로 보여요. 켜지 않고 시작하면 글로 답해요.
 */
function MicCheck({ state, level, onEnable }: { state: MicState; level: { current: number }; onEnable: () => void }) {
  const L = useMessages(TEXT)
  const text = { idle: L.micIdle, asking: L.micAsking, ready: L.micReady, denied: L.micBlocked, missing: L.micNone, unsupported: L.micUnsupported }[state]
  const action = state === 'idle' || state === 'asking' ? L.micOn : state === 'denied' || state === 'missing' ? L.micRetry : null
  return (
    <div className="mt-5 flex w-full max-w-xl shrink-0 items-center gap-3 rounded-[22px] bg-[#fff]/8 py-2.5 pr-2.5 pl-4 text-left">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${state === 'ready' ? 'bg-brand text-white' : 'bg-[#fff]/10 text-[#fff]/70'}`}>
        <MicIcon className="size-[18px]" strokeWidth={1.6} />
      </span>
      <p aria-live="polite" className="min-w-0 flex-1 text-[13.5px] leading-snug break-keep text-[#fff]/75">
        {text}
      </p>
      {state === 'ready' && <AudioMeter voice={SILENT} mic={level} />}
      {action && (
        <button
          type="button"
          onClick={onEnable}
          disabled={state === 'asking'}
          className="flex h-10 shrink-0 items-center rounded-lg bg-[#fff]/12 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#fff]/20 disabled:opacity-50"
        >
          {action}
        </button>
      )}
    </div>
  )
}

function AudioMeter({ voice, mic }: { voice: { current: MouthPose }; mic: { current: number } }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    const smooth = METER_BARS.map(() => 0)
    let frame = 0
    const tick = (now: number) => {
      const level = Math.max(voice.current.open, mic.current)
      METER_BARS.forEach((weight, at) => {
        // 막대마다 조금씩 다른 속도로 흔들려서 한 덩어리로 움직이지 않아요.
        const wobble = 0.75 + 0.25 * Math.sin(now / (90 + at * 23) + at * 1.7)
        const target = Math.min(1, level * weight * wobble)
        smooth[at] += (target - smooth[at]) * (target > smooth[at] ? 0.5 : 0.18)
        const bar = bars.current[at]
        if (bar) bar.style.transform = `scaleY(${0.2 + smooth[at] * 0.8})`
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [voice, mic])
  return (
    <span aria-hidden className="flex h-10 shrink-0 items-center gap-[3px] px-1">
      {METER_BARS.map((_, at) => (
        <span
          key={at}
          ref={(node) => {
            bars.current[at] = node
          }}
          className="h-5 w-[3px] origin-center scale-y-[0.2] rounded-full bg-white/85"
        />
      ))}
    </span>
  )
}

function VolumeControl({ highlight = false }: { highlight?: boolean }) {
  const L = useMessages(TEXT)
  const volume = usePracticeVolume()
  /** 끄기 전의 크기예요. 다시 켜면 이 크기로 돌아가요. */
  const before = useRef(volume > 0 ? volume : 1)
  if (volume > 0) before.current = volume
  return (
    <div className={`flex shrink-0 items-center gap-2 rounded-full transition-shadow duration-300 ${highlight ? 'ring-2 ring-white/70 ring-offset-4 ring-offset-black' : ''}`}>
      <button
        type="button"
        onClick={() => setPracticeVolume(volume > 0 ? 0 : before.current)}
        aria-label={volume > 0 ? L.mute : L.unmute}
        className="flex size-10 items-center justify-center rounded-full bg-[#fff]/10 text-white transition-colors hover:bg-[#fff]/20"
      >
        <SpeakerIcon className="size-4" strokeWidth={1.6} level={volume} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        onChange={(event) => setPracticeVolume(Number(event.target.value) / 100)}
        aria-label={L.volume}
        className="hidden w-24 cursor-pointer accent-white sm:block"
      />
    </div>
  )
}

/** 면접이 끝나고 보여주는 결과예요. 평균 점수와 질문마다 내 답, 점수, 피드백이 있어요. 채점이 덜 끝난 질문은 끝나는 대로 채워져요. */
function Summary({ answers, single, interviewer, onAgain, onBack, backLabel }: { answers: Answer[]; single: boolean; interviewer: string; onAgain: () => void; onBack: () => void; backLabel?: string }) {
  const L = useMessages(TEXT)
  const scores = answers.flatMap((item) => (typeof item.feedback === 'object' ? [item.feedback.score] : []))
  const grading = answers.some((item) => item.feedback === 'grading')
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length))
  const answered = answers.filter((item) => item.feedback !== 'skipped').length

  return (
    <div className="mx-auto w-full max-w-3xl animate-rise pt-10">
      <div className="flex flex-col items-center text-center">
        {scores.length > 0 && <ScoreRing score={average} />}
        {scores.length > 0 && <p className="mt-2 text-[12.5px] text-[#fff]/50">{single ? L.score : L.average}</p>}
        <h1 className="mt-5 text-[28px] font-bold tracking-tight text-white">{single ? L.singleDone : L.doneTitle}</h1>
        <p className="mt-1.5 text-[13px] font-medium text-[#fff]/45">{L.gradedBy(interviewer)}</p>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#fff]/55">{single ? L.singleDoneBody : L.doneBody(answered)}</p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onAgain} className={darkButton}>
            {single ? L.answerAgain : L.again}
          </button>
          <button type="button" onClick={onBack} className={lightButton}>
            {backLabel ?? L.toReport}
          </button>
        </div>
        {grading && <p className="mt-4 text-[12.5px] text-[#fff]/45 motion-safe:animate-pulse">{L.grading}</p>}
      </div>

      <ol className="mt-12 space-y-4">
        {answers.map((item, order) => (
          <ResultCard
            key={item.question.id}
            order={order + 1}
            question={item.question.question}
            answer={item.text}
            feedback={typeof item.feedback === 'object' ? item.feedback : null}
            note={item.feedback === 'grading' ? <span className="motion-safe:animate-pulse">{L.grading}</span> : item.feedback === 'failed' ? L.gradeFailed : item.feedback === 'skipped' ? L.skipped : undefined}
          />
        ))}
      </ol>
    </div>
  )
}
