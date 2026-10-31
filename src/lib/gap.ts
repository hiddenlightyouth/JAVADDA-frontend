/**
 * 취업 갭 진단의 자료와 API예요. 공고, 기업, 이력서, 리포트(적합도와 갭), 서류 검증, 예상 면접 질문, 면접 연습이 여기 있어요.
 * 모두 백엔드(`/api/v1`)를 불러요. 화면은 이 파일의 함수와 저장소만 보고, 응답의 숫자 아이디는 글자로 바꿔 둬요.
 * 기업과 공고는 처음 그리기 전에 한 번 받아 두고(`loadCatalog`), 서버에 닿지 못하면 이 파일에 적어 둔 목록을 보여줘요.
 * 이력서, 리포트, 보완 계획, 면접 노트는 계정에 저장돼서, 로그인하면 받아 오고 로그아웃하면 비워요.
 */
import { useEffect, useRef, useState } from 'react'
import { aiModelHeaders } from './api'
import { authFetch, isSignedIn, onSignedInChange } from './auth'
import { apiUrl, readWithLoad, type ApiResult, type OnLoad } from './http'
import type { LoadTracker } from './load'
import { getLang, messages, pick } from './i18n'
import { createStore, useStore } from './store'
import { showToast } from './toast'

export type JobFamily = 'backend' | 'frontend' | 'mobile' | 'data' | 'devops'
export type CareerLevel = 'entry' | 'junior' | 'any'
type Requirement = 'required' | 'preferred'

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
  /** 기업 기술 블로그 주소. 요구 스택의 변화를 읽는 자료이고, 요약은 `blogs.ts`에 있어요. */
  techBlog?: string
  /** false면 고용24처럼 공고와 함께 들어온 기업이라 기업 버튼 줄에 보여주지 않아요. */
  featured?: boolean
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
  /** 서버가 대표 이력서로 계산한 적합도. 로그인하지 않았거나 이력서가 없으면 없어요. 화면은 `fitOf`로 다시 계산해요. */
  fitScore?: number
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

interface SkillTrend {
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
  /** 만드는 정도(0에서 100). 다 됐으면 100이에요. */
  progress?: number
  /** 지금 하고 있는 단계(queued, reading, analyzing, preparing, calculating, writing, saving, done) */
  stage?: string
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
type QuestionSource = 'paragraph' | 'gap' | 'strength' | 'blog' | 'corpus'

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
  /** 이렇게 답했으면 좋았어요. 내 답을 바탕으로 빠진 포인트를 채운 모범 답변이에요. 예전에 저장한 답변에는 없어요. */
  modelAnswer?: string | null
}

/** 저장해 둔 연습 답변 하나예요(GET /reports/{id}/questions/answers). 무엇을 물었고 뭐라고 답했고 어떤 피드백을 받았는지예요. */
export interface PracticeRecord {
  id: number
  questionId: string
  /** 답할 때의 질문 글이에요. 질문을 다시 만들어 찾을 수 없으면 빈 글이에요. */
  question: string
  answer: string
  feedback: PracticeFeedback
  createdAt: string
}

interface InterviewNote {
  skill: string
  text: string
  savedAt: string
}

/** 1부터 5까지의 숙련도를 레이더에 올릴 때 쓰는 최대값 */
export const LEVEL_MAX = 5

// ---------- 자료 ----------

/** 서버에 닿지 못했을 때 보여줄 기업이에요. 서버에 닿으면 `loadCatalog`가 `COMPANIES`를 서버의 목록으로 바꿔요. */
const FALLBACK_COMPANIES: Company[] = [
  { id: 'toss', name: '토스', initial: 'T', logo: '/logos/toss.png', industry: '핀테크', site: 'https://toss.im/company', techBlog: 'https://toss.tech' },
  { id: 'kakao', name: '카카오', initial: 'K', logo: '/logos/kakao.png', industry: '플랫폼', site: 'https://www.kakaocorp.com/page/', techBlog: 'https://tech.kakao.com' },
  { id: 'naver', name: '네이버', initial: 'N', logo: '/logos/naver.png', industry: '포털', site: 'https://www.navercorp.com', techBlog: 'https://d2.naver.com' },
  { id: 'woowa', name: '우아한형제들', initial: '우', logo: '/logos/woowa.png', industry: '푸드테크', site: 'https://www.woowahan.com', techBlog: 'https://techblog.woowahan.com' },
  { id: 'coupang', name: '쿠팡', initial: 'C', logo: '/logos/coupang.png', industry: '커머스', site: 'https://www.aboutcoupang.com', techBlog: 'https://medium.com/coupang-engineering' },
  { id: 'line', name: '라인플러스', initial: 'L', logo: '/logos/line.png', industry: '메신저', site: 'https://www.linepluscorp.com', techBlog: 'https://techblog.lycorp.co.jp/ko' },
  { id: 'daangn', name: '당근', initial: '당', logo: '/logos/daangn.png', industry: '로컬 커뮤니티', site: 'https://about.daangn.com', techBlog: 'https://medium.com/daangn' },
  { id: 'musinsa', name: '무신사', initial: 'M', logo: '/logos/musinsa.png', industry: '패션 커머스', site: 'https://www.musinsacareers.com/ko/home', techBlog: 'https://techblog.musinsa.com' },
  { id: 'dunamu', name: '두나무', initial: 'D', logo: '/logos/dunamu.png', industry: '핀테크', site: 'https://www.dunamu.com' },
  { id: 'zigbang', name: '직방', initial: 'Z', logo: '/logos/zigbang.png', industry: '프롭테크', site: 'https://career.zigbang.com', techBlog: 'https://medium.com/zigbang' },
  { id: 'wanted', name: '원티드랩', initial: 'W', logo: '/logos/wanted.png', industry: 'HR 테크', site: 'https://www.wantedlab.com', techBlog: 'https://medium.com/wantedjobs' },
  { id: 'bucketplace', name: '오늘의집', initial: '오', logo: '/logos/bucketplace.png', industry: '리빙 커머스', site: 'https://www.bucketplace.com', techBlog: 'https://www.bucketplace.com/culture/Tech/' },
]

/** 기업 목록이에요. 처음 그리기 전에 `loadCatalog`가 서버의 목록으로 채워요(배열은 그대로 두고 속만 바꿔요). */
export const COMPANIES: Company[] = [...FALLBACK_COMPANIES]

const companyById = new Map(COMPANIES.map((company) => [company.id, company]))

/** 기업 버튼 줄과 기업으로 둘러보기에 보여줄 기업이에요. 공고가 들어오며 늘어나는 기업은 공고에서만 보여요. */
export const featuredCompanies = () => COMPANIES.filter((company) => company.featured !== false)

export const companyOf = (id: string): Company => companyById.get(id) ?? { id, name: id, initial: id[0]?.toUpperCase() ?? '?', industry: '', site: '' }

/** 스킬이 어느 묶음인지. 레이더의 축이에요. */
const SKILL_AXES = ['언어', '프레임워크', '데이터베이스', '인프라', '협업', 'CS 기초'] as const
type SkillAxis = (typeof SKILL_AXES)[number]

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

const CAREER_NAMES: Record<CareerLevel, { ko: string; en: string }> = {
  entry: { ko: '신입', en: 'Entry level' },
  junior: { ko: '주니어(1년 이상)', en: 'Junior (1+ years)' },
  any: { ko: '경력 무관', en: 'Any level' },
}

export const careerName = (career: CareerLevel) => CAREER_NAMES[career][getLang()]

const DAY = 86_400_000

const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const daysLater = (days: number) => new Date(Date.now() + days * DAY).toISOString()

/** 서버에 닿지 못했을 때 보여줄 공고예요. 올린 날과 마감은 오늘을 기준으로 계산해요. */
const FALLBACK_POSTINGS: JobPosting[] = [
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


/** 공고 목록이에요. 처음 그리기 전에 `loadCatalog`가 서버의 목록으로 채워요(배열은 그대로 두고 속만 바꿔요). */
export const POSTINGS: JobPosting[] = [...FALLBACK_POSTINGS]

const postingById = new Map(POSTINGS.map((posting) => [posting.id, posting]))

export const postingOf = (id: string): JobPosting | null => postingById.get(id) ?? null

// ---------- 서버 요청 ----------

const ERRORS = messages<Record<string, string>>({
  ko: {
    C4001: 'PDF 파일만 올릴 수 있어요.',
    C4002: 'GitHub나 노션 링크만 올릴 수 있어요.',
    C4221: '서류를 읽지 못했어요. 다른 파일이나 링크로 다시 올려 주세요.',
    C413: '파일은 10MB까지 올릴 수 있어요.',
    C502: '외부 서비스에서 답을 받지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    C4003: '역량이 비어 있어요. 내 이력서에서 역량을 하나 이상 더해 주세요.',
    C4043: '이력서를 찾지 못했어요. 이력서를 먼저 올려 주세요.',
    C4092: '리포트를 아직 만들고 있어요. 잠시 뒤에 다시 시도해 주세요.',
    login: '로그인이 필요해요. 다시 로그인해 주세요.',
    network: '서버와 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    unknown: '문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
  },
  en: {
    C4001: 'Only PDF files can be uploaded.',
    C4002: 'Only GitHub or Notion links can be uploaded.',
    C4221: "We couldn't read this document. Try another file or link.",
    C413: 'Files can be up to 10MB.',
    C502: "An outside service didn't respond. Please try again in a moment.",
    C4003: 'No skills yet. Add at least one skill in My resume.',
    C4043: "We couldn't find your resume. Please upload one first.",
    C4092: 'The report is still being made. Please try again in a moment.',
    login: 'Please sign in again.',
    network: "Couldn't reach the server. Please try again in a moment.",
    unknown: 'Something went wrong. Please try again in a moment.',
  },
})

const NETWORK: ApiResult<never> = { ok: false, status: 0, data: null, code: 'network' }

/** 실패한 요청을 토스트로 알려줘요. 서버의 오류 코드가 있으면 그 말로 바꿔요. */
function fail(result: ApiResult<unknown>) {
  const text = pick(ERRORS)
  const key = result.code && text[result.code] ? result.code : result.status === 413 ? 'C413' : result.status === 401 ? 'login' : result.status === 0 ? 'network' : 'unknown'
  showToast(text[key])
}

/**
 * 로그인한 계정으로 서버를 불러요. ai면 설정 창에서 고른 AI 모델을 헤더로 붙여요. extra는 더 붙일 헤더예요(진행 아이디 등).
 * 서버에 닿지 못하면 status 0이에요. onLoad를 주면 응답을 받는 정도(0에서 1)를 알려요(`readWithLoad`).
 */
async function call<T>(path: string, init: RequestInit = {}, ai = false, extra: Record<string, string> = {}, onLoad?: OnLoad): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined), ...(ai ? await aiModelHeaders() : {}), ...extra }
    if (typeof init.body === 'string') headers['Content-Type'] = 'application/json'
    return await authFetch<T>(path, { ...init, headers }, onLoad)
  } catch {
    onLoad?.(1)
    return NETWORK
  }
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

// ---------- AI 진행 상황 ----------

/** AI가 일하는 동안의 진행 상황이에요. progress는 0에서 100, stage는 서버가 알려 주는 단계 이름이에요(reading, analyzing 등). */
export interface ProgressState {
  progress: number
  stage: string
}

export type OnProgress = (progress: ProgressState) => void

/** 처음 보여줄 진행 상황이에요. 서버가 일을 시작하기 전과 같아요. */
export const PROGRESS_START: ProgressState = { progress: 0, stage: 'waiting' }

/** 진행 상황을 다시 묻는 간격(ms)이에요. */
const PROGRESS_POLL_MS = 500
/** 다 되면 100%를 이만큼(ms) 보여준 뒤에 결과로 바꿔요. */
const PROGRESS_HOLD_MS = 250

/** 진행 상황을 물을 때 쓰는 아이디예요. 서버는 [A-Za-z0-9-]로 된 8자에서 64자를 받아요. */
function newProgressId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'p-'
  for (let index = 0; index < 30; index += 1) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

/**
 * AI 요청을 보내면서 진행 상황을 0.5초마다 물어요(GET /progress/{id}). 요청에는 X-Progress-Id 헤더로 같은 아이디를 붙여요.
 * 요청이 끝나면 묻기를 멈추고, 성공했으면 100%를 잠깐 보여준 뒤에 돌려줘요. 묻다가 실패한 것은 넘겨요.
 * 화면의 숫자가 뒤로 가지 않게 지금까지 본 값 중 가장 큰 값만 알려요. onProgress가 없으면 그냥 요청만 보내요.
 */
async function withProgress<T>(onProgress: OnProgress | undefined, run: (headers: Record<string, string>) => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  if (!onProgress) return run({})
  const id = newProgressId()
  let settled = false
  let polled = false
  let best = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const report = (next: ProgressState) => {
    if (settled) return
    best = Math.max(best, Math.min(100, Math.max(0, Math.round(next.progress))))
    onProgress({ progress: best, stage: next.stage || 'waiting' })
  }
  const poll = () => {
    timer = setTimeout(() => {
      polled = true
      void call<ProgressState & { status?: string }>(`/progress/${id}`).then((result) => {
        if (settled) return
        if (result.ok && result.data && typeof result.data.progress === 'number') report(result.data)
        poll()
      })
    }, PROGRESS_POLL_MS)
  }
  report(PROGRESS_START)
  poll()
  const result = await run({ 'X-Progress-Id': id })
  clearTimeout(timer)
  settled = true
  if (result.ok) {
    onProgress({ progress: 100, stage: 'done' })
    // 금방 끝난 요청(이미 만들어 둔 결과)은 기다리지 않고 바로 돌려줘요.
    if (polled) await new Promise((resolve) => setTimeout(resolve, PROGRESS_HOLD_MS))
  }
  return result
}

let loginHandler: (() => void) | null = null

/** 로그인이 필요한 일을 하려 할 때 부를 함수를 정해요. App이 로그인 화면을 열고, 로그인하면 보던 화면으로 돌아와요. */
export function setLoginHandler(handler: (() => void) | null) {
  loginHandler = handler
}

/** 로그인하지 않았으면 로그인 화면으로 보내고 false예요. */
function requireLogin(): boolean {
  if (isSignedIn()) return true
  loginHandler?.()
  return false
}

/** 로그인 화면으로 가요. 로그인하면 지금 화면으로 돌아와요. */
export function requestLogin() {
  loginHandler?.()
}

// ---------- 기업과 공고 ----------

type ServerCompany = Omit<Company, 'logo' | 'techBlog'> & { logo?: string | null; techBlog?: string | null }
type ServerPosting = Omit<JobPosting, 'deadline' | 'fitScore'> & { deadline?: string | null; fitScore?: number | null }

const toCompany = (item: ServerCompany): Company => ({
  ...item,
  initial: item.initial || item.name.slice(0, 1).toUpperCase(),
  logo: item.logo ?? undefined,
  techBlog: item.techBlog ?? undefined,
  site: item.site ?? '',
  industry: item.industry ?? '',
})

const toPosting = (item: ServerPosting): JobPosting => ({
  ...item,
  deadline: item.deadline ?? undefined,
  fitScore: item.fitScore ?? undefined,
  required: item.required ?? [],
  preferred: item.preferred ?? [],
  summary: item.summary ?? '',
})

/** 기업과 공고를 서버에서 받았는지예요. 아니면 이 파일에 적어 둔 목록을 보여주고, 공고 검색도 그 목록에서 해요. */
let catalogLive = false

const CATALOG_TIMEOUT_MS = 8000

/**
 * 기업과 공고를 서버에서 받아 `COMPANIES`와 `POSTINGS`를 채워요. 처음 그리기 전에 한 번 불러요(`src/main.tsx`).
 * 서버에 닿지 못하거나 오래 걸리면 적어 둔 목록 그대로 둬서 화면은 늘 그려져요.
 * tracker를 주면 두 요청을 더해 받는 정도를 알려요. 처음 화면의 진행 막대가 이것을 봐요.
 */
export async function loadCatalog(tracker?: LoadTracker): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS)
  const get = <T,>(path: string) => {
    const onLoad = tracker?.track()
    return fetch(apiUrl(path), { signal: controller.signal })
      .then((res) => readWithLoad<T>(res, onLoad))
      .catch((error: unknown) => {
        onLoad?.(1)
        throw error
      })
  }
  try {
    const [companies, postings] = await Promise.all([get<ServerCompany[]>('/companies'), get<ServerPosting[]>('/postings')])
    if (!companies.ok || !Array.isArray(companies.data) || !postings.ok || !Array.isArray(postings.data)) return
    COMPANIES.splice(0, COMPANIES.length, ...companies.data.map(toCompany))
    POSTINGS.splice(0, POSTINGS.length, ...postings.data.map(toPosting))
    companyById.clear()
    for (const company of COMPANIES) companyById.set(company.id, company)
    postingById.clear()
    for (const posting of POSTINGS) postingById.set(posting.id, posting)
    knownSkills = null
    catalogLive = true
  } catch {
    // 적어 둔 목록 그대로 보여줘요.
  } finally {
    clearTimeout(timer)
  }
}

interface PostingFilter {
  query?: string
  family?: JobFamily | null
  career?: CareerLevel | null
}

export type PostingSort = 'fit' | 'recent' | 'deadline'

/** 서버에 닿지 못했을 때 적어 둔 목록에서 찾아요. 검색어는 기업 이름, 공고 제목, 지역, 스킬에서 찾아요. */
function filterLocally(filter: PostingFilter): JobPosting[] {
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

/** 공고 목록이에요(GET /postings). 검색어, 직군, 경력으로 걸러요. 받지 못하면 오류를 내서 화면이 다시 시도 버튼을 보여줘요. */
export async function fetchPostings(filter: PostingFilter = {}, onLoad?: OnLoad): Promise<JobPosting[]> {
  if (!catalogLive) {
    onLoad?.(1)
    return filterLocally(filter)
  }
  const params = new URLSearchParams()
  const query = filter.query?.trim()
  if (query) params.set('query', query)
  if (filter.family) params.set('family', filter.family)
  if (filter.career) params.set('career', filter.career)
  const search = params.toString()
  const result = await call<ServerPosting[]>(`/postings${search ? `?${search}` : ''}`, {}, false, {}, onLoad)
  if (!result.ok || !Array.isArray(result.data)) throw new Error(result.code ?? 'postings')
  return result.data.map((item) => {
    const posting = toPosting(item)
    // 처음 그린 뒤에 올라온 공고도 postingOf로 찾을 수 있게 목록에 더해요.
    if (!postingById.has(posting.id)) {
      POSTINGS.push(posting)
      postingById.set(posting.id, posting)
    }
    return posting
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
  // 기술 블로그예요. 2026년 10월 30일에 헤더를 확인했어요.
  'd2.naver.com',
  'tech.kakao.com',
  'medium.com',
  'techblog.musinsa.com',
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

// ---------- 기업 상세 ----------

export interface CompanyQuestion {
  question: string
  category: QuestionCategory
  /** 이 질문이 나온 직군 */
  family: JobFamily
}

export interface CompanyProfile {
  company: Company
  about: string
  /** 지금 열려 있는 공고. 올라온 순서예요. */
  postings: JobPosting[]
  /** 이 기업 공고에 적힌 스킬을 레이더 축마다 묶었어요. 스킬마다 몇 개의 공고에 적혔는지 같이 있어요. */
  stack: { axis: string; skills: { skill: string; count: number }[] }[]
  questions: CompanyQuestion[]
}

/** 기업 소개 한 줄이에요. 기업 소개 사이트를 보고 줄여 적었어요. */
const COMPANY_ABOUT: Record<string, string> = {
  toss: '송금에서 시작해 증권, 은행, 결제까지 금융을 쉽게 쓰는 서비스를 만들어요.',
  kakao: '카카오톡을 중심으로 사람과 서비스를 잇는 플랫폼을 만들어요.',
  naver: '검색을 중심으로 커머스, 콘텐츠, 클라우드 서비스를 만들어요.',
  woowa: '배달의민족을 만들고, 음식 주문과 배달 경험을 다듬어요.',
  coupang: '로켓배송을 중심으로 커머스와 물류 시스템을 직접 만들어요.',
  line: '메신저 LINE과 그 위의 서비스를 글로벌 사용자에게 만들어요.',
  daangn: '동네 이웃을 잇는 중고거래와 지역 커뮤니티 서비스를 만들어요.',
  musinsa: '패션 커머스 무신사와 브랜드, 물류 서비스를 만들어요.',
  dunamu: '디지털 자산 거래소 업비트와 증권 서비스를 만들어요.',
  zigbang: '집을 구하고 사는 과정을 온라인으로 옮기는 서비스를 만들어요.',
  wanted: '채용 플랫폼 원티드와 HR 솔루션을 만들어요.',
  bucketplace: '인테리어 콘텐츠와 커머스를 잇는 오늘의집을 만들어요.',
}

/** 스킬마다 면접에서 자주 나오는 질문이에요. 기출이 쌓이기 전이라 보기 자료예요. */
const QUESTION_BANK: Record<string, { question: string; category: QuestionCategory }[]> = {
  'Spring Boot': [{ question: 'Spring의 빈 생명주기와 의존성 주입 방식을 설명해 주세요.', category: 'tech' }],
  JPA: [{ question: 'JPA에서 N+1 문제가 생기는 이유와 해결 방법을 말해 주세요.', category: 'tech' }],
  Kotlin: [{ question: 'Kotlin의 null 안정성이 Java와 어떻게 다른지 설명해 주세요.', category: 'tech' }],
  Java: [{ question: 'JVM의 메모리 구조와 GC가 동작하는 방식을 설명해 주세요.', category: 'tech' }],
  Kafka: [{ question: 'Kafka에서 메시지 순서를 보장하려면 어떻게 해야 하나요?', category: 'tech' }],
  Redis: [{ question: 'Redis를 캐시로 쓸 때 데이터 정합성을 어떻게 맞췄나요?', category: 'project' }],
  MySQL: [{ question: '인덱스가 동작하는 원리와, 인덱스를 타지 않는 경우를 말해 주세요.', category: 'tech' }],
  Kubernetes: [{ question: 'Pod가 계속 재시작될 때 어떤 순서로 원인을 찾나요?', category: 'tech' }],
  Docker: [{ question: '컨테이너와 가상 머신의 차이를 설명해 주세요.', category: 'tech' }],
  '테스트 코드': [{ question: '테스트하기 어려운 코드를 만났을 때 어떻게 구조를 바꿨나요?', category: 'project' }],
  TypeScript: [{ question: 'any와 unknown의 차이와, 타입 가드를 쓴 경험을 말해 주세요.', category: 'tech' }],
  React: [{ question: '불필요한 리렌더링을 찾고 줄인 경험을 말해 주세요.', category: 'project' }],
  'Next.js': [{ question: '서버 렌더링과 정적 생성 중 어떤 기준으로 골랐나요?', category: 'tech' }],
  Go: [{ question: '고루틴과 채널로 동시성을 다룬 경험을 말해 주세요.', category: 'tech' }],
  Python: [{ question: '데이터 파이프라인에서 실패한 작업을 다시 돌리는 방법을 설명해 주세요.', category: 'project' }],
  Swift: [{ question: 'ARC에서 순환 참조가 생기는 경우와 해결 방법을 말해 주세요.', category: 'tech' }],
  '자료구조와 알고리즘': [{ question: '해시 테이블에서 충돌이 생기면 어떻게 처리하나요?', category: 'cs' }],
  네트워크: [{ question: '브라우저에 주소를 입력하면 어떤 일이 일어나는지 순서대로 말해 주세요.', category: 'cs' }],
  운영체제: [{ question: '프로세스와 스레드의 차이, 컨텍스트 스위칭 비용을 설명해 주세요.', category: 'cs' }],
}

/** 어느 기업이든 자주 나오는 컬처핏 질문이에요. */
const CULTURE_QUESTIONS = ['우리 회사에 지원한 이유와, 입사하면 가장 먼저 해 보고 싶은 일을 말해 주세요.', '실패했던 프로젝트와 그 뒤에 바꾼 것을 말해 주세요.']

/** 기업 하나의 상세예요. `loadCatalog`가 받아 둔 기업과 공고로 소개, 열린 공고, 기술 스택, 면접 질문을 만들어요. 기술 블로그 요약은 `blogs.ts`에 있어요. 없는 기업이면 null이에요. */
export async function fetchCompany(id: string): Promise<CompanyProfile | null> {
  const company = companyById.get(id)
  if (!company) return null
  const postings = POSTINGS.filter((posting) => posting.companyId === id).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))
  const counts = new Map<string, number>()
  for (const posting of postings) for (const skill of [...posting.required, ...posting.preferred]) counts.set(skill, (counts.get(skill) ?? 0) + 1)
  const skills = [...counts].sort((a, b) => b[1] - a[1]).map(([skill, count]) => ({ skill, count }))
  const stack = SKILL_AXES.map((axis) => ({ axis: axis as string, skills: skills.filter((item) => axisOf(item.skill) === axis) })).filter((group) => group.skills.length > 0)
  const familyOf = (skill: string) => postings.find((posting) => posting.required.includes(skill) || posting.preferred.includes(skill))?.family ?? 'backend'
  const questions: CompanyQuestion[] = [
    ...skills.flatMap(({ skill }) => (QUESTION_BANK[skill] ?? []).map((item) => ({ ...item, family: familyOf(skill) }))),
    ...CULTURE_QUESTIONS.map((question) => ({ question, category: 'culture' as const, family: postings[0]?.family ?? 'backend' })),
  ].slice(0, 6)
  return { company, about: COMPANY_ABOUT[id] ?? '', postings, stack, questions }
}


// ---------- 저장소 ----------

/** 올려 둔 서류 목록과, 진단과 추천에 쓰는 대표 서류의 아이디예요. */
interface ResumeShelf {
  list: Resume[]
  primaryId: string | null
}

const EMPTY_SHELF: ResumeShelf = { list: [], primaryId: null }

const shelfStore = createStore<ResumeShelf>(EMPTY_SHELF)
const primaryOf = (shelf: ResumeShelf) => shelf.list.find((resume) => resume.id === shelf.primaryId) ?? null
const reportsStore = createStore<Report[]>([])
const notesStore = createStore<InterviewNote[]>([])
/** 보완 계획에 넣어 둔 스킬 */
const plansStore = createStore<string[]>([])

/** 대표 이력서예요. 적합도, 추천, 진단은 모두 이 서류를 기준으로 해요. */
export const useResume = () => useStore(shelfStore, primaryOf)
const getResume = () => primaryOf(shelfStore.get())
/** 올려 둔 서류 전부와 대표 서류의 아이디 */
export const useResumeShelf = () => useStore(shelfStore)
export const useReports = () => useStore(reportsStore)
export const useNotes = () => useStore(notesStore)
export const usePlans = () => useStore(plansStore)

/** 이 공고를 진단한 리포트 중 가장 최근 것이에요. 만들지 못한(failed) 리포트는 빼요. 없으면 null이에요. */
function diagnosedOf(reports: Report[], postingId: string): Report | null {
  let latest: Report | null = null
  for (const report of reports) {
    if (report.postingId !== postingId || report.status === 'failed') continue
    if (!latest || report.createdAt > latest.createdAt) latest = report
  }
  return latest
}

/** 이 공고를 이미 진단했는지예요. 공고 카드와 줄이 "진단함" 표시를 붙일 때 써요. 로그인한 계정의 리포트에서 찾아요. */
export const useDiagnosed = (postingId: string) => useStore(reportsStore, (reports) => diagnosedOf(reports, postingId))

/** 로그아웃하면 늘어나요. 로그아웃 전에 보낸 요청의 응답이 비운 저장소를 다시 채우지 않게 해요. */
let generation = 0

/** 지금 계정의 응답인지 확인하고 저장소에 넣어요. */
function keep<T>(started: number, store: { set: (value: T) => void }, value: T) {
  if (started === generation && isSignedIn()) store.set(value)
}

let syncing = false

/**
 * 로그인하면 이력서, 리포트, 보완 계획, 면접 노트를 받아 오고, 로그아웃하면 비워요. 앱을 열 때 한 번 불러요(`src/main.tsx`).
 */
export function startAccountSync() {
  if (syncing || typeof window === 'undefined') return
  syncing = true
  onSignedInChange((signedIn) => {
    if (signedIn) void loadAccount()
    else clearAccount()
  })
  if (isSignedIn()) void loadAccount()
}

async function loadAccount() {
  await Promise.all([loadShelf(), loadReports(), loadPlans(), loadNotes()])
}

function clearAccount() {
  generation += 1
  full.clear()
  replacedBy.clear()
  shelfStore.set(EMPTY_SHELF)
  reportsStore.set([])
  plansStore.set([])
  notesStore.set([])
}

async function loadPlans() {
  const started = generation
  const result = await call<string[]>('/plans')
  if (result.ok && Array.isArray(result.data)) keep(started, plansStore, result.data)
}

async function loadNotes() {
  const started = generation
  const result = await call<InterviewNote[]>('/notes')
  if (result.ok && Array.isArray(result.data)) keep(started, notesStore, result.data)
}

/** 보완 계획에 넣거나 빼요. 화면에는 바로 보이고, 서버가 돌려준 목록으로 맞춰요. */
export function togglePlan(skill: string) {
  if (!requireLogin()) return
  const before = plansStore.get()
  const adding = !before.includes(skill)
  plansStore.set(adding ? [...before, skill] : before.filter((item) => item !== skill))
  const started = generation
  void call<string[]>(`/plans/${encodeURIComponent(skill)}`, { method: adding ? 'PUT' : 'DELETE' }).then((result) => {
    if (result.ok && Array.isArray(result.data)) return keep(started, plansStore, result.data)
    if (result.ok) return
    fail(result)
    keep(started, plansStore, before)
  })
}

/** 강점 스킬의 면접 노트를 저장해요. 화면에는 바로 보여요. */
export function saveNote(skill: string, text: string) {
  if (!requireLogin()) return
  const before = notesStore.get()
  notesStore.set([...before.filter((note) => note.skill !== skill), { skill, text, savedAt: new Date().toISOString() }])
  const started = generation
  void call<InterviewNote>(`/notes/${encodeURIComponent(skill)}`, send('PUT', { text })).then((result) => {
    if (result.ok && result.data?.skill) {
      const saved = result.data
      keep(started, notesStore, [...notesStore.get().filter((note) => note.skill !== saved.skill), saved])
      return
    }
    if (result.ok) return
    fail(result)
    keep(started, notesStore, before)
  })
}

// ---------- 계산 ----------

/** 서류마다 스킬 이름과 숙련도를 한 번만 표로 만들어 둬요. 서류는 고칠 때마다 새 객체라 예전 표는 저절로 버려져요. */
const levelTables = new WeakMap<Resume, Map<string, number>>()

/** 서류에서 이 스킬을 몇으로 보는지. 없으면 0이에요. */
export function levelOf(resume: Resume | null, skill: string): number {
  if (!resume) return 0
  let table = levelTables.get(resume)
  if (!table) {
    table = new Map(resume.skills.map((item) => [item.name, item.level]))
    levelTables.set(resume, table)
  }
  return table.get(skill) ?? 0
}

/** 서류마다 공고별 적합도를 기억해요. 정렬과 카드가 같은 값을 여러 번 물어서, 한 번만 계산해요. */
const fitTables = new WeakMap<Resume, Map<string, number>>()

/** 추천(추천 공고, 새 진단 화면의 나와 잘 맞는 공고)에 넣는 적합도의 최소값이에요. 중간(50%) 아래는 낮음이라 추천하지 않아요. */
export const RECOMMEND_MIN_FIT = 50

/** 이 공고와 이력서의 적합도(0에서 100)예요. 필수 역량을 더 무겁게 봐요. 이력서가 없으면 null이에요. */
export function fitOf(posting: JobPosting, resume: Resume | null): number | null {
  if (!resume || resume.skills.length === 0) return null
  let table = fitTables.get(resume)
  if (!table) {
    table = new Map()
    fitTables.set(resume, table)
  }
  const cached = table.get(posting.id)
  if (cached !== undefined) return cached
  const score = (skills: string[]) => (skills.length === 0 ? 1 : skills.reduce((sum, skill) => sum + Math.min(1, levelOf(resume, skill) / 3), 0) / skills.length)
  const required = score(posting.required)
  const preferred = score(posting.preferred)
  const breadth = Math.min(1, resume.skills.length / 10)
  const fit = Math.round((required * 0.6 + preferred * 0.25 + breadth * 0.15) * 100)
  table.set(posting.id, fit)
  return fit
}


// ---------- 이력서 ----------

type ServerResume = Omit<Resume, 'id' | 'link'> & { id: number; link?: string | null; primary?: boolean }

const toResume = (item: ServerResume): Resume => ({
  id: String(item.id),
  name: item.name,
  source: item.source,
  link: item.link ?? undefined,
  uploadedAt: item.uploadedAt,
  skills: item.skills ?? [],
  paragraphs: item.paragraphs ?? [],
})

/** 올려 둔 서류 목록을 다시 받아요(GET /resumes). 대표는 서버가 정해요. */
async function loadShelf() {
  const started = generation
  const result = await call<{ primaryId: number | null; list: ServerResume[] }>('/resumes')
  if (!result.ok || !result.data || !Array.isArray(result.data.list)) return
  const list = result.data.list.map(toResume)
  const primary = result.data.primaryId ?? result.data.list.find((item) => item.primary)?.id ?? null
  keep(started, shelfStore, { list, primaryId: primary === null ? null : String(primary) })
}

/**
 * 이력서나 포트폴리오를 올려요. PDF 파일(POST /resumes)이나 GitHub, 노션 링크(POST /resumes/link)를 받아요.
 * 서버가 AI로 읽느라 1분 가까이 걸릴 수 있어요. onProgress를 주면 그동안의 진행 상황을 알려줘요(`withProgress`). 다 읽으면 목록을 다시 받아요. 대표는 서버가 정해요(대표가 없을 때만 새 서류가 대표예요).
 * 로그인하지 않았으면 로그인 화면으로 보내고, 실패하면 토스트로 알리고 null이에요.
 */
export async function uploadResume(input: { file?: File; link?: string }, onProgress?: OnProgress): Promise<Resume | null> {
  if (!requireLogin()) return null
  const result = await withProgress(onProgress, (headers) => {
    if (input.file) {
      const form = new FormData()
      form.append('file', input.file)
      return call<ServerResume>('/resumes', { method: 'POST', body: form }, true, headers)
    }
    return call<ServerResume>('/resumes/link', send('POST', { link: input.link }), true, headers)
  })
  if (!result.ok || !result.data) {
    fail(result)
    return null
  }
  const uploaded = toResume(result.data)
  await loadShelf()
  return shelfStore.get().list.find((resume) => resume.id === uploaded.id) ?? uploaded
}

/** 추출한 역량을 사용자가 고친 뒤에 저장해요. id가 없으면 대표 서류를 고쳐요. 화면에는 바로 보이고, 서버가 돌려준 서류로 맞춰요. */
export function saveResumeSkills(skills: ResumeSkill[], id = shelfStore.get().primaryId) {
  if (!id || !requireLogin()) return
  const replace = (resume: Resume) => {
    const shelf = shelfStore.get()
    shelfStore.set({ ...shelf, list: shelf.list.map((item) => (item.id === resume.id ? resume : item)) })
  }
  const current = shelfStore.get().list.find((resume) => resume.id === id)
  if (current) replace({ ...current, skills })
  const started = generation
  void call<ServerResume>(`/resumes/${Number(id)}/skills`, send('PUT', { skills })).then((result) => {
    if (started !== generation) return
    if (result.ok && result.data) replace(toResume(result.data))
    else if (!result.ok) {
      fail(result)
      void loadShelf()
    }
  })
}

/** 대표 이력서를 바꿔요(PUT /resumes/{id}/primary). 화면에는 바로 보이고, 끝나면 목록을 다시 받아요. */
export function setPrimaryResume(id: string) {
  if (!requireLogin()) return
  shelfStore.set({ ...shelfStore.get(), primaryId: id })
  void call<unknown>(`/resumes/${Number(id)}/primary`, { method: 'PUT' }).then((result) => {
    if (!result.ok) fail(result)
    void loadShelf()
  })
}

/** 서류를 지워요(DELETE /resumes/{id}). 대표 서류를 지우면 서버가 남은 것 중 가장 최근 것을 대표로 정해요. */
export function removeResume(id: string) {
  if (!requireLogin()) return
  const shelf = shelfStore.get()
  const list = shelf.list.filter((resume) => resume.id !== id)
  shelfStore.set({ list, primaryId: shelf.primaryId === id ? (list[0]?.id ?? null) : shelf.primaryId })
  void call<unknown>(`/resumes/${Number(id)}`, { method: 'DELETE' }).then((result) => {
    if (!result.ok) fail(result)
    void loadShelf()
  })
}

// ---------- 리포트 ----------

type ServerReport = Omit<Report, 'id' | 'resumeId'> & { id: number; resumeId: number | null }

const toReport = (item: ServerReport): Report => ({
  id: String(item.id),
  postingId: item.postingId,
  companyId: item.companyId,
  resumeId: item.resumeId === null || item.resumeId === undefined ? '' : String(item.resumeId),
  status: item.status,
  progress: item.progress ?? (item.status === 'done' ? 100 : 0),
  stage: item.stage ?? (item.status === 'done' ? 'done' : 'queued'),
  createdAt: item.createdAt,
  fitScore: item.fitScore ?? 0,
  summary: item.summary ?? '',
  breakdown: item.breakdown ?? [],
  radar: item.radar ?? [],
  gaps: item.gaps ?? [],
  trends: item.trends ?? [],
  checks: item.checks ?? [],
  courses: item.courses ?? [],
  alternatives: item.alternatives ?? [],
})

/** 상세(GET /reports/{id})까지 받아 둔 리포트의 아이디예요. 목록(GET /reports)에는 요약만 있어요. */
const full = new Set<string>()

/** 리포트가 만들어지는 동안 상태를 다시 묻는 간격(ms)이에요. 진행 막대가 부드럽게 움직이게 1초마다 물어요. */
const POLL_MS = 1000

function setReports(next: Report[]) {
  reportsStore.set(next)
}

/** 리포트를 목록에 넣어요. 이미 있으면 그 자리에서 바꾸고, 없으면 맨 앞에 더해요. 만드는 중이면 진행 숫자가 뒤로 가지 않게 해요. */
function upsertReport(report: Report) {
  const reports = reportsStore.get()
  const before = reports.find((item) => item.id === report.id)
  const next = before && report.status === 'pending' && (before.progress ?? 0) > (report.progress ?? 0) ? { ...report, progress: before.progress } : report
  setReports(before ? reports.map((item) => (item.id === next.id ? next : item)) : [next, ...reports])
}

/** 내 리포트 목록을 받아요. 상세까지 받아 둔 리포트는 그대로 둬요. */
async function loadReports() {
  const started = generation
  const result = await call<ServerReport[]>('/reports')
  if (!result.ok || !Array.isArray(result.data)) return
  const known = new Map(reportsStore.get().map((report) => [report.id, report]))
  const list = result.data.map((item) => {
    const report = toReport(item)
    return full.has(report.id) ? (known.get(report.id) ?? report) : report
  })
  keep(started, reportsStore, list)
}

/** 리포트 하나를 상세까지 받아요. 없으면(지웠거나 다른 계정) 'missing', 서버에 닿지 못하면 'error'예요. */
async function loadReport(id: string, onLoad?: OnLoad): Promise<Report | 'missing' | 'error'> {
  const started = generation
  const result = await call<ServerReport>(`/reports/${Number(id)}`, {}, false, {}, onLoad)
  if (started !== generation) return 'error'
  if (result.ok && result.data) {
    const report = toReport(result.data)
    full.add(report.id)
    upsertReport(report)
    return report
  }
  if (result.status === 401 || result.status === 403 || result.status === 404 || Number.isNaN(Number(id))) {
    if (reportsStore.get().some((report) => report.id === id)) setReports(reportsStore.get().filter((report) => report.id !== id))
    return 'missing'
  }
  return 'error'
}

let pollTimer: ReturnType<typeof setTimeout> | null = null

/** 만드는 중인 리포트가 있으면 다 될 때까지 1초마다 상태와 진행 정도를 물어요. 화면을 옮겨도 사이드바의 "진단 중 42%"가 끝까지 바뀌어요. */
function schedulePoll() {
  if (pollTimer || typeof window === 'undefined') return
  if (!reportsStore.get().some((report) => report.status === 'pending')) return
  pollTimer = setTimeout(() => {
    const pending = reportsStore.get().filter((report) => report.status === 'pending')
    void Promise.all(pending.map((report) => loadReport(report.id))).finally(() => {
      pollTimer = null
      schedulePoll()
    })
  }, POLL_MS)
}

reportsStore.subscribe(schedulePoll)

/**
 * 공고를 누르면 바로 진단해요. 대표 이력서로 이미 만든 리포트가 있으면 그것을 열고, 없으면 새로 만들어요(POST /reports, 202).
 * 서버는 만드는 중인 리포트나, 같은 공고를 이미 진단한 리포트를 돌려줘요.
 * 대표 이력서가 없거나 역량이 비어 있으면 null이에요. 그때는 화면이 서류를 올리는 칸을 보여줘요. 요청이 실패하면 'failed'예요.
 */
export async function startDiagnosis(postingId: string): Promise<Report | null | 'failed'> {
  const resume = getResume()
  if (!resume || resume.skills.length === 0 || !postingOf(postingId)) return null
  const existing = reportsStore.get().find((report) => report.postingId === postingId && report.resumeId === resume.id && report.status !== 'failed')
  if (existing) return existing
  const result = await call<ServerReport>('/reports', send('POST', { postingId }), true)
  if (!result.ok || !result.data) {
    fail(result)
    return 'failed'
  }
  const report = toReport(result.data)
  full.add(report.id)
  upsertReport(report)
  return report
}

/** 다시 진단해서 바뀐 리포트의 예전 아이디와 새 아이디예요. 앱을 여는 동안만 기억해요. */
const replacedBy = new Map<string, string>()

/** 예전 아이디면 새 아이디를 따라가요. 여러 번 다시 진단했으면 끝까지 따라가요. */
const currentId = (id: string) => {
  let next = id
  for (let hops = 0; replacedBy.has(next) && hops < 20; hops += 1) next = replacedBy.get(next)!
  return next
}

/**
 * 아이디로 리포트를 읽어요. 다시 진단해서 바뀐 아이디면 새 리포트를 돌려줘요.
 * 상세를 아직 받지 않았으면 서버에서 받아요. 받는 동안은 undefined, 없으면 null이에요.
 * 만드는 중(pending)이면 다 될 때까지 저장소가 알아서 상태를 물어요.
 * startLoad를 주면 상세를 받을 때마다(다시 물을 때도) 불러서 받은 정도를 알릴 함수를 얻어요(`useLoadProgress`의 one).
 */
export function useReport(id: string | null, startLoad?: () => OnLoad): Report | null | undefined {
  const report = useStore(reportsStore, (reports) => {
    if (!id) return null
    const target = currentId(id)
    return reports.find((item) => item.id === target) ?? null
  })
  const [missing, setMissing] = useState<string | null>(null)
  const target = id ? (report?.id ?? currentId(id)) : null
  const needsDetail = !!target && !full.has(target)
  const startLoadRef = useRef(startLoad)
  startLoadRef.current = startLoad

  useEffect(() => {
    if (!target || !needsDetail) return
    let stale = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      void loadReport(target, startLoadRef.current?.()).then((result) => {
        if (stale) return
        if (result === 'missing') setMissing(target)
        // 서버에 닿지 못했으면 잠시 뒤에 다시 물어요.
        else if (result === 'error') timer = setTimeout(load, POLL_MS * 2)
      })
    }
    load()
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [target, needsDetail])

  if (!id) return null
  if (report && !needsDetail) return report
  if (missing === target) return null
  // 목록의 요약만 있으면 상세를 받을 때까지 기다려요. 만드는 중이면 요약만으로도 진행 막대를 그려요.
  return report?.status === 'pending' ? report : undefined
}

/** 리포트를 지워요(DELETE /reports/{id}). 화면에서는 바로 빠지고, 실패하면 알리고 목록을 다시 받아요. */
export function deleteReport(id: string) {
  const target = currentId(id)
  setReports(reportsStore.get().filter((report) => report.id !== target))
  full.delete(target)
  void call<unknown>(`/reports/${Number(target)}`, { method: 'DELETE' }).then((result) => {
    if (result.ok || result.status === 404) return
    fail(result)
    void loadReports()
  })
}

/**
 * 같은 공고를 지금의 대표 이력서로 다시 진단해요(POST /reports/{id}/rerun, 202). 서버는 새 아이디의 리포트를 만들고 예전 리포트를 지워요.
 * 예전 아이디는 새 아이디로 이어 둬서, 예전 주소로 보던 화면이 빈 화면 없이 새 리포트를 그려요.
 */
export async function rerunReport(id: string): Promise<Report | null> {
  const target = currentId(id)
  const result = await call<ServerReport>(`/reports/${Number(target)}/rerun`, { method: 'POST' }, true)
  if (!result.ok || !result.data) {
    fail(result)
    return null
  }
  const next = toReport(result.data)
  full.add(next.id)
  full.delete(target)
  replacedBy.set(target, next.id)
  // 지우기와 더하기를 한 번에 해서, 그 사이에 리포트가 없는 순간이 없어요.
  setReports([next, ...reportsStore.get().filter((report) => report.id !== target && report.id !== next.id)])
  return next
}

// ---------- 서류 검증 ----------

const DOC_NAMES: Record<DocType, { ko: string; en: string }> = {
  coverLetter: { ko: '자기소개서', en: 'Cover letter' },
  resume: { ko: '이력서', en: 'Resume' },
  portfolio: { ko: '포트폴리오', en: 'Portfolio' },
}

export const docName = (doc: DocType) => DOC_NAMES[doc][getLang()]


/**
 * 서류를 공고에 맞춰 문단마다 읽어요(GET /reports/{id}/reviews/{docType}). 태그는 좋아요(good), 고쳐요(fix), 빠졌어요(missing), 면접 예상(interview)이에요.
 * AI가 읽어서 1분 가까이 걸릴 수 있어요. onProgress를 주면 진행 상황을 알려줘요. 실패하면 토스트로 알리고 null이에요. 리포트를 아직 만드는 중이면 서버가 C4092로 답해요.
 */
export async function fetchReview(reportId: string, docType: DocType, onProgress?: OnProgress): Promise<DocumentReview | null> {
  const result = await withProgress(onProgress, (headers) => call<DocumentReview>(`/reports/${Number(currentId(reportId))}/reviews/${docType}`, {}, true, headers))
  if (!result.ok || !result.data) {
    fail(result)
    return null
  }
  return { ...result.data, paragraphs: result.data.paragraphs ?? [], appealMore: result.data.appealMore ?? [] }
}

// ---------- 예상 면접 질문 ----------

/** 예상 면접 질문이에요(GET /reports/{id}/questions). 나올 확률 순서예요. onProgress를 주면 진행 상황을 알려줘요. 실패하면 토스트로 알리고 빈 목록이에요. */
export async function fetchQuestions(reportId: string, onProgress?: OnProgress): Promise<InterviewQuestion[]> {
  const result = await withProgress(onProgress, (headers) => call<InterviewQuestion[]>(`/reports/${Number(currentId(reportId))}/questions`, {}, true, headers))
  if (!result.ok || !Array.isArray(result.data)) {
    fail(result)
    return []
  }
  return [...result.data].sort((a, b) => b.probability - a.probability)
}

// ---------- 면접 연습 ----------

/** 이 리포트에서 연습한 답변이에요(GET /reports/{id}/questions/answers). 최근 것부터예요. 실패하면 조용히 빈 목록이에요(질문 목록은 그대로 보여요). */
export async function fetchAnswers(reportId: string): Promise<PracticeRecord[]> {
  const result = await call<PracticeRecord[]>(`/reports/${Number(currentId(reportId))}/questions/answers`)
  return result.ok && Array.isArray(result.data) ? result.data : []
}

/** 답변을 보내고 피드백을 받아요(POST /reports/{id}/questions/{질문}/answers). onProgress를 주면 채점 진행 상황을 알려줘요. 실패하면 토스트로 알리고 null이에요. */
export async function submitAnswer(reportId: string, question: InterviewQuestion, answer: string, onProgress?: OnProgress): Promise<PracticeFeedback | null> {
  const result = await withProgress(onProgress, (headers) =>
    call<PracticeFeedback>(`/reports/${Number(currentId(reportId))}/questions/${encodeURIComponent(question.id)}/answers`, send('POST', { answer }), true, headers),
  )
  if (!result.ok || !result.data) {
    fail(result)
    return null
  }
  return result.data
}

