import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN } from '../lib/app'
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

/**
 * 소개 화면의 문구예요. 기능은 한 줄에 두 개씩 이어서 보여줘요.
 * 서비스에 실제로 있는 기능만 적어요. 미리보기는 실제 화면 부품에 보기 자료를 넣어 그려요.
 */
export const ABOUT_TEXT = messages({
  ko: {
    title: '내 역량과 공고 사이, 얼마나 멀까요?',
    lead: '기업이나 공고를 기준으로 이력서와 포트폴리오를 진단해요. 부족한 역량과 채우는 방법, 지금 나에게 맞는 공고까지 한 리포트로 받아요.',
    start: '시작하기',
    download: 'macOS 앱 다운로드',
    trust: '적합도 숫자는 판결이 아니라 참고할 신호예요. 공고마다 보는 기준이 달라서, 이 숫자 하나로 나를 재지 말고 무엇을 먼저 채울지 정하는 데 써 주세요.',
    features: [
      { title: '공고 요구 역량 구조화', body: '공고마다 적힌 말이 달라서 뭘 원하는지 헷갈려요! 필수와 우대 역량으로 나눠 정리하고, 최근 몇 달 사이 요구가 늘고 줄어든 흐름까지 같이 봐요.', alt: '필수와 우대 역량 이름표와 12주 요구 변화 막대' },
      { title: '적합도 진단', body: '지원해도 될지 감으로만 판단했나요? 필수 역량, 우대 역량, 프로젝트 근거, 요즘 뜨는 역량 네 항목으로 점수를 나눠 어디서 점수가 깎였는지 바로 확인해요.', alt: '적합도 점수 고리와 네 항목 막대' },
      { title: '갭 목록과 보완 방법', body: '부족한 건 알겠는데 뭘 먼저 할지 모르겠어요! 부족, 보완, 강점으로 나눈 목록에서 하나를 고르면 근거와 보완 순서, 예상 소요, 어울리는 강의까지 이어서 보여줘요.', alt: '부족과 보완과 강점으로 나뉜 역량 이름표' },
      { title: '역량 레이더', body: '내가 어디에 치우쳐 있는지 한눈에 보고 싶어요! 언어, 프레임워크, 데이터베이스, 인프라, 협업, CS 기초 여섯 축에서 공고와 나를 겹쳐 봐요.', alt: '여섯 축 레이더에 나와 공고의 수준이 겹쳐 그려진 그림' },
      { title: '서류 검증', body: '자소서를 몇 번 읽어도 뭘 고쳐야 할지 모르겠어요! 공고 기준으로 문단마다 좋아요, 고쳐요, 빠졌어요, 면접 예상 태그를 붙이고 이유를 적어 줘요.', alt: '자기소개서 문단 아래에 태그와 피드백이 붙은 모습' },
      { title: '예상 면접 질문과 연습', body: '면접에서 뭘 물어볼지 막막해요! 내 서류와 갭, 기업 기출을 바탕으로 질문을 만들고, 답을 적으면 점수와 보완할 점, 꼬리 질문까지 돌려줘요.', alt: '확률이 적힌 면접 질문 카드와 답변 포인트' },
    ] as FeatureText[],
  },
  en: {
    title: 'How far are you from the job you want?',
    lead: 'Measure your resume and portfolio against a real company or posting. Get the skill gaps, how to close them, and the postings that fit you now in one report.',
    start: 'Get started',
    download: 'Download for macOS',
    trust: 'Fit scores are signals, not verdicts. Every posting weighs things differently, so use the number to decide what to work on first rather than to judge yourself.',
    features: [
      { title: 'Structured requirements', body: 'Postings describe the same skill ten different ways. We split them into required and preferred skills and show how demand has moved over recent months.', alt: 'Required and preferred skill chips with a 12 week demand trend' },
      { title: 'Fit diagnosis', body: 'Stop guessing whether to apply. The score is split into required skills, preferred skills, project evidence, and rising skills so you see exactly where points were lost.', alt: 'A fit score ring and four score bars' },
      { title: 'Gaps and how to close them', body: 'Knowing what is missing is not enough. Pick any gap to see the evidence, a plan, the expected effort, and matching courses.', alt: 'Skill chips grouped into missing, weak, and strength' },
      { title: 'Skill radar', body: 'See where you lean at a glance. Six axes compare you with the posting across languages, frameworks, databases, infrastructure, collaboration, and CS fundamentals.', alt: 'A six axis radar with your level and the posting level overlaid' },
      { title: 'Document review', body: 'Rereading your cover letter does not tell you what to fix. Each paragraph gets a tag and a reason, measured against the posting.', alt: 'A cover letter paragraph with tags and feedback beneath it' },
      { title: 'Interview questions and practice', body: 'Questions are built from your document, your gaps, and real past interviews. Write an answer and get a score, improvements, and the follow-up question.', alt: 'An interview question card with a probability and answer points' },
    ],
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

const primaryButton = 'inline-flex h-12 items-center rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover'
const quietButton = 'inline-flex h-12 items-center gap-2 rounded-full border border-gray-300 px-6 text-[15px] font-medium text-gray-800 transition-colors hover:border-gray-500'

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
        <div className="rounded-xl border border-gray-200 bg-white p-3">
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
            <span className={`mt-0.5 inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[11.5px] font-medium ${group.tone === 'met' ? 'bg-brand-soft text-brand-hover' : 'bg-gray-100 text-gray-600'}`}>{group.label}</span>
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
        <p className="border-l-2 border-gray-200 pl-3 text-[12.5px] leading-relaxed text-gray-700">{S.paragraph}</p>
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
    <div role="img" aria-label={alt} className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 sm:rounded-2xl">
      <span aria-hidden className="absolute top-3 left-3.5 flex gap-2">
        {WINDOW_BUTTONS.map((color) => (
          <span key={color} className="size-3 rounded-full" style={{ background: color }} />
        ))}
      </span>
      <div className="flex aspect-[1600/1018] items-center justify-center px-8 pt-12 pb-8 sm:px-12" aria-hidden>
        {body[kind]}
      </div>
    </div>
  )
}

/**
 * 서비스를 소개하는 화면이에요.
 * 위에 손글씨와 한마디, 시작하는 버튼을 두고, 아래에 기능을 한 줄에 두 개씩 미리보기와 함께 늘어놓아요.
 * 스크롤해서 내려가면 기능이 차례로 떠올라요.
 */
export function About({ onHome }: Props) {
  const scrollRef = useRef<HTMLElement>(null)
  const lang = useLang()
  const text = useMessages(ABOUT_TEXT)

  useEffect(() => {
    // 소개 화면은 브라우저의 메인 화면이라 메인 화면의 제목과 미리보기 태그를 써요.
    applyMeta(HOME_META[lang], lang, '/')
  }, [lang])

  // 스크롤해서 화면에 들어온 기능부터 떠오르게 해요. 처음부터 보이는 것은 그리기 전에 바로 표시해서 깜빡이지 않게 해요.
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const targets = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    const limit = window.innerHeight
    for (const target of targets) {
      if (target.getBoundingClientRect().top < limit) target.dataset.shown = ''
    }
    root.dataset.armed = ''
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.shown = ''
          observer.unobserve(entry.target)
        }
      },
      { root, rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    targets.filter((target) => target.dataset.shown === undefined).forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  const start = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    track('about_cta_click')
    onHome()
  }

  return (
    <main ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto">
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-32 pb-20 text-center sm:pt-44 sm:pb-28">
        {/* 소개 화면 맨 위에는 로고 그림 대신 손글씨 Lofy가 써져요. 헤더의 로고는 그대로예요. */}
        <LofyScript className="h-20 w-auto sm:h-24" />
        <h1 className="mt-8 text-balance break-keep font-semibold leading-[1.2] tracking-[-0.03em] text-gray-900 text-[clamp(30px,6vw,56px)]">{text.title}</h1>
        <p className="mt-5 text-balance break-keep text-[14px] leading-relaxed text-gray-500 sm:text-[16px]">{text.lead}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-2.5">
          <a href="/app" onClick={start} className={primaryButton}>
            {text.start}
          </a>
          {MAC_DOWNLOAD_OPEN && (
            <a href={MAC_DOWNLOAD} download onClick={() => track('app_download_click', { os: 'macos', from: 'about' })} className={quietButton}>
              <AppleLogo />
              {text.download}
            </a>
          )}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-x-10 gap-y-14 px-6 pb-20 md:grid-cols-2 md:gap-y-20">
        {text.features.map((feature, index) => (
          // 한 줄의 오른쪽 기능은 왼쪽보다 조금 늦게 떠올라요.
          <article key={PREVIEWS[index]} data-reveal style={{ '--reveal-delay': `${(index % 2) * 140}ms` } as CSSProperties} className="min-w-0">
            <Shot kind={PREVIEWS[index]} alt={feature.alt} />
            <h2 className="mt-4 min-w-0 break-keep font-semibold leading-snug tracking-[-0.03em] text-gray-900 text-[clamp(19px,2.1vw,26px)] md:mt-6">{feature.title}</h2>
            <p className="mt-1.5 break-keep text-[14px] leading-relaxed text-gray-500 md:mt-2 md:text-[15px]">{feature.body}</p>
          </article>
        ))}
      </div>

      <p className="mx-auto max-w-2xl px-6 text-balance break-keep text-center text-[13px] leading-relaxed text-gray-400 sm:text-[14px]">{text.trust}</p>

      <Footer className="mt-10" from="about" />
    </main>
  )
}
