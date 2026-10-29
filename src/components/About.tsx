import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN } from '../lib/app'
import { heroDark } from '../lib/hero'
import { messages, useLang, useMessages } from '../lib/i18n'
import { applyMeta, HOME_META } from '../lib/meta'
import { Footer } from './Footer'
import { Delta, Meter, Radar, ScoreRing, SkillChip, Sparkline } from './GapParts'
import { AppleLogo } from './Header'
import { LofyScript } from './LofyScript'

interface Props {
  onHome: () => void
}

/** 기능마다 보여주는 미리보기의 종류예요. 그림 파일 대신 실제 화면 부품을 보기 자료로 그려요. */
const PREVIEWS = ['posting', 'fit', 'gaps', 'radar', 'review', 'interview'] as const
type Preview = (typeof PREVIEWS)[number]

interface FeatureText {
  /** 기능의 이름. 문장으로 풀지 않고 짧은 이름으로 적어요. */
  title: string
  /** 이름 아래에 붙이는 설명. 겪어 봤을 불편을 먼저 꺼내고, 그 기능으로 무엇을 바로 확인하는지 말해요. */
  body: string
  /** 화면을 못 보는 사람에게 읽어 줄 미리보기 설명 */
  alt: string
}

interface FlowText {
  /** 원 아래에 굵게 적는 단계 이름 */
  name: string
  /** 이름 아래의 한 줄 설명 */
  body: string
}

/**
 * 소개 화면의 문구예요. 서비스에 실제로 있는 기능만 적어요. 미리보기는 실제 화면 부품에 보기 자료를 넣어 그려요.
 * 첫 화면의 굴러가는 낱말(roll)은 마지막에 첫 낱말을 한 번 더 적어서 끊기지 않고 처음으로 돌아가요.
 */
export const ABOUT_TEXT = messages({
  ko: {
    intro: ['공고 하나를 기준으로'],
    rollBefore: '',
    roll: ['필수 역량', '우대 역량', '자기소개서', '면접 질문', '필수 역량'],
    rollAfter: '까지 진단해요',
    rollLabel: '공고 하나를 기준으로 필수 역량, 우대 역량, 자기소개서, 면접 질문까지 진단해요',
    title: '내 역량과 공고 사이, 얼마나 멀까요?',
    meta: '로그인 없이 바로 진단해요',
    start: '시작하기',
    download: 'macOS 앱 다운로드',
    featuresTitle: '지원하기 전,\n다시 한 번 체크.',
    featuresLead: '공고를 고르고 이력서를 올리면, 아래 여섯 가지를 한 번에 받아요.',
    features: [
      { title: '공고 요구 역량 구조화', body: '공고마다 적힌 말이 달라서 뭘 원하는지 헷갈려요. 필수와 우대 역량으로 나눠 정리하고, 최근 몇 달 사이 요구가 늘고 줄어든 흐름까지 같이 봐요.', alt: '필수와 우대 역량 이름표와 12주 요구 변화 막대' },
      { title: '적합도 진단', body: '지원해도 될지 감으로만 판단했나요? 필수 역량, 우대 역량, 프로젝트 근거, 요즘 뜨는 역량 네 항목으로 점수를 나눠 어디서 점수가 깎였는지 바로 확인해요.', alt: '적합도 점수 고리와 네 항목 막대' },
      { title: '갭 목록과 보완 방법', body: '부족한 건 알겠는데 뭘 먼저 할지 모르겠어요. 부족, 보완, 강점으로 나눈 목록에서 하나를 고르면 근거와 보완 순서, 예상 소요, 어울리는 강의까지 이어서 보여줘요.', alt: '부족과 보완과 강점으로 나뉜 역량 이름표' },
      { title: '역량 레이더', body: '내가 어디에 치우쳐 있는지 한눈에 보고 싶어요. 언어, 프레임워크, 데이터베이스, 인프라, 협업, CS 기초 여섯 축에서 공고와 나를 겹쳐 봐요.', alt: '여섯 축 레이더에 나와 공고의 수준이 겹쳐 그려진 그림' },
      { title: '서류 검증', body: '자소서를 몇 번 읽어도 뭘 고쳐야 할지 모르겠어요. 공고 기준으로 문단마다 좋아요, 고쳐요, 빠졌어요, 면접 예상 태그를 붙이고 이유를 적어 줘요.', alt: '자기소개서 문단 아래에 태그와 피드백이 붙은 모습' },
      { title: '예상 면접 질문과 연습', body: '면접에서 뭘 물어볼지 막막해요. 내 서류와 갭, 기업 기출을 바탕으로 질문을 만들고, 답을 적으면 점수와 보완할 점, 꼬리 질문까지 돌려줘요.', alt: '확률이 적힌 면접 질문 카드와 답변 포인트' },
    ] as FeatureText[],
    flowTitle: '진단은 이렇게 이어져요',
    flow: [
      { name: '공고 고르기', body: '가고 싶은 기업이나 공고를 검색해요' },
      { name: '이력서 올리기', body: 'PDF나 GitHub, 노션 링크를 올려요' },
      { name: '리포트 받기', body: '적합도와 갭, 보완 방법을 한 번에 봐요' },
      { name: '면접 연습', body: '예상 질문에 답하고 피드백을 받아요' },
    ] as FlowText[],
    flowMore: '지금 진단해 보기',
    faqTitle: '자주 묻는 질문',
    faq: [
      { q: '로그인해야 쓸 수 있나요?', a: '아니요. 로그인하지 않아도 공고를 고르고 리포트까지 받을 수 있어요.' },
      { q: '올린 이력서는 어디에 저장되나요?', a: '지금은 이 기기의 브라우저에만 저장돼요. 다른 기기에서는 보이지 않고, 내 이력서 화면에서 언제든 지울 수 있어요.' },
      { q: '적합도 점수는 믿어도 되나요?', a: '적합도는 판결이 아니라 참고할 신호예요. 공고마다 보는 기준이 달라서, 이 숫자 하나로 나를 재지 말고 무엇을 먼저 채울지 정하는 데 써 주세요.' },
      { q: '어떤 공고를 볼 수 있나요?', a: '신입과 주니어 개발자 공고를 백엔드, 프론트엔드, 모바일, 데이터, DevOps 직군으로 나눠 보여줘요.' },
      { q: 'macOS 앱도 있나요?', a: '네. 웹과 같은 화면을 macOS 앱으로도 쓸 수 있어요. 위의 macOS 앱 다운로드 버튼으로 받아요.', app: true },
    ],
    closingTitle: '가고 싶은 회사부터 재 볼까요?',
    closingLead: '공고 하나만 고르면 바로 시작해요.',
  },
  en: {
    intro: ['Pick one posting and'],
    rollBefore: 'check your ',
    roll: ['required skills', 'preferred skills', 'cover letter', 'interview', 'required skills'],
    rollAfter: '',
    rollLabel: 'Pick one posting and check your required skills, preferred skills, cover letter, and interview',
    title: 'How far are you from the job you want?',
    meta: 'No sign in needed',
    start: 'Get started',
    download: 'Download for macOS',
    featuresTitle: 'Before you apply,\ncheck once more.',
    featuresLead: 'Pick a posting and upload your resume to get all six at once.',
    features: [
      { title: 'Structured requirements', body: 'Postings describe the same skill ten different ways. We split them into required and preferred skills and show how demand has moved over recent months.', alt: 'Required and preferred skill chips with a 12 week demand trend' },
      { title: 'Fit diagnosis', body: 'Stop guessing whether to apply. The score is split into required skills, preferred skills, project evidence, and rising skills so you see exactly where points were lost.', alt: 'A fit score ring and four score bars' },
      { title: 'Gaps and how to close them', body: 'Knowing what is missing is not enough. Pick any gap to see the evidence, a plan, the expected effort, and matching courses.', alt: 'Skill chips grouped into missing, weak, and strength' },
      { title: 'Skill radar', body: 'See where you lean at a glance. Six axes compare you with the posting across languages, frameworks, databases, infrastructure, collaboration, and CS fundamentals.', alt: 'A six axis radar with your level and the posting level overlaid' },
      { title: 'Document review', body: 'Rereading your cover letter does not tell you what to fix. Each paragraph gets a tag and a reason, measured against the posting.', alt: 'A cover letter paragraph with tags and feedback beneath it' },
      { title: 'Interview questions and practice', body: 'Questions are built from your document, your gaps, and real past interviews. Write an answer and get a score, improvements, and the follow-up question.', alt: 'An interview question card with a probability and answer points' },
    ],
    flowTitle: 'How a diagnosis works',
    flow: [
      { name: 'Pick a posting', body: 'Search for a company or posting' },
      { name: 'Upload a resume', body: 'A PDF, GitHub, or Notion link' },
      { name: 'Get the report', body: 'Fit, gaps, and how to close them' },
      { name: 'Practice', body: 'Answer likely questions, get feedback' },
    ],
    flowMore: 'Try a diagnosis',
    faqTitle: 'FAQ',
    faq: [
      { q: 'Do I need to sign in?', a: 'No. You can pick a posting and get a full report without signing in.' },
      { q: 'Where is my resume stored?', a: 'Only in this browser on this device for now. It does not appear on other devices, and you can delete it any time from My resume.' },
      { q: 'Can I trust the fit score?', a: 'Fit scores are signals, not verdicts. Every posting weighs things differently, so use the number to decide what to work on first rather than to judge yourself.' },
      { q: 'Which postings are there?', a: 'Entry level and junior developer postings, grouped into backend, frontend, mobile, data, and DevOps.' },
      { q: 'Is there a macOS app?', a: 'Yes. The same screens are available as a macOS app. Use the Download for macOS button above.', app: true },
    ],
    closingTitle: 'Start with the company you want',
    closingLead: 'Pick one posting and you are ready to go.',
  },
})

/** 미리보기 안의 보기 자료 문구예요. */
const SAMPLE = messages({
  ko: {
    required: '필수',
    preferred: '우대',
    trend: 'Kafka, 최근 12주',
    fit: '필수 역량',
    pref: '우대 역량',
    evidence: '프로젝트 근거',
    recency: '요즘 뜨는 역량',
    missing: '부족',
    partial: '보완',
    strength: '강점',
    paragraph: '거래 목록 조회가 느려지는 문제를 만나 실행 계획을 분석하고 복합 인덱스를 추가해 응답 시간을 1.8초에서 0.2초로 줄였습니다.',
    good: '좋아요',
    interview: '면접 예상',
    feedback: '숫자로 개선 폭을 보여준 좋은 문단이에요. 면접에서 원인을 찾은 과정을 꼭 물어요.',
    question: '조회가 느려진 문제를 어떻게 발견하고, 원인을 어떤 순서로 좁혀 갔나요?',
    probability: '확률',
    points: ['발견 경로를 먼저 말해요', '가설과 측정 순서를 말해요', '전과 후를 숫자로 말해요'],
  },
  en: {
    required: 'Required',
    preferred: 'Preferred',
    trend: 'Kafka, last 12 weeks',
    fit: 'Required skills',
    pref: 'Preferred skills',
    evidence: 'Project evidence',
    recency: 'Rising skills',
    missing: 'Missing',
    partial: 'Weak',
    strength: 'Strength',
    paragraph: 'When list queries slowed down, I analyzed the execution plan and added a composite index, cutting response time from 1.8s to 0.2s.',
    good: 'Good',
    interview: 'Likely asked',
    feedback: 'A strong paragraph with numbers. Interviewers will ask how you found the cause.',
    question: 'How did you notice the slow query, and in what order did you narrow down the cause?',
    probability: 'Likelihood',
    points: ['Start with how you noticed it', 'Walk through hypotheses and measurements', 'Give before and after numbers'],
  },
})

const RADAR_SAMPLE = [
  { axis: '언어', mine: 4, required: 4 },
  { axis: '프레임워크', mine: 3.6, required: 4 },
  { axis: '데이터베이스', mine: 3, required: 3 },
  { axis: '인프라', mine: 1.2, required: 4 },
  { axis: '협업', mine: 3, required: 2 },
  { axis: 'CS 기초', mine: 2, required: 3 },
]

/** macOS 창 왼쪽 위의 닫기, 최소화, 확대 버튼 색이에요. 실제 창과 같은 색이라 색 토큰을 쓰지 않아요. */
const WINDOW_BUTTONS = ['#ff5f57', '#febc2e', '#28c840']

/** 첫 화면의 움직임 시각(ms)이에요. 낱말은 1.1초마다 바뀌고, 손대지 않으면 3.3초 뒤에 빛줄기가 지나가며 로고가 드러나요. */
const ROLL_START = 300
const ROLL_EVERY = 1100
const SKIP_AFTER = 900
const AUTO_SWEEP = 3300
const SWEEP_MS = 1100

/** 빛줄기의 밝기예요. 낮게 시작해 금방 가장 밝아지고, 잠시 머문 뒤 형광등처럼 서서히 꺼져요. */
const FLICKER = [0.19, 0.46, 0.61, 0.7, 0.76, 0.82, 0.89, 0.94, 1, 0.99, 0.97, 0.95, 0.9, 0.85, 0.82, 0.75, 0.69, 0.57, 0.4, 0.05]

function flicker(progress: number) {
  const at = Math.min(Math.max(progress, 0), 1) * (FLICKER.length - 1)
  const low = Math.floor(at)
  const high = Math.min(low + 1, FLICKER.length - 1)
  return FLICKER[low] + (FLICKER[high] - FLICKER[low]) * (at - low)
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const primaryPill = 'inline-flex h-[52px] items-center justify-center rounded-full bg-brand px-7 text-[16px] font-bold text-white transition-[background-color,scale] duration-200 hover:bg-brand-hover active:scale-[.98]'
const outlinePill = 'inline-flex h-12 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-6 text-[15px] font-bold text-gray-900 transition-colors duration-150 hover:bg-gray-100'

/** 기능의 미리보기예요. 실제 화면 부품에 보기 자료를 넣어 앱 창처럼 그려요. */
function Shot({ kind, alt }: { kind: Preview; alt: string }) {
  const S = useMessages(SAMPLE)
  const body: Record<Preview, ReactNode> = {
    posting: (
      <div className="w-full space-y-4">
        <div>
          <p className="text-[11px] font-medium text-gray-500">{S.required}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {['Java', 'Spring Boot', 'JPA', 'MySQL'].map((skill) => (
              <SkillChip key={skill} name={skill} tone="met" />
            ))}
            <SkillChip name="테스트 코드" tone="partial" />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-gray-500">{S.preferred}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <SkillChip name="Kafka" tone="missing" />
            <SkillChip name="Redis" tone="partial" />
            <SkillChip name="Kubernetes" tone="missing" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-3">
          <div className="flex items-center justify-between text-[11.5px] text-gray-500">
            <span>{S.trend}</span>
            <Delta value={12} unit="p" />
          </div>
          <Sparkline series={[52, 55, 53, 58, 61, 60, 66, 70, 69, 74, 78, 83]} className="mt-2 h-9" />
        </div>
      </div>
    ),
    fit: (
      <div className="flex w-full items-center gap-6">
        <ScoreRing score={72} size={96} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Meter label={S.fit} value={78} display="78" />
          <Meter label={S.pref} value={45} display="45" />
          <Meter label={S.evidence} value={83} display="83" />
          <Meter label={S.recency} value={50} display="50" />
        </div>
      </div>
    ),
    gaps: (
      <div className="w-full space-y-3">
        {[
          { label: S.missing, chips: ['Kafka', 'Kubernetes'], tone: 'missing' as const },
          { label: S.partial, chips: ['Redis', '테스트 코드', 'Docker'], tone: 'partial' as const },
          { label: S.strength, chips: ['Java', 'Spring Boot', 'JPA', 'MySQL'], tone: 'met' as const },
        ].map((group) => (
          <div key={group.label} className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[11.5px] font-medium ${group.tone === 'met' ? 'bg-brand-soft text-brand-hover' : 'bg-white text-gray-600'}`}>{group.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {group.chips.map((skill) => (
                <SkillChip key={skill} name={skill} tone={group.tone} />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
    radar: <Radar axes={RADAR_SAMPLE} size={240} />,
    review: (
      <div className="w-full">
        <p className="border-l-2 border-gray-300 pl-3 text-[12.5px] leading-relaxed text-gray-700">{S.paragraph}</p>
        <div className="mt-2.5 flex gap-1.5">
          <span className="inline-flex h-6 items-center rounded-md bg-brand-soft px-2 text-[11.5px] font-medium text-brand-hover">{S.good}</span>
          <span className="inline-flex h-6 items-center rounded-md border border-gray-900 px-2 text-[11.5px] font-medium text-gray-900">{S.interview}</span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-gray-500">{S.feedback}</p>
      </div>
    ),
    interview: (
      <div className="flex w-full gap-4">
        <div className="shrink-0 text-center">
          <p className="text-[20px] font-semibold text-brand tabular-nums">92%</p>
          <p className="text-[10.5px] text-gray-400">{S.probability}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug font-medium text-gray-900">{S.question}</p>
          <ul className="mt-2.5 space-y-1 text-[12px] text-gray-600">
            {S.points.map((point) => (
              <li key={point} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-gray-400" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  }
  return (
    <div role="img" aria-label={alt} className="relative overflow-hidden rounded-2xl bg-gray-100">
      <span aria-hidden className="absolute top-3.5 left-4 flex gap-2">
        {WINDOW_BUTTONS.map((color) => (
          <span key={color} className="size-3 rounded-full" style={{ background: color }} />
        ))}
      </span>
      <div className="flex aspect-video items-center justify-center px-8 pt-12 pb-8 sm:px-14" aria-hidden>
        {body[kind]}
      </div>
    </div>
  )
}

/** 첫 화면에서 위로 굴러 올라가며 바뀌는 낱말이에요. 둘레의 글자는 바뀐 낱말의 폭에 맞춰 부드럽게 밀리고 당겨져요. */
function Roll({ words, index, jump }: { words: string[]; index: number; jump: boolean }) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [widths, setWidths] = useState<number[]>([])

  useLayoutEffect(() => {
    const measure = () => setWidths(refs.current.map((el) => el?.offsetWidth ?? 0))
    measure()
    document.fonts?.ready.then(measure)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [words])

  return (
    <i className={`kv-roll ${jump ? 'jump' : ''}`} style={widths[index] ? { width: widths[index] } : undefined}>
      {words.map((word, at) => (
        <em key={at} ref={(el) => void (refs.current[at] = el)} style={{ transform: `translateY(${-100 * index}%)` }}>
          {word}
        </em>
      ))}
    </i>
  )
}

type Phase = 'idle' | 'intro' | 'sweep' | 'final'

/**
 * 맨 위의 검은 첫 화면이에요. 모서리만 그린 틀이 조여들며 문장이 떠오르고, 가운데 낱말이 굴러가며 바뀌어요.
 * 그다음 아래에서 위로 빛줄기가 훑고 지나가며, 줄 아래로 손글씨 로고와 제목, 시작하기 버튼이 드러나요.
 * 아래로 스크롤하거나 키를 누르면 기다리지 않고 바로 빛줄기가 지나가요. 움직임 줄이기 설정에서는 처음부터 다 드러난 모습이에요.
 * 미리 그린 화면에는 로고 쪽 글이 가려져 있어서, 자바스크립트가 없을 때는 noscript 규칙이 가림을 풀어요.
 */
function Hero({ onStart }: { onStart: (event: MouseEvent) => void }) {
  const text = useMessages(ABOUT_TEXT)
  const [phase, setPhase] = useState<Phase>('idle')
  const [roll, setRoll] = useState(0)
  const [jump, setJump] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const sweepRef = useRef<HTMLElement>(null)
  const sweepStarted = useRef(false)

  // 빛줄기가 아래에서 위로 지나가요. 줄 아래는 로고 쪽, 줄 위는 문장 쪽만 보여요.
  const sweep = () => {
    if (sweepStarted.current) return
    sweepStarted.current = true
    const frame = frameRef.current
    const intro = introRef.current
    const final = finalRef.current
    const line = sweepRef.current
    if (!frame || !intro || !final || !line) return setPhase('final')
    setPhase('sweep')
    const height = frame.offsetHeight
    const tailMax = Math.min(110, Math.max(60, window.innerHeight * 0.1))
    const reach = line.offsetHeight + tailMax
    const begin = performance.now()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      final.style.clipPath = ''
      intro.style.clipPath = ''
      line.style.opacity = '0'
      setPhase('final')
    }
    // 탭이 뒤에 있어서 화면을 그리지 않는 동안에도 멈추지 않게, 시간이 지나면 다 드러난 모습으로 마쳐요.
    window.setTimeout(finish, SWEEP_MS + 400)
    const step = (now: number) => {
      if (done) return
      const t = Math.min((now - begin) / SWEEP_MS, 1)
      const progress = 0.9 * easeInOutCubic(t) + 0.1 * t
      const y = Math.round((height + reach) * (1 - progress)) - reach
      const edge = clamp(y, 0, height)
      final.style.clipPath = `inset(${edge}px 0 0 0)`
      intro.style.clipPath = `inset(0 0 ${height - edge}px 0)`
      line.style.transform = `translateY(${y}px)`
      line.style.setProperty('--tail', `${clamp(height - y - 2, 0, tailMax)}px`)
      line.style.opacity = String(Math.min(1, 0.3 + 0.8 * flicker(progress)) * clamp(y / 40, 0, 1))
      if (t < 1) return void requestAnimationFrame(step)
      finish()
    }
    requestAnimationFrame(step)
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sweepStarted.current = true
      setPhase('final')
      return
    }
    const timers: number[] = []
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))
    const start = performance.now()
    // 검은 틀을 한 번 그린 다음에 움직이기 시작해야 처음 모습에서 부드럽게 바뀌어요.
    later(50, () => setPhase((now) => (now === 'idle' ? 'intro' : now)))

    later(ROLL_START, () => {
      const tick = () => {
        if (sweepStarted.current) return
        setRoll((index) => index + 1)
        later(ROLL_EVERY, tick)
      }
      later(ROLL_EVERY, tick)
    })
    later(AUTO_SWEEP, sweep)

    // 문장이 떠오른 뒤에는 아래로 넘기려는 손짓에 바로 빛줄기를 보내요.
    const ready = () => performance.now() - start > SKIP_AFTER
    const onWheel = (event: WheelEvent) => event.deltaY > 0 && ready() && sweep()
    const onKey = (event: KeyboardEvent) => ['ArrowDown', 'PageDown', 'Space', 'End'].includes(event.code) && ready() && sweep()
    let touchY = 0
    const onTouchStart = (event: TouchEvent) => void (touchY = event.touches[0]?.clientY ?? 0)
    const onTouchMove = (event: TouchEvent) => touchY - (event.touches[0]?.clientY ?? 0) > 12 && ready() && sweep()
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
    // sweep은 ref만 만져서 처음 한 번만 걸어 둬요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 마지막 낱말은 첫 낱말을 한 번 더 적은 것이라, 다 굴러가면 움직임 없이 처음으로 되돌려요.
  useEffect(() => {
    if (roll !== text.roll.length - 1) return
    const timer = window.setTimeout(() => {
      setJump(true)
      setRoll(0)
      requestAnimationFrame(() => requestAnimationFrame(() => setJump(false)))
    }, 700)
    return () => clearTimeout(timer)
  }, [roll, text.roll.length])

  const revealed = phase === 'sweep' || phase === 'final'

  return (
    <section data-phase={phase} className="kv sticky top-0 z-0 flex h-[100svh] min-h-[540px] items-center justify-center overflow-hidden bg-[#0f1012] px-4 text-white">
      <noscript dangerouslySetInnerHTML={{ __html: '<style>.kv-final{clip-path:none!important}.kv-intro{display:none}</style>' }} />
      <div ref={frameRef} className="kv-frame relative h-[min(clamp(360px,54vh,560px),100svh-140px)] w-[clamp(300px,64vw,1080px)] max-w-full">
        <div ref={introRef} className="kv-intro absolute inset-0 flex flex-col items-center justify-center px-6 text-center" aria-hidden={phase === 'final'}>
          <p className="sr-only">{text.rollLabel}</p>
          <div aria-hidden className="text-[26px] leading-[1.38] font-bold tracking-[-0.04em] md:text-[clamp(28px,3.6vw,52px)]">
            {text.intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="whitespace-nowrap">
              {text.rollBefore}
              <Roll words={text.roll} index={roll} jump={jump} />
              {text.rollAfter}
            </p>
          </div>
        </div>

        <div ref={finalRef} inert={!revealed} className="kv-final absolute inset-0 flex flex-col items-center justify-center px-6 pt-9 text-center">
          {revealed && <LofyScript className="h-[clamp(64px,8vw,104px)] w-auto" />}
          {!revealed && <span className="h-[clamp(64px,8vw,104px)]" aria-hidden />}
          <h1 className="mt-6 text-balance break-keep text-[clamp(26px,3.6vw,48px)] leading-[1.35] font-bold tracking-[-0.04em]">{text.title}</h1>
          <p className="mt-3 text-[clamp(15px,1.4vw,19px)] font-bold text-white/60">{text.meta}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            <a href="/app" onClick={onStart} className={`${primaryPill} min-w-[clamp(180px,15vw,220px)] text-[18px]`}>
              {text.start}
            </a>
            {MAC_DOWNLOAD_OPEN && (
              <a
                href={MAC_DOWNLOAD}
                download
                onClick={() => track('app_download_click', { os: 'macos', from: 'about' })}
                className="inline-flex h-[52px] items-center gap-2 rounded-full border border-white/25 px-6 text-[16px] font-bold text-white transition-colors duration-200 hover:bg-white/10"
              >
                <AppleLogo />
                {text.download}
              </a>
            )}
          </div>
        </div>

        <span className="kv-clip pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <i ref={sweepRef} className="kv-sweep" />
        </span>
      </div>
    </section>
  )
}

/** 펼치고 접는 자주 묻는 질문 한 줄이에요. 높이가 부드럽게 늘고 줄고, 더하기 표시의 세로 막대가 돌아 빼기가 돼요. */
function FaqItem({ id, q, a }: { id: string; q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="faq-item rounded-2xl bg-gray-100" data-open={open || undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-a`}
        onClick={() => {
          if (!open) track('about_faq_open', { id })
          setOpen(!open)
        }}
        className="relative w-full py-6 pr-16 pl-7 text-left text-[17px] leading-[1.5] font-bold text-gray-900"
      >
        {q}
        <span className="faq-icon absolute top-1/2 right-7 size-3.5 -translate-y-1/2" aria-hidden />
      </button>
      <div id={`${id}-a`} role="region" className="faq-answer grid">
        <p className="overflow-hidden px-7 text-[15px] leading-[1.8] whitespace-pre-line text-gray-500">
          <span className="block pb-6">{a}</span>
        </p>
      </div>
    </div>
  )
}

/**
 * 서비스를 소개하는 화면이에요. 브라우저의 메인 화면이에요.
 * 검은 첫 화면이 제자리에 머물고, 흰 본문이 그 위를 덮으며 올라와요.
 * 본문은 기능 여섯 가지(왼쪽 제목은 멈춰 있고 오른쪽 카드가 올라가요), 진단 흐름, 자주 묻는 질문, 마지막 시작하기 순서예요.
 * 스크롤해서 화면에 들어온 덩어리는 아래에서 떠오르고, 함께 들어온 것끼리는 조금씩 늦게 떠올라요.
 */
export function About({ onHome }: Props) {
  const scrollRef = useRef<HTMLElement>(null)
  const lang = useLang()
  const text = useMessages(ABOUT_TEXT)

  useEffect(() => {
    // 소개 화면은 브라우저의 메인 화면이라 메인 화면의 제목과 미리보기 태그를 써요.
    applyMeta(HOME_META[lang], lang, '/')
  }, [lang])

  // 첫 화면이 헤더 뒤에 있는 동안 헤더를 투명하게 해요.
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let raf = 0
    const update = () => {
      raf = 0
      heroDark.set(root.scrollTop < root.clientHeight - 56)
    }
    const onScroll = () => void (raf ||= requestAnimationFrame(update))
    update()
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      heroDark.set(false)
    }
  }, [])

  // 스크롤해서 화면 아래쪽 20% 위로 올라온 덩어리부터 떠오르게 해요. 같은 때 들어온 것끼리는 0.18초씩(네 번까지) 늦춰요.
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const targets = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    root.dataset.armed = ''
    const observer = new IntersectionObserver(
      (entries) => {
        let order = 0
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const target = entry.target as HTMLElement
          target.style.setProperty('--d', String(Math.min(order++, 4)))
          target.dataset.shown = ''
          observer.unobserve(target)
        }
      },
      { root, rootMargin: '0px 0px -20% 0px' },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  const start = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    track('about_cta_click')
    onHome()
  }

  const faq = text.faq.filter((item) => !('app' in item && item.app) || MAC_DOWNLOAD_OPEN)

  return (
    <main ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto">
      <Hero onStart={start} />

      {/* 본문은 첫 화면 위로 덮이며 올라와요. */}
      <div className="relative z-10 bg-white">
        <section className="mx-auto grid max-w-[1280px] gap-12 px-4 pt-[88px] sm:px-10 md:grid-cols-[minmax(0,1fr)_minmax(0,min(640px,58%))] md:pt-32">
          <div className="md:sticky md:top-[120px] md:self-start" data-reveal>
            <h2 className="text-balance break-keep whitespace-pre-line text-[clamp(28px,3vw,44px)] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">{text.featuresTitle}</h2>
            <p className="mt-4 max-w-sm break-keep text-[17px] leading-[1.8] text-gray-500">{text.featuresLead}</p>
          </div>
          <div className="space-y-20 md:space-y-28">
            {text.features.map((feature, index) => (
              <article key={PREVIEWS[index]} data-reveal className="min-w-0">
                <Shot kind={PREVIEWS[index]} alt={feature.alt} />
                <h3 className="mt-6 break-keep text-[clamp(24px,2.4vw,32px)] leading-[1.45] font-bold tracking-[-0.02em] text-gray-900">{feature.title}</h3>
                <p className="mt-2 break-keep text-[17px] leading-[1.8] text-gray-500">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 pt-[88px] sm:px-10 md:pt-32">
          <h2 data-reveal className="text-[clamp(28px,3.2vw,40px)] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900">{text.flowTitle}</h2>
          {/* 단계마다 STEP 번호를 적은 원을 두고, 넓은 화면에서는 원 사이를 가는 선으로 이어요. */}
          <ol data-reveal className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {text.flow.map((row, index) => (
              <li key={row.name} className="relative flex flex-col items-center text-center">
                {index > 0 && <span aria-hidden className="absolute top-[52px] right-1/2 hidden h-px w-full bg-gray-200 md:block" />}
                <span className="relative flex size-[104px] flex-col items-center justify-center rounded-full bg-gray-100">
                  <span className="text-[12px] font-bold tracking-[0.06em] text-gray-500">STEP</span>
                  <span className="text-[30px] leading-[1.15] font-bold text-gray-900 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                </span>
                <p className="mt-5 text-[18px] leading-[1.45] font-bold text-gray-900 md:text-[20px]">{row.name}</p>
                <p className="mt-1.5 break-keep text-[15px] leading-[1.7] text-gray-500">{row.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 flex justify-center">
            <a href="/app" onClick={start} className={outlinePill}>
              {text.flowMore}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 pt-[88px] sm:px-10 md:pt-32">
          <h2 data-reveal className="text-[clamp(28px,3.2vw,40px)] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900">{text.faqTitle}</h2>
          <div data-reveal className="mt-10 space-y-2">
            {faq.map((item, index) => (
              <FaqItem key={item.q} id={`faq-${index}`} q={item.q} a={item.a} />
            ))}
          </div>
        </section>

        <section data-reveal className="mx-auto flex max-w-[1280px] flex-col items-center px-4 pt-[88px] pb-[88px] text-center sm:px-10 md:pt-32 md:pb-32">
          <h2 className="text-balance break-keep text-[clamp(24px,2.4vw,32px)] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900">{text.closingTitle}</h2>
          <p className="mt-3 break-keep text-[17px] leading-[1.8] text-gray-500">{text.closingLead}</p>
          <a href="/app" onClick={start} className={`${primaryPill} mt-8`}>
            {text.start}
          </a>
        </section>

        <div className="mx-auto max-w-[1280px] border-t border-gray-200 sm:px-4">
          <Footer className="pt-6 sm:text-[14px]" from="about" />
        </div>
      </div>
    </main>
  )
}
