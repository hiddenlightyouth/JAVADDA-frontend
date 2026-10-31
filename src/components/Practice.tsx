import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { track } from '../lib/analytics'
import { companyOf, fetchQuestions, postingOf, PROGRESS_START, submitAnswer, useReport, type InterviewQuestion, type PracticeFeedback, type ProgressState } from '../lib/gap'
import { messages, useLang, useMessages } from '../lib/i18n'
import { useLoadHold, useLoadProgress } from '../lib/load'
import { canDictate, canSpeak, chime, joinSpeech, prefetchVoice, unlockChime, useDictation, usePracticeVoice, useSpeak } from '../lib/speech'
import { showToast } from '../lib/toast'
import { AiProgress, CompanyMark, Notice, ScoreRing } from './GapParts'
import { CloseIcon, MicIcon } from './Icons'
import { Bullets, label, loadCenter, LoadProgress } from './ui'

const TEXT = messages({
  ko: {
    title: '면접 연습',
    missing: '연습할 질문이 없어요',
    missingBody: '리포트가 지워졌거나 아직 질문을 만들지 못했어요.',
    back: '돌아가기',
    exit: '면접 나가기',
    exitTitle: '면접에서 정말 나갈까요?',
    exitBody: '지금 나가면 이번 면접의 진행 상황과 결과를 다시 볼 수 없어요.',
    stay: '계속하기',
    leave: '나가기',
    progress: (current: number, total: number) => `${current} / ${total}`,
    introTitle: '가상 면접 시작',
    introBody: '면접 준비가 되었다면 편안한 환경에서 본인을 테스트 해보세요.',
    singleTitle: '한 문제 연습',
    singleBody: '질문 하나에 답하면 바로 피드백을 보여줘요. 어떤 부분을 어떻게 말하면 좋을지 확인해 보세요.',
    voiceTip: '면접관의 목소리는 설정에서 변경할 수 있습니다.',
    start: '시작',
    preparing: '면접관이 질문을 준비하고 있어요',
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
    doneTitle: '가상 면접이 종료됨',
    doneBody: (count: number) => `${count}개의 질문에 답했어요. 질문마다 보완할 점을 하나씩 다듬어 보세요.`,
    singleDone: '답변 피드백',
    singleDoneBody: '이런 부분은 이렇게 말해 보세요. 다시 답해 보면 차이가 보여요.',
    score: '점수',
    modelAnswer: '이렇게 답했으면 좋았어요',
    answerAgain: '다시 답하기',
    average: '평균 점수',
    grading: '채점하고 있어요',
    gradeFailed: '채점하지 못했어요',
    skipped: '답변하지 않음',
    myAnswer: '내 답변',
    good: '좋았어요',
    improve: '보완할 점',
    rephrase: '이렇게 말해 보세요',
    followUp: '꼬리 질문',
    again: '다시 연습하기',
    toReport: '리포트로 돌아가기',
  },
  en: {
    title: 'Interview practice',
    missing: 'Nothing to practice yet',
    missingBody: 'The report was deleted or questions are not ready.',
    back: 'Go back',
    exit: 'Leave interview',
    exitTitle: 'Leave the interview?',
    exitBody: "If you leave now, you won't be able to see this interview's progress or results again.",
    stay: 'Keep going',
    leave: 'Leave',
    progress: (current: number, total: number) => `${current} / ${total}`,
    introTitle: 'Start a mock interview',
    introBody: 'When you feel ready, find a comfortable spot and put yourself to the test.',
    singleTitle: 'Practice one question',
    singleBody: 'Answer one question and get feedback right away. See which parts to say differently.',
    voiceTip: "You can change the interviewer's voice in Settings.",
    start: 'Start',
    preparing: 'The interviewer is getting ready',
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
    doneTitle: 'Mock interview ended',
    doneBody: (count: number) => `You answered ${count} ${count === 1 ? 'question' : 'questions'}. Work on one improvement per question.`,
    singleDone: 'Answer feedback',
    singleDoneBody: 'Try saying these parts like this. Answer again to feel the difference.',
    score: 'Score',
    modelAnswer: 'A stronger answer',
    answerAgain: 'Answer again',
    average: 'Average score',
    grading: 'Grading',
    gradeFailed: "Couldn't grade this one",
    skipped: 'Not answered',
    myAnswer: 'Your answer',
    good: 'What worked',
    improve: 'What to improve',
    rephrase: 'Try saying it like this',
    followUp: 'Follow-up',
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
/** 띵 소리가 마이크에 들어가지 않게, 소리가 끝난 뒤에 듣기 시작해요. */
const LISTEN_AFTER_MS = 450

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
 * 음성 인식이 없는 브라우저(macOS 앱의 웹뷰, Firefox)나 마이크를 쓸 수 없으면 글로 답해요. 면접관 목소리는 설정에서 골라요(`VoiceSetting`).
 * 질문 하나를 골라 들어오면 그 질문만 연습하고, 답하면 바로 점수와 피드백, 모범 답변을 보여줘요(한 문제 연습).
 */
export function Practice({ id, question: startId, onBack }: { id: string; question?: string; onBack: () => void }) {
  const L = useMessages(TEXT)
  const lang = useLang()
  const reportLoad = useLoadProgress()
  const report = useReport(id, reportLoad.one)
  // 리포트 상세는 자료를 받는 것이라 받은 바이트로, 질문은 AI가 만드는 것이라 서버의 단계로 퍼센트를 보여줘요.
  const waitingReport = useLoadHold(report === undefined)
  const [questions, setQuestions] = useState<InterviewQuestion[] | null | undefined>(undefined)
  const [loadProgress, setLoadProgress] = useState<ProgressState>(PROGRESS_START)
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
  const speaker = usePracticeVoice()
  const voice = useSpeak()
  /** 지금 진행 중인 질문 차례예요. 건너뛰거나 나가면 하나 올려서, 늦게 끝난 읽기와 타이머가 다음 단계를 건드리지 않게 해요. */
  const run = useRef(0)
  /** 이번 답을 말로 했는지. 분석과 결과에서 글로 쓴 답과 나눠 봐요. */
  const spoken = useRef(false)
  const dictation = useDictation(
    lang === 'ko' ? 'ko-KR' : 'en-US',
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
  /** 말하는 동안에는 아직 확정되지 않은 글자까지 보여줘요. */
  const shown = joinSpeech(answer, dictation.interim)
  const transcript = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let stale = false
    setLoadProgress(PROGRESS_START)
    void fetchQuestions(id, (next) => {
      if (!stale) setLoadProgress(next)
    }).then((list) => {
      if (stale) return
      // 질문 하나를 골라 들어오면 그 질문 하나만 연습하고 바로 피드백을 보여줘요.
      const picked = startId ? list.filter((item) => item.id === startId) : list
      setQuestions(picked.length > 0 ? picked : null)
    })
    return () => {
      stale = true
    }
  }, [id, startId])

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

  /** 질문 하나만 연습하는지예요. 시작 화면과 결과 화면의 글이 달라요. */
  const single = !!startId
  const posting = report ? postingOf(report.postingId) : null
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
    // 바로 답하기를 누르면 읽기가 멈추면서 여기서 이어져요.
    if (canSpeak()) await voice.speak(question.question, speaker)
    if (mine !== run.current) return
    chime()
    setPhase('answering')
    if (!typingRef.current) {
      setTimeout(() => {
        if (mine === run.current) dictation.start()
      }, LISTEN_AFTER_MS)
    }
  }

  function begin() {
    if (!questions) return
    // 띵 소리와 음성은 사용자가 누른 순간에 준비해야 브라우저가 막지 않아요.
    unlockChime()
    track('practice_start', { count: questions.length, voice: !typing })
    setAnswers([])
    void ask(0)
  }

  /** 지금 질문의 답을 마치고 다음 질문으로 넘어가요. 채점은 뒤에서 받아요. */
  function complete(skip = false) {
    if (!questions || !current) return
    const mine = ++run.current
    voice.stop()
    const text = skip ? '' : joinSpeech(answer, dictation.finish()).trim()
    dictation.finish()
    const at = index
    // 한 글자라도 답했으면 채점해요. 답하지 않음은 아무 말도 하지 않고 건너뛴 질문에만 붙어요.
    const gradable = text.length > 0
    const entry: Answer = { question: current, text, spoken: spoken.current, feedback: gradable ? 'grading' : 'skipped' }
    setAnswers((prev) => [...prev.slice(0, at), entry])
    if (gradable) {
      track('practice_submit', { voice: spoken.current })
      void submitAnswer(id, current, text).then((result) => {
        setAnswers((prev) => prev.map((item, order) => (order === at ? { ...item, feedback: result ?? 'failed' } : item)))
      })
    } else track('practice_skip')
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
  if (report === null || questions === null) {
    body = <Notice title={L.missing} body={L.missingBody} action={L.back} onAction={exit} className="mt-[18vh]" />
  } else if (waitingReport || report === undefined) {
    body = <LoadProgress percent={reportLoad.percent} className={loadCenter} />
  } else if (questions === undefined || !current) {
    // AI가 질문을 만드는 동안이에요. 이미 만들어 둔 질문이면 금방 지나가요.
    body = <AiProgress progress={loadProgress.progress} stage={loadProgress.stage} className="mx-auto mt-[18vh] w-full max-w-md" />
  } else if (phase === 'intro') {
    body = (
      // 위의 나가기 줄 높이만큼 아래를 비워서, 화면 전체의 가운데에 오게 해요.
      <div className="mx-auto flex min-h-full max-w-xl animate-rise flex-col items-center justify-center pb-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-[#fff]/10">
          <MicIcon className="size-7 text-white" />
        </span>
        <h1 className="mt-6 text-[30px] leading-tight font-bold tracking-tight text-white md:text-[38px]">{single ? L.singleTitle : L.introTitle}</h1>
        <p className="mt-4 text-[15px] leading-relaxed break-keep text-[#fff]/60">{single ? L.singleBody : L.introBody}</p>
        {canSpeak() && (
          <p className="mt-5 text-[13px] text-[#fff]/45">{L.voiceTip}</p>
        )}
        <button type="button" onClick={begin} className="mt-9 h-12 rounded-full bg-[#fff] px-8 text-[15px] font-semibold text-[#000] transition-opacity hover:opacity-90">
          {L.start}
        </button>
      </div>
    )
  } else if (phase === 'finished') {
    body = <Summary answers={answers} single={single} onAgain={begin} onBack={exit} />
  } else {
    body = (
      <div key={current.id} className="mx-auto flex h-full w-full max-w-4xl flex-col">
        <div className="flex flex-1 flex-col justify-center pb-6">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#fff]/45">
            <span>{phase === 'asking' ? (voice.preparing ? L.preparing : L.speaking) : phase === 'moving' ? (index + 1 >= total ? L.last : L.moving) : L.listening}</span>
          </p>
          <Karaoke text={current.question} progress={progressValue} dim={phase === 'moving'} />

          {/* 내 답이에요. 말하는 동안 확정된 글자는 밝게, 아직 바뀔 수 있는 글자는 옅게 보여요. */}
          {phase !== 'asking' && (
            <div className="mt-10 animate-fade">
              {typing ? (
                <textarea
                  autoFocus
                  value={answer}
                  readOnly={phase !== 'answering'}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder={L.typePlaceholder}
                  className="min-h-40 w-full resize-none rounded-2xl border border-[#fff]/10 bg-[#fff]/[0.06] p-5 text-[18px] leading-relaxed text-white outline-none placeholder:text-[#fff]/30 focus:border-[#fff]/25"
                />
              ) : (
                <div ref={transcript} className="max-h-[30vh] overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,#000_24px)] pt-6">
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

        <div className="flex min-h-14 flex-wrap items-center justify-center gap-3 pb-2">
          {phase === 'asking' && canSpeak() && (
            <button type="button" onClick={() => voice.stop()} className={darkButton}>
              {L.answerNow}
            </button>
          )}
          {phase === 'answering' && (
            <>
              {!typing && dictation.listening && (
                <span className="mr-2 flex items-center gap-2 text-[13px] text-[#fff]/55">
                  <span className="relative flex size-2.5">
                    <span className="absolute inset-0 rounded-full bg-red-500 motion-safe:animate-ping" />
                    <span className="relative size-2.5 rounded-full bg-red-500" />
                  </span>
                  {L.silenceNote}
                </span>
              )}
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
                className="h-11 rounded-full bg-[#fff] px-6 text-[14px] font-semibold text-[#000] transition-opacity hover:opacity-90 disabled:opacity-30"
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
    <div role="dialog" aria-modal="true" aria-label={L.title} className="dark fixed inset-0 z-[45] flex animate-fade flex-col overflow-hidden bg-[#000] text-white">
      <div aria-hidden className={`interview-glow interview-glow-a ${live ? 'opacity-100' : 'opacity-50'}`} />
      <div aria-hidden className={`interview-glow interview-glow-b ${live ? 'opacity-100' : 'opacity-50'}`} />

      <header className="relative flex shrink-0 items-center gap-4 px-5 pt-5 md:px-8">
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
          <p className="min-w-0 flex-1 truncate text-[13px] text-[#fff]/55">{L.title}</p>
        )}
        {total > 0 && phase !== 'intro' && phase !== 'finished' && <span className="shrink-0 text-[13px] font-medium text-[#fff]/55 tabular-nums">{L.progress(index + 1, total)}</span>}
      </header>
      {/* 질문 수만큼 나눈 가는 막대예요. 답한 질문은 밝게 채워요. */}
      {total > 0 && phase !== 'intro' && phase !== 'finished' && (
        <div aria-hidden className="relative mt-4 flex gap-1 px-5 md:px-8">
          {questions?.map((item, order) => (
            <span key={item.id} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${order < index || (order === index && phase === 'moving') ? 'bg-[#fff]/80' : order === index ? 'bg-[#fff]/35' : 'bg-[#fff]/12'}`} />
          ))}
        </div>
      )}

      <main className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-8 md:px-12">{body}</main>

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
              <button type="button" autoFocus onClick={() => setConfirming(false)} className="h-9 rounded-full px-4 text-[13px] font-medium text-[#fff]/80 transition-colors hover:bg-[#fff]/10">
                {L.stay}
              </button>
              <button type="button" onClick={exit} className="h-9 rounded-full bg-red-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600">
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

const darkButton = 'h-11 rounded-full bg-[#fff]/10 px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#fff]/20'

/**
 * 면접관이 읽는 질문이에요. 노래방 자막처럼 읽은 만큼 낱말이 왼쪽부터 밝아져요.
 * 낱말마다 흰색과 옅은 흰색을 가르는 그러데이션을 글자 모양으로 잘라서(bg-clip-text), 읽고 있는 낱말은 중간까지만 밝아요.
 * 읽기 프로그램에는 질문 전체를 한 번에 읽어 줘요.
 */
function Karaoke({ text, progress, dim }: { text: string; progress: number; dim: boolean }) {
  const lit = progress * text.length
  let offset = 0
  return (
    <h2 aria-label={text} className={`mt-4 text-[30px] leading-[1.3] font-bold tracking-tight break-keep text-white transition-opacity duration-700 md:text-[44px] ${dim ? 'opacity-40' : ''}`}>
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

/** 면접이 끝나고 보여주는 결과예요. 평균 점수와 질문마다 내 답, 점수, 피드백이 있어요. 채점이 덜 끝난 질문은 끝나는 대로 채워져요. */
function Summary({ answers, single, onAgain, onBack }: { answers: Answer[]; single: boolean; onAgain: () => void; onBack: () => void }) {
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
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#fff]/55">{single ? L.singleDoneBody : L.doneBody(answered)}</p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onAgain} className={darkButton}>
            {single ? L.answerAgain : L.again}
          </button>
          <button type="button" onClick={onBack} className="h-11 rounded-full bg-[#fff] px-6 text-[14px] font-semibold text-[#000] transition-opacity hover:opacity-90">
            {L.toReport}
          </button>
        </div>
        {grading && <p className="mt-4 text-[12.5px] text-[#fff]/45 motion-safe:animate-pulse">{L.grading}</p>}
      </div>

      <ol className="mt-12 space-y-4">
        {answers.map((item, order) => (
          <li key={item.question.id} className="rounded-2xl bg-[#fff]/[0.06] p-5 md:p-6">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 shrink-0 text-[13px] font-semibold text-[#fff]/40 tabular-nums">Q{order + 1}</span>
              <h2 className="min-w-0 flex-1 text-[16px] leading-snug font-semibold text-white">{item.question.question}</h2>
              {typeof item.feedback === 'object' && <span className="shrink-0 text-[20px] font-bold text-brand tabular-nums">{item.feedback.score}</span>}
            </div>
            {item.text && (
              <div className="mt-4">
                <h3 className={label}>{L.myAnswer}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#fff]/70">{item.text}</p>
              </div>
            )}
            {/* 내 답 바로 아래에 모범 답변을 두어서, 무엇이 달랐는지 나란히 읽혀요. */}
            {typeof item.feedback === 'object' && item.feedback.modelAnswer && (
              <div className="mt-4 rounded-xl bg-brand/15 p-4">
                <h3 className="text-[12.5px] font-semibold text-brand">{L.modelAnswer}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#fff]/90">{item.feedback.modelAnswer}</p>
              </div>
            )}
            {item.feedback === 'grading' && <p className="mt-4 text-[13px] text-[#fff]/45 motion-safe:animate-pulse">{L.grading}</p>}
            {item.feedback === 'failed' && <p className="mt-4 text-[13px] text-[#fff]/45">{L.gradeFailed}</p>}
            {item.feedback === 'skipped' && <p className="mt-4 text-[13px] text-[#fff]/45">{L.skipped}</p>}
            {typeof item.feedback === 'object' && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <section>
                  <h3 className={label}>{L.good}</h3>
                  <Bullets items={item.feedback.good} brand className="mt-1" />
                </section>
                <section>
                  <h3 className={label}>{L.improve}</h3>
                  <Bullets items={item.feedback.improve} className="mt-1" />
                </section>
                <section>
                  <h3 className={label}>{L.rephrase}</h3>
                  <Bullets items={item.feedback.rephrase} className="mt-1" />
                </section>
                <section>
                  <h3 className={label}>{L.followUp}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#fff]/70">{item.feedback.followUp}</p>
                </section>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
