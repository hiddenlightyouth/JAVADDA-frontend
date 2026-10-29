/**
 * 취업 갭 진단의 자료와 API예요. 공고, 기업, 이력서, 리포트(적합도와 갭), 서류 검증, 예상 면접 질문, 면접 연습이 여기 있어요.
 * 백엔드가 아직 없어서 화면은 이 파일의 가짜 API를 불러요. 요청과 응답 모양은 백엔드 기획(PostgreSQL 스키마)의 테이블을 따라 두어서,
 * 서버가 생기면 함수 속만 fetch로 바꾸고 화면은 그대로 둘 수 있어요. 이력서와 리포트는 이 기기의 localStorage에 남겨요.
 */
import { getLang } from './i18n'
import { readJson, writeJson } from './storage'
import { createStore, useStore } from './store'

export type JobFamily = 'backend' | 'frontend' | 'mobile' | 'data' | 'devops'
export type CareerLevel = 'entry' | 'junior' | 'any'
export type Requirement = 'required' | 'preferred'

export interface Company {
  id: string
  name: string
  /** 로고가 없거나 불러오지 못했을 때 보여줄 머리글자 */
  initial: string
  /** 로고 그림 주소(`public/logos`). 기업 사이트의 아이콘을 받아 둔 거예요. */
  logo?: string
  industry: string
  /** 기업 소개 사이트 주소. 공고 탐색에서 로고를 누르면 미니 브라우저로 열어요. */
  site: string
  /** 기업 기술 블로그 주소. 요구 스택의 변화를 읽는 자료예요. */
  techBlog?: string
}

export interface JobPosting {
  id: string
  companyId: string
  title: string
  family: JobFamily
  career: CareerLevel
  location: string
  /** 처음 본 날(ISO) */
  postedAt: string
  /** 마감일. 없으면 상시 채용이에요. */
  deadline?: string
  required: string[]
  preferred: string[]
  summary: string
  source: 'worknet' | 'company'
  url: string
}

export interface ResumeSkill {
  name: string
  /** 1부터 5까지. 서류에서 읽은 숙련도예요. */
  level: number
  /** 이렇게 판단한 근거 문장 */
  evidence: string
}

export interface Resume {
  id: string
  /** 파일 이름이나 링크의 이름 */
  name: string
  source: 'pdf' | 'github' | 'notion'
  link?: string
  uploadedAt: string
  skills: ResumeSkill[]
  /** 서류 검증에 쓰는 문단. PDF를 읽어 나눈 글이에요. */
  paragraphs: string[]
}

export type GapKind = 'missing' | 'partial' | 'strength'

export interface Course {
  id: string
  title: string
  provider: '인프런'
  level: '입문' | '초급' | '중급'
  hours: number
  url: string
}

/** 강의 플랫폼의 로고예요. public/providers에 받아 둔 아이콘이에요. */
export const PROVIDER_LOGOS: Record<Course['provider'], string> = { 인프런: '/providers/inflearn.png' }

export interface SkillGap {
  skill: string
  kind: GapKind
  requirement: Requirement
  /** 같은 직군 공고 중 이 스킬을 적은 비율(0에서 1) */
  share: number
  /** 지난 6개월 사이 시장 요구의 변화(퍼센트 포인트) */
  marketChange: number
  /** 이렇게 판단한 근거 */
  reason: string
  /** 서류에서 찾은 근거 한 줄. 부족이거나 예전 리포트면 없어요. */
  evidence?: string
  /** 보완 방법. 부족과 보완에만 있어요. */
  actionPlan: string[]
  /** 보완에 걸리는 주 수 */
  estimatedWeeks: number
  /** 보완하면 오를 적합도 점수 */
  scoreGain: number
  courses: Course[]
  /** 강점일 때 면접에서 어필할 포인트 */
  appealPoints: string[]
  /** 강점일 때 주의할 점 */
  caution?: string
  /** 이 스킬에서 나올 만한 질문과 답변 포인트 */
  expectedQuestions: { question: string; points: string[] }[]
}

export interface ScoreItem {
  key: 'required' | 'preferred' | 'experience' | 'recency'
  score: number
  /** 전체 점수에서 차지하는 비중(0에서 1) */
  weight: number
  note: string
}

export interface RadarAxis {
  axis: string
  mine: number
  required: number
}

export interface SkillTrend {
  skill: string
  /** 최근 12주의 공고 수 */
  series: number[]
}

export interface RequirementCheck {
  skill: string
  requirement: Requirement
  status: 'met' | 'partial' | 'missing'
}

export interface Report {
  id: string
  postingId: string
  companyId: string
  resumeId: string
  status: 'pending' | 'done' | 'failed'
  createdAt: string
  fitScore: number
  summary: string
  breakdown: ScoreItem[]
  radar: RadarAxis[]
  gaps: SkillGap[]
  trends: SkillTrend[]
  checks: RequirementCheck[]
  courses: Course[]
  /** 더 잘 맞는 다른 공고 */
  alternatives: string[]
}

export type DocType = 'coverLetter' | 'resume' | 'portfolio'
export type ParagraphTag = 'good' | 'fix' | 'missing' | 'interview'

export interface ReviewParagraph {
  id: string
  text: string
  tags: ParagraphTag[]
  feedback: string
}

export interface DocumentReview {
  docType: DocType
  fitScore: number
  summary: string
  paragraphs: ReviewParagraph[]
  appealMore: string[]
  reviewedAt: string
}

export type QuestionCategory = 'tech' | 'project' | 'cs' | 'culture'
export type QuestionSource = 'paragraph' | 'gap' | 'strength' | 'blog' | 'corpus'

export interface InterviewQuestion {
  id: string
  question: string
  category: QuestionCategory
  /** 나올 확률(0에서 1) */
  probability: number
  source: { type: QuestionSource; label: string }
  intent: string
  answerPoints: string[]
  followUp: string
}

export interface PracticeFeedback {
  score: number
  good: string[]
  improve: string[]
  rephrase: string[]
  followUp: string
}

export interface InterviewNote {
  skill: string
  text: string
  savedAt: string
}

/** 1부터 5까지의 숙련도를 레이더에 올릴 때 쓰는 최대값 */
export const LEVEL_MAX = 5

const KEYS = {
  /** 예전에 하나만 두던 이력서. 처음 읽을 때 목록으로 옮겨요. */
  resume: 'whoisloafing:gap:resume:v1',
  resumes: 'whoisloafing:gap:resumes:v1',
  reports: 'whoisloafing:gap:reports:v1',
  bookmarks: 'whoisloafing:gap:bookmarks:v1',
  notes: 'whoisloafing:gap:notes:v1',
  plans: 'whoisloafing:gap:plans:v1',
}

// ---------- 자료 ----------

export const COMPANIES: Company[] = [
  { id: 'toss', name: '토스', initial: 'T', logo: '/logos/toss.png', industry: '핀테크', site: 'https://toss.im/company', techBlog: 'https://toss.tech' },
  { id: 'kakao', name: '카카오', initial: 'K', logo: '/logos/kakao.png', industry: '플랫폼', site: 'https://www.kakaocorp.com/page/', techBlog: 'https://tech.kakao.com' },
  { id: 'naver', name: '네이버', initial: 'N', logo: '/logos/naver.png', industry: '포털', site: 'https://www.navercorp.com', techBlog: 'https://d2.naver.com' },
  { id: 'woowa', name: '우아한형제들', initial: '우', logo: '/logos/woowa.png', industry: '푸드테크', site: 'https://www.woowahan.com', techBlog: 'https://techblog.woowahan.com' },
  { id: 'coupang', name: '쿠팡', initial: 'C', logo: '/logos/coupang.png', industry: '커머스', site: 'https://www.aboutcoupang.com', techBlog: 'https://medium.com/coupang-engineering' },
  { id: 'line', name: '라인플러스', initial: 'L', logo: '/logos/line.png', industry: '메신저', site: 'https://www.linepluscorp.com', techBlog: 'https://techblog.lycorp.co.jp/ko' },
  { id: 'daangn', name: '당근', initial: '당', logo: '/logos/daangn.png', industry: '로컬 커뮤니티', site: 'https://about.daangn.com', techBlog: 'https://medium.com/daangn' },
  { id: 'musinsa', name: '무신사', initial: 'M', logo: '/logos/musinsa.png', industry: '패션 커머스', site: 'https://www.musinsacareers.com/ko/home' },
  { id: 'dunamu', name: '두나무', initial: 'D', logo: '/logos/dunamu.png', industry: '핀테크', site: 'https://www.dunamu.com' },
  { id: 'zigbang', name: '직방', initial: 'Z', logo: '/logos/zigbang.png', industry: '프롭테크', site: 'https://career.zigbang.com' },
  { id: 'wanted', name: '원티드랩', initial: 'W', logo: '/logos/wanted.png', industry: 'HR 테크', site: 'https://www.wantedlab.com' },
  { id: 'bucketplace', name: '오늘의집', initial: '오', logo: '/logos/bucketplace.png', industry: '리빙 커머스', site: 'https://www.bucketplace.com' },
]

const companyById = new Map(COMPANIES.map((company) => [company.id, company]))

export const companyOf = (id: string): Company => companyById.get(id) ?? { id, name: id, initial: id[0]?.toUpperCase() ?? '?', industry: '', site: '' }

/** 스킬이 어느 묶음인지. 레이더의 축이에요. */
export const SKILL_AXES = ['언어', '프레임워크', '데이터베이스', '인프라', '협업', 'CS 기초'] as const
export type SkillAxis = (typeof SKILL_AXES)[number]

const AXIS_OF: Record<string, SkillAxis> = {
  Java: '언어',
  Kotlin: '언어',
  TypeScript: '언어',
  JavaScript: '언어',
  Python: '언어',
  Go: '언어',
  Swift: '언어',
  SQL: '언어',
  'Spring Boot': '프레임워크',
  'Spring Batch': '프레임워크',
  JPA: '프레임워크',
  React: '프레임워크',
  'Next.js': '프레임워크',
  Vue: '프레임워크',
  'React Native': '프레임워크',
  'Node.js': '프레임워크',
  FastAPI: '프레임워크',
  Django: '프레임워크',
  MySQL: '데이터베이스',
  PostgreSQL: '데이터베이스',
  Redis: '데이터베이스',
  MongoDB: '데이터베이스',
  Elasticsearch: '데이터베이스',
  Kafka: '인프라',
  Docker: '인프라',
  Kubernetes: '인프라',
  AWS: '인프라',
  GCP: '인프라',
  Terraform: '인프라',
  'GitHub Actions': '인프라',
  Jenkins: '인프라',
  Git: '협업',
  Jira: '협업',
  Figma: '협업',
  'Slack 봇': '협업',
  '테스트 코드': 'CS 기초',
  '자료구조와 알고리즘': 'CS 기초',
  네트워크: 'CS 기초',
  '운영체제': 'CS 기초',
  '시스템 설계': 'CS 기초',
  MSA: 'CS 기초',
  gRPC: '인프라',
  GraphQL: '프레임워크',
  Tailwind: '프레임워크',
  Webpack: '인프라',
  Vite: '인프라',
  'Spring Security': '프레임워크',
  'Spring AI': '프레임워크',
  LLM: 'CS 기초',
  pgvector: '데이터베이스',
}

export const axisOf = (skill: string): SkillAxis => AXIS_OF[skill] ?? 'CS 기초'

/** 스킬 이름의 여러 표기를 하나로 모아요. 서류에서 읽은 글자와 공고의 글자가 달라도 같은 스킬로 봐요. */
const ALIASES: Record<string, string> = {
  springboot: 'Spring Boot',
  spring: 'Spring Boot',
  스프링: 'Spring Boot',
  스프링부트: 'Spring Boot',
  'spring boot': 'Spring Boot',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  react: 'React',
  리액트: 'React',
  'react.js': 'React',
  reactjs: 'React',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  next: 'Next.js',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  쿠버네티스: 'Kubernetes',
  docker: 'Docker',
  도커: 'Docker',
  aws: 'AWS',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  redis: 'Redis',
  kafka: 'Kafka',
  카프카: 'Kafka',
  jpa: 'JPA',
  hibernate: 'JPA',
  java: 'Java',
  자바: 'Java',
  kotlin: 'Kotlin',
  코틀린: 'Kotlin',
  python: 'Python',
  파이썬: 'Python',
  git: 'Git',
  github: 'Git',
  'github actions': 'GitHub Actions',
  jenkins: 'Jenkins',
  test: '테스트 코드',
  junit: '테스트 코드',
  jest: '테스트 코드',
  테스트: '테스트 코드',
  msa: 'MSA',
  마이크로서비스: 'MSA',
  알고리즘: '자료구조와 알고리즘',
  자료구조: '자료구조와 알고리즘',
  네트워크: '네트워크',
  os: '운영체제',
  운영체제: '운영체제',
  tailwind: 'Tailwind',
  tailwindcss: 'Tailwind',
  vite: 'Vite',
  graphql: 'GraphQL',
  grpc: 'gRPC',
  elasticsearch: 'Elasticsearch',
  mongodb: 'MongoDB',
  mongo: 'MongoDB',
  terraform: 'Terraform',
  gcp: 'GCP',
  figma: 'Figma',
  jira: 'Jira',
  llm: 'LLM',
  'spring ai': 'Spring AI',
  pgvector: 'pgvector',
  swift: 'Swift',
  go: 'Go',
  golang: 'Go',
  vue: 'Vue',
  'vue.js': 'Vue',
  'react native': 'React Native',
  fastapi: 'FastAPI',
  django: 'Django',
  sql: 'SQL',
  '시스템 설계': '시스템 설계',
  'spring security': 'Spring Security',
  'spring batch': 'Spring Batch',
}

/** 스킬 이름을 하나의 표기로 바꿔요. 모르는 이름은 앞뒤 공백만 떼고 그대로 둬요. */
export function canonical(name: string): string {
  const trimmed = name.trim()
  return ALIASES[trimmed.toLowerCase()] ?? trimmed
}

let knownSkills: string[] | null = null

/** 역량 더하기에서 고를 수 있는 스킬 이름이에요. 축이 정해진 스킬과 공고에 적힌 스킬을 모아요. 처음 쓸 때 한 번만 만들어요. */
function allSkills(): string[] {
  knownSkills ??= [...new Set([...Object.keys(AXIS_OF), ...POSTINGS.flatMap((posting) => [...posting.required, ...posting.preferred])])].sort((a, b) => a.localeCompare(b))
  return knownSkills
}

/**
 * 친 글자에 맞는 스킬 이름을 골라요. 이름이나 별칭(스프링, k8s)이 친 글자로 시작하면 앞에, 가운데에 들어 있으면 뒤에 둬요.
 * 이미 가진 스킬(exclude)은 빼요.
 */
export function suggestSkills(query: string, exclude: string[] = [], limit = 8): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const aliased = new Set(Object.entries(ALIASES).filter(([alias]) => alias.startsWith(q)).map(([, name]) => name))
  const rank = (name: string) => {
    const lower = name.toLowerCase()
    if (lower.startsWith(q) || aliased.has(name)) return 0
    if (lower.includes(q)) return 1
    return -1
  }
  return allSkills()
    .filter((name) => !exclude.includes(name))
    .map((name) => ({ name, rank: rank(name) }))
    .filter((item) => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((item) => item.name)
}

const FAMILY_NAMES: Record<JobFamily, string> = { backend: '백엔드', frontend: '프론트엔드', mobile: '모바일', data: '데이터', devops: 'DevOps' }
const FAMILY_NAMES_EN: Record<JobFamily, string> = { backend: 'Backend', frontend: 'Frontend', mobile: 'Mobile', data: 'Data', devops: 'DevOps' }

export const familyName = (family: JobFamily) => (getLang() === 'en' ? FAMILY_NAMES_EN[family] : FAMILY_NAMES[family])

export const CAREER_NAMES: Record<CareerLevel, { ko: string; en: string }> = {
  entry: { ko: '신입', en: 'Entry level' },
  junior: { ko: '주니어(1년 이상)', en: 'Junior (1+ years)' },
  any: { ko: '경력 무관', en: 'Any level' },
}

export const careerName = (career: CareerLevel) => CAREER_NAMES[career][getLang()]

const DAY = 86_400_000

const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const daysLater = (days: number) => new Date(Date.now() + days * DAY).toISOString()

export const POSTINGS: JobPosting[] = [
  {
    id: 'toss-be-1',
    companyId: 'toss',
    title: 'Server Developer (신입)',
    family: 'backend',
    career: 'entry',
    location: '서울 강남',
    postedAt: daysAgo(2),
    deadline: daysLater(19),
    required: ['Java', 'Kotlin', 'Spring Boot', 'JPA', 'MySQL', '테스트 코드'],
    preferred: ['Kafka', 'Redis', 'Kubernetes', 'MSA'],
    summary: '토스의 금융 서비스 서버를 만들어요. 대규모 트래픽을 안정적으로 다루는 경험을 쌓을 수 있어요.',
    source: 'company',
    url: 'https://toss.im/career',
  },
  {
    id: 'toss-fe-1',
    companyId: 'toss',
    title: 'Frontend Developer (신입)',
    family: 'frontend',
    career: 'entry',
    location: '서울 강남',
    postedAt: daysAgo(5),
    deadline: daysLater(12),
    required: ['TypeScript', 'React', 'Next.js', 'Git'],
    preferred: ['테스트 코드', 'Vite', 'GraphQL', 'Figma'],
    summary: '수천만 명이 쓰는 금융 화면을 만들어요. 디자인 시스템과 성능 최적화에 깊이 참여해요.',
    source: 'company',
    url: 'https://toss.im/career',
  },
  {
    id: 'kakao-be-1',
    companyId: 'kakao',
    title: '카카오톡 서버 개발자 (신입 공채)',
    family: 'backend',
    career: 'entry',
    location: '경기 판교',
    postedAt: daysAgo(7),
    deadline: daysLater(8),
    required: ['Java', 'Spring Boot', 'MySQL', '자료구조와 알고리즘', '네트워크'],
    preferred: ['Kafka', 'Redis', 'Docker', 'Kubernetes', 'MongoDB'],
    summary: '카카오톡의 메시지 서버를 함께 만들어요. 초당 수십만 건의 메시지를 처리하는 구조를 배워요.',
    source: 'company',
    url: 'https://careers.kakao.com',
  },
  {
    id: 'kakao-fe-1',
    companyId: 'kakao',
    title: 'FE 개발자 (신입 공채)',
    family: 'frontend',
    career: 'entry',
    location: '경기 판교',
    postedAt: daysAgo(7),
    deadline: daysLater(8),
    required: ['JavaScript', 'TypeScript', 'React', 'Git', '자료구조와 알고리즘'],
    preferred: ['Next.js', 'Vue', '테스트 코드', 'Webpack'],
    summary: '카카오 서비스의 웹 화면을 만들어요. 대규모 사용자 환경에서의 접근성과 성능을 다뤄요.',
    source: 'company',
    url: 'https://careers.kakao.com',
  },
  {
    id: 'naver-be-1',
    companyId: 'naver',
    title: '백엔드 개발 (신입, 검색 플랫폼)',
    family: 'backend',
    career: 'entry',
    location: '경기 분당',
    postedAt: daysAgo(10),
    deadline: daysLater(21),
    required: ['Java', 'Spring Boot', '자료구조와 알고리즘', '운영체제', '네트워크'],
    preferred: ['Elasticsearch', 'Kafka', 'Kubernetes', 'Go'],
    summary: '네이버 검색의 색인과 서빙 플랫폼을 만들어요. 분산 시스템을 깊이 다뤄요.',
    source: 'company',
    url: 'https://recruit.navercorp.com',
  },
  {
    id: 'woowa-be-1',
    companyId: 'woowa',
    title: '배민 주문 플랫폼 서버 개발자 (주니어)',
    family: 'backend',
    career: 'junior',
    location: '서울 송파',
    postedAt: daysAgo(3),
    deadline: daysLater(27),
    required: ['Java', 'Kotlin', 'Spring Boot', 'JPA', 'MySQL', 'Kafka', '테스트 코드'],
    preferred: ['MSA', 'Redis', 'Kubernetes', 'Spring Batch'],
    summary: '주문부터 결제까지 이어지는 핵심 도메인을 담당해요. 이벤트 기반 아키텍처를 실무에서 다뤄요.',
    source: 'company',
    url: 'https://career.woowahan.com',
  },
  {
    id: 'woowa-fe-1',
    companyId: 'woowa',
    title: '배민 웹 프론트엔드 개발자 (신입)',
    family: 'frontend',
    career: 'entry',
    location: '서울 송파',
    postedAt: daysAgo(12),
    deadline: daysLater(4),
    required: ['TypeScript', 'React', 'Git', '테스트 코드'],
    preferred: ['Next.js', 'Tailwind', 'Vite', 'Figma'],
    summary: '사장님과 라이더가 쓰는 웹 도구를 만들어요. 작은 팀에서 기획부터 배포까지 함께해요.',
    source: 'company',
    url: 'https://career.woowahan.com',
  },
  {
    id: 'coupang-be-1',
    companyId: 'coupang',
    title: 'Software Engineer, Backend (Entry)',
    family: 'backend',
    career: 'entry',
    location: '서울 송파',
    postedAt: daysAgo(4),
    required: ['Java', 'Spring Boot', 'MySQL', 'AWS', '자료구조와 알고리즘'],
    preferred: ['Kafka', 'Kubernetes', 'Redis', '시스템 설계'],
    summary: '쿠팡의 물류와 커머스 시스템을 만들어요. 클라우드 위에서 대규모 트래픽을 다뤄요.',
    source: 'company',
    url: 'https://www.coupang.jobs',
  },
  {
    id: 'line-be-1',
    companyId: 'line',
    title: 'Server-side Engineer (신입)',
    family: 'backend',
    career: 'entry',
    location: '경기 판교',
    postedAt: daysAgo(15),
    deadline: daysLater(14),
    required: ['Java', 'Kotlin', 'Spring Boot', 'MySQL', 'Redis'],
    preferred: ['Kafka', 'Kubernetes', 'gRPC', 'MongoDB'],
    summary: '글로벌 메신저의 서버를 만들어요. 여러 나라 팀과 함께 일해요.',
    source: 'company',
    url: 'https://careers.linecorp.com',
  },
  {
    id: 'daangn-fe-1',
    companyId: 'daangn',
    title: 'Frontend Engineer (주니어)',
    family: 'frontend',
    career: 'junior',
    location: '서울 서초',
    postedAt: daysAgo(1),
    deadline: daysLater(29),
    required: ['TypeScript', 'React', 'React Native', 'Git'],
    preferred: ['GraphQL', '테스트 코드', 'Vite', 'Figma'],
    summary: '당근 웹과 앱의 화면을 만들어요. 웹뷰와 네이티브를 함께 다뤄요.',
    source: 'company',
    url: 'https://about.daangn.com/jobs',
  },
  {
    id: 'daangn-be-1',
    companyId: 'daangn',
    title: 'Software Engineer, Backend (주니어)',
    family: 'backend',
    career: 'junior',
    location: '서울 서초',
    postedAt: daysAgo(6),
    required: ['Go', 'Kotlin', 'PostgreSQL', 'Kafka', 'Kubernetes'],
    preferred: ['gRPC', 'Redis', 'Terraform', 'MSA'],
    summary: '당근의 채팅과 거래 서버를 만들어요. Go와 Kotlin을 함께 써요.',
    source: 'company',
    url: 'https://about.daangn.com/jobs',
  },
  {
    id: 'musinsa-be-1',
    companyId: 'musinsa',
    title: '백엔드 개발자 (신입)',
    family: 'backend',
    career: 'entry',
    location: '서울 성동',
    postedAt: daysAgo(9),
    deadline: daysLater(10),
    required: ['Java', 'Spring Boot', 'JPA', 'MySQL', 'Git'],
    preferred: ['Redis', 'Kafka', 'Docker', '테스트 코드'],
    summary: '무신사 스토어의 상품과 주문 서버를 만들어요.',
    source: 'worknet',
    url: 'https://www.work.go.kr',
  },
  {
    id: 'musinsa-fe-1',
    companyId: 'musinsa',
    title: '프론트엔드 개발자 (신입)',
    family: 'frontend',
    career: 'entry',
    location: '서울 성동',
    postedAt: daysAgo(9),
    deadline: daysLater(10),
    required: ['JavaScript', 'TypeScript', 'React', 'Next.js'],
    preferred: ['Tailwind', 'GraphQL', '테스트 코드', 'Webpack'],
    summary: '무신사 스토어의 웹 화면을 만들어요. 커머스 화면의 성능을 다뤄요.',
    source: 'worknet',
    url: 'https://www.work.go.kr',
  },
  {
    id: 'dunamu-be-1',
    companyId: 'dunamu',
    title: '업비트 거래소 백엔드 개발자 (신입)',
    family: 'backend',
    career: 'entry',
    location: '서울 강남',
    postedAt: daysAgo(11),
    deadline: daysLater(17),
    required: ['Java', 'Kotlin', 'Spring Boot', 'MySQL', 'Redis', '자료구조와 알고리즘'],
    preferred: ['Kafka', 'Kubernetes', '시스템 설계', '테스트 코드'],
    summary: '거래 체결과 자산 서비스를 만들어요. 정합성과 지연 시간이 중요한 시스템이에요.',
    source: 'company',
    url: 'https://www.dunamu.com/careers',
  },
  {
    id: 'zigbang-be-1',
    companyId: 'zigbang',
    title: '백엔드 엔지니어 (신입)',
    family: 'backend',
    career: 'entry',
    location: '서울 서초',
    postedAt: daysAgo(14),
    deadline: daysLater(2),
    required: ['Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
    preferred: ['Redis', 'Docker', 'GraphQL', '테스트 코드'],
    summary: '직방의 매물과 중개 서비스 서버를 만들어요. TypeScript로 서버를 작성해요.',
    source: 'worknet',
    url: 'https://www.work.go.kr',
  },
  {
    id: 'wanted-fe-1',
    companyId: 'wanted',
    title: '프론트엔드 개발자 (경력 무관)',
    family: 'frontend',
    career: 'any',
    location: '서울 송파',
    postedAt: daysAgo(8),
    required: ['TypeScript', 'React', 'Next.js', 'Git'],
    preferred: ['Tailwind', '테스트 코드', 'Figma', 'Vite'],
    summary: '원티드의 채용 서비스 화면을 만들어요. 기획과 디자인 팀과 가까이 일해요.',
    source: 'company',
    url: 'https://www.wanted.co.kr',
  },
  {
    id: 'wanted-data-1',
    companyId: 'wanted',
    title: '데이터 엔지니어 (신입)',
    family: 'data',
    career: 'entry',
    location: '서울 송파',
    postedAt: daysAgo(13),
    deadline: daysLater(6),
    required: ['Python', 'SQL', 'AWS', 'Docker'],
    preferred: ['Kafka', 'Elasticsearch', 'LLM', 'pgvector'],
    summary: '채용 데이터 파이프라인과 추천 모델의 서빙을 만들어요.',
    source: 'company',
    url: 'https://www.wanted.co.kr',
  },
  {
    id: 'bucketplace-be-1',
    companyId: 'bucketplace',
    title: '백엔드 개발자 (신입)',
    family: 'backend',
    career: 'entry',
    location: '서울 서초',
    postedAt: daysAgo(2),
    deadline: daysLater(25),
    required: ['Kotlin', 'Spring Boot', 'JPA', 'MySQL', 'Git'],
    preferred: ['Kafka', 'Redis', 'Kubernetes', 'MSA', '테스트 코드'],
    summary: '오늘의집 커머스와 콘텐츠 서버를 만들어요. Kotlin과 Spring으로 작성해요.',
    source: 'company',
    url: 'https://www.bucketplace.com/careers',
  },
  {
    id: 'bucketplace-fe-1',
    companyId: 'bucketplace',
    title: '웹 프론트엔드 개발자 (신입)',
    family: 'frontend',
    career: 'entry',
    location: '서울 서초',
    postedAt: daysAgo(2),
    deadline: daysLater(25),
    required: ['TypeScript', 'React', 'Next.js', 'Git'],
    preferred: ['Tailwind', 'GraphQL', '테스트 코드', 'Figma'],
    summary: '오늘의집 웹의 커머스 화면과 커뮤니티 화면을 만들어요.',
    source: 'company',
    url: 'https://www.bucketplace.com/careers',
  },
  {
    id: 'naver-devops-1',
    companyId: 'naver',
    title: 'Cloud Platform Engineer (신입)',
    family: 'devops',
    career: 'entry',
    location: '경기 분당',
    postedAt: daysAgo(16),
    deadline: daysLater(15),
    required: ['Kubernetes', 'Docker', 'Python', '네트워크', '운영체제'],
    preferred: ['Go', 'Terraform', 'GCP', 'AWS'],
    summary: '네이버 클라우드의 컨테이너 플랫폼을 운영하고 만들어요.',
    source: 'company',
    url: 'https://recruit.navercorp.com',
  },
  {
    id: 'kakao-mobile-1',
    companyId: 'kakao',
    title: 'iOS 개발자 (신입 공채)',
    family: 'mobile',
    career: 'entry',
    location: '경기 판교',
    postedAt: daysAgo(7),
    deadline: daysLater(8),
    required: ['Swift', 'Git', '자료구조와 알고리즘', '네트워크'],
    preferred: ['테스트 코드', 'GraphQL', 'Figma'],
    summary: '카카오톡 iOS 앱을 만들어요.',
    source: 'company',
    url: 'https://careers.kakao.com',
  },
  {
    id: 'coupang-fe-1',
    companyId: 'coupang',
    title: 'Frontend Engineer (Entry)',
    family: 'frontend',
    career: 'entry',
    location: '서울 송파',
    postedAt: daysAgo(18),
    required: ['TypeScript', 'React', 'Next.js', '테스트 코드'],
    preferred: ['GraphQL', 'Webpack', 'Figma', 'Tailwind'],
    summary: '쿠팡 앱과 웹의 상품 화면을 만들어요. 서버 사이드 렌더링과 성능 지표를 다뤄요.',
    source: 'company',
    url: 'https://www.coupang.jobs',
  },
]

const postingById = new Map(POSTINGS.map((posting) => [posting.id, posting]))

export const postingOf = (id: string): JobPosting | null => postingById.get(id) ?? null

const COURSES: Record<string, Course[]> = {
  Kafka: [
    { id: 'c-kafka-1', title: '아파치 카프카 애플리케이션 프로그래밍', provider: '인프런', level: '초급', hours: 8, url: 'https://www.inflearn.com' },
    { id: 'c-kafka-2', title: 'Spring Boot와 Kafka로 만드는 이벤트 기반 서비스', provider: '인프런', level: '중급', hours: 12, url: 'https://www.inflearn.com' },
  ],
  Redis: [{ id: 'c-redis-1', title: 'Redis 기본과 실전 캐싱 전략', provider: '인프런', level: '초급', hours: 6, url: 'https://www.inflearn.com' }],
  Kubernetes: [
    { id: 'c-k8s-1', title: '쿠버네티스 입문, 컨테이너 오케스트레이션의 시작', provider: '인프런', level: '입문', hours: 10, url: 'https://www.inflearn.com' },
  ],
  Docker: [{ id: 'c-docker-1', title: 'Docker로 개발 환경부터 배포까지', provider: '인프런', level: '입문', hours: 5, url: 'https://www.inflearn.com' }],
  '테스트 코드': [
    { id: 'c-test-1', title: '실용적인 테스트 가이드, JUnit과 Mockito', provider: '인프런', level: '초급', hours: 7, url: 'https://www.inflearn.com' },
    { id: 'c-test-2', title: 'React Testing Library로 프론트엔드 테스트 시작하기', provider: '인프런', level: '초급', hours: 5, url: 'https://www.inflearn.com' },
  ],
  MSA: [{ id: 'c-msa-1', title: 'Spring Cloud로 개발하는 마이크로서비스', provider: '인프런', level: '중급', hours: 14, url: 'https://www.inflearn.com' }],
  JPA: [{ id: 'c-jpa-1', title: '자바 ORM 표준 JPA 프로그래밍 기본편', provider: '인프런', level: '초급', hours: 16, url: 'https://www.inflearn.com' }],
  Kotlin: [{ id: 'c-kotlin-1', title: '자바 개발자를 위한 코틀린 입문', provider: '인프런', level: '입문', hours: 6, url: 'https://www.inflearn.com' }],
  'Next.js': [{ id: 'c-next-1', title: 'Next.js로 서버 사이드 렌더링 시작하기', provider: '인프런', level: '초급', hours: 9, url: 'https://www.inflearn.com' }],
  GraphQL: [{ id: 'c-gql-1', title: 'GraphQL 기본과 Apollo 실전', provider: '인프런', level: '초급', hours: 6, url: 'https://www.inflearn.com' }],
  '자료구조와 알고리즘': [{ id: 'c-algo-1', title: '코딩 테스트 대비 자료구조와 알고리즘', provider: '인프런', level: '초급', hours: 20, url: 'https://www.inflearn.com' }],
  네트워크: [{ id: 'c-net-1', title: '개발자를 위한 컴퓨터 네트워크 핵심', provider: '인프런', level: '입문', hours: 8, url: 'https://www.inflearn.com' }],
  운영체제: [{ id: 'c-os-1', title: '운영체제 핵심 개념 정리', provider: '인프런', level: '입문', hours: 9, url: 'https://www.inflearn.com' }],
  '시스템 설계': [{ id: 'c-design-1', title: '대규모 시스템 설계 입문', provider: '인프런', level: '중급', hours: 11, url: 'https://www.inflearn.com' }],
  AWS: [{ id: 'c-aws-1', title: 'AWS 기본 서비스로 서버 배포하기', provider: '인프런', level: '입문', hours: 7, url: 'https://www.inflearn.com' }],
  TypeScript: [{ id: 'c-ts-1', title: '타입스크립트 올인원', provider: '인프런', level: '초급', hours: 10, url: 'https://www.inflearn.com' }],
  Tailwind: [{ id: 'c-tw-1', title: 'Tailwind CSS로 빠르게 화면 만들기', provider: '인프런', level: '입문', hours: 4, url: 'https://www.inflearn.com' }],
  Go: [{ id: 'c-go-1', title: 'Go 언어 입문과 웹 서버 만들기', provider: '인프런', level: '입문', hours: 8, url: 'https://www.inflearn.com' }],
  gRPC: [{ id: 'c-grpc-1', title: 'gRPC로 서비스 간 통신 설계하기', provider: '인프런', level: '중급', hours: 5, url: 'https://www.inflearn.com' }],
  Elasticsearch: [{ id: 'c-es-1', title: 'Elasticsearch 검색 엔진 기본', provider: '인프런', level: '초급', hours: 8, url: 'https://www.inflearn.com' }],
  MongoDB: [{ id: 'c-mongo-1', title: 'MongoDB 기본과 모델링', provider: '인프런', level: '입문', hours: 6, url: 'https://www.inflearn.com' }],
  Terraform: [{ id: 'c-tf-1', title: 'Terraform으로 인프라를 코드로 관리하기', provider: '인프런', level: '초급', hours: 7, url: 'https://www.inflearn.com' }],
  Vite: [{ id: 'c-vite-1', title: 'Vite로 프론트엔드 빌드 환경 다지기', provider: '인프런', level: '입문', hours: 3, url: 'https://www.inflearn.com' }],
  Figma: [{ id: 'c-figma-1', title: '개발자를 위한 Figma 읽는 법', provider: '인프런', level: '입문', hours: 3, url: 'https://www.inflearn.com' }],
  'React Native': [{ id: 'c-rn-1', title: 'React Native로 앱 만들기', provider: '인프런', level: '초급', hours: 12, url: 'https://www.inflearn.com' }],
  Webpack: [{ id: 'c-wp-1', title: 'Webpack 설정 완전 정복', provider: '인프런', level: '초급', hours: 5, url: 'https://www.inflearn.com' }],
  'Spring Batch': [{ id: 'c-batch-1', title: 'Spring Batch로 대용량 처리하기', provider: '인프런', level: '중급', hours: 8, url: 'https://www.inflearn.com' }],
}

const coursesFor = (skill: string): Course[] => COURSES[skill] ?? []

/** 같은 직군 공고 중 이 스킬을 적은 비율과 지난 6개월 변화예요. 공고가 쌓이기 전이라 기술 블로그와 공고 표본으로 어림한 값이에요. */
const MARKET: Record<string, { share: number; change: number }> = {
  Java: { share: 0.82, change: -3 },
  Kotlin: { share: 0.54, change: 9 },
  'Spring Boot': { share: 0.88, change: 2 },
  JPA: { share: 0.61, change: 1 },
  MySQL: { share: 0.74, change: -1 },
  PostgreSQL: { share: 0.33, change: 6 },
  Redis: { share: 0.57, change: 4 },
  Kafka: { share: 0.49, change: 12 },
  Kubernetes: { share: 0.46, change: 10 },
  Docker: { share: 0.63, change: 3 },
  AWS: { share: 0.58, change: 2 },
  MSA: { share: 0.38, change: 5 },
  '테스트 코드': { share: 0.66, change: 8 },
  '자료구조와 알고리즘': { share: 0.52, change: 0 },
  네트워크: { share: 0.41, change: 0 },
  운영체제: { share: 0.3, change: -1 },
  '시스템 설계': { share: 0.27, change: 7 },
  TypeScript: { share: 0.91, change: 4 },
  JavaScript: { share: 0.7, change: -6 },
  React: { share: 0.89, change: 1 },
  'Next.js': { share: 0.62, change: 14 },
  Vue: { share: 0.18, change: -5 },
  GraphQL: { share: 0.24, change: 2 },
  Tailwind: { share: 0.29, change: 11 },
  Vite: { share: 0.31, change: 13 },
  Webpack: { share: 0.26, change: -9 },
  Figma: { share: 0.35, change: 3 },
  Git: { share: 0.77, change: 0 },
  Go: { share: 0.21, change: 6 },
  gRPC: { share: 0.14, change: 4 },
  Elasticsearch: { share: 0.17, change: 1 },
  MongoDB: { share: 0.22, change: -2 },
  Terraform: { share: 0.19, change: 5 },
  GCP: { share: 0.12, change: 1 },
  Python: { share: 0.44, change: 3 },
  SQL: { share: 0.6, change: 1 },
  LLM: { share: 0.16, change: 15 },
  pgvector: { share: 0.05, change: 5 },
  'React Native': { share: 0.2, change: 2 },
  Swift: { share: 0.15, change: 0 },
  'Node.js': { share: 0.28, change: -2 },
  'Spring Batch': { share: 0.19, change: 2 },
  'Spring Security': { share: 0.3, change: 1 },
}

const marketOf = (skill: string) => MARKET[skill] ?? { share: 0.1, change: 0 }

// ---------- 저장소 ----------

/** 올려 둔 서류 목록과, 진단과 추천에 쓰는 대표 서류의 아이디예요. */
export interface ResumeShelf {
  list: Resume[]
  primaryId: string | null
}

function readShelf(): ResumeShelf {
  const shelf = readJson<ResumeShelf | null>(KEYS.resumes, null)
  if (shelf) return shelf
  // 예전에 하나만 올려 두었으면 그 서류를 대표로 옮겨요.
  const legacy = readJson<Resume | null>(KEYS.resume, null)
  return legacy ? { list: [legacy], primaryId: legacy.id } : { list: [], primaryId: null }
}

const shelfStore = createStore<ResumeShelf>(readShelf())
const primaryOf = (shelf: ResumeShelf) => shelf.list.find((resume) => resume.id === shelf.primaryId) ?? null
const reportsStore = createStore<Report[]>(readJson<Report[]>(KEYS.reports, []))
const bookmarksStore = createStore<string[]>(readJson<string[]>(KEYS.bookmarks, []))
const notesStore = createStore<InterviewNote[]>(readJson<InterviewNote[]>(KEYS.notes, []))
/** 보완 계획에 넣어 둔 스킬 */
const plansStore = createStore<string[]>(readJson<string[]>(KEYS.plans, []))

/** 대표 이력서예요. 적합도, 추천, 진단은 모두 이 서류를 기준으로 해요. */
export const useResume = () => useStore(shelfStore, primaryOf)
export const getResume = () => primaryOf(shelfStore.get())
/** 올려 둔 서류 전부와 대표 서류의 아이디 */
export const useResumeShelf = () => useStore(shelfStore)
/** 아이디로 서류를 찾아요. 지웠거나 아이디가 없으면 대표 서류예요. */
const resumeOf = (id?: string | null) => shelfStore.get().list.find((resume) => resume.id === id) ?? getResume()
export const useReports = () => useStore(reportsStore)
export const getReports = () => reportsStore.get()
export const useBookmarks = () => useStore(bookmarksStore)
export const useNotes = () => useStore(notesStore)
export const usePlans = () => useStore(plansStore)

function setReports(next: Report[]) {
  reportsStore.set(next)
  writeJson(KEYS.reports, next)
}

export function toggleBookmark(companyId: string) {
  const current = bookmarksStore.get()
  const next = current.includes(companyId) ? current.filter((id) => id !== companyId) : [...current, companyId]
  bookmarksStore.set(next)
  writeJson(KEYS.bookmarks, next)
}

export function togglePlan(skill: string) {
  const current = plansStore.get()
  const next = current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]
  plansStore.set(next)
  writeJson(KEYS.plans, next)
}

export function saveNote(skill: string, text: string) {
  const next = [...notesStore.get().filter((note) => note.skill !== skill), { skill, text, savedAt: new Date().toISOString() }]
  notesStore.set(next)
  writeJson(KEYS.notes, next)
}

// ---------- 계산 ----------

/** 같은 글자로 같은 수를 내는 간단한 난수예요. 목 자료가 새로 고칠 때마다 바뀌지 않게 해요. */
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

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 서류에서 이 스킬을 몇으로 보는지. 없으면 0이에요. */
const levelOf = (resume: Resume | null, skill: string) => resume?.skills.find((item) => item.name === skill)?.level ?? 0

/** 이 공고와 이력서의 적합도(0에서 100)예요. 필수 역량을 더 무겁게 봐요. 이력서가 없으면 null이에요. */
export function fitOf(posting: JobPosting, resume: Resume | null): number | null {
  if (!resume || resume.skills.length === 0) return null
  const score = (skills: string[]) => (skills.length === 0 ? 1 : skills.reduce((sum, skill) => sum + Math.min(1, levelOf(resume, skill) / 3), 0) / skills.length)
  const required = score(posting.required)
  const preferred = score(posting.preferred)
  const breadth = Math.min(1, resume.skills.length / 10)
  return Math.round((required * 0.6 + preferred * 0.25 + breadth * 0.15) * 100)
}

function buildGaps(posting: JobPosting, resume: Resume): SkillGap[] {
  const gaps: SkillGap[] = []
  const seen = new Set<string>()
  const push = (skill: string, requirement: Requirement) => {
    if (seen.has(skill)) return
    seen.add(skill)
    const level = levelOf(resume, skill)
    const kind: GapKind = level >= 3 ? 'strength' : level > 0 ? 'partial' : 'missing'
    const market = marketOf(skill)
    const evidence = resume.skills.find((item) => item.name === skill)?.evidence
    const gain = requirement === 'required' ? (kind === 'missing' ? 9 : 5) : kind === 'missing' ? 4 : 2
    gaps.push({
      skill,
      kind,
      requirement,
      share: market.share,
      marketChange: market.change,
      reason:
        kind === 'strength'
          ? `서류에서 ${skill}을(를) 실제로 쓴 근거가 보여요. ${evidence ?? ''}`.trim()
          : kind === 'partial'
            ? `서류에 ${skill}이(가) 보이지만 깊이를 보여주는 근거가 약해요. ${evidence ?? ''}`.trim()
            : `서류 어디에도 ${skill}을(를) 다룬 흔적이 없어요. 이 공고는 ${requirement === 'required' ? '필수' : '우대'} 역량으로 적고 있어요.`,
      evidence: kind === 'missing' ? undefined : evidence,
      actionPlan:
        kind === 'strength'
          ? []
          : [
              `${skill}의 핵심 개념을 정리하고 작은 예제로 손에 익혀요.`,
              `기존 프로젝트에 ${skill}을(를) 적용해 보고, 왜 썼는지와 결과를 README에 남겨요.`,
              `면접에서 설명할 수 있게 겪은 문제와 해결 과정을 한 문단으로 적어 둬요.`,
            ],
      estimatedWeeks: kind === 'missing' ? (market.share > 0.5 ? 4 : 3) : 2,
      scoreGain: kind === 'strength' ? 0 : gain,
      courses: kind === 'strength' ? [] : coursesFor(skill).slice(0, 2),
      appealPoints:
        kind === 'strength'
          ? [`${skill}을(를) 쓴 프로젝트에서 맡은 역할과 결정 이유를 숫자와 함께 말해요.`, `${skill}을(를) 쓰다 겪은 문제 하나를 골라 원인과 해결을 구조적으로 설명해요.`]
          : [],
      caution: kind === 'strength' ? `${skill}의 내부 동작을 물어보면 깊이가 드러나요. 자주 쓰는 기능의 원리까지 한 번 짚어 두세요.` : undefined,
      expectedQuestions: [
        {
          question: `${skill}을(를) 선택한 이유와 대안으로 고려한 것은 무엇이었나요?`,
          points: ['문제 상황을 먼저 말해요', '비교한 대안과 기준을 들어요', '결과를 숫자로 보여줘요'],
        },
        {
          question: `${skill}을(를) 쓰면서 겪은 가장 어려운 문제는 무엇이었나요?`,
          points: ['원인을 어떻게 찾았는지 과정을 말해요', '해결 뒤에 남긴 재발 방지 장치를 말해요'],
        },
      ],
    })
  }
  for (const skill of posting.required) push(skill, 'required')
  for (const skill of posting.preferred) push(skill, 'preferred')
  const order: Record<GapKind, number> = { missing: 0, partial: 1, strength: 2 }
  return gaps.sort((a, b) => order[a.kind] - order[b.kind] || (a.requirement === b.requirement ? b.share - a.share : a.requirement === 'required' ? -1 : 1))
}

function buildRadar(posting: JobPosting, resume: Resume): RadarAxis[] {
  return SKILL_AXES.map((axis) => {
    const wanted = [...posting.required, ...posting.preferred].filter((skill) => axisOf(skill) === axis)
    const mine = resume.skills.filter((skill) => axisOf(skill.name) === axis)
    const required = wanted.length === 0 ? 1 : Math.min(LEVEL_MAX, 2 + wanted.length)
    const level = mine.length === 0 ? 0 : Math.min(LEVEL_MAX, mine.reduce((sum, skill) => sum + skill.level, 0) / mine.length + Math.min(1.5, mine.length * 0.3))
    return { axis, mine: Math.round(level * 10) / 10, required }
  })
}

function buildTrends(posting: JobPosting, seed: string): SkillTrend[] {
  const random = seeded(seed)
  return [...posting.required, ...posting.preferred].slice(0, 6).map((skill) => {
    const market = marketOf(skill)
    const base = Math.round(40 + market.share * 160)
    const slope = market.change / 12
    return {
      skill,
      series: Array.from({ length: 12 }, (_, week) => Math.max(2, Math.round(base * (1 + (slope * (week - 11)) / 100) + (random() - 0.5) * base * 0.12))),
    }
  })
}

function buildBreakdown(posting: JobPosting, resume: Resume): ScoreItem[] {
  const ratio = (skills: string[], threshold: number) =>
    skills.length === 0 ? 1 : skills.filter((skill) => levelOf(resume, skill) >= threshold).length / skills.length
  const required = ratio(posting.required, 3)
  const preferred = ratio(posting.preferred, 2)
  const experience = Math.min(1, resume.skills.filter((skill) => skill.level >= 3).length / 6)
  const rising = [...posting.required, ...posting.preferred].filter((skill) => marketOf(skill).change >= 5)
  const recency = rising.length === 0 ? 0.7 : rising.filter((skill) => levelOf(resume, skill) > 0).length / rising.length
  const pct = (value: number) => Math.round(value * 100)
  return [
    { key: 'required', score: pct(required), weight: 0.45, note: `필수 역량 ${posting.required.length}개 중 ${posting.required.filter((skill) => levelOf(resume, skill) >= 3).length}개를 충분히 보여줘요.` },
    { key: 'preferred', score: pct(preferred), weight: 0.2, note: `우대 역량 ${posting.preferred.length}개 중 ${posting.preferred.filter((skill) => levelOf(resume, skill) >= 2).length}개가 서류에 보여요.` },
    { key: 'experience', score: pct(experience), weight: 0.2, note: '프로젝트에서 직접 쓴 근거가 있는 스킬이 많을수록 높아요.' },
    { key: 'recency', score: pct(recency), weight: 0.15, note: '요즘 공고에서 요구가 늘고 있는 스킬을 얼마나 갖췄는지예요.' },
  ]
}

function buildChecks(posting: JobPosting, resume: Resume): RequirementCheck[] {
  const check = (skill: string, requirement: Requirement): RequirementCheck => {
    const level = levelOf(resume, skill)
    return { skill, requirement, status: level >= 3 ? 'met' : level > 0 ? 'partial' : 'missing' }
  }
  return [...posting.required.map((skill) => check(skill, 'required')), ...posting.preferred.map((skill) => check(skill, 'preferred'))]
}

function buildSummary(posting: JobPosting, company: Company, fit: number, gaps: SkillGap[]): string {
  const missing = gaps.filter((gap) => gap.kind === 'missing' && gap.requirement === 'required').map((gap) => gap.skill)
  const strengths = gaps.filter((gap) => gap.kind === 'strength').map((gap) => gap.skill)
  const head = fit >= 75 ? `${company.name} ${posting.title} 공고와 꽤 잘 맞아요.` : fit >= 50 ? `${company.name} ${posting.title} 공고와 절반 넘게 맞아요.` : `${company.name} ${posting.title} 공고와는 아직 거리가 있어요.`
  const strong = strengths.length > 0 ? ` ${strengths.slice(0, 3).join(', ')}은(는) 서류에서 분명하게 드러나요.` : ''
  const weak = missing.length > 0 ? ` 다만 필수 역량 중 ${missing.slice(0, 3).join(', ')}이(가) 보이지 않아서, 이 부분을 채우면 점수가 크게 올라요.` : ' 필수 역량은 모두 보여서, 우대 역량을 더하면 더 좋아져요.'
  return head + strong + weak
}

// ---------- 공고 ----------

export interface PostingFilter {
  query?: string
  family?: JobFamily | null
  career?: CareerLevel | null
}

export type PostingSort = 'fit' | 'recent' | 'deadline'

/** 공고 목록이에요. 검색어는 기업 이름, 공고 제목, 스킬에서 찾아요. */
export async function fetchPostings(filter: PostingFilter = {}): Promise<JobPosting[]> {
  await wait(280)
  const query = filter.query?.trim().toLowerCase() ?? ''
  return POSTINGS.filter((posting) => {
    if (filter.family && posting.family !== filter.family) return false
    if (filter.career && posting.career !== filter.career && posting.career !== 'any') return false
    if (!query) return true
    const company = companyOf(posting.companyId)
    const haystack = [company.name, posting.title, posting.location, ...posting.required, ...posting.preferred].join(' ').toLowerCase()
    return haystack.includes(query)
  })
}

export function sortPostings(list: JobPosting[], sort: PostingSort, resume: Resume | null): JobPosting[] {
  const copy = [...list]
  if (sort === 'recent') return copy.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))
  if (sort === 'deadline') return copy.sort((a, b) => (a.deadline ?? '9') < (b.deadline ?? '9') ? -1 : 1)
  return copy.sort((a, b) => (fitOf(b, resume) ?? -1) - (fitOf(a, resume) ?? -1))
}

/**
 * 다른 서비스 안(iframe)에 보이지 않게 막아 둔 채용 사이트예요(X-Frame-Options나 frame-ancestors).
 * 이 사이트의 원문은 앱 안의 미니 브라우저에 띄우지 않고, 공고 요약과 새 탭 버튼을 대신 보여줘요.
 */
// 다른 서비스 안에 보이지 않게 막아 둔 사이트예요(X-Frame-Options, frame-ancestors). 같은 도메인도 페이지마다 달라서 주소 앞부분으로 적어요.
const FRAME_BLOCKED = [
  'toss.im/career',
  'careers.kakao.com',
  'recruit.navercorp.com',
  'www.navercorp.com',
  'career.woowahan.com',
  'www.woowahan.com',
  'www.coupang.jobs',
  'www.aboutcoupang.com',
  'www.wanted.co.kr',
  'www.wantedlab.com',
]

/** 공고 원문이나 기업 사이트를 앱 안에 띄울 수 있는지예요. */
export function canEmbed(url: string): boolean {
  try {
    const { host, pathname } = new URL(url)
    return !FRAME_BLOCKED.some((prefix) => `${host}${pathname}`.startsWith(prefix))
  } catch {
    return false
  }
}

/** 마감까지 남은 날. 마감이 없으면 null이에요. */
/** 공고가 올라온 지 며칠 지났는지예요. 오늘 올라왔으면 0이에요. */
export function daysSince(posting: JobPosting): number {
  return Math.max(0, Math.floor((Date.now() - new Date(posting.postedAt).getTime()) / DAY))
}

/** 검색창에 돌아가며 보여주는 추천 검색어예요. 공고에 실제로 자주 적힌 기업, 기술, 지역이에요. */
export const SEARCH_SUGGESTIONS = ['Spring Boot', '토스', 'React', 'Kubernetes', '카카오', 'TypeScript', 'Kotlin', '판교']

/** 추천 검색어가 바뀌는 간격(ms)이에요. */
export const SUGGEST_MS = 2600

export function daysLeft(posting: JobPosting): number | null {
  if (!posting.deadline) return null
  return Math.max(0, Math.ceil((new Date(posting.deadline).getTime() - Date.now()) / DAY))
}

// ---------- 이력서 ----------

/** 파일 이름이나 링크에서 어떤 서류인지 어림해요. 실제 파싱은 서버가 할 일이라, 여기서는 그럴듯한 역량 목록을 만들어요. */
function extractSkills(seed: string, hint: 'backend' | 'frontend'): ResumeSkill[] {
  const random = seeded(seed)
  const pool =
    hint === 'frontend'
      ? [
          ['TypeScript', 4, '세 개의 팀 프로젝트를 모두 TypeScript로 작성했어요.'],
          ['React', 4, '컴포넌트 설계와 상태 관리를 맡았어요.'],
          ['JavaScript', 4, '바닐라 JS로 만든 토이 프로젝트가 있어요.'],
          ['Git', 3, 'PR 기반 협업과 브랜치 전략을 썼어요.'],
          ['Next.js', 2, '한 프로젝트에서 SSR을 적용했지만 설명이 짧아요.'],
          ['Tailwind', 3, '디자인 시스템을 Tailwind로 만들었어요.'],
          ['Vite', 2, '빌드 도구로 썼다고만 적혀 있어요.'],
          ['Figma', 2, '디자이너와 Figma로 소통했어요.'],
          ['자료구조와 알고리즘', 2, '코딩 테스트 준비 기록만 있어요.'],
          ['테스트 코드', 1, '테스트를 썼다는 언급이 한 줄 있어요.'],
        ]
      : [
          ['Java', 4, '팀 프로젝트 세 개를 Java로 작성했어요.'],
          ['Spring Boot', 4, 'REST API 서버를 설계하고 구현했어요.'],
          ['JPA', 3, '연관관계 매핑과 N+1 문제 해결 경험을 적었어요.'],
          ['MySQL', 3, '인덱스 설계로 조회 속도를 개선한 경험이 있어요.'],
          ['Git', 3, 'PR 기반 협업과 브랜치 전략을 썼어요.'],
          ['Redis', 2, '세션 저장소로 썼다는 언급이 있어요.'],
          ['Docker', 2, 'docker compose로 로컬 환경을 구성했어요.'],
          ['AWS', 2, 'EC2에 배포했다는 한 줄이 있어요.'],
          ['자료구조와 알고리즘', 2, '코딩 테스트 준비 기록만 있어요.'],
          ['테스트 코드', 1, '테스트를 썼다는 언급이 한 줄 있어요.'],
          ['Kotlin', 1, '토이 프로젝트에서 잠깐 써 봤어요.'],
        ]
  return pool
    .filter(() => random() > 0.18)
    .map(([name, level, evidence]) => ({ name: name as string, level: level as number, evidence: evidence as string }))
}

function buildParagraphs(skills: ResumeSkill[], hint: 'backend' | 'frontend'): string[] {
  const top = skills.filter((skill) => skill.level >= 3).map((skill) => skill.name)
  return hint === 'frontend'
    ? [
        `사용자가 바로 느끼는 화면을 만드는 일이 좋아서 프론트엔드 개발자가 되기로 했습니다. 대학 동아리에서 ${top.slice(0, 2).join('과 ')}로 세 개의 서비스를 만들며 기획부터 배포까지 전 과정을 경험했습니다.`,
        `가장 기억에 남는 프로젝트는 동아리 출석 관리 서비스입니다. 첫 배포 뒤 모바일에서 화면이 느리다는 피드백을 받아, 번들 크기를 분석하고 라우트 단위로 코드를 나누어 첫 화면 로딩을 3.2초에서 1.1초로 줄였습니다.`,
        `협업할 때는 PR에 변경 이유를 꼭 적고, 디자이너와 Figma에서 컴포넌트 이름을 맞추는 규칙을 만들어 소통 비용을 줄였습니다.`,
        `입사 후에는 대규모 사용자 환경에서의 접근성과 성능 지표를 배우고, 팀의 디자인 시스템에 기여하고 싶습니다.`,
      ]
    : [
        `사용자가 믿고 쓰는 서비스의 뒤편을 만드는 일이 좋아서 백엔드 개발자가 되기로 했습니다. 대학 동아리에서 ${top.slice(0, 2).join('과 ')}로 세 개의 서비스를 만들며 설계부터 배포까지 전 과정을 경험했습니다.`,
        `가장 기억에 남는 프로젝트는 동아리 중고 거래 서비스입니다. 거래 목록 조회가 느려지는 문제를 만나 실행 계획을 분석하고 복합 인덱스를 추가해 응답 시간을 1.8초에서 0.2초로 줄였습니다.`,
        `협업할 때는 PR에 변경 이유를 꼭 적고, 이슈 번호를 브랜치와 커밋에 남겨 누구나 맥락을 따라올 수 있게 했습니다.`,
        `입사 후에는 대규모 트래픽에서의 장애 대응과 메시지 기반 설계를 배우고, 테스트를 꼼꼼히 쓰는 개발자가 되고 싶습니다.`,
      ]
}

/**
 * 이력서나 포트폴리오를 올려요. PDF 파일이나 GitHub, 노션 링크를 받아요. 서버가 파싱한 것처럼 역량 목록과 문단을 돌려줘요.
 * 목록 맨 앞에 더하고, 대표 서류가 없으면 대표로 삼아요.
 */
export async function uploadResume(input: { file?: File; link?: string }): Promise<Resume> {
  await wait(1400)
  const name = input.file?.name ?? input.link?.replace(/^https?:\/\//, '') ?? '이력서'
  const source: Resume['source'] = input.file ? 'pdf' : /notion/i.test(input.link ?? '') ? 'notion' : 'github'
  const hint: 'backend' | 'frontend' = /front|fe|react|web|프론트/i.test(name) ? 'frontend' : 'backend'
  const skills = extractSkills(name, hint)
  const resume: Resume = {
    id: `resume-${Date.now().toString(36)}`,
    name,
    source,
    link: input.link,
    uploadedAt: new Date().toISOString(),
    skills,
    paragraphs: buildParagraphs(skills, hint),
  }
  const shelf = shelfStore.get()
  saveShelf({ list: [resume, ...shelf.list], primaryId: primaryOf(shelf) ? shelf.primaryId : resume.id })
  return resume
}

function saveShelf(shelf: ResumeShelf) {
  shelfStore.set(shelf)
  writeJson(KEYS.resumes, shelf)
}

/** 추출한 역량을 사용자가 고친 뒤에 저장해요. id가 없으면 대표 서류를 고쳐요. */
export function saveResumeSkills(skills: ResumeSkill[], id = shelfStore.get().primaryId) {
  const shelf = shelfStore.get()
  saveShelf({ ...shelf, list: shelf.list.map((resume) => (resume.id === id ? { ...resume, skills } : resume)) })
}

/** 대표 이력서를 바꿔요. */
export function setPrimaryResume(id: string) {
  saveShelf({ ...shelfStore.get(), primaryId: id })
}

/** 서류를 지워요. 대표 서류를 지우면 남은 것 중 가장 최근 것이 대표가 돼요. */
export function removeResume(id: string) {
  const shelf = shelfStore.get()
  const list = shelf.list.filter((resume) => resume.id !== id)
  saveShelf({ list, primaryId: shelf.primaryId === id ? (list[0]?.id ?? null) : shelf.primaryId })
}

// ---------- 리포트 ----------

/**
 * 리포트를 만들기 시작해요. 바로 pending 리포트를 돌려주고, 잠시 뒤에 done으로 바뀌어요. 서버의 POST /reports 202와 같은 흐름이에요.
 * resumeId를 주면 그 서류로, 없으면 대표 이력서로 진단해요.
 */
export async function createReport(postingId: string, resumeId?: string): Promise<Report | null> {
  const posting = postingOf(postingId)
  const resume = resumeOf(resumeId)
  if (!posting || !resume) return null
  await wait(200)
  const id = `r-${Date.now().toString(36)}`
  const pending: Report = {
    id,
    postingId,
    companyId: posting.companyId,
    resumeId: resume.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    fitScore: 0,
    summary: '',
    breakdown: [],
    radar: [],
    gaps: [],
    trends: [],
    checks: [],
    courses: [],
    alternatives: [],
  }
  setReports([pending, ...reportsStore.get().filter((report) => report.postingId !== postingId)])
  void finishReport(pending, posting, resume)
  return pending
}

async function finishReport(pending: Report, posting: JobPosting, resume: Resume) {
  await wait(2600)
  const company = companyOf(posting.companyId)
  const gaps = buildGaps(posting, resume)
  const fit = fitOf(posting, resume) ?? 0
  const courses = [...new Map(gaps.filter((gap) => gap.kind !== 'strength').flatMap((gap) => gap.courses).map((course) => [course.id, course])).values()].slice(0, 4)
  const alternatives = POSTINGS.filter((item) => item.id !== posting.id && item.family === posting.family)
    .map((item) => ({ id: item.id, fit: fitOf(item, resume) ?? 0 }))
    .filter((item) => item.fit > fit)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 3)
    .map((item) => item.id)
  const done: Report = {
    ...pending,
    status: 'done',
    fitScore: fit,
    summary: buildSummary(posting, company, fit, gaps),
    breakdown: buildBreakdown(posting, resume),
    radar: buildRadar(posting, resume),
    gaps,
    trends: buildTrends(posting, pending.id),
    checks: buildChecks(posting, resume),
    courses,
    alternatives,
  }
  setReports(reportsStore.get().map((report) => (report.id === pending.id ? done : report)))
}

export const reportOf = (id: string): Report | null => reportsStore.get().find((report) => report.id === id) ?? null

export function useReport(id: string | null): Report | null {
  return useStore(reportsStore, (reports) => (id ? reports.find((report) => report.id === id) ?? null : null))
}

export function deleteReport(id: string) {
  setReports(reportsStore.get().filter((report) => report.id !== id))
}

/** 같은 공고를 다시 진단해요. 이력서를 고친 뒤에 써요. */
export async function rerunReport(id: string): Promise<Report | null> {
  const report = reportOf(id)
  if (!report) return null
  deleteReport(id)
  return createReport(report.postingId, report.resumeId)
}

// ---------- 서류 검증 ----------

const DOC_NAMES: Record<DocType, { ko: string; en: string }> = {
  coverLetter: { ko: '자기소개서', en: 'Cover letter' },
  resume: { ko: '이력서', en: 'Resume' },
  portfolio: { ko: '포트폴리오', en: 'Portfolio' },
}

export const docName = (doc: DocType) => DOC_NAMES[doc][getLang()]

/** 서류를 공고에 맞춰 문단마다 읽어요. 태그는 좋아요(good), 고쳐요(fix), 빠졌어요(missing), 면접 예상(interview)이에요. */
export async function fetchReview(reportId: string, docType: DocType): Promise<DocumentReview | null> {
  await wait(1600)
  const report = reportOf(reportId)
  const posting = report ? postingOf(report.postingId) : null
  const resume = resumeOf(report?.resumeId)
  if (!report || !posting || !resume) return null
  const company = companyOf(posting.companyId)
  const missing = report.gaps.filter((gap) => gap.kind === 'missing' && gap.requirement === 'required').map((gap) => gap.skill)
  const strengths = report.gaps.filter((gap) => gap.kind === 'strength').map((gap) => gap.skill)
  const base = resume.paragraphs
  const paragraphs: ReviewParagraph[] =
    docType === 'coverLetter'
      ? base.map((text, index) => {
          const tags: ParagraphTag[] = index === 0 ? ['fix'] : index === 1 ? ['good', 'interview'] : index === 2 ? ['good'] : ['missing']
          const feedback =
            index === 0
              ? `동기가 일반적이에요. ${company.name}의 ${posting.title}에서 하는 일(${posting.summary.split('.')[0]})과 이어지는 문장으로 바꾸면 부합도가 올라요.`
              : index === 1
                ? '숫자로 개선 폭을 보여준 좋은 문단이에요. 면접에서 "어떻게 원인을 찾았는지"를 반드시 물어요. 분석 과정을 한 줄 더 적어 두면 좋아요.'
                : index === 2
                  ? '협업 방식이 구체적이에요. 이 팀이 쓰는 PR 템플릿과 비슷해서 그대로 두어도 좋아요.'
                  : `포부가 공고와 맞지만 ${missing.slice(0, 2).join(', ') || '우대 역량'}에 대한 준비 계획이 빠졌어요. 지금 공부 중인 것을 한 문장 더하면 "빠진 역량"이 "채우는 중인 역량"으로 읽혀요.`
          return { id: `${docType}-${index}`, text, tags, feedback }
        })
      : docType === 'resume'
        ? [
            { id: 'resume-0', text: `기술 스택: ${resume.skills.map((skill) => skill.name).join(', ')}`, tags: ['fix'], feedback: `나열만 되어 있어요. 공고의 필수 역량(${posting.required.slice(0, 4).join(', ')}) 순서로 앞에 두고, 각 스킬 옆에 어느 프로젝트에서 썼는지 적으면 읽는 사람이 바로 연결해요.` },
            { id: 'resume-1', text: base[1], tags: ['good', 'interview'], feedback: '성과가 숫자로 적혀 있어서 좋아요. 이 문단에서 질문이 나올 확률이 높아요.' },
            { id: 'resume-2', text: `프로젝트 경험 3건, 팀 프로젝트 2건과 개인 프로젝트 1건.`, tags: ['missing'], feedback: `팀에서 맡은 역할이 빠졌어요. 기여한 기능과 비율을 적으면 ${strengths[0] ?? '강점'}이(가) 더 설득력 있게 보여요.` },
          ]
        : [
            { id: 'portfolio-0', text: base[1], tags: ['good'], feedback: '문제, 원인, 해결, 결과가 한 문단에 다 있어요. 포트폴리오의 첫 사례로 두세요.' },
            { id: 'portfolio-1', text: '프로젝트 소개: 동아리 서비스의 전체 구조와 기술 스택 다이어그램.', tags: ['fix', 'interview'], feedback: '구조도는 좋지만 왜 이렇게 나눴는지가 없어요. 면접에서 설계 이유를 물어요. 한 문단으로 결정 이유를 더해 주세요.' },
            { id: 'portfolio-2', text: '배포와 운영: 클라우드 서버에 배포하고 운영했습니다.', tags: ['missing'], feedback: `어디에 어떻게 배포했는지, 장애가 났을 때 어떻게 대응했는지가 없어요. ${posting.preferred.find((skill) => axisOf(skill) === '인프라') ?? 'Docker'} 같은 우대 역량과 이어 쓰면 좋아요.` },
          ]
  const good = paragraphs.filter((paragraph) => paragraph.tags.includes('good')).length
  const fitScore = Math.min(100, Math.round(report.fitScore * 0.6 + (good / paragraphs.length) * 40))
  return {
    docType,
    fitScore,
    summary:
      fitScore >= 70
        ? `${docName(docType)}이(가) 공고의 핵심 역량을 대부분 건드려요. 표시된 문단만 다듬으면 돼요.`
        : `${docName(docType)}이(가) 공고의 핵심 역량과 절반쯤 이어져요. 빠진 역량에 대한 준비 계획을 더하면 부합도가 크게 올라요.`,
    paragraphs,
    appealMore: [
      `${company.name}이(가) 요즘 기술 블로그에서 다루는 주제(${posting.preferred.slice(0, 2).join(', ')})와 이어지는 경험이 있으면 한 줄 더해요.`,
      `${strengths[0] ?? '강점 스킬'}을(를) 쓴 프로젝트에서 내린 결정과 그 이유를 한 문장으로 적어요.`,
      '성과를 적을 때는 전과 후를 숫자로 나란히 두어요.',
    ],
    reviewedAt: new Date().toISOString(),
  }
}

// ---------- 예상 면접 질문 ----------

export async function fetchQuestions(reportId: string): Promise<InterviewQuestion[]> {
  await wait(1200)
  const report = reportOf(reportId)
  const posting = report ? postingOf(report.postingId) : null
  const resume = resumeOf(report?.resumeId)
  if (!report || !posting || !resume) return []
  const company = companyOf(posting.companyId)
  const random = seeded(reportId)
  const list: InterviewQuestion[] = []
  const strengths = report.gaps.filter((gap) => gap.kind === 'strength').slice(0, 3)
  const missing = report.gaps.filter((gap) => gap.kind !== 'strength' && gap.requirement === 'required').slice(0, 2)

  list.push({
    id: 'q-p1',
    question: '조회가 느려진 문제를 어떻게 발견하고, 원인을 어떤 순서로 좁혀 갔나요?',
    category: 'project',
    probability: 0.92,
    source: { type: 'paragraph', label: '자기소개서 2문단' },
    intent: '성과 뒤의 과정을 직접 했는지 확인해요.',
    answerPoints: ['모니터링이나 사용자 피드백 등 발견 경로를 먼저 말해요', '가설을 세우고 측정한 순서를 말해요', '전과 후의 숫자를 나란히 말해요'],
    followUp: '같은 문제가 다시 생기지 않게 무엇을 남겼나요?',
  })
  for (const gap of strengths) {
    list.push({
      id: `q-s-${gap.skill}`,
      question: gap.expectedQuestions[0].question,
      category: 'tech',
      probability: Math.round((0.6 + random() * 0.25) * 100) / 100,
      source: { type: 'strength', label: `강점 ${gap.skill}` },
      intent: `${gap.skill}을(를) 얼마나 깊이 이해하는지 봐요.`,
      answerPoints: gap.expectedQuestions[0].points,
      followUp: gap.expectedQuestions[1].question,
    })
  }
  for (const gap of missing) {
    list.push({
      id: `q-g-${gap.skill}`,
      question: `${gap.skill}을(를) 쓴 경험이 없는데, 입사 뒤 어떻게 익힐 계획인가요? 비슷한 개념을 다룬 경험이 있나요?`,
      category: 'tech',
      probability: Math.round((0.45 + random() * 0.2) * 100) / 100,
      source: { type: 'gap', label: `부족 ${gap.skill}` },
      intent: '빠진 필수 역량을 어떻게 메울지 봐요. 솔직함과 학습 계획을 평가해요.',
      answerPoints: ['모른다고 숨기지 않아요', '비슷한 개념을 다룬 경험을 연결해요', '지금 하고 있는 공부를 구체적으로 말해요'],
      followUp: `${gap.skill}이(가) 해결하는 문제는 무엇이라고 이해하고 있나요?`,
    })
  }
  list.push(
    {
      id: 'q-cs1',
      question: 'HTTP와 HTTPS의 차이, 그리고 TLS 핸드셰이크 과정을 설명해 주세요.',
      category: 'cs',
      probability: 0.58,
      source: { type: 'corpus', label: `${company.name} 기출 (2024)` },
      intent: '네트워크 기초를 확인하는 단골 질문이에요.',
      answerPoints: ['암호화와 인증서의 역할을 나눠 말해요', '대칭키와 비대칭키가 어디에 쓰이는지 말해요'],
      followUp: 'HTTPS를 쓰면 성능은 어떻게 달라지나요?',
    },
    {
      id: 'q-cs2',
      question: '트랜잭션 격리 수준을 설명하고, 실제로 어떤 수준을 왜 선택했는지 말해 주세요.',
      category: 'cs',
      probability: 0.51,
      source: { type: 'corpus', label: '백엔드 공통 기출' },
      intent: '데이터베이스 기초를 실무와 연결할 수 있는지 봐요.',
      answerPoints: ['네 단계와 각 단계가 막는 현상을 말해요', '기본값과 바꿔 본 경험을 말해요'],
      followUp: '데드락이 났을 때 어떻게 찾고 풀었나요?',
    },
    {
      id: 'q-b1',
      question: `${company.name} 기술 블로그에서 최근 다룬 주제 중 인상 깊었던 글이 있나요? 우리 팀이 왜 그런 선택을 했다고 생각하나요?`,
      category: 'culture',
      probability: 0.47,
      source: { type: 'blog', label: `${company.name} 기술 블로그` },
      intent: '회사에 관심이 있는지, 기술 선택의 이유를 읽을 수 있는지 봐요.',
      answerPoints: ['글 하나를 골라 핵심을 요약해요', '우리 팀의 선택 이유를 추측하고 근거를 말해요'],
      followUp: '본인이라면 다르게 했을 부분이 있나요?',
    },
    {
      id: 'q-c1',
      question: '팀원과 의견이 갈렸던 경험과, 어떻게 결론을 냈는지 말해 주세요.',
      category: 'culture',
      probability: 0.66,
      source: { type: 'paragraph', label: '자기소개서 3문단' },
      intent: '협업 방식을 봐요. PR 규칙을 만든 경험과 이어져요.',
      answerPoints: ['상황과 두 의견을 공정하게 말해요', '기준을 세워 결정한 과정을 말해요', '결과와 배운 점을 말해요'],
      followUp: '그 결정이 틀렸다는 것을 알게 되었다면 어떻게 하나요?',
    },
  )
  return list.sort((a, b) => b.probability - a.probability)
}

// ---------- 면접 연습 ----------

/** 답변을 읽고 피드백을 줘요. 답변 포인트의 낱말이 들어 있는지와 길이를 봐요. */
export async function submitAnswer(question: InterviewQuestion, answer: string): Promise<PracticeFeedback> {
  await wait(1500)
  const text = answer.trim()
  const words = text.replace(/\s+/g, ' ').split(' ').filter(Boolean).length
  const hits = question.answerPoints.filter((point) => {
    const keywords = point.replace(/[을를이가은는에서로와과의]\b/g, ' ').split(/\s+/).filter((word) => word.length >= 2)
    return keywords.some((word) => text.includes(word.slice(0, 2)))
  })
  const hasNumber = /\d/.test(text)
  const structure = /(먼저|그래서|결과|이후|때문)/.test(text)
  let score = 40 + hits.length * 15 + (hasNumber ? 10 : 0) + (structure ? 10 : 0)
  if (words < 30) score -= 15
  if (words > 220) score -= 5
  score = Math.max(20, Math.min(98, score))
  const good: string[] = []
  const improve: string[] = []
  if (structure) good.push('상황, 행동, 결과의 흐름이 보여서 따라가기 쉬워요.')
  if (hasNumber) good.push('숫자로 결과를 말해서 설득력이 있어요.')
  if (hits.length >= 2) good.push('질문의 의도에 맞는 포인트를 짚었어요.')
  if (words < 30) improve.push('답이 짧아요. 상황을 한두 문장 더 설명하면 면접관이 맥락을 잡기 쉬워요.')
  if (!hasNumber) improve.push('결과를 숫자로 말해 보세요. 전과 후를 나란히 두면 좋아요.')
  const missed = question.answerPoints.filter((point) => !hits.includes(point))
  for (const point of missed.slice(0, 2)) improve.push(`빠진 포인트: ${point}.`)
  if (good.length === 0) good.push('질문을 피하지 않고 답했어요.')
  return {
    score,
    good,
    improve: improve.length > 0 ? improve : ['이대로도 좋아요. 꼬리 질문에 대한 답도 준비해 두세요.'],
    rephrase: [`"${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"를 "먼저 상황은 ~였고, 저는 ~했으며, 그 결과 ~였습니다"의 순서로 다시 말해 보세요.`],
    followUp: question.followUp,
  }
}
