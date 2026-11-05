// 공개 API(/api/public/v1)의 문서예요. 내 API 키 화면의 문서 탭(`ApiDocs`)이 그려요. 문서 문구는 합쇼체(~합니다)로 써요.
// 서버의 PublicApiController, PublicDtos와 같은 모양이라, 서버의 공개 API나 응답을 바꾸면 여기도 같이 고쳐요.

/** 표의 한 줄이에요. required는 요청 파라미터에만 써요. */
export interface Field {
  name: string
  type: string
  desc: string
  required?: boolean
}

/** 응답 안에서 되풀이되는 객체예요. 필드 표의 type에 이름을 적으면 그 표로 이어져요. */
export interface TypeDoc {
  name: string
  desc: string
  fields: Field[]
}

export interface EndpointDoc {
  /** 문서 안의 자리(목차) */
  id: string
  title: string
  scope: string
  method: 'GET'
  path: string
  desc: string[]
  pathParams?: Field[]
  query?: Field[]
  /** 응답 data의 모양 */
  response: Field[]
  /** 응답에 쓰는 객체(TYPES의 이름) */
  types: string[]
  example: { query: string; response: unknown }
  errors: [string, string][]
}

export interface Guide {
  id: string
  title: string
}

export const GUIDES: Guide[] = [
  { id: 'overview', title: '개요' },
  { id: 'start', title: '시작하기' },
  { id: 'auth', title: '인증' },
  { id: 'format', title: '응답 형식' },
  { id: 'paging', title: '페이지' },
  { id: 'limits', title: '호출 한도' },
  { id: 'errors', title: '오류 코드' },
  { id: 'values', title: '코드 값' },
]

const FAMILY = 'backend(백엔드), frontend(프론트엔드), mobile(모바일), data(데이터), devops(DevOps), other(개발 외 직무)'
const CAREER = 'entry(신입), junior(주니어), any(경력 무관)'
const CATEGORY = 'service(자체 서비스), saas(B2B SaaS), commerce(커머스), finance(핀테크와 금융), ai(AI와 데이터), it-service(IT 서비스와 SI), manufacturing(제조와 산업), public(공공기관), other(기타)'

export const CODE_VALUES: { name: string; values: [string, string][] }[] = [
  {
    name: '직군(family)',
    values: [
      ['backend', '백엔드'],
      ['frontend', '프론트엔드'],
      ['mobile', '모바일'],
      ['data', '데이터'],
      ['devops', 'DevOps'],
      ['other', '개발이 아닌 직무(기획, 디자인, 영업, 사무 등)'],
    ],
  },
  {
    name: '경력(career)',
    values: [
      ['entry', '신입'],
      ['junior', '주니어'],
      ['any', '경력 무관'],
    ],
  },
  {
    name: '기업 분류(category)',
    values: [
      ['service', '자체 서비스'],
      ['saas', 'B2B SaaS'],
      ['commerce', '커머스'],
      ['finance', '핀테크와 금융'],
      ['ai', 'AI와 데이터'],
      ['it-service', 'IT 서비스와 SI'],
      ['manufacturing', '제조와 산업'],
      ['public', '공공기관'],
      ['other', '기타'],
    ],
  },
  {
    name: '공고 출처(source)',
    values: [
      ['company', '기업 채용 페이지'],
      ['worknet', '고용24(워크넷)'],
      ['public', '공공기관 채용 정보'],
    ],
  },
  {
    name: '스킬 축(axis)',
    values: [
      ['언어', 'Java, Python, TypeScript 등'],
      ['프레임워크', 'Spring Boot, React, Django 등'],
      ['데이터베이스', 'MySQL, Redis 등'],
      ['인프라', 'AWS, Docker, Kubernetes 등'],
      ['협업', 'Git, 커뮤니케이션 등'],
      ['CS 기초', '자료구조, 운영체제, 네트워크 등'],
    ],
  },
  {
    name: '공모전 분야(categories)',
    values: [
      ['it', 'IT와 소프트웨어'],
      ['idea', '기획과 아이디어'],
      ['startup', '창업과 취업'],
      ['science', '과학과 공학'],
      ['design', '디자인'],
      ['marketing', '광고와 마케팅'],
      ['video', '영상과 사진'],
      ['naming', '네이밍과 슬로건'],
      ['writing', '문학과 글'],
      ['thesis', '논문과 학술'],
      ['arts', '예체능'],
      ['etc', '기타'],
    ],
  },
  {
    name: '공모전 상태(status)',
    values: [
      ['open', '접수 중'],
      ['upcoming', '접수 예정'],
      ['closed', '마감. 개별 공모전과 새 공모전에서만 나옵니다.'],
    ],
  },
]

/** 모든 요청에 같이 보내는 헤더예요. */
export const HEADERS: Field[] = [
  { name: 'X-API-Key', type: 'String', desc: '승인된 API 키(jvd_로 시작)', required: true },
]

const pageQuery: Field[] = [
  { name: 'page', type: 'Integer', desc: '페이지(0부터, 기본 0)' },
  { name: 'size', type: 'Integer', desc: '페이지 크기(최대 100, 기본 20)' },
]

export const TYPES: TypeDoc[] = [
  {
    name: 'Page',
    desc: '',
    fields: [
      { name: 'items', type: 'Array', desc: '이 페이지의 항목' },
      { name: 'page', type: 'Integer', desc: '지금 페이지(0부터)' },
      { name: 'size', type: 'Integer', desc: '요청한 페이지 크기' },
      { name: 'total', type: 'Long', desc: '조건에 맞는 전체 항목 수' },
      { name: 'hasNext', type: 'Boolean', desc: '다음 페이지가 있는지' },
    ],
  },
  {
    name: 'Posting',
    desc: '',
    fields: [
      { name: 'id', type: 'String', desc: '공고 아이디' },
      { name: 'company', type: 'CompanyRef', desc: '공고를 낸 기업' },
      { name: 'title', type: 'String', desc: '공고 제목' },
      { name: 'family', type: 'String', desc: `직군. ${FAMILY}` },
      { name: 'career', type: 'String', desc: `경력. ${CAREER}` },
      { name: 'location', type: 'String', desc: '근무지. 공고에 적힌 그대로(예: 서울 송파)' },
      { name: 'postedAt', type: 'Datetime', desc: '공고가 올라온 때' },
      { name: 'deadline', type: 'Datetime', desc: '마감 시각. null이면 상시 채용' },
      { name: 'required', type: 'String[]', desc: '필수 역량' },
      { name: 'preferred', type: 'String[]', desc: '우대 역량' },
      { name: 'summary', type: 'String', desc: '공고를 요약한 한두 문장' },
      { name: 'url', type: 'String', desc: '공고 원문 주소' },
      { name: 'source', type: 'String', desc: '모은 곳. company(기업 채용 페이지), worknet(고용24), public(공공기관)' },
      { name: 'closedAt', type: 'Datetime', desc: '채용이 닫힌 때. 열린 공고는 null' },
    ],
  },
  {
    name: 'CompanyRef',
    desc: '',
    fields: [
      { name: 'id', type: 'String', desc: '기업 아이디' },
      { name: 'name', type: 'String', desc: '기업 이름' },
    ],
  },
  {
    name: 'Company',
    desc: '',
    fields: [
      { name: 'id', type: 'String', desc: '기업 아이디' },
      { name: 'name', type: 'String', desc: '기업 이름' },
      { name: 'logo', type: 'String', desc: '로고 이미지 주소' },
      { name: 'industry', type: 'String', desc: '업종' },
      { name: 'category', type: 'String', desc: `사업 분류. ${CATEGORY}` },
      { name: 'site', type: 'String', desc: '기업 소개 사이트 주소' },
      { name: 'techBlog', type: 'String', desc: '기술 블로그 주소' },
      { name: 'openPostings', type: 'Integer', desc: '지금 열려 있는 공고 수' },
    ],
  },
  {
    name: 'Skill',
    desc: '',
    fields: [
      { name: 'name', type: 'String', desc: '스킬 이름(하나로 모은 표기, 예: Spring Boot)' },
      { name: 'axis', type: 'String', desc: '축. 언어, 프레임워크, 데이터베이스, 인프라, 협업, CS 기초' },
      { name: 'aliases', type: 'String[]', desc: '같은 스킬로 보는 다른 표기(예: 스프링, springboot)' },
      { name: 'share', type: 'Double', desc: '같은 직군 공고 중 이 스킬을 적은 비율(0에서 1)' },
      { name: 'change', type: 'Integer', desc: '최근 6개월 비율 변화(%p)' },
      { name: 'courses', type: 'Course[]', desc: '추천 강의. 목록에서는 null' },
    ],
  },
  {
    name: 'Course',
    desc: '',
    fields: [
      { name: 'id', type: 'String', desc: '강의 아이디' },
      { name: 'title', type: 'String', desc: '강의 제목' },
      { name: 'provider', type: 'String', desc: '강의 플랫폼(예: 인프런)' },
      { name: 'level', type: 'String', desc: '난이도' },
      { name: 'hours', type: 'Integer', desc: '강의 시간' },
      { name: 'url', type: 'String', desc: '강의 주소' },
    ],
  },
  {
    name: 'Stats',
    desc: '',
    fields: [
      { name: 'openPostings', type: 'Long', desc: '열린 공고 수' },
      { name: 'postedThisWeek', type: 'Long', desc: '최근 7일 안에 올라온 공고 수' },
      { name: 'closingThisWeek', type: 'Long', desc: '앞으로 7일 안에 마감하는 공고 수' },
      { name: 'rolling', type: 'Long', desc: '마감이 없는 상시 채용 공고 수' },
      { name: 'byFamily', type: 'Count[]', desc: '직군별 공고 수(많은 순서)' },
      { name: 'byCareer', type: 'Count[]', desc: '경력별 공고 수' },
      { name: 'byCategory', type: 'Count[]', desc: '기업 분류별 공고 수. 모르면 unknown' },
      { name: 'topCompanies', type: 'CompanyCount[]', desc: '공고가 많은 기업 20곳' },
      { name: 'requiredSkills', type: 'SkillCount[]', desc: '필수 역량으로 많이 적힌 30개' },
      { name: 'preferredSkills', type: 'SkillCount[]', desc: '우대 역량으로 많이 적힌 30개' },
      { name: 'generatedAt', type: 'Datetime', desc: '계산한 때' },
    ],
  },
  { name: 'Count', desc: '', fields: [{ name: 'key', type: 'String', desc: '코드 값(예: backend)' }, { name: 'count', type: 'Long', desc: '공고 수' }] },
  {
    name: 'CompanyCount',
    desc: '',
    fields: [
      { name: 'id', type: 'String', desc: '기업 아이디' },
      { name: 'name', type: 'String', desc: '기업 이름' },
      { name: 'count', type: 'Long', desc: '열린 공고 수' },
    ],
  },
  {
    name: 'SkillCount',
    desc: '',
    fields: [
      { name: 'skill', type: 'String', desc: '역량(스킬 사전의 표기로 모은 이름)' },
      { name: 'count', type: 'Long', desc: '이 역량을 적은 공고 수' },
      { name: 'share', type: 'Double', desc: '열린 공고 중 비율(0에서 1, 소수 셋째 자리까지)' },
    ],
  },
  {
    name: 'BlogDigest',
    desc: '',
    fields: [
      { name: 'companyId', type: 'String', desc: '기업 아이디' },
      { name: 'blog', type: 'String', desc: '블로그 주소' },
      { name: 'platform', type: 'String', desc: '블로그 이름(예: 토스 테크)' },
      { name: 'headline', type: 'String', desc: '요즘 고민 한 문장' },
      { name: 'analysis', type: 'String', desc: '최근 글의 흐름을 정리한 한 문단' },
      { name: 'concerns', type: 'BlogConcern[]', desc: '요즘 고민 주제' },
      { name: 'interview', type: 'String[]', desc: '서류와 면접에서 쓸 만한 점' },
      { name: 'posts', type: 'BlogPost[]', desc: '글(최신 글부터)' },
    ],
  },
  {
    name: 'BlogConcern',
    desc: '',
    fields: [
      { name: 'title', type: 'String', desc: '고민 제목' },
      { name: 'body', type: 'String', desc: '고민 설명' },
      { name: 'posts', type: 'String[]', desc: '이 고민이 드러난 글의 아이디' },
    ],
  },
  {
    name: 'BlogPost',
    desc: '',
    fields: [
      { name: 'id', type: 'String', desc: '글 아이디' },
      { name: 'title', type: 'String', desc: '글 제목' },
      { name: 'url', type: 'String', desc: '글 주소' },
      { name: 'date', type: 'Date', desc: '올린 날' },
      { name: 'summary', type: 'String', desc: '글을 요약한 두 문장' },
      { name: 'themes', type: 'String[]', desc: '주제 아이디(예: ai-agent, llm-cost)' },
      { name: 'skills', type: 'String[]', desc: '글에 나온 기술' },
    ],
  },
  {
    name: 'BlogOutlook',
    desc: '',
    fields: [
      { name: 'headline', type: 'String', desc: '요즘 기업들의 고민 한 문장' },
      { name: 'summary', type: 'String', desc: '흐름과 채용 예측 한 문단' },
      { name: 'themes', type: 'OutlookTheme[]', desc: '많이 다룬 주제' },
      { name: 'skills', type: 'OutlookSkill[]', desc: '따라가려면 필요한 역량' },
      { name: 'generatedAt', type: 'Datetime', desc: '쓴 때' },
    ],
  },
  {
    name: 'OutlookTheme',
    desc: '',
    fields: [
      { name: 'theme', type: 'String', desc: '주제 아이디' },
      { name: 'concern', type: 'String', desc: '기업들이 이 주제로 무엇을 고민하는지' },
      { name: 'prepare', type: 'String', desc: '취업 준비생이 지금 해 볼 준비' },
      { name: 'companies', type: 'String[]', desc: '최근 넉 달에 이 주제로 글을 쓴 기업 아이디' },
      { name: 'rising', type: 'Boolean', desc: '최근 두 달의 글이 그 전 두 달보다 많은지' },
    ],
  },
  {
    name: 'OutlookSkill',
    desc: '',
    fields: [
      { name: 'skill', type: 'String', desc: '역량' },
      { name: 'reason', type: 'String', desc: '왜 필요한지 한 문장' },
      { name: 'postings', type: 'Integer', desc: '이 역량을 필수나 우대로 적은 열린 공고 수' },
    ],
  },
  {
    name: 'Contest',
    desc: '',
    fields: [
      { name: 'id', type: 'String', desc: '공모전 아이디' },
      { name: 'title', type: 'String', desc: '공모전 이름' },
      { name: 'organizer', type: 'String', desc: '주최' },
      { name: 'categories', type: 'String[]', desc: '분야(코드 값의 공모전 분야)' },
      { name: 'startDate', type: 'Date', desc: '접수 시작일' },
      { name: 'deadline', type: 'Date', desc: '접수 마감일' },
      { name: 'daysLeft', type: 'Integer', desc: '마감까지 남은 날. 오늘 마감이면 0, 마감했으면 음수' },
      { name: 'status', type: 'String', desc: 'open(접수 중), upcoming(접수 예정), closed(마감)' },
      { name: 'imageUrl', type: 'String', desc: '포스터 이미지 주소' },
      { name: 'prize', type: 'String', desc: '상금이나 혜택' },
      { name: 'links', type: 'ContestLink[]', desc: '공모전을 올린 사이트와 주소' },
      { name: 'firstSeenAt', type: 'Datetime', desc: '처음 모은 때' },
    ],
  },
  {
    name: 'ContestCategoryCount',
    desc: '',
    fields: [
      { name: 'category', type: 'String', desc: '분야(코드 값의 공모전 분야)' },
      { name: 'count', type: 'Long', desc: '마감하지 않은 공모전 수(접수 예정 포함)' },
      { name: 'open', type: 'Long', desc: '그중 지금 접수 중인 수' },
    ],
  },
  {
    name: 'ContestLink',
    desc: '',
    fields: [
      { name: 'site', type: 'String', desc: 'linkareer, campuspick, wevity, thinkgood' },
      { name: 'url', type: 'String', desc: '그 사이트의 공모전 주소' },
    ],
  },
]

const POSTING_EXAMPLE = {
  id: 'daangn-8043876003',
  company: { id: 'daangn', name: '당근' },
  title: '[산업기능요원 집중 채용 캠페인] Software Engineer, Backend',
  family: 'backend',
  career: 'any',
  location: '서울',
  postedAt: '2026-10-27T15:50:29',
  deadline: null,
  required: ['자료구조와 알고리즘', '운영체제', '네트워크', '데이터베이스'],
  preferred: ['성능 최적화', 'MSA', 'gRPC', 'Apache Kafka'],
  summary: '대규모 트래픽을 처리하는 백엔드 서비스를 설계, 개발, 운영하고 안정성과 성능을 개선해요.',
  url: 'https://careers.daangn.com/jobs/role/8043876003/',
  source: 'company',
  closedAt: null,
}

const COMPANY_EXAMPLE = {
  id: 'toss',
  name: '토스',
  logo: 'https://javadda.hidly.dev/logos/toss.png',
  industry: '핀테크',
  category: 'finance',
  site: 'https://toss.im/company',
  techBlog: 'https://toss.tech',
  openPostings: 134,
}

const CONTEST_EXAMPLE = {
  id: 'c-02c736edd44ff64dee714dc9',
  title: '2026 관광 데이터 활용 공모전',
  organizer: '한국관광공사',
  categories: ['it', 'idea'],
  startDate: '2026-10-20',
  deadline: '2026-11-12',
  daysLeft: 7,
  status: 'open',
  imageUrl: null,
  prize: '총상금 2,000만 원',
  links: [{ site: 'wevity', url: 'https://www.wevity.com/?c=find&s=1&gbn=view&ix=112025' }],
  firstSeenAt: '2026-11-03T09:49:18',
}

const NOT_FOUND: [string, string] = ['C404', '없는 아이디입니다(404).']
const BAD_PARAM: [string, string] = ['C002', '파라미터 값이 잘못되었습니다(400).']

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: 'postings',
    title: '공고 목록',
    scope: 'postings:read',
    method: 'GET',
    path: '/postings',
    desc: ['열려 있는 공고를 검색합니다. 경력을 고르면 경력 무관 공고도 같이 나옵니다.'],
    query: [
      { name: 'query', type: 'String', desc: '기업, 제목, 근무지, 역량에서 찾을 말' },
      { name: 'family', type: 'String', desc: `직군. ${FAMILY}` },
      { name: 'career', type: 'String', desc: `경력. ${CAREER}` },
      { name: 'company', type: 'String', desc: '기업 아이디' },
      { name: 'sort', type: 'String', desc: 'recent(최신순, 기본), deadline(마감순)' },
      ...pageQuery,
    ],
    response: [{ name: 'data', type: 'Page', desc: 'items가 Posting[]인 목록' }],
    types: ['Page', 'Posting', 'CompanyRef'],
    example: { query: '/postings?family=backend&career=entry&size=1', response: { items: [POSTING_EXAMPLE], page: 0, size: 1, total: 9, hasNext: true } },
    errors: [BAD_PARAM],
  },
  {
    id: 'posting',
    title: '개별 공고',
    scope: 'postings:read',
    method: 'GET',
    path: '/postings/{id}',
    desc: ['닫힌 공고도 조회할 수 있습니다.'],
    pathParams: [{ name: 'id', type: 'String', desc: '공고 아이디', required: true }],
    response: [{ name: 'data', type: 'Posting', desc: '공고' }],
    types: ['Posting', 'CompanyRef'],
    example: { query: '/postings/daangn-8043876003', response: POSTING_EXAMPLE },
    errors: [['C4042', '없는 공고입니다(404).']],
  },
  {
    id: 'companies',
    title: '기업 목록',
    scope: 'companies:read',
    method: 'GET',
    path: '/companies',
    desc: [],
    query: [
      { name: 'query', type: 'String', desc: '기업 이름에서 찾을 말' },
      { name: 'category', type: 'String', desc: `사업 분류. ${CATEGORY}` },
      ...pageQuery,
    ],
    response: [{ name: 'data', type: 'Page', desc: 'items가 Company[]인 목록' }],
    types: ['Page', 'Company'],
    example: { query: '/companies?query=토스&size=1', response: { items: [COMPANY_EXAMPLE], page: 0, size: 1, total: 2, hasNext: true } },
    errors: [BAD_PARAM],
  },
  {
    id: 'company',
    title: '개별 기업',
    scope: 'companies:read',
    method: 'GET',
    path: '/companies/{id}',
    desc: [],
    pathParams: [{ name: 'id', type: 'String', desc: '기업 아이디', required: true }],
    response: [{ name: 'data', type: 'Company', desc: '기업' }],
    types: ['Company'],
    example: { query: '/companies/toss', response: COMPANY_EXAMPLE },
    errors: [NOT_FOUND],
  },
  {
    id: 'skills',
    title: '스킬 사전',
    scope: 'skills:read',
    method: 'GET',
    path: '/skills',
    desc: [],
    query: [{ name: 'axis', type: 'String', desc: '축. 언어, 프레임워크, 데이터베이스, 인프라, 협업, CS 기초' }],
    response: [{ name: 'data', type: 'Skill[]', desc: '스킬 목록(courses는 null)' }],
    types: ['Skill'],
    example: {
      query: '/skills?axis=프레임워크',
      response: [{ name: 'Spring Boot', axis: '프레임워크', aliases: ['spring', 'springboot', '스프링', '스프링부트'], share: 0.88, change: 2, courses: null }],
    },
    errors: [],
  },
  {
    id: 'skill',
    title: '개별 스킬',
    scope: 'skills:read',
    method: 'GET',
    path: '/skills/{name}',
    desc: ['별칭(스프링, k8s)으로도 조회할 수 있습니다.'],
    pathParams: [{ name: 'name', type: 'String', desc: '스킬 이름이나 별칭(URL 인코딩)', required: true }],
    response: [{ name: 'data', type: 'Skill', desc: '스킬(courses 포함)' }],
    types: ['Skill', 'Course'],
    example: {
      query: '/skills/스프링',
      response: { name: 'Spring Boot', axis: '프레임워크', aliases: ['spring', 'springboot', '스프링', '스프링부트'], share: 0.88, change: 2, courses: [] },
    },
    errors: [NOT_FOUND],
  },
  {
    id: 'stats',
    title: '채용 통계',
    scope: 'stats:read',
    method: 'GET',
    path: '/stats/postings',
    desc: ['지금 열린 공고로 호출할 때마다 계산합니다.'],
    response: [{ name: 'data', type: 'Stats', desc: '통계' }],
    types: ['Stats', 'Count', 'CompanyCount', 'SkillCount'],
    example: {
      query: '/stats/postings',
      response: {
        openPostings: 776,
        postedThisWeek: 91,
        closingThisWeek: 308,
        rolling: 337,
        byFamily: [{ key: 'other', count: 693 }, { key: 'data', count: 38 }, { key: 'backend', count: 19 }],
        byCareer: [{ key: 'any', count: 363 }, { key: 'junior', count: 221 }, { key: 'entry', count: 192 }],
        byCategory: [{ key: 'public', count: 291 }, { key: 'finance', count: 146 }],
        topCompanies: [{ id: 'toss', name: '토스', count: 134 }, { id: 'coupang', name: '쿠팡', count: 55 }],
        requiredSkills: [{ skill: '커뮤니케이션', count: 63, share: 0.081 }, { skill: '데이터 분석', count: 27, share: 0.035 }],
        preferredSkills: [{ skill: '장애인', count: 113, share: 0.146 }, { skill: '취업지원대상자', count: 108, share: 0.139 }],
        generatedAt: '2026-11-05T13:40:21',
      },
    },
    errors: [],
  },
  {
    id: 'blogs',
    title: '기술 블로그 요약',
    scope: 'blogs:read',
    method: 'GET',
    path: '/blogs',
    desc: ['매일 새벽 새 글을 모아 AI가 다시 작성합니다.'],
    response: [{ name: 'data', type: 'BlogDigest[]', desc: '기업마다 하나' }],
    types: ['BlogDigest', 'BlogConcern', 'BlogPost'],
    example: {
      query: '/blogs',
      response: [
        {
          companyId: 'toss',
          blog: 'https://toss.tech',
          platform: '토스 테크',
          headline: '토스는 AI와 공통 플랫폼의 활용을 넓히면서, 늘어나는 비용과 운영 부담을 줄이는 방법을 고민하고 있어요.',
          analysis: '최근 글에서는 AI를 도입하는 데서 그치지 않고, 호출 비용과 응답 지연을 줄이는 흐름이 보여요.',
          concerns: [{ title: 'AI를 반복해서 쓰기 좋은 기반', body: '서비스마다 반복되는 모델 연동과 권한 관리를 공통 플랫폼으로 옮기고 있어요.', posts: ['toss-llm-cost'] }],
          interview: ['AI를 도입했다는 설명보다 어떤 반복 업무를 줄였고 결과를 어떻게 확인했는지 쓰면 좋아요.'],
          posts: [
            {
              id: 'toss-llm-cost',
              title: '손가락 튕기기로 LLM 비용 줄이기',
              url: 'https://toss.tech/article/snap-llm-cost-reduction',
              date: '2026-10-27',
              summary: '대용량 호출에서 드러나는 비용과 응답 지연 문제를 다뤄요.',
              themes: ['llm-cost'],
              skills: ['LLM', 'Python'],
            },
          ],
        },
      ],
    },
    errors: [],
  },
  {
    id: 'outlook',
    title: '기술 블로그 총정리',
    scope: 'blogs:read',
    method: 'GET',
    path: '/blogs/outlook',
    desc: ['아직 작성되지 않았으면 data가 null입니다.'],
    response: [{ name: 'data', type: 'BlogOutlook', desc: '총정리. 없으면 null' }],
    types: ['BlogOutlook', 'OutlookTheme', 'OutlookSkill'],
    example: {
      query: '/blogs/outlook',
      response: {
        headline: '요즘 기업들은 AI를 업무와 서비스에 연결하면서, 결과를 믿고 맡길 수 있도록 검증 체계를 갖추는 데 고민하고 있어요.',
        summary: '에이전트가 업무 기준을 이해하고 실제 도구를 실행하도록 만드는 흐름이 보여요.',
        themes: [
          {
            theme: 'ai-agent',
            concern: '에이전트가 업무 기준에 맞게 도구를 실행하고 믿을 수 있는 결과를 내도록 고민하고 있어요.',
            prepare: '공개 데이터를 조회하는 작은 에이전트를 만들고 실패 사례를 모아 개선해 보세요.',
            companies: ['kakao', 'line', 'toss'],
            rising: true,
          },
        ],
        skills: [{ skill: 'SQL', reason: '분석 에이전트가 만든 쿼리의 결과를 직접 확인하려면 필요해요.', postings: 44 }],
        generatedAt: '2026-11-03T01:00:11',
      },
    },
    errors: [],
  },
  {
    id: 'contests',
    title: '공모전 목록',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests',
    desc: ['마감하지 않은 공모전입니다. 접수 예정도 포함합니다.'],
    query: [
      { name: 'query', type: 'String', desc: '공모전 이름이나 주최에서 찾을 말' },
      { name: 'category', type: 'String', desc: '분야. 코드 값의 공모전 분야' },
      { name: 'status', type: 'String', desc: 'all(기본), open, upcoming' },
      { name: 'sort', type: 'String', desc: 'deadline(마감순, 기본), recent(최신순)' },
      ...pageQuery,
    ],
    response: [{ name: 'data', type: 'Page', desc: 'items가 Contest[]인 목록' }],
    types: ['Page', 'Contest', 'ContestLink'],
    example: { query: '/contests?category=it&size=1', response: { items: [CONTEST_EXAMPLE], page: 0, size: 1, total: 48, hasNext: true } },
    errors: [BAD_PARAM],
  },
  {
    id: 'contests-open',
    title: '접수 중인 공모전',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests/open',
    desc: ['공모전 목록에 status=open을 준 것과 같습니다.'],
    query: [
      { name: 'query', type: 'String', desc: '공모전 이름이나 주최에서 찾을 말' },
      { name: 'category', type: 'String', desc: '분야. 코드 값의 공모전 분야' },
      { name: 'sort', type: 'String', desc: 'deadline(마감순, 기본), recent(최신순)' },
      ...pageQuery,
    ],
    response: [{ name: 'data', type: 'Page', desc: 'items가 Contest[]인 목록' }],
    types: ['Page', 'Contest', 'ContestLink'],
    example: { query: '/contests/open?size=1', response: { items: [CONTEST_EXAMPLE], page: 0, size: 1, total: 212, hasNext: true } },
    errors: [BAD_PARAM],
  },
  {
    id: 'contests-upcoming',
    title: '접수 예정 공모전',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests/upcoming',
    desc: ['접수 시작일이 가까운 순서입니다.'],
    query: [
      { name: 'query', type: 'String', desc: '공모전 이름이나 주최에서 찾을 말' },
      { name: 'category', type: 'String', desc: '분야. 코드 값의 공모전 분야' },
      ...pageQuery,
    ],
    response: [{ name: 'data', type: 'Page', desc: 'items가 Contest[]인 목록' }],
    types: ['Page', 'Contest', 'ContestLink'],
    example: {
      query: '/contests/upcoming?size=1',
      response: { items: [{ ...CONTEST_EXAMPLE, startDate: '2026-11-10', daysLeft: 25, deadline: '2026-11-30', status: 'upcoming' }], page: 0, size: 1, total: 6, hasNext: true },
    },
    errors: [BAD_PARAM],
  },
  {
    id: 'contests-closing',
    title: '마감 임박 공모전',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests/closing',
    desc: ['마감일을 모르는 공모전은 뺍니다.'],
    query: [
      { name: 'days', type: 'Integer', desc: '오늘부터 며칠 안에 마감하는지(0에서 90, 기본 7). 0이면 오늘 마감' },
      { name: 'query', type: 'String', desc: '공모전 이름이나 주최에서 찾을 말' },
      { name: 'category', type: 'String', desc: '분야. 코드 값의 공모전 분야' },
      ...pageQuery,
    ],
    response: [{ name: 'data', type: 'Page', desc: 'items가 Contest[]인 목록' }],
    types: ['Page', 'Contest', 'ContestLink'],
    example: {
      query: '/contests/closing?days=3&size=1',
      response: { items: [{ ...CONTEST_EXAMPLE, deadline: '2026-11-05', daysLeft: 0 }], page: 0, size: 1, total: 27, hasNext: true },
    },
    errors: [BAD_PARAM],
  },
  {
    id: 'contests-new',
    title: '새로 올라온 공모전',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests/new',
    desc: ['날짜를 주지 않으면 오늘 모은 공모전입니다.'],
    query: [
      { name: 'date', type: 'Date', desc: '하루. from, to와 같이 쓸 수 없음' },
      { name: 'from', type: 'Date', desc: '시작일(포함). to가 없으면 오늘까지' },
      { name: 'to', type: 'Date', desc: '끝일(포함). 기간은 31일까지' },
      { name: 'category', type: 'String', desc: '분야. 코드 값의 공모전 분야' },
      ...pageQuery,
    ],
    response: [{ name: 'data', type: 'Page', desc: 'items가 Contest[]인 목록' }],
    types: ['Page', 'Contest', 'ContestLink'],
    example: { query: '/contests/new?date=2026-11-03&size=1', response: { items: [CONTEST_EXAMPLE], page: 0, size: 1, total: 14, hasNext: true } },
    errors: [['C002', '날짜 형식, date와 기간을 같이 줌, 31일 초과(400).'], BAD_PARAM],
  },
  {
    id: 'contests-categories',
    title: '분야별 공모전 수',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests/categories',
    desc: ['여러 분야에 걸친 공모전은 분야마다 셉니다.'],
    response: [{ name: 'data', type: 'ContestCategoryCount[]', desc: '분야마다 하나' }],
    types: ['ContestCategoryCount'],
    example: {
      query: '/contests/categories',
      response: [
        { category: 'it', count: 48, open: 45 },
        { category: 'idea', count: 61, open: 58 },
        { category: 'startup', count: 22, open: 20 },
      ],
    },
    errors: [],
  },
  {
    id: 'contest',
    title: '개별 공모전',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests/{id}',
    desc: ['마감 뒤 7일이 지나면 404입니다.'],
    pathParams: [{ name: 'id', type: 'String', desc: '공모전 아이디(c-로 시작)', required: true }],
    response: [{ name: 'data', type: 'Contest', desc: '공모전' }],
    types: ['Contest', 'ContestLink'],
    example: { query: '/contests/c-02c736edd44ff64dee714dc9', response: CONTEST_EXAMPLE },
    errors: [NOT_FOUND],
  },
]

/** 모든 API에 공통인 오류예요. [HTTP 상태, 코드, 뜻] */
export const COMMON_ERRORS: [string, string, string][] = [
  ['401', 'C4014', 'X-API-Key 헤더가 없습니다.'],
  ['401', 'C4015', '존재하지 않는 키입니다.'],
  ['403', 'C4031', '아직 승인되지 않았거나 해지한 키입니다.'],
  ['403', 'C4032', '사용 기간이 끝난 키입니다.'],
  ['403', 'C4033', '이 API의 권한이 없는 키입니다.'],
  ['429', 'C429', '호출 한도를 초과했습니다. Retry-After 초 뒤에 다시 호출하십시오.'],
  ['400', 'C002', '파라미터 값이 잘못되었습니다.'],
  ['404', 'C404, C4042', '찾는 자료가 없습니다.'],
  ['500', 'C500', '서버 오류입니다.'],
]

/** 응답 헤더예요. */
export const RESPONSE_HEADERS: Field[] = [
  { name: 'X-RateLimit-Limit', type: 'Integer', desc: '이 키의 하루 호출 한도' },
  { name: 'X-RateLimit-Remaining', type: 'Integer', desc: '오늘(한국 시각) 남은 호출 수' },
  { name: 'Retry-After', type: 'Integer', desc: '한도를 넘었을 때(429) 다시 부를 수 있을 때까지의 초' },
]

const fieldLine = (f: Field) => `- \`${f.name}\` (${f.type}${f.required ? ', 필수' : ''}): ${f.desc}`

/**
 * API 하나를 코딩 에이전트(Claude Code, Cursor 등)에게 그대로 붙여 넣는 프롬프트로 바꿔요.
 * 주소, 인증, 파라미터, 응답 객체, 예제, 오류를 모두 담아서 에이전트가 문서를 따로 읽지 않아도 연동 코드를 쓸 수 있어요.
 */
export function endpointPrompt(e: EndpointDoc, base: string, scopeLabel: string): string {
  const typeNames = new Set<string>()
  const collect = (name: string) => {
    const type = TYPES.find((t) => t.name === name.replace('[]', ''))
    if (!type || typeNames.has(type.name)) return
    typeNames.add(type.name)
    type.fields.forEach((f) => collect(f.type))
  }
  e.types.forEach(collect)
  const lines = [
    `잡아따(Javadda) 공개 API의 "${e.title}" API를 호출하는 코드를 작성해 주세요.`,
    '',
    '## API',
    `- 요청: ${e.method} ${base}${e.path}`,
    `- 인증: 요청 헤더 \`X-API-Key\`에 API 키를 넣습니다. 키는 코드에 적지 말고 환경 변수 \`JAVADDA_API_KEY\`에서 읽어 주세요.`,
    `- 권한: \`${e.scope}\`${scopeLabel && scopeLabel !== e.scope ? ` (${scopeLabel})` : ''}`,
    ...e.desc.map((line) => `- ${line}`),
  ]
  if (e.pathParams?.length) lines.push('', '## 경로 파라미터', ...e.pathParams.map(fieldLine))
  if (e.query?.length) lines.push('', '## 쿼리 파라미터 (모두 선택)', ...e.query.map(fieldLine))
  lines.push(
    '',
    '## 응답',
    '응답 본문은 늘 `{ "data": ..., "error": { "code": ..., "message": ... } }` 모양입니다. 성공하면 error의 값이 null이고, 실패하면 data가 null입니다.',
    ...e.response.map(fieldLine),
  )
  for (const name of typeNames) {
    const type = TYPES.find((t) => t.name === name)!
    lines.push('', `### ${type.name}`, ...(type.desc ? [type.desc] : []), ...type.fields.map(fieldLine))
  }
  lines.push(
    '',
    '## 예제',
    `요청: ${e.method} ${base}${e.example.query}`,
    '응답의 data:',
    '```json',
    JSON.stringify(e.example.response, null, 2),
    '```',
    '',
    '## 오류',
    ...e.errors.map(([code, desc]) => `- ${code}: ${desc}`),
    ...COMMON_ERRORS.filter(([, code]) => !e.errors.some(([own]) => own === code)).map(([status, code, desc]) => `- ${code}: ${desc}(${status})`),
    '',
    '## 지켜 주세요',
    '- 429를 받으면 Retry-After 헤더의 초만큼 기다린 뒤 다시 호출해 주세요. 응답 헤더 X-RateLimit-Remaining이 오늘 남은 호출 수입니다.',
    ...(e.types.includes('Page') ? ['- 목록은 page(0부터)와 size(100까지)로 나눠 받고, hasNext가 false일 때까지 이어 받습니다.'] : []),
    '- 날짜(Date)는 2026-11-05, 시각(Datetime)은 시간대 없는 한국 시각(2026-11-05T13:40:21)입니다.',
  )
  return lines.join('\n')
}
