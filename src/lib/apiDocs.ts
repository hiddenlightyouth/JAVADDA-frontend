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
]

/** 모든 요청에 같이 보내는 헤더예요. */
export const HEADERS: Field[] = [
  { name: 'X-API-Key', type: 'String', desc: '승인된 API 키(jvd_로 시작)', required: true },
]

const pageQuery: Field[] = [
  { name: 'page', type: 'Integer', desc: '가져올 페이지입니다. 0부터 시작하며 기본값은 0입니다.' },
  { name: 'size', type: 'Integer', desc: '한 페이지의 항목 수입니다. 1부터 100까지이며 기본값은 20입니다.' },
]

export const TYPES: TypeDoc[] = [
  {
    name: 'Page',
    desc: '목록 응답입니다. items에 그 페이지의 항목이 들어 있습니다.',
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
    desc: '채용 공고 하나입니다.',
    fields: [
      { name: 'id', type: 'String', desc: '공고 아이디' },
      { name: 'company', type: 'CompanyRef', desc: '공고를 낸 기업' },
      { name: 'title', type: 'String', desc: '공고 제목' },
      { name: 'family', type: 'String', desc: `직군. ${FAMILY}` },
      { name: 'career', type: 'String', desc: `경력. ${CAREER}` },
      { name: 'location', type: 'String', desc: '근무지. 공고에 적힌 글자 그대로입니다(예: 서울 송파, 경기 분당, 판교).' },
      { name: 'postedAt', type: 'Datetime', desc: '공고가 올라온 때' },
      { name: 'deadline', type: 'Datetime', desc: '마감 시각. null이면 상시 채용입니다.' },
      { name: 'required', type: 'String[]', desc: '필수 역량' },
      { name: 'preferred', type: 'String[]', desc: '우대 역량' },
      { name: 'summary', type: 'String', desc: '공고를 요약한 한두 문장' },
      { name: 'url', type: 'String', desc: '공고 원문 주소' },
      { name: 'source', type: 'String', desc: '모은 곳. company(기업 채용 페이지), worknet(고용24), public(공공기관)' },
      { name: 'closedAt', type: 'Datetime', desc: '채용이 닫힌 때. 열린 공고는 null입니다.' },
    ],
  },
  {
    name: 'CompanyRef',
    desc: '공고 안에 들어 있는 기업 요약입니다.',
    fields: [
      { name: 'id', type: 'String', desc: '기업 아이디입니다. 기업 API에 그대로 사용합니다.' },
      { name: 'name', type: 'String', desc: '기업 이름' },
    ],
  },
  {
    name: 'Company',
    desc: '기업 하나입니다.',
    fields: [
      { name: 'id', type: 'String', desc: '기업 아이디' },
      { name: 'name', type: 'String', desc: '기업 이름' },
      { name: 'logo', type: 'String', desc: '로고 이미지 주소. 없으면 null입니다.' },
      { name: 'industry', type: 'String', desc: '업종' },
      { name: 'category', type: 'String', desc: `사업 분류. ${CATEGORY}. 모르면 null입니다.` },
      { name: 'site', type: 'String', desc: '기업 소개 사이트 주소' },
      { name: 'techBlog', type: 'String', desc: '기술 블로그 주소. 없으면 null입니다.' },
      { name: 'openPostings', type: 'Integer', desc: '지금 열려 있는 공고 수' },
    ],
  },
  {
    name: 'Skill',
    desc: '스킬 사전의 스킬 하나입니다.',
    fields: [
      { name: 'name', type: 'String', desc: '스킬 이름(하나로 모은 표기, 예: Spring Boot)' },
      { name: 'axis', type: 'String', desc: '축. 언어, 프레임워크, 데이터베이스, 인프라, 협업, CS 기초' },
      { name: 'aliases', type: 'String[]', desc: '같은 스킬로 보는 다른 표기(예: 스프링, springboot)' },
      { name: 'share', type: 'Double', desc: '같은 직군 공고 중 이 스킬을 적은 비율(0에서 1). 모르면 null입니다.' },
      { name: 'change', type: 'Integer', desc: '최근 6개월 동안 비율이 변한 정도(%p). 모르면 null입니다.' },
      { name: 'courses', type: 'Course[]', desc: '추천 강의입니다. 개별 스킬을 조회할 때만 있고, 목록에서는 null입니다.' },
    ],
  },
  {
    name: 'Course',
    desc: '스킬을 채울 때 볼 만한 강의입니다.',
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
    desc: '열린 공고의 통계입니다. 호출할 때마다 지금 열린 공고로 계산합니다.',
    fields: [
      { name: 'openPostings', type: 'Long', desc: '열린 공고 수' },
      { name: 'postedThisWeek', type: 'Long', desc: '최근 7일 안에 올라온 공고 수' },
      { name: 'closingThisWeek', type: 'Long', desc: '앞으로 7일 안에 마감하는 공고 수' },
      { name: 'rolling', type: 'Long', desc: '마감이 없는 상시 채용 공고 수' },
      { name: 'byFamily', type: 'Count[]', desc: '직군별 공고 수(많은 순서)' },
      { name: 'byCareer', type: 'Count[]', desc: '경력별 공고 수' },
      { name: 'byCategory', type: 'Count[]', desc: '기업 분류별 공고 수. 분류를 모르는 기업은 unknown입니다.' },
      { name: 'topCompanies', type: 'CompanyCount[]', desc: '공고가 많은 기업 20곳' },
      { name: 'requiredSkills', type: 'SkillCount[]', desc: '필수 역량으로 많이 적힌 30개' },
      { name: 'preferredSkills', type: 'SkillCount[]', desc: '우대 역량으로 많이 적힌 30개' },
      { name: 'generatedAt', type: 'Datetime', desc: '계산한 때' },
    ],
  },
  { name: 'Count', desc: '값 하나의 수입니다.', fields: [{ name: 'key', type: 'String', desc: '코드 값(예: backend)' }, { name: 'count', type: 'Long', desc: '공고 수' }] },
  {
    name: 'CompanyCount',
    desc: '기업 하나의 공고 수입니다.',
    fields: [
      { name: 'id', type: 'String', desc: '기업 아이디' },
      { name: 'name', type: 'String', desc: '기업 이름' },
      { name: 'count', type: 'Long', desc: '열린 공고 수' },
    ],
  },
  {
    name: 'SkillCount',
    desc: '역량 하나가 적힌 공고 수입니다.',
    fields: [
      { name: 'skill', type: 'String', desc: '역량(스킬 사전의 표기로 모은 이름)' },
      { name: 'count', type: 'Long', desc: '이 역량을 적은 공고 수' },
      { name: 'share', type: 'Double', desc: '열린 공고 중 비율(0에서 1, 소수 셋째 자리까지)' },
    ],
  },
  {
    name: 'BlogDigest',
    desc: '기업 기술 블로그 한 곳의 요약입니다. AI가 최근 글을 읽고 작성합니다.',
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
    desc: '기업의 요즘 고민 하나입니다.',
    fields: [
      { name: 'title', type: 'String', desc: '고민 제목' },
      { name: 'body', type: 'String', desc: '고민 설명' },
      { name: 'posts', type: 'String[]', desc: '이 고민이 드러난 글의 아이디' },
    ],
  },
  {
    name: 'BlogPost',
    desc: '기술 블로그 글 하나입니다.',
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
    desc: '여러 기업의 최근 글을 함께 읽고 쓴 총정리입니다. 하루에 한 번 새로 작성합니다.',
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
    desc: '총정리의 주제 하나입니다.',
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
    desc: '총정리의 역량 하나입니다.',
    fields: [
      { name: 'skill', type: 'String', desc: '역량' },
      { name: 'reason', type: 'String', desc: '왜 필요한지 한 문장' },
      { name: 'postings', type: 'Integer', desc: '이 역량을 필수나 우대로 적은 열린 공고 수' },
    ],
  },
  {
    name: 'Contest',
    desc: '공모전 하나입니다. 여러 사이트에 올라온 같은 공모전은 하나로 합칩니다.',
    fields: [
      { name: 'id', type: 'String', desc: '공모전 아이디' },
      { name: 'title', type: 'String', desc: '공모전 이름' },
      { name: 'organizer', type: 'String', desc: '주최' },
      { name: 'categories', type: 'String[]', desc: '분야(코드 값의 공모전 분야)' },
      { name: 'startDate', type: 'Date', desc: '접수 시작일. 모르면 null입니다.' },
      { name: 'deadline', type: 'Date', desc: '접수 마감일' },
      { name: 'imageUrl', type: 'String', desc: '포스터 이미지 주소. 없으면 null입니다.' },
      { name: 'prize', type: 'String', desc: '상금이나 혜택. 없으면 null입니다.' },
      { name: 'links', type: 'ContestLink[]', desc: '공모전을 올린 사이트와 주소' },
      { name: 'firstSeenAt', type: 'Datetime', desc: '처음 모은 때' },
    ],
  },
  {
    name: 'ContestLink',
    desc: '공모전을 올린 사이트 하나입니다.',
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

const NOT_FOUND: [string, string] = ['C404', '없는 아이디입니다(404).']
const BAD_PARAM: [string, string] = ['C002', '파라미터 값이 잘못되었습니다. 코드 값과 범위를 확인하십시오(400).']

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: 'postings',
    title: '공고 목록',
    scope: 'postings:read',
    method: 'GET',
    path: '/postings',
    desc: [
      '지금 열려 있는 채용 공고를 검색합니다. 닫힌 공고와 마감 시각이 지난 공고는 뺍니다.',
      '검색어는 기업 이름, 공고 제목, 근무지, 필수와 우대 역량에서 찾습니다. 경력을 고르면 그 경력의 공고와 경력 무관 공고가 같이 나옵니다.',
    ],
    query: [
      { name: 'query', type: 'String', desc: '찾을 말(예: 토스, Kafka, 판교)' },
      { name: 'family', type: 'String', desc: `직군. ${FAMILY}` },
      { name: 'career', type: 'String', desc: `경력. ${CAREER}` },
      { name: 'company', type: 'String', desc: '기업 아이디입니다. 해당 기업의 공고만 조회합니다.' },
      { name: 'sort', type: 'String', desc: 'recent(최근에 올라온 순서, 기본값), deadline(마감이 가까운 순서, 상시 채용은 맨 뒤)' },
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
    desc: ['공고 한 건을 조회합니다. 닫힌 공고도 가져올 수 있고, 그때는 closedAt에 닫힌 때가 있습니다.'],
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
    desc: ['기업 목록과 지금 열려 있는 공고 수를 조회합니다. 순서는 잡아따가 정한 노출 순서입니다.'],
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
    desc: ['기업 한 곳을 조회합니다. 공고의 company.id를 그대로 사용합니다.'],
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
    desc: ['잡아따가 공고와 서류에서 역량을 읽을 때 쓰는 스킬 사전입니다. 이름순이고, 공고에 적힌 비중과 6개월 변화가 있습니다.'],
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
    desc: ['스킬 한 개와 추천 강의를 조회합니다. 별칭(스프링, k8s)으로 조회해도 대표 이름으로 응답합니다.'],
    pathParams: [{ name: 'name', type: 'String', desc: '스킬 이름이나 별칭입니다. 주소에 넣을 때 URL 인코딩하십시오.', required: true }],
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
    desc: ['지금 열린 공고를 직군, 경력, 기업 분류, 기업으로 센 수와, 필수와 우대로 많이 적힌 역량입니다.', '역량은 공고에 적힌 표기를 스킬 사전의 표기로 모아 셉니다. 공공기관 공고의 우대 조건(예: 장애인, 취업지원대상자)도 우대 역량에 들어갑니다.'],
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
    desc: ['기업 기술 블로그마다 최근 글의 요약, 요즘 고민, 면접에서 쓸 점입니다. 매일 새벽에 새 글을 모아 다시 작성합니다.'],
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
    desc: ['여러 기업의 최근 글을 함께 분석한 흐름과 채용 예측, 주제마다 고민과 준비, 필요한 역량입니다. 아직 작성되지 않았으면 data가 null입니다.'],
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
    title: '공모전',
    scope: 'contests:read',
    method: 'GET',
    path: '/contests',
    desc: ['마감하지 않은 공모전입니다. 링커리어, 캠퍼스픽, 위비티, 씽굿에서 매일 모아 같은 공모전은 하나로 합칩니다. 마감이 가까운 순서입니다.'],
    response: [{ name: 'data', type: 'Contest[]', desc: '공모전 목록' }],
    types: ['Contest', 'ContestLink'],
    example: {
      query: '/contests',
      response: [
        {
          id: 'c-02c736edd44ff64dee714dc9',
          title: 'SNS 홍보단 모집',
          organizer: '한국여성소비자연합',
          categories: ['etc'],
          startDate: null,
          deadline: '2026-11-05',
          imageUrl: null,
          prize: null,
          links: [{ site: 'wevity', url: 'https://www.wevity.com/?c=find&s=1&gbn=view&ix=112025' }],
          firstSeenAt: '2026-11-03T09:49:18',
        },
      ],
    },
    errors: [],
  },
]

/** 모든 API에 공통인 오류예요. [HTTP 상태, 코드, 뜻] */
export const COMMON_ERRORS: [string, string, string][] = [
  ['401', 'C4014', 'X-API-Key 헤더가 없습니다.'],
  ['401', 'C4015', '존재하지 않는 키입니다. 키를 다시 확인하십시오.'],
  ['403', 'C4031', '아직 승인되지 않았거나 해지한 키입니다.'],
  ['403', 'C4032', '사용 기간이 끝난 키입니다.'],
  ['403', 'C4033', '이 API의 권한이 없는 키입니다. 권한이 더 필요하면 새 키를 요청하십시오.'],
  ['429', 'C429', '1분 또는 하루 호출 한도를 초과했습니다. Retry-After 헤더의 초만큼 기다린 뒤 다시 호출하십시오.'],
  ['400', 'C002', '파라미터 값이 잘못되었습니다.'],
  ['404', 'C404, C4042', '찾는 자료가 없습니다.'],
  ['500', 'C500', '서버에서 오류가 발생했습니다. 잠시 뒤에 다시 호출하십시오.'],
]

/** 응답 헤더예요. */
export const RESPONSE_HEADERS: Field[] = [
  { name: 'X-RateLimit-Limit', type: 'Integer', desc: '이 키의 하루 호출 한도' },
  { name: 'X-RateLimit-Remaining', type: 'Integer', desc: '오늘(한국 시각) 남은 호출 수' },
  { name: 'Retry-After', type: 'Integer', desc: '한도를 넘었을 때(429) 다시 부를 수 있을 때까지의 초' },
]
