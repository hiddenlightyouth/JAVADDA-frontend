import { axisOf, COMPANIES, companyOf, docName, fitOf, LEVEL_MAX, POSTINGS, type DocType, type DocumentReview, type InterviewQuestion, type JobPosting, type ParagraphTag, type PracticeFeedback, type PracticeRecord, type Report, type Resume, type ResumeSkill, type SkillGap } from './gap'
import { readJson, writeJson } from './storage'

// 목 모드예요. 백엔드 없이 프론트만 볼 때, 브라우저 안에서 /api/v1 요청을 가로채 서버 대신 답해요.
// 내 컴퓨터의 .env.development.local에 VITE_MOCK=true가 있을 때만 켜지고(main.tsx), 배포 빌드에는 들어가지 않아요.
// 리포트 계산은 서버와 연결하기 전의 프론트 코드를 옮겨 왔어요. 대충 그럴듯한 값이면 돼서 꼼꼼히 맞추지는 않았어요.

const KEY = 'whoisloafing:mock:v1'

type MockResume = Omit<Resume, 'id'> & { id: number }
type MockReport = Omit<Report, 'id' | 'resumeId'> & { id: number; resumeId: number; readyAt: number }

interface State {
  seq: number
  primaryId: number | null
  resumes: MockResume[]
  reports: MockReport[]
  reviews: Record<string, DocumentReview>
  questions: Record<string, InterviewQuestion[]>
  answers: Record<string, PracticeRecord[]>
  plans: string[]
  notes: { skill: string; text: string; savedAt: string }[]
}

/** 빈 자료예요. 배열과 객체를 그 자리에서 고쳐 쓰기 때문에, 부를 때마다 새로 만들어요. */
const empty = (): State => ({ seq: 1, primaryId: null, resumes: [], reports: [], reviews: {}, questions: {}, answers: {}, plans: [], notes: [] })
let state: State = { ...empty(), ...readJson<Partial<State>>(KEY, {}) }
const save = () => writeJson(KEY, state)
const nextId = () => state.seq++

/** 처음 켰을 때의 기업과 공고(gap.ts에 적어 둔 목록)예요. 공고 받기가 배열 속을 바꾸기 전에 떠 둬요. */
let companies = [...COMPANIES]
let postings = [...POSTINGS]
const postingOf = (id: string) => postings.find((posting) => posting.id === id) ?? null
const toResume = (item: MockResume): Resume => ({ ...item, id: String(item.id) })

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 받침이 있으면 앞의 조사, 없으면 뒤의 조사예요. 영어는 l, m, n으로 끝날 때만 받침으로 봐요. */
function josa(word: string, withBatchim: string, without: string) {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  const batchim = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : /[lmn]$/i.test(last)
  return word + (batchim ? withBatchim : without)
}
const eul = (word: string) => josa(word, '을', '를')
const iga = (word: string) => josa(word, '이', '가')
const eunneun = (word: string) => josa(word, '은', '는')

// ---------- 리포트 계산 (서버 연결 전의 프론트 코드) ----------

const MARKET: Record<string, { share: number; change: number }> = {
  Java: { share: 0.82, change: -3 }, Kotlin: { share: 0.54, change: 9 }, 'Spring Boot': { share: 0.88, change: 2 }, JPA: { share: 0.61, change: 1 },
  MySQL: { share: 0.74, change: -1 }, PostgreSQL: { share: 0.33, change: 6 }, Redis: { share: 0.57, change: 4 }, Kafka: { share: 0.49, change: 12 },
  Kubernetes: { share: 0.46, change: 10 }, Docker: { share: 0.63, change: 3 }, AWS: { share: 0.58, change: 2 }, MSA: { share: 0.38, change: 5 },
  '테스트 코드': { share: 0.66, change: 8 }, '자료구조와 알고리즘': { share: 0.52, change: 0 }, 네트워크: { share: 0.41, change: 0 }, 운영체제: { share: 0.3, change: -1 },
  '시스템 설계': { share: 0.27, change: 7 }, TypeScript: { share: 0.91, change: 4 }, JavaScript: { share: 0.7, change: -6 }, React: { share: 0.89, change: 1 },
  'Next.js': { share: 0.62, change: 14 }, Vue: { share: 0.18, change: -5 }, GraphQL: { share: 0.24, change: 2 }, Tailwind: { share: 0.29, change: 11 },
  Vite: { share: 0.31, change: 13 }, Webpack: { share: 0.26, change: -9 }, Figma: { share: 0.35, change: 3 }, Git: { share: 0.77, change: 0 },
  Go: { share: 0.21, change: 6 }, Python: { share: 0.44, change: 3 }, SQL: { share: 0.6, change: 1 }, LLM: { share: 0.16, change: 15 },
}
const marketOf = (skill: string) => MARKET[skill] ?? { share: 0.15, change: 1 }

const COURSE_TITLES: Record<string, string> = {
  Kafka: '아파치 카프카 애플리케이션 프로그래밍', Redis: 'Redis 기본과 실전 캐싱 전략', Kubernetes: '쿠버네티스 입문, 컨테이너 오케스트레이션의 시작',
  Docker: 'Docker로 개발 환경부터 배포까지', '테스트 코드': '실용적인 테스트 가이드, JUnit과 Mockito', MSA: 'Spring Cloud로 개발하는 마이크로서비스',
  JPA: '자바 ORM 표준 JPA 프로그래밍 기본편', 'Next.js': 'Next.js로 서버 사이드 렌더링 시작하기', TypeScript: '타입스크립트 올인원', AWS: 'AWS 기본 서비스로 서버 배포하기',
}
const coursesFor = (skill: string) =>
  COURSE_TITLES[skill] ? [{ id: `c-${skill}`, title: COURSE_TITLES[skill], provider: '인프런' as const, level: '초급' as const, hours: 8, url: 'https://www.inflearn.com' }] : []

/** 같은 글자로 같은 수를 내는 간단한 난수예요. 새로 고쳐도 값이 바뀌지 않게 해요. */
function seeded(seed: string): () => number {
  let h = 2166136261
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 10000) / 10000
  }
}

const levelIn = (resume: Resume, skill: string) => resume.skills.find((item) => item.name === skill)?.level ?? 0

function buildGaps(posting: JobPosting, resume: Resume): SkillGap[] {
  const seen = new Set<string>()
  const gaps: SkillGap[] = []
  const push = (skill: string, requirement: SkillGap['requirement']) => {
    if (seen.has(skill)) return
    seen.add(skill)
    const level = levelIn(resume, skill)
    const kind: SkillGap['kind'] = level >= 3 ? 'strength' : level > 0 ? 'partial' : 'missing'
    const market = marketOf(skill)
    const evidence = resume.skills.find((item) => item.name === skill)?.evidence
    gaps.push({
      skill,
      kind,
      requirement,
      share: market.share,
      marketChange: market.change,
      reason:
        kind === 'strength'
          ? `서류에서 ${eul(skill)} 실제로 쓴 근거가 보여요.`
          : kind === 'partial'
            ? `서류에 ${iga(skill)} 보이지만 깊이를 보여주는 근거가 약해요.`
            : `서류 어디에도 ${eul(skill)} 다룬 흔적이 없어요. 이 공고는 ${requirement === 'required' ? '필수' : '우대'} 역량으로 적고 있어요.`,
      evidence: kind === 'missing' ? undefined : evidence,
      actionPlan:
        kind === 'strength'
          ? []
          : [`${skill}의 핵심 개념을 정리하고 작은 예제로 손에 익혀요.`, `기존 프로젝트에 ${eul(skill)} 적용해 보고, 왜 썼는지와 결과를 README에 남겨요.`, '면접에서 설명할 수 있게 겪은 문제와 해결 과정을 한 문단으로 적어 둬요.'],
      estimatedWeeks: kind === 'missing' ? (market.share > 0.5 ? 4 : 3) : 2,
      scoreGain: kind === 'strength' ? 0 : requirement === 'required' ? (kind === 'missing' ? 9 : 5) : kind === 'missing' ? 4 : 2,
      courses: kind === 'strength' ? [] : coursesFor(skill),
      appealPoints: kind === 'strength' ? [`${eul(skill)} 쓴 프로젝트에서 맡은 역할과 결정 이유를 숫자와 함께 말해요.`] : [],
      caution: kind === 'strength' ? `${skill}의 내부 동작을 물어보면 깊이가 드러나요.` : undefined,
      expectedQuestions: [
        { question: `${eul(skill)} 선택한 이유와 대안으로 고려한 것은 무엇이었나요?`, points: ['문제 상황을 먼저 말해요', '비교한 대안과 기준을 들어요', '결과를 숫자로 보여줘요'] },
        { question: `${eul(skill)} 쓰면서 겪은 가장 어려운 문제는 무엇이었나요?`, points: ['원인을 어떻게 찾았는지 말해요', '재발 방지 장치를 말해요'] },
      ],
    })
  }
  posting.required.forEach((skill) => push(skill, 'required'))
  posting.preferred.forEach((skill) => push(skill, 'preferred'))
  const order = { missing: 0, partial: 1, strength: 2 }
  return gaps.sort((a, b) => order[a.kind] - order[b.kind])
}

const AXES = ['언어', '프레임워크', '데이터베이스', '인프라', '협업', 'CS 기초']

function buildReport(id: number, posting: JobPosting, resume: Resume, resumeId: number): MockReport {
  const gaps = buildGaps(posting, resume)
  const fit = fitOf(posting, resume) ?? 0
  const company = companyOf(posting.companyId)
  const ratio = (skills: string[], min: number) => (skills.length === 0 ? 1 : skills.filter((skill) => levelIn(resume, skill) >= min).length / skills.length)
  const pct = (value: number) => Math.round(value * 100)
  const missing = gaps.filter((gap) => gap.kind === 'missing' && gap.requirement === 'required').map((gap) => gap.skill)
  const strengths = gaps.filter((gap) => gap.kind === 'strength').map((gap) => gap.skill)
  const random = seeded(String(id))
  const skills = [...posting.required, ...posting.preferred]
  return {
    id,
    resumeId,
    readyAt: Date.now() + 1500,
    postingId: posting.id,
    companyId: posting.companyId,
    status: 'done',
    createdAt: new Date().toISOString(),
    fitScore: fit,
    summary:
      `${company.name} ${posting.title} 공고와 ${fit >= 70 ? '꽤 잘 맞아요.' : fit >= 50 ? '절반 넘게 맞아요.' : '아직 거리가 있어요.'}` +
      (strengths.length > 0 ? ` ${eunneun(strengths.slice(0, 3).join(', '))} 서류에서 분명하게 드러나요.` : '') +
      (missing.length > 0 ? ` 다만 필수 역량 중 ${iga(missing.slice(0, 3).join(', '))} 보이지 않아서, 이 부분을 채우면 점수가 크게 올라요.` : ' 필수 역량은 모두 보여서, 우대 역량을 더하면 더 좋아져요.'),
    breakdown: [
      { key: 'required', score: pct(ratio(posting.required, 3)), weight: 0.45, note: `필수 역량 ${posting.required.length}개 중 ${posting.required.filter((skill) => levelIn(resume, skill) >= 3).length}개를 충분히 보여줘요.` },
      { key: 'preferred', score: pct(ratio(posting.preferred, 2)), weight: 0.2, note: `우대 역량 ${posting.preferred.length}개 중 ${posting.preferred.filter((skill) => levelIn(resume, skill) >= 2).length}개가 서류에 보여요.` },
      { key: 'experience', score: pct(Math.min(1, resume.skills.filter((skill) => skill.level >= 3).length / 6)), weight: 0.2, note: '프로젝트에서 직접 쓴 근거가 있는 스킬이 많을수록 높아요.' },
      { key: 'recency', score: pct(ratio(skills.filter((skill) => marketOf(skill).change >= 5), 1)), weight: 0.15, note: '요즘 공고에서 요구가 늘고 있는 스킬을 얼마나 갖췄는지예요.' },
    ],
    radar: AXES.map((axis) => {
      const wanted = skills.filter((skill) => axisOf(skill) === axis)
      const mine = resume.skills.filter((skill) => axisOf(skill.name) === axis)
      const level = mine.length === 0 ? 0 : Math.min(LEVEL_MAX, mine.reduce((sum, skill) => sum + skill.level, 0) / mine.length + Math.min(1.5, mine.length * 0.3))
      return { axis, mine: Math.round(level * 10) / 10, required: wanted.length === 0 ? 1 : Math.min(LEVEL_MAX, 2 + wanted.length) }
    }),
    gaps,
    trends: skills.slice(0, 6).map((skill) => {
      const market = marketOf(skill)
      const base = Math.round(40 + market.share * 160)
      return { skill, series: Array.from({ length: 12 }, (_, week) => Math.max(2, Math.round(base * (1 + ((market.change / 12) * (week - 11)) / 100) + (random() - 0.5) * base * 0.12))) }
    }),
    checks: [
      ...posting.required.map((skill) => ({ skill, requirement: 'required' as const })),
      ...posting.preferred.map((skill) => ({ skill, requirement: 'preferred' as const })),
    ].map((item) => ({ ...item, status: levelIn(resume, item.skill) >= 3 ? ('met' as const) : levelIn(resume, item.skill) > 0 ? ('partial' as const) : ('missing' as const) })),
    courses: gaps.flatMap((gap) => gap.courses).slice(0, 4),
    alternatives: postings
      .filter((item) => item.id !== posting.id && item.family === posting.family)
      .map((item) => ({ id: item.id, fit: fitOf(item, resume) ?? 0 }))
      .filter((item) => item.fit > fit)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 3)
      .map((item) => item.id),
  }
}

/** 리포트는 만든 뒤 잠깐(1.5초) 만드는 중이었다가 다 돼요. 진행 막대와 사이드바의 "진단 중"을 볼 수 있게요. */
function shown(report: MockReport) {
  const { readyAt, ...rest } = report
  if (Date.now() >= readyAt) return { ...rest, progress: 100, stage: 'done' }
  const progress = Math.round(100 - ((readyAt - Date.now()) / 1500) * 100)
  return { ...rest, status: 'pending', progress, stage: 'writing', fitScore: 0, gaps: [], breakdown: [], radar: [], trends: [], checks: [], courses: [], alternatives: [] }
}

// ---------- 이력서 ----------

function extractSkills(seed: string, frontend: boolean): ResumeSkill[] {
  const random = seeded(seed)
  const pool: [string, number, string][] = frontend
    ? [['TypeScript', 4, '세 개의 팀 프로젝트를 모두 TypeScript로 작성했어요.'], ['React', 4, '컴포넌트 설계와 상태 관리를 맡았어요.'], ['JavaScript', 4, '바닐라 JS로 만든 토이 프로젝트가 있어요.'], ['Git', 3, 'PR 기반으로 협업했어요.'], ['Next.js', 2, '한 프로젝트에서 SSR을 적용했어요.'], ['Tailwind', 3, '디자인 시스템을 Tailwind로 만들었어요.'], ['Figma', 2, '디자이너와 Figma로 소통했어요.'], ['테스트 코드', 1, '테스트를 썼다는 언급이 한 줄 있어요.']]
    : [['Java', 4, '팀 프로젝트 세 개를 Java로 작성했어요.'], ['Spring Boot', 4, 'REST API 서버를 설계하고 구현했어요.'], ['JPA', 3, 'N+1 문제를 해결한 경험을 적었어요.'], ['MySQL', 3, '인덱스 설계로 조회 속도를 개선했어요.'], ['Git', 3, 'PR 기반으로 협업했어요.'], ['Redis', 2, '세션 저장소로 썼어요.'], ['Docker', 2, 'docker compose로 로컬 환경을 구성했어요.'], ['AWS', 2, 'EC2에 배포했어요.'], ['자료구조와 알고리즘', 2, '코딩 테스트 준비 기록이 있어요.'], ['테스트 코드', 1, '테스트를 썼다는 언급이 한 줄 있어요.']]
  return pool.filter(() => random() > 0.15).map(([name, level, evidence]) => ({ name, level, evidence }))
}

function paragraphsFor(frontend: boolean): string[] {
  return [
    `사용자가 믿고 쓰는 서비스를 만드는 일이 좋아서 ${frontend ? '프론트엔드' : '백엔드'} 개발자가 되기로 했습니다. 대학 동아리에서 세 개의 서비스를 만들며 설계부터 배포까지 경험했습니다.`,
    frontend
      ? '첫 배포 뒤 모바일에서 화면이 느리다는 피드백을 받아, 번들 크기를 분석하고 라우트 단위로 코드를 나누어 첫 화면 로딩을 3.2초에서 1.1초로 줄였습니다.'
      : '거래 목록 조회가 느려지는 문제를 만나 실행 계획을 분석하고 복합 인덱스를 추가해 응답 시간을 1.8초에서 0.2초로 줄였습니다.',
    '협업할 때는 PR에 변경 이유를 꼭 적고, 이슈 번호를 브랜치와 커밋에 남겨 누구나 맥락을 따라올 수 있게 했습니다.',
    '입사 후에는 대규모 트래픽에서의 장애 대응을 배우고, 테스트를 꼼꼼히 쓰는 개발자가 되고 싶습니다.',
  ]
}

// ---------- 서류 검증, 예상 질문, 답변 ----------

function buildReview(report: MockReport, docType: DocType): DocumentReview {
  const posting = postingOf(report.postingId)
  const resume = state.resumes.find((item) => item.id === report.resumeId)
  const base = resume?.paragraphs ?? paragraphsFor(false)
  const missing = report.gaps.filter((gap) => gap.kind === 'missing').map((gap) => gap.skill)
  const plan: [ParagraphTag[], string][] = [
    [['fix'], `동기가 일반적이에요. ${posting?.title ?? '이 공고'}에서 하는 일과 이어지는 문장으로 바꾸면 부합도가 올라요.`],
    [['good', 'interview'], '숫자로 개선 폭을 보여준 좋은 문단이에요. 면접에서 원인을 어떻게 찾았는지 꼭 물어요.'],
    [['good'], '협업 방식이 구체적이에요. 그대로 두어도 좋아요.'],
    [['missing'], `${missing.slice(0, 2).join(', ') || '우대 역량'}에 대한 준비 계획이 빠졌어요. 지금 공부 중인 것을 한 문장 더해요.`],
  ]
  const paragraphs = base.slice(0, 4).map((text, index) => ({ id: `${docType}-${index}`, text, tags: plan[index][0], feedback: plan[index][1] }))
  const good = paragraphs.filter((paragraph) => paragraph.tags.includes('good')).length
  const fitScore = Math.min(100, Math.round(report.fitScore * 0.6 + (good / Math.max(1, paragraphs.length)) * 40))
  return {
    docType,
    fitScore,
    summary: `${iga(docName(docType))} 공고의 핵심 역량과 ${fitScore >= 70 ? '대부분 이어져요. 표시된 문단만 다듬으면 돼요.' : '절반쯤 이어져요. 빠진 역량의 준비 계획을 더하면 좋아요.'}`,
    paragraphs,
    appealMore: ['성과를 적을 때는 전과 후를 숫자로 나란히 두어요.', '강점 스킬을 쓴 프로젝트에서 내린 결정과 그 이유를 한 문장으로 적어요.', '회사 기술 블로그 주제와 이어지는 경험이 있으면 한 줄 더해요.'],
    reviewedAt: new Date().toISOString(),
  }
}

function buildQuestions(report: MockReport): InterviewQuestion[] {
  const company = companyOf(report.companyId)
  const random = seeded(`q${report.id}`)
  const list: InterviewQuestion[] = [
    { id: 'q-p1', question: '조회가 느려진 문제를 어떻게 발견하고, 원인을 어떤 순서로 좁혀 갔나요?', category: 'project', probability: 0.92, source: { type: 'paragraph', label: '자기소개서 2문단' }, intent: '성과 뒤의 과정을 직접 했는지 확인해요.', answerPoints: ['발견 경로를 먼저 말해요', '가설을 세우고 측정한 순서를 말해요', '전과 후의 숫자를 나란히 말해요'], followUp: '같은 문제가 다시 생기지 않게 무엇을 남겼나요?' },
    { id: 'q-cs1', question: 'HTTP와 HTTPS의 차이, 그리고 TLS 핸드셰이크 과정을 설명해 주세요.', category: 'cs', probability: 0.58, source: { type: 'corpus', label: `${company.name} 기출` }, intent: '네트워크 기초를 확인하는 단골 질문이에요.', answerPoints: ['암호화와 인증서의 역할을 나눠 말해요', '대칭키와 비대칭키가 어디에 쓰이는지 말해요'], followUp: 'HTTPS를 쓰면 성능은 어떻게 달라지나요?' },
    { id: 'q-c1', question: '팀원과 의견이 갈렸던 경험과, 어떻게 결론을 냈는지 말해 주세요.', category: 'culture', probability: 0.66, source: { type: 'paragraph', label: '자기소개서 3문단' }, intent: '협업 방식을 봐요.', answerPoints: ['두 의견을 공정하게 말해요', '기준을 세워 결정한 과정을 말해요', '배운 점을 말해요'], followUp: '그 결정이 틀렸다면 어떻게 하나요?' },
  ]
  for (const gap of report.gaps.slice(0, 5)) {
    const strength = gap.kind === 'strength'
    list.push({
      id: `q-${gap.skill}`,
      question: strength ? gap.expectedQuestions[0].question : `${eul(gap.skill)} 쓴 경험이 없는데, 입사 뒤 어떻게 익힐 계획인가요?`,
      category: 'tech',
      probability: Math.round((strength ? 0.6 : 0.45) * 100 + random() * 20) / 100,
      source: { type: strength ? 'strength' : 'gap', label: `${strength ? '강점' : '부족'} ${gap.skill}` },
      intent: strength ? `${eul(gap.skill)} 얼마나 깊이 이해하는지 봐요.` : '빠진 역량을 어떻게 메울지 봐요.',
      answerPoints: strength ? gap.expectedQuestions[0].points : ['모른다고 숨기지 않아요', '비슷한 개념을 다룬 경험을 연결해요', '지금 하는 공부를 구체적으로 말해요'],
      followUp: gap.expectedQuestions[1].question,
    })
  }
  return list.sort((a, b) => b.probability - a.probability)
}

function grade(question: InterviewQuestion | undefined, answer: string): PracticeFeedback {
  const text = answer.trim()
  const hasNumber = /\d/.test(text)
  const structure = /(먼저|그래서|결과|이후|때문)/.test(text)
  const score = Math.max(20, Math.min(96, 45 + (hasNumber ? 15 : 0) + (structure ? 15 : 0) + Math.min(20, Math.floor(text.length / 15)) - (text.length < 60 ? 15 : 0)))
  return {
    score,
    good: [structure ? '상황, 행동, 결과의 흐름이 보여서 따라가기 쉬워요.' : '질문을 피하지 않고 답했어요.', ...(hasNumber ? ['숫자로 결과를 말해서 설득력이 있어요.'] : [])],
    improve: [...(text.length < 60 ? ['답이 짧아요. 상황을 한두 문장 더 설명해 주세요.'] : []), ...(hasNumber ? [] : ['결과를 숫자로 말해 보세요.']), `빠진 포인트: ${question?.answerPoints[0] ?? '결과와 배운 점'}.`],
    rephrase: ['먼저 상황은 이랬고, 저는 이렇게 했으며, 그 결과 이렇게 됐다는 순서로 말해 보세요.'],
    followUp: question?.followUp ?? '그 경험에서 가장 크게 배운 점은 무엇인가요?',
    modelAnswer: `${question?.answerPoints.join(' ') ?? ''} 이 순서로 말하면 면접관이 흐름을 따라가기 쉬워요.`.trim(),
  }
}

// ---------- 요청 처리 ----------

function reply(data: unknown, status = 200, code: string | null = null): Response {
  const body = JSON.stringify({ data, error: { code, message: null } })
  return new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Content-Length': String(new TextEncoder().encode(body).length) } })
}
const fail = (status: number, code: string) => reply(null, status, code)

const TOKENS = { accessToken: 'mock-access', refreshToken: 'mock-refresh' }
const ME = { id: 1, email: 'mock@javadda.dev', name: '목 사용자', role: 'USER', registeredAt: '2026-10-01T09:00:00', passwordSet: true }
const CONFIG = { admin: false, feedback: false, githubClientId: null, kakaoClientId: null, socialAppLink: false, socialUnlink: false, withdraw: false, usage: false, ai: { defaultModel: '', models: [] } }

function startReport(postingId: string, resume: MockResume): MockReport {
  // 서버처럼 같은 공고를 같은 서류로 만든 예전 리포트는 새 리포트가 대신해요.
  state.reports = state.reports.filter((report) => !(report.postingId === postingId && report.resumeId === resume.id))
  const report = buildReport(nextId(), postingOf(postingId)!, toResume(resume), resume.id)
  state.reports.unshift(report)
  save()
  return report
}

async function handle(path: string, query: URLSearchParams, method: string, body: unknown): Promise<Response> {
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const [head, id, sub, extra, last] = parts
  const json = (body ?? {}) as Record<string, unknown>

  if (head === 'config') return reply(CONFIG)
  if (head === 'auth') return id === 'sessions' ? reply([]) : id === 'logout' ? reply(null) : reply(TOKENS)
  if (head === 'users') return id === 'me' && sub === 'login-history' ? reply({ items: [], page: 0, size: 20, hasNext: false }) : reply(id === 'me' && !sub && method === 'GET' ? ME : null)
  if (head === 'companies') return reply(companies)
  if (head === 'postings') {
    if (id) return postingOf(id) ? reply(postingOf(id)) : fail(404, 'C4042')
    const text = (query.get('query') ?? '').toLowerCase()
    return reply(
      postings.filter(
        (posting) =>
          (!query.get('family') || posting.family === query.get('family')) &&
          (!query.get('career') || posting.career === query.get('career')) &&
          (!text || [posting.title, companyOf(posting.companyId).name, posting.location, ...posting.required, ...posting.preferred].join(' ').toLowerCase().includes(text)),
      ),
    )
  }
  if (head === 'plans') {
    if (id) state.plans = method === 'DELETE' ? state.plans.filter((skill) => skill !== id) : [...new Set([...state.plans, id])]
    save()
    return reply(state.plans)
  }
  if (head === 'notes') {
    if (!id) return reply(state.notes)
    const note = { skill: id, text: String(json.text ?? ''), savedAt: new Date().toISOString() }
    state.notes = [...state.notes.filter((item) => item.skill !== id), note]
    save()
    return reply(note)
  }

  if (head === 'resumes') {
    if (!id && method === 'GET') return reply({ primaryId: state.primaryId, list: state.resumes })
    if (!id || id === 'link') {
      await wait(1000)
      const name = body instanceof FormData ? ((body.get('file') as File | null)?.name ?? '이력서.pdf') : String(json.link ?? '링크').replace(/^https?:\/\//, '')
      const frontend = /front|fe|react|web|프론트/i.test(name)
      const resume: MockResume = { id: nextId(), name, source: body instanceof FormData ? 'pdf' : /notion/i.test(name) ? 'notion' : 'github', uploadedAt: new Date().toISOString(), skills: extractSkills(name, frontend), paragraphs: paragraphsFor(frontend) }
      state.resumes.unshift(resume)
      state.primaryId ??= resume.id
      save()
      return reply(resume)
    }
    const resume = state.resumes.find((item) => item.id === Number(id))
    if (!resume) return fail(404, 'C4043')
    if (sub === 'skills') resume.skills = (json.skills as ResumeSkill[]) ?? resume.skills
    else if (sub === 'primary') state.primaryId = resume.id
    else if (method === 'DELETE') {
      state.resumes = state.resumes.filter((item) => item !== resume)
      if (state.primaryId === resume.id) state.primaryId = state.resumes[0]?.id ?? null
    }
    save()
    return reply(method === 'DELETE' || sub === 'primary' ? null : resume)
  }

  if (head === 'reports') {
    if (!id) {
      if (method === 'GET') return reply(state.reports.map(shown))
      const resume = state.resumes.find((item) => item.id === (Number(json.resumeId) || state.primaryId))
      if (!resume) return fail(404, 'C4043')
      if (resume.skills.length === 0) return fail(400, 'C4003')
      if (!postingOf(String(json.postingId))) return fail(404, 'C4042')
      const existing = state.reports.find((report) => report.postingId === json.postingId && report.resumeId === resume.id)
      return reply(shown(existing ?? startReport(String(json.postingId), resume)), 202)
    }
    const report = state.reports.find((item) => item.id === Number(id))
    if (!report) return fail(404, 'C4044')
    if (method === 'DELETE') {
      state.reports = state.reports.filter((item) => item !== report)
      save()
      return reply(null)
    }
    if (sub === 'rerun') {
      const resume = state.resumes.find((item) => item.id === state.primaryId) ?? state.resumes.find((item) => item.id === report.resumeId)
      if (!resume) return fail(404, 'C4043')
      state.reports = state.reports.filter((item) => item !== report)
      return reply(shown(startReport(report.postingId, resume)), 202)
    }
    if (Date.now() < report.readyAt && sub) return fail(409, 'C4092')
    if (sub === 'reviews' && last === 'paragraphs') {
      // 고쳐 쓴 문단 다시 보기예요. 숫자가 있으면 좋아요, 없으면 고쳐요로 대충 바꿔요.
      const review = state.reviews[`${report.id}:${extra}`]
      if (!review) return fail(404, 'C4044')
      const text = String(json.text ?? '')
      const id = parts[5]
      review.paragraphs = review.paragraphs.map((paragraph) => (paragraph.id === id ? { id, text, tags: /\d/.test(text) ? ['good'] : ['fix'], feedback: /\d/.test(text) ? '성과가 숫자로 드러나서 좋아요.' : '결과를 숫자로 보여주면 좋아요.' } : paragraph))
      save()
      return reply(review)
    }
    if (sub === 'reviews') {
      const key = `${report.id}:${extra}`
      if (last === 'regenerate') delete state.reviews[key]
      if (!state.reviews[key]) {
        await wait(1000)
        state.reviews[key] = buildReview(report, extra as DocType)
        save()
      }
      return reply(state.reviews[key])
    }
    if (sub === 'questions') {
      if (extra === 'regenerate') delete state.questions[report.id]
      const questions = (state.questions[report.id] ??= buildQuestions(report))
      if (extra === 'answers' && !last) return reply(state.answers[report.id] ?? [])
      if (last === 'answers') {
        await wait(800)
        const question = questions.find((item) => item.id === extra)
        const feedback = grade(question, String(json.answer ?? ''))
        ;(state.answers[report.id] ??= []).unshift({ id: nextId(), questionId: extra, question: question?.question ?? '', answer: String(json.answer ?? ''), feedback, createdAt: new Date().toISOString() })
        save()
        return reply(feedback)
      }
      save()
      await wait(600)
      return reply(questions)
    }
    return reply(shown(report))
  }

  // 블로그, 사용량, 진행 상황 등은 서버가 없는 것처럼 답해요. 블로그는 화면이 적어 둔 글을 보여줘요.
  return fail(404, 'C404')
}

/** 목 모드를 켜요. 처음 그리기 전에 한 번 불러요. */
export function installMock() {
  companies = [...COMPANIES]
  postings = [...POSTINGS]
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin)
    const at = url.pathname.indexOf('/api/v1/')
    if (url.origin !== window.location.origin || at < 0) return realFetch(input, init)
    const raw = init.body
    const body = raw instanceof FormData ? raw : typeof raw === 'string' ? JSON.parse(raw || '{}') : undefined
    await wait(80)
    return handle(url.pathname.slice(at + '/api/v1/'.length), url.searchParams, (init.method ?? 'GET').toUpperCase(), body)
  }
  console.info('[mock] 목 모드로 켜졌어요. 서버 대신 브라우저 안의 가짜 서버가 답해요.')
}

/** 목 모드의 자료를 모두 지워요. 브라우저 콘솔에서 `mockReset()`으로 불러요. */
;(window as unknown as { mockReset: () => void }).mockReset = () => {
  state = empty()
  save()
  window.location.reload()
}
