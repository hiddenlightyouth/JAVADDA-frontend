import { COMPANIES, type Company } from './gap'
import { apiUrl, readResult } from './http'

/**
 * 기업 기술 블로그 요약이에요. 기업마다 대표 글과 한 줄 요약, 요즘 고민 분석, 면접에서 쓸 점을 모아 둬요.
 * 서버가 각 블로그의 RSS를 모아 요약해 두고, 화면은 GET /blogs로 받아요(`fetchBlogDigests`).
 * 이 파일의 글(`DIGESTS`)은 2026년 10월 29일에 모은 실제 글이고, 서버에 닿지 못할 때만 대신 보여줘요.
 * 주제 비중과 여러 기업에 걸친 흐름은 글에 붙인 주제(`themes`)에서 계산해서, 글을 더하면 분석도 같이 바뀌어요.
 */

/** 글의 주제예요. 여러 기업의 글을 같은 기준으로 묶어서 요즘 흐름을 봐요. */
export type BlogTheme =
  | 'ai-agent'
  | 'ai-dev'
  | 'ai-platform'
  | 'ai-model'
  | 'llm-cost'
  | 'data-platform'
  | 'db-ops'
  | 'infra'
  | 'observability'
  | 'frontend'
  | 'architecture'
  | 'test-auto'
  | 'recommend'
  | 'search'

export const THEME_NAMES: Record<BlogTheme, string> = {
  'ai-agent': 'AI 에이전트',
  'ai-dev': 'AI와 함께 일하기',
  'ai-platform': '사내 AI 플랫폼',
  'ai-model': 'AI 모델과 기능',
  'llm-cost': 'LLM 비용',
  'data-platform': '데이터 파이프라인',
  'db-ops': '데이터베이스 운영',
  infra: '인프라와 성능',
  observability: '장애 대응과 관측',
  frontend: '웹과 앱 화면',
  architecture: '백엔드 설계',
  'test-auto': '테스트 자동화',
  recommend: '추천과 개인화',
  search: '검색',
}

export interface BlogPost {
  id: string
  title: string
  /** 원문 주소. 누르면 새 탭으로 바로 열어요. */
  url: string
  /** 올린 날(YYYY-MM-DD) */
  date: string
  /** 두 문장 안쪽의 요약 */
  summary: string
  themes: BlogTheme[]
  /** 글에 나온 기술 */
  skills: string[]
}

/** 요즘 고민 하나와, 그 고민이 드러난 글이에요. */
interface BlogConcern {
  title: string
  body: string
  /** 근거가 된 글의 id */
  posts: string[]
}

export interface BlogDigest {
  companyId: string
  /** 블로그 주소 */
  blog: string
  /** 블로그를 어디서 운영하는지. 사내 블로그, 미디엄 같은 것이에요. */
  platform: string
  /** 요즘 가장 큰 고민 한 줄 */
  headline: string
  /** 최근 글을 읽고 정리한 한 문단 */
  analysis: string
  concerns: BlogConcern[]
  /** 면접과 서류에서 쓸 점 */
  interview: string[]
  /** 최신 글부터 */
  posts: BlogPost[]
}

/** 적어 둔 글(`DIGESTS`)을 모은 날이에요. */
const FALLBACK_COLLECTED_AT = '2026-10-29'

const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * 글을 모은 날이에요. 마지막 글이 이보다 오래되었는지 셀 때 기준이 돼요.
 * 서버가 RSS를 늘 모으고 있어서 오늘이고, 적어 둔 글을 보여줄 때만 그 글을 모은 날이에요.
 */
export let COLLECTED_AT = today()

/** 마지막 글이 이만큼(일) 지났으면 블로그가 멈춘 것으로 보고 안내해요. */
const STALE_DAYS = 180

/** 여러 기업에 걸친 흐름은 이 기간(일) 안의 글로만 셈해요. */
const RECENT_DAYS = 120

const post = (id: string, date: string, title: string, url: string, summary: string, themes: BlogTheme[], skills: string[]): BlogPost => ({ id, date, title, url, summary, themes, skills })

const DIGESTS: BlogDigest[] = [
  {
    companyId: 'toss',
    blog: 'https://toss.tech',
    platform: '토스 테크',
    headline: 'LLM을 서비스 곳곳에 넣은 뒤, 호출 비용과 운영 기준을 어떻게 잡을지 고민하고 있어요.',
    analysis:
      '최근 글의 절반 가까이가 생성형 AI를 실제 운영에 올린 뒤의 문제를 다뤄요. 모델을 붙이는 단계는 지났고, 호출 비용과 지연, 서비스 팀마다 반복되는 연동 작업을 플랫폼으로 묶는 쪽으로 관심이 옮겨 갔어요. 한편 증권과 뱅크 쪽에서는 DB 커밋 지연이나 패키지 형식처럼 기본기를 깊게 파는 글이 꾸준히 나와요.',
    concerns: [
      { title: 'LLM 호출 비용과 지연 줄이기', body: '대용량 호출을 시작하면 비용과 응답 시간이 바로 문제가 돼요. 같은 품질을 더 싸게 내는 방법과, 팀마다 반복하던 연동을 플랫폼이 맡는 구조를 만들고 있어요.', posts: ['toss-llm-cost', 'toss-ai-platform'] },
      { title: 'AI가 읽을 수 있는 문맥 만들기', body: '로그 정의 기준과 데이터 파이프라인의 출처를 코드와 규칙으로 옮겨서, 사람과 에이전트가 같은 기준을 보게 하고 있어요.', posts: ['toss-log-skill', 'toss-dw-airflow'] },
      { title: '평균 지표 뒤에 숨은 병목 찾기', body: '평균은 정상인데 가끔 느려지는 문제를 OS와 하드웨어까지 내려가 풀어요.', posts: ['toss-nic'] },
    ],
    interview: [
      'LLM 기능을 만들어 봤다면 정확도뿐 아니라 호출 비용과 응답 시간을 어떻게 쟀는지 말할 준비를 해 두세요.',
      '성능 문제를 겪은 경험은 평균이 아니라 가장 느린 요청들을 어떻게 찾았는지로 풀면 토스 글의 방향과 잘 맞아요.',
      '프론트엔드라면 패키지를 ESM으로만 내기로 한 글을 읽고, 내 프로젝트의 빌드 설정과 비교해 보세요.',
    ],
    posts: [
      post('toss-llm-cost', '2026-10-27', '손가락 튕기기로 LLM 비용 줄이기', 'https://toss.tech/article/snap-llm-cost-reduction', '프롬프트 튜닝을 마친 뒤 대용량 호출에서 드러나는 비용과 응답 지연 문제를 다뤄요. 서비스와 내부 업무 곳곳에 퍼진 LLM 호출을 더 싸고 빠르게 만드는 방법을 정리했어요.', ['llm-cost'], ['LLM', 'Python']),
      post('toss-log-skill', '2026-10-23', '머릿속에 있던 로그 정의 기준을 모두의 AI 스킬로 만들기', 'https://toss.tech/article/dataops-log-definition-skill', '비개발자인 DataOps Manager들이 손으로 하던 앱 로그 정의 업무를 AI 스킬로 바꾼 과정이에요. 사람마다 머릿속에 있던 기준을 누구나 쓰는 규칙으로 옮긴 점이 핵심이에요.', ['ai-agent', 'data-platform'], ['AI 에이전트', '로그 설계']),
      post('toss-nic', '2026-10-19', '평균 CPU는 여유로운데, 커밋은 왜 느릴까?', 'https://toss.tech/article/nic-interrupt-bottleneck', '토스증권 주문과 체결 DB에서 커밋 대기가 0.1초 넘게 반복된 원인을 쫓은 글이에요. 평균 지표는 모두 정상이었고, CPU 소켓 하나에 몰린 NIC 인터럽트를 나누자 대부분 풀렸어요.', ['infra', 'db-ops'], ['Oracle', 'Linux']),
      post('toss-dw-airflow', '2026-10-16', '실행은 도메인별로, 문맥은 한 레포에', 'https://toss.tech/article/dw-airflow-migration', '중앙 DW Airflow를 멈추지 않고 도메인별 Airflow와 dbt 기반 파이프라인으로 옮긴 과정이에요. 코딩 에이전트가 테이블의 출처를 코드에서 찾을 수 있게 문맥을 한 레포에 모은 점이 눈에 띄어요.', ['data-platform', 'ai-agent'], ['Airflow', 'dbt']),
      post('toss-esm', '2026-10-15', '토스뱅크가 패키지를 관리하는 방식 #1: 패키지를 ESM으로만 제공하기로 했어요', 'https://toss.tech/article/package-management-1', '토스뱅크가 여러 서비스가 같이 쓰는 패키지를 ESM으로만 제공하기로 한 이유예요. CommonJS와 같이 빌드할 때 생기던 상태 분리와 타입 문제를 정리했어요.', ['frontend'], ['TypeScript', 'ESM']),
      post('toss-ai-platform', '2026-10-13', '서비스 개발에 집중할 수 있는 AI 플랫폼 만들기', 'https://toss.tech/article/ai-platform-foundation', '모델 연동, 권한, 사용량 집계처럼 서비스 팀마다 반복하던 일을 AI Platform 팀이 맡도록 만든 이야기예요. 서비스 팀은 목적과 모델만 정하고 운영 중 결과를 확인할 수 있어요.', ['ai-platform'], ['LLM', '플랫폼 엔지니어링']),
      post('toss-topk', '2026-10-01', '추천 후보는 많을수록 좋을까? TopK를 최적화해 전환율을 높인 방법', 'https://toss.tech/article/53545', '여러 리트리벌 모델이 가져오는 추천 후보 수를 다시 정해 전환율을 높인 방법이에요. 모델 바깥의 결정이 성능을 크게 좌우한다는 점을 보여줘요.', ['recommend'], ['추천 시스템', 'ML']),
    ],
  },
  {
    companyId: 'kakao',
    blog: 'https://tech.kakao.com',
    platform: '카카오 기술 블로그',
    headline: 'AI 에이전트가 사내 데이터를 믿을 만하게 다루도록 컨텍스트를 설계하는 데 힘을 쏟고 있어요.',
    analysis:
      '최근 한 달 사이 데이터 분석 에이전트와 컨텍스트 설계 글이 연달아 나왔어요. 자체 모델 Kanana 계열 연구와 if(kakao)26 같은 행사 글도 많아서, 모델을 직접 만드는 일과 그 모델을 사내 업무에 붙이는 일을 함께 밀고 있다는 게 보여요. 메시징처럼 오래된 기반 시스템의 안정성 글도 꾸준해요.',
    concerns: [
      { title: 'AI 에이전트에게 줄 컨텍스트 설계', body: '에이전트가 지침 문서를 읽고 SQL을 써서 리포트까지 만들게 하면서, 팀이 그 결과를 믿고 쓸 수 있는 기준을 만들고 있어요.', posts: ['kakao-rec-context', 'kakao-agent-context'] },
      { title: '자체 AI 모델 키우기', body: '언어모델 Kanana-2의 구조를 살려 비전 인코더까지 밑바닥부터 직접 만들고 있어요.', posts: ['kakao-vision'] },
      { title: '추천을 개인 단위로', body: '세그먼트 단위로 돌던 추천을 개인의 기록을 반영하는 랭킹 모델로 바꾸고 있어요.', posts: ['kakao-ranking'] },
    ],
    interview: [
      'AI 도구를 써 본 경험이 있다면 어떤 정보를 주고 결과를 어떻게 검증했는지 말해 보세요.',
      '추천이나 개인화 프로젝트는 세그먼트 단위와 개인 단위의 차이를 설명할 수 있으면 좋아요.',
      '국제 문자 인증 글처럼, 보이지 않던 실패 경로를 하나씩 확인해 간 경험이 있다면 순서대로 정리해 두세요.',
    ],
    posts: [
      post('kakao-rec-context', '2026-10-27', '팀이 신뢰할 수 있는 AI 분석 환경 만들기: 추천팀의 컨텍스트 설계', 'https://tech.kakao.com/posts/844', '카카오톡 숏폼 추천팀이 추천 지표 분석을 AI 에이전트에게 맡기며 정리한 컨텍스트 설계예요. 에이전트가 지침 문서를 읽고 SQL을 써서 Hadoop에서 돌린 뒤 리포트까지 만드는 흐름을 팀이 믿고 쓰게 만든 과정이에요.', ['ai-agent', 'data-platform'], ['AI 에이전트', 'SQL', 'Hadoop']),
      post('kakao-mo', '2026-10-21', '문자를 보냈다는데 왜 안 오죠? 길 잃은 국제 MO 메시지 구출 작전', 'https://tech.kakao.com/posts/843', '사내 SMS 전송 시스템에서 해외 사용자가 보낸 인증 문자가 어디서 사라지는지 추적한 글이에요. 보이지 않던 경로를 하나씩 확인해 국제 MO 전환율을 90%대까지 올렸어요.', ['observability', 'infra'], ['메시징', '모니터링']),
      post('kakao-vision', '2026-10-20', '글로벌 최고 수준의 자체 비전 인코더, Kanana-2-vision-encoder 개발기', 'https://tech.kakao.com/posts/840', '카카오가 밑바닥부터 만든 비전 인코더 개발기예요. 자체 언어모델 Kanana-2의 구조를 활용해 학습과 추론의 효율을 높였어요.', ['ai-model'], ['멀티모달', '딥러닝']),
      post('kakao-agent-context', '2026-10-01', '데이터 분석 에이전트를 만들며 배운 컨텍스트 설계', 'https://tech.kakao.com/posts/838', '데이터 분석 에이전트를 만들며 무엇을 컨텍스트에 넣고 어떻게 나눌지 배운 점을 정리했어요. 모델 성능만큼 에이전트에게 주는 정보의 설계가 결과를 좌우한다는 이야기예요.', ['ai-agent'], ['AI 에이전트', 'LLM']),
      post('kakao-ranking', '2026-09-22', '개인화 추천을 위한 랭킹 모델 개발기', 'https://tech.kakao.com/posts/837', '세그먼트 단위로 돌던 추천 로직을 유저 개인의 기록을 반영하는 랭킹 모델로 바꾼 프로젝트예요. 체류 시간과 만족도로 이어지는 개인화의 설계를 다뤄요.', ['recommend'], ['추천 시스템', 'ML']),
    ],
  },
  {
    companyId: 'naver',
    blog: 'https://d2.naver.com',
    platform: 'NAVER D2',
    headline: '오래 운영한 데이터 플랫폼의 버전을 올리며 생기는 호환성 문제와, AI 시대 개발자의 기본기를 함께 이야기해요.',
    analysis:
      'D2에는 Airflow, Hive, Spark처럼 오래 운영해 온 데이터 플랫폼을 새 버전으로 올리며 겪은 문제를 깊게 판 글이 많아요. 동시에 JavaScript 동향 연재와 에이전트 개념 정리처럼, 빠르게 바뀌는 흐름을 원문으로 다시 짚는 글이 이어져요. 학생 개발자에게 보내는 글도 나와서 신입 채용을 준비한다면 꼭 읽어 볼 만해요.',
    concerns: [
      { title: '오래된 데이터 플랫폼 올리기', body: 'Airflow 3.0과 Hive 4.2로 올리면서 fork와 GC, 사라진 RPC처럼 버전 사이의 틈을 끝까지 따라가 고치고 기여하고 있어요.', posts: ['naver-airflow-gc', 'naver-hive'] },
      { title: 'Kubernetes 위의 상태 있는 서비스', body: 'DB처럼 오래 떠 있어야 하는 컨테이너 옆의 사이드카를 따로, 선언적으로 관리하는 방법을 찾고 있어요.', posts: ['naver-sidecar'] },
      { title: '바뀐 흐름을 원문으로 다시 정리', body: 'JavaScript 명세와 에이전트 개념처럼 말이 엇갈리기 쉬운 주제를 스펙부터 다시 짚어요.', posts: ['naver-js', 'naver-agent'] },
    ],
    interview: [
      '오픈소스 버전을 올리다 막힌 경험이 있다면 원인을 어디까지 따라갔는지 말해 보세요. D2 글들이 그 깊이를 좋아해요.',
      '"AI 시대의 개발자를 꿈꾸는 학생 개발자에게"는 면접 전에 읽고 내 생각을 한 줄로 정리해 두세요.',
      '프론트엔드라면 JavaScript 동향 글에서 지금 바로 쓸 수 있는 기능 하나를 골라 써 보고 이야기해 보세요.',
    ],
    posts: [
      post('naver-sidecar', '2026-10-29', '사이드카의 선언적 관리: OpenKruise SidecarSet 도입과 운영', 'https://d2.naver.com/helloworld/2983631', '관리형 DB 서비스에서 DB와 수명이 다른 사이드카 컨테이너를 OpenKruise SidecarSet으로 관리한 이야기예요. DB를 멈추지 않고 사이드카만 자주 바꾸는 방법을 다뤄요.', ['infra'], ['Kubernetes', 'OpenKruise']),
      post('naver-student', '2026-10-29', 'AI 시대의 개발자를 꿈꾸는 학생 개발자에게', 'https://d2.naver.com/helloworld/1975819', '2018년 글의 후속편으로, AI로 개발자의 역할이 흔들리는 시기에 학생 개발자들의 질문에 답했어요. 무엇을 공부하고 어떻게 성장할지 고민하는 분께 바로 도움이 되는 글이에요.', ['ai-dev'], ['커리어']),
      post('naver-js-outside', '2026-10-21', '2026년과 이후 JavaScript의 동향 - 브라우저 밖의 JavaScript', 'https://d2.naver.com/helloworld/1443473', 'Node.js, Deno, Bun과 패키지 관리자까지, 브라우저 밖 JavaScript 생태계가 7년 동안 어떻게 바뀌었는지 정리했어요.', ['frontend'], ['Node.js', 'Bun', 'Deno']),
      post('naver-js', '2026-10-20', '2026년과 이후 JavaScript의 동향 - JavaScript(ECMAScript)', 'https://d2.naver.com/helloworld/2675915', '6년 만에 돌아온 JavaScript 동향 연재로, 그사이 바뀐 ECMAScript 명세를 정리했어요. Stage 4에 오른 Temporal처럼 지금 쓸 수 있는 기능과 AI 코딩 도구가 바꾼 흐름을 같이 다뤄요.', ['frontend'], ['JavaScript', 'ECMAScript']),
      post('naver-airflow-gc', '2026-10-08', 'Python의 GC가 멀티프로세싱과 만나면 생기는 일 - Python과 Airflow, 그리고 관련된 문제 해결기 2편', 'https://d2.naver.com/helloworld/4149925', 'Airflow 3.0 도입을 검토하다 fork로 만든 프로세스와 Python GC가 부딪혀 생긴 메모리 문제를 풀고 기여한 과정이에요.', ['data-platform'], ['Python', 'Airflow']),
      post('naver-agent', '2026-10-01', '에이전트, 개념부터 같이 정리해봐요: 워크플로우, 하네스, Context/Memory, MCP/A2A', 'https://d2.naver.com/helloworld/8118359', '사내 밋업 인기 세션으로, 에이전트를 만들 때 자주 섞여 쓰이는 개념을 원문 스펙부터 다시 정리했어요.', ['ai-agent'], ['MCP', 'A2A']),
      post('naver-hive', '2026-09-29', 'Hive는 잊으려 했지만, Spark는 기억하고 있었다: 사라진 get_table RPC 복원기', 'https://d2.naver.com/helloworld/7314597', 'Hadoop 플랫폼의 Metastore를 Hive 4.2로 올리다 Spark 잡이 실패한 원인을 찾아, 사라진 RPC 하나를 되살린 이야기예요.', ['data-platform'], ['Hive', 'Spark', 'Thrift']),
    ],
  },
  {
    companyId: 'woowa',
    blog: 'https://techblog.woowahan.com',
    platform: '우아한형제들 기술 블로그',
    headline: '사장님과 고객이 기다리는 시간을 줄이는 일, 그리고 AI가 짠 코드도 규칙을 지키게 하는 일에 집중하고 있어요.',
    analysis:
      '최근 글은 웹뷰 로딩, 입점 승인, 배치 처리처럼 기다림을 줄이는 주제가 많아요. 우아콘 2026의 주제도 기다림이 없는 도시예요. 동시에 AI로 화면을 개편하거나 워크플로 엔진을 만드는 글이 늘면서, AI가 쓴 코드도 아키텍처 규칙을 지키도록 테스트로 강제하는 흐름이 함께 보여요.',
    concerns: [
      { title: '기다리는 시간 줄이기', body: '웹뷰 로딩 30% 단축, 자동승인 대기 10분에서 10초로처럼 사용자가 기다리는 시간을 숫자로 줄이고 있어요.', posts: ['woowa-critical-script', 'woowa-auto-approve', 'woowa-workflow'] },
      { title: 'AI가 쓴 코드도 규칙 안에', body: 'AI에게 화면 개편을 맡기면서도, 문서로만 지키던 아키텍처 규칙은 테스트 코드로 강제하고 있어요.', posts: ['woowa-archunit', 'woowa-contract'] },
      { title: '웹뷰의 까다로운 실패 다루기', body: '네트워크가 끊겼다 돌아온 뒤 화면이 살아나지 않는 문제처럼, 스펙에 숨은 동작까지 파고들어요.', posts: ['woowa-lazy'] },
    ],
    interview: [
      '성능 개선 경험은 몇 초에서 몇 초로 줄였는지 숫자로 말해 보세요. 배민 글들이 늘 그렇게 시작해요.',
      '헥사고날 아키텍처나 ArchUnit처럼 규칙을 코드로 지키는 방법을 물어볼 수 있어요.',
      'AI로 개발해 봤다면 AI에게 맡긴 것과 직접 챙긴 것을 나눠서 말해 보세요.',
    ],
    posts: [
      post('woowa-critical-script', '2026-10-21', 'critical-script, 배달의민족 웹뷰 로딩 성능을 30% 개선한 인라인 스크립트 로딩 전략 이야기', 'https://techblog.woowahan.com/27864/', 'B마트 가게홈처럼 웹뷰로 만든 지면의 로딩을 인라인 스크립트 전략으로 30% 줄인 이야기예요. 먼저 필요한 스크립트만 골라 HTML에 넣는 방식이에요.', ['frontend'], ['웹뷰', 'JavaScript']),
      post('woowa-auto-approve', '2026-09-23', '사장님 입점신청 자동승인 주기를 10분에서 10초로', 'https://techblog.woowahan.com/27678/', '10분 주기 2단계 스케줄러를 걷어내고 10초 폴링으로 바꿔, 자동승인이 시작되기까지 최대 13분 가까이 걸리던 대기를 10초 안으로 줄였어요.', ['architecture'], ['스케줄러', 'DB']),
      post('woowa-contract', '2026-09-18', '배달의민족 전자계약서 화면 개편기: AI에게 맡긴 것과 사람이 챙긴 것', 'https://techblog.woowahan.com/27604/', '사장님과 영업 담당자가 쓰는 전자계약서 작성 화면을 개편하며, AI에게 맡긴 일과 사람이 직접 챙긴 일을 나눈 기록이에요.', ['ai-dev', 'frontend'], ['React', 'AI 코딩']),
      post('woowa-lazy', '2026-09-15', '집 나간 네트워크는 돌아왔는데 React.lazy는 왜 안 돌아올까', 'https://techblog.woowahan.com/27330/', '네트워크가 끊겼다 돌아온 뒤 React.lazy 화면이 오류를 내는 원인이, 모듈 로드 실패를 기억하는 HTML 스펙이었다는 이야기예요. 새로고침 없이 되살리는 방법을 찾았어요.', ['frontend'], ['React', 'Vite']),
      post('woowa-workflow', '2026-09-08', '한꺼번에 짊어지던 배치를 내려놓고, 하나씩 흘려보내는 워크플로로', 'https://techblog.woowahan.com/26832/', '포스 백엔드의 시간 지연 작업을 한꺼번에 도는 배치 대신 하나씩 흘려보내는 워크플로 엔진으로 바꿨어요. Temporal 대신 필요한 것만 골라 Claude로 직접 만든 점이 흥미로워요.', ['architecture', 'ai-dev'], ['워크플로', '배치']),
      post('woowa-archunit', '2026-09-07', '문서로만 지키던 아키텍처 규칙, 테스트 코드로 강제하기', 'https://techblog.woowahan.com/26835/', '위키와 AI 규칙 문서로만 지키던 헥사고날 아키텍처 규칙을 ArchUnit 테스트로 강제한 이야기예요.', ['architecture', 'ai-dev'], ['Java', 'ArchUnit']),
    ],
  },
  {
    companyId: 'line',
    blog: 'https://techblog.lycorp.co.jp/ko',
    platform: 'LY Corporation 기술 블로그',
    headline: 'AI 에이전트에게 무엇을 맡기고 어디서 사람이 판단할지 선을 긋는 데 고민이 많아요.',
    analysis:
      '최근 석 달 글 대부분이 AI 에이전트를 실제 업무에 넣은 사례예요. 광고 리포트, BI, 장애 분석, 보안까지 범위가 넓고, 글마다 LLM이 만든 결과를 믿고 실행하려면 무엇이 필요한지 묻고 있어요. MCP와 A2A 같은 연결 표준을 사내 인프라로 깔아 두는 일에도 힘을 쓰고 있어요.',
    concerns: [
      { title: 'LLM 결과를 믿고 실행하기', body: 'LLM이 만든 SQL과 리포트를 그대로 쓰지 않고, 검증 단계를 나눠 어디까지 맡길지 정하고 있어요.', posts: ['line-a2a', 'line-ad-report'] },
      { title: '에이전트를 위한 사내 연결 인프라', body: 'MCP Hub와 코드 기준 지식 문서로 에이전트가 사내 도구와 도메인 지식에 닿게 하고 있어요.', posts: ['line-mcp', 'line-wiki'] },
      { title: '장애 분석과 테스트를 AI로', body: '장애 알림의 원인 찾기와 E2E 회귀 테스트를 사람이 누르던 일에서 파이프라인으로 옮기고 있어요.', posts: ['line-sre', 'line-e2e'] },
    ],
    interview: [
      'AI를 쓴 프로젝트라면 결과를 그대로 쓰지 않고 어떻게 검증했는지 꼭 말해 보세요.',
      '글로벌 서비스라서 다국어 검색처럼 언어별 차이를 다룬 경험이 있으면 좋은 이야깃거리가 돼요.',
      'MCP나 A2A를 들어 봤다면 일반 REST API와 무엇이 다른지 한 문장으로 말할 수 있게 해 두세요.',
    ],
    posts: [
      post('line-mcp', '2026-10-26', 'Flava MCP Hub가 걸어온 길: AI 시대를 위한 배관 공사', 'https://techblog.lycorp.co.jp/ko/flava-mcp-hub-ai-infrastructure', 'AI 에이전트가 사내 서비스 상태를 그럴듯한 말이 아니라 쓸 수 있는 답으로 돌려주도록 MCP Hub를 만들어 온 과정이에요. 에이전트와 사내 도구를 잇는 일을 배관 공사에 빗댔어요.', ['ai-agent', 'ai-platform'], ['MCP', 'LLM']),
      post('line-e2e', '2026-10-16', "AI로 E2E 회귀 테스트 자동화하기: '딸깍'을 파이프라인으로 바꾸기까지", 'https://techblog.lycorp.co.jp/ko/ai-e2e-test-automation', '대만 Giftshop QA에서 AI로 E2E 회귀 테스트를 자동화한 이야기예요. 한 번 눌러 보는 시연을 매일 도는 파이프라인으로 바꾸기까지의 과정을 담았어요.', ['test-auto'], ['E2E 테스트', 'AI']),
      post('line-a2a', '2026-10-02', 'LLM이 만든 SQL을 믿고 실행하기까지: A2A 기반의 대화형 BI 애플리케이션 개발기', 'https://techblog.lycorp.co.jp/ko/a2a-conversational-bi-app', '게임 플랫폼 조직이 LLM이 만든 SQL을 믿고 실행할 수 있게 A2A 기반으로 대화형 BI 앱을 만든 개발기예요.', ['ai-agent', 'data-platform'], ['A2A', 'SQL']),
      post('line-ad-report', '2026-09-18', 'LLM에게 어디까지 맡길 것인가: AI 에이전트 기반 광고 분석 리포트 자동화', 'https://techblog.lycorp.co.jp/ko/ai-agent-ad-report-automation', '매일 움직이는 광고 KPI의 분석 리포트를 AI 에이전트로 자동화하며, LLM에게 맡길 일과 아닌 일의 선을 그은 이야기예요.', ['ai-agent'], ['AI 에이전트', '데이터 분석']),
      post('line-sre', '2026-09-04', '장애 Alert의 원인을 스스로 찾다: SRE Observer 개발기', 'https://techblog.lycorp.co.jp/ko/building-sre-observer-for-alert-root-cause-analysis', 'Home SRE 팀이 장애 알림이 오면 원인을 스스로 찾아 주는 SRE Observer를 만든 과정이에요.', ['observability', 'ai-agent'], ['SRE', 'LLM']),
      post('line-wiki', '2026-08-28', 'LLM Wiki: 코드 기준으로 자동 최신화되는 도메인 지식 SSOT 만들기', 'https://techblog.lycorp.co.jp/ko/llm-wiki-code-driven-knowledge-ssot', '코드를 기준으로 저절로 최신화되는 도메인 지식 문서를 만들어, AI로 개발할 때 참고하는 하나의 기준으로 삼은 이야기예요.', ['ai-dev'], ['LLM', '문서화']),
      post('line-search', '2026-08-21', '일본어 상품 검색 정확도 높이기: Elasticsearch + Kuromoji에서 OpenSearch + Sudachi로', 'https://techblog.lycorp.co.jp/ko/japanese-search-kuromoji-to-sudachi', '통합 커머스의 일본어 상품 검색 정확도를 높이려 형태소 분석기와 검색 엔진을 함께 바꾼 이야기예요.', ['search'], ['OpenSearch', 'Elasticsearch']),
    ],
  },
  {
    companyId: 'daangn',
    blog: 'https://medium.com/daangn',
    platform: '당근 테크 블로그(미디엄)',
    headline: '웹뷰를 넘어서는 앱 화면, 그리고 늘어난 LLM 호출의 비용을 잡는 데 고민이 많아요.',
    analysis:
      '당근은 프론트엔드 글의 비중이 특히 높아요. 웹뷰의 초기 로딩을 풀려고 Lynx라는 새 기술을 도입했고, 화면 위에 겹치는 UI처럼 사용자가 실제로 겪는 문제를 인턴 글로도 풀어내요. 백엔드에서는 LLM 비용과 Aurora 엔진 결함처럼 운영하면서 마주친 문제를 끝까지 파고드는 글이 이어져요.',
    concerns: [
      { title: '웹뷰 다음의 앱 화면', body: '웹뷰의 초기 로딩 문제를 풀려고 Lynx를 도입하고, 한 화면에 겹치는 모달과 팝업을 정리하고 있어요.', posts: ['daangn-lynx', 'daangn-overlay'] },
      { title: '운영 중 드러나는 비용과 결함', body: '모델만 바꿨는데 세 배가 된 LLM 비용, 인덱스 작업이 비운 버퍼풀처럼 운영 중 마주친 문제를 끝까지 따라가요.', posts: ['daangn-llm-cost', 'daangn-aurora'] },
      { title: '팀이 스스로 품질과 실험을 확인하기', body: '한 문장으로 앱을 테스트하는 QAHub와 실험플랫폼으로, 각 팀이 직접 검증하게 만들고 있어요.', posts: ['daangn-qahub', 'daangn-experiment'] },
    ],
    interview: [
      '당근 글은 결과보다 문제를 정의한 과정을 길게 써요. 내 프로젝트도 그 순서로 설명해 보세요.',
      '새 기술을 도입한 경험이 있다면 Lynx 글처럼 검토 기준과 버린 선택지를 같이 말해 보세요.',
      '백엔드라면 운영 중 장애나 비용 문제를 끝까지 추적한 경험을 하나 준비해 두세요.',
    ],
    posts: [
      post('daangn-llm-cost', '2026-10-21', '모델만 바꿨는데 LLM 비용이 3배가 된 이유', 'https://medium.com/daangn/%EB%AA%A8%EB%8D%B8%EB%A7%8C-%EB%B0%94%EA%BF%A8%EB%8A%94%EB%8D%B0-llm-%EB%B9%84%EC%9A%A9%EC%9D%B4-3%EB%B0%B0%EA%B0%80-%EB%90%9C-%EC%9D%B4%EC%9C%A0-5ae60ab5108b', '커뮤니티 피드 추천에 쓰는 LLM 분류 작업에서, 모델만 바꿨는데 비용이 세 배가 된 원인을 찾은 글이에요.', ['llm-cost', 'recommend'], ['LLM']),
      post('daangn-aurora', '2026-10-06', 'Aurora MySQL 인덱스 DDL이 Reader 버퍼풀을 비운다?', 'https://medium.com/daangn/aurora-mysql-%EC%9D%B8%EB%8D%B1%EC%8A%A4-ddl%EC%9D%B4-reader-%EB%B2%84%ED%8D%BC%ED%92%80%EC%9D%84-%EB%B9%84%EC%9A%B4%EB%8B%A4-16c6328dea50', '미사용 인덱스를 INVISIBLE로 바꾸는 가벼운 작업이 Reader의 버퍼풀을 비운 엔진 결함을 찾아, Aurora 3.14 릴리즈까지 이어진 이야기예요.', ['db-ops'], ['Aurora MySQL']),
      post('daangn-qahub', '2026-10-06', '한 문장으로 앱을 테스트하기까지', 'https://medium.com/daangn/%ED%95%9C-%EB%AC%B8%EC%9E%A5%EC%9C%BC%EB%A1%9C-%EC%95%B1%EC%9D%84-%ED%85%8C%EC%8A%A4%ED%8A%B8%ED%95%98%EA%B8%B0%EA%B9%8C%EC%A7%80-5340546886b5', '한 문장으로 요청하면 실제 기기에서 앱 테스트가 돌도록 QAHub를 만든 과정이에요. 각 팀이 직접 품질을 확인하게 하는 게 목표예요.', ['test-auto'], ['테스트 자동화', '모바일']),
      post('daangn-overlay', '2026-09-30', '당근 동네걷기 위에서 동시에 쏟아지는 오버레이들을 우아하게 제어하기', 'https://medium.com/daangn/%EB%8B%B9%EA%B7%BC-%EB%8F%99%EB%84%A4%EA%B1%B7%EA%B8%B0-%EC%9C%84%EC%97%90%EC%84%9C-%EB%8F%99%EC%8B%9C%EC%97%90-%EC%8F%9F%EC%95%84%EC%A7%80%EB%8A%94-%EC%98%A4%EB%B2%84%EB%A0%88%EC%9D%B4%EB%93%A4%EC%9D%84-%EC%9A%B0%EC%95%84%ED%95%98%EA%B2%8C-%EC%A0%9C%EC%96%B4%ED%95%98%EA%B8%B0-097551289b2a', '동네걷기 화면에서 모달, 바텀시트, OS 권한 팝업이 겹쳐 뜨는 문제를 FE 인턴이 정의하고 푼 기록이에요. 해결보다 문제를 정의한 과정을 자세히 썼어요.', ['frontend'], ['React', '상태 관리']),
      post('daangn-auth', '2026-08-20', '당근의 인증은 어떻게 달라져 왔을까요?', 'https://medium.com/daangn/%EB%8B%B9%EA%B7%BC%EC%9D%98-%EC%9D%B8%EC%A6%9D%EC%9D%80-%EC%96%B4%EB%96%BB%EA%B2%8C-%EB%8B%AC%EB%9D%BC%EC%A0%B8-%EC%99%94%EC%9D%84%EA%B9%8C%EC%9A%94-a50dd4b7b44c', 'SMS 인증부터 본인인증까지, 서비스가 자라며 당근의 인증 방식이 어떻게 바뀌었고 어떤 문제를 만났는지 정리했어요.', ['architecture'], ['인증']),
      post('daangn-lynx', '2026-08-12', '웹뷰 다음의 레일을 깔다: 당근이 Lynx를 선택한 이유', 'https://medium.com/daangn/%EC%9B%B9%EB%B7%B0-%EB%8B%A4%EC%9D%8C%EC%9D%98-%EB%A0%88%EC%9D%BC%EC%9D%84-%EA%B9%94%EB%8B%A4-%EB%8B%B9%EA%B7%BC%EC%9D%B4-lynx%EB%A5%BC-%EC%84%A0%ED%83%9D%ED%95%9C-%EC%9D%B4%EC%9C%A0-34dd50abbfb7', '웹뷰의 초기 로딩 문제를 풀려고 레퍼런스가 거의 없던 Lynx를 검토해 프로덕션 앱에 넣기까지의 판단 과정이에요.', ['frontend'], ['Lynx', '웹뷰']),
      post('daangn-experiment', '2026-08-04', '실험을 더 편하게 설계할 수 있게: 당근 실험플랫폼 이야기', 'https://medium.com/daangn/%EC%8B%A4%ED%97%98%EC%9D%84-%EB%8D%94-%ED%8E%B8%ED%95%98%EA%B2%8C-%EC%84%A4%EA%B3%84%ED%95%A0-%EC%88%98-%EC%9E%88%EA%B2%8C-%EB%8B%B9%EA%B7%BC-%EC%8B%A4%ED%97%98%ED%94%8C%EB%9E%AB%ED%8F%BC-%EC%9D%B4%EC%95%BC%EA%B8%B0-3fa344b4391b', 'A/B 테스트의 설계부터 결과 분석까지 한곳에서 하는 실험플랫폼을 더 쓰기 쉽게 다듬은 이야기예요.', ['data-platform'], ['A/B 테스트']),
      post('daangn-community', '2026-07-14', '천만 MAU를 지탱하는 커뮤니티 시스템을 소개해요', 'https://medium.com/daangn/%EC%B2%9C%EB%A7%8C-mau%EB%A5%BC-%EC%A7%80%ED%83%B1%ED%95%98%EB%8A%94-%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%8B%9C%EC%8A%A4%ED%85%9C%EC%9D%84-%EC%86%8C%EA%B0%9C%ED%95%B4%EC%9A%94-090fb4021e20', '모임, 카페, 아파트 같은 커뮤니티 서비스를 받치는 모듈러 모놀리스 구조를 소개해요.', ['architecture'], ['모듈러 모놀리스']),
    ],
  },
  {
    companyId: 'musinsa',
    blog: 'https://techblog.musinsa.com',
    platform: '무신사 테크 블로그',
    headline: 'AI 에이전트와 일하는 방식이 바뀌면서, 도메인 지식과 품질 검증을 어떻게 지킬지 고민하고 있어요.',
    analysis:
      '무신사는 9월 테크 컨퍼런스 이후 AI Native를 앞세운 글이 많아요. 코딩이 빨라진 만큼 병목이 판단과 검증으로 옮겨 갔다고 보고, 시맨틱 레이어와 테스트 자동화로 그 빈자리를 채우고 있어요. 오프라인 매장과 물류처럼 실제 공간이 얽힌 문제도 꾸준히 다뤄요.',
    concerns: [
      { title: 'AI와 함께 일하는 방식', body: '1인 1작업에서 1인 N작업으로 바뀌면서, 조직의 도메인 지식을 모든 에이전트가 같이 읽게 만들고 있어요.', posts: ['musinsa-ai-work', 'musinsa-semantic'] },
      { title: '빌드마다 도는 품질 검증', body: '앱 빌드와 웹 배포마다 실기기 테스트가 돌고, 빠른 기기가 느린 기기를 기다리지 않게 다시 짰어요.', posts: ['musinsa-bvt'] },
      { title: '로그가 장애가 되지 않게', body: '로그 쓰기가 막혀 서비스가 멈춘 장애를 겪고, 관측성과 가용성을 같이 잡는 방법을 찾았어요.', posts: ['musinsa-log'] },
    ],
    interview: [
      'AI 코딩 도구를 쓴다면 어디까지 맡기고 무엇을 직접 판단했는지 구체적으로 말해 보세요.',
      '커머스 개인화 글이 많아서, 추천이나 임베딩을 다뤄 본 경험이 있으면 좋은 연결 고리가 돼요.',
      '백엔드라면 로그 때문에 생긴 장애 글을 읽고, 내 서비스의 로깅 방식을 설명할 수 있게 해 두세요.',
    ],
    posts: [
      post('musinsa-ai-work', '2026-10-26', '대AI시대에 일하는 방식의 변화에 대한 고찰', 'https://techblog.musinsa.com/%EB%8C%80ai%EC%8B%9C%EB%8C%80%EC%97%90-%EC%9D%BC%ED%95%98%EB%8A%94-%EB%B0%A9%EC%8B%9D%EC%9D%98-%EB%B3%80%ED%99%94%EC%97%90-%EB%8C%80%ED%95%9C-%EA%B3%A0%EC%B0%B0-6d11e0b1fead', '물류플랫폼팀 백엔드 개발자가 AI 코딩 에이전트와 일하며 1인 1작업에서 1인 N작업으로 바뀐 과정을 돌아봐요. 병목이 코딩에서 판단으로 옮겨 갔다는 이야기예요.', ['ai-dev'], ['AI 코딩 에이전트']),
      post('musinsa-bvt', '2026-10-19', '빠른 기기가 왜 기다려야 하지?', 'https://techblog.musinsa.com/%EB%B9%A0%EB%A5%B8-%EA%B8%B0%EA%B8%B0%EA%B0%80-%EC%99%9C-%EA%B8%B0%EB%8B%A4%EB%A0%A4%EC%95%BC-%ED%95%98%EC%A7%80-a0533ee53dd2', '앱 빌드와 웹 배포마다 실기기에서 도는 빌드 검증 테스트를 프레임워크 3.0으로 바꾼 과정이에요. 빠른 기기가 느린 기기를 기다리던 구조를 고쳤어요.', ['test-auto'], ['테스트 자동화', '실기기 테스트']),
      post('musinsa-tablet', '2026-10-05', '태블릿을 없애자 생긴 문제', 'https://techblog.musinsa.com/%ED%83%9C%EB%B8%94%EB%A6%BF%EC%9D%84-%EC%97%86%EC%95%A0%EC%9E%90-%EC%83%9D%EA%B8%B4-%EB%AC%B8%EC%A0%9C-7d6a1cee7df5', '오프라인 매장 웨이팅에서 태블릿을 없애고 GPS로 매장 방문을 확인하자 생긴 위치 오차 문제와 싸운 기록이에요.', ['frontend'], ['위치 정보', '웹']),
      post('musinsa-log', '2026-10-01', '로그가 서비스를 죽였다', 'https://techblog.musinsa.com/%EB%A1%9C%EA%B7%B8%EA%B0%80-%EC%84%9C%EB%B9%84%EC%8A%A4%EB%A5%BC-%EC%A3%BD%EC%98%80%EB%8B%A4-4013e35a463b', '트래픽이 많은 서비스에서 stdout 로그 쓰기가 막혀 스레드가 멈추고 장애로 번진 원인을 찾았어요. 관측성과 가용성을 같이 잡는 로깅 방법을 다뤄요.', ['observability'], ['JVM', '로깅']),
      post('musinsa-embedding', '2026-08-31', '통합임베딩으로 개인화 푸시 CTR +21.3%를 만든 과정', 'https://techblog.musinsa.com/%ED%86%B5%ED%95%A9%EC%9E%84%EB%B2%A0%EB%94%A9%EC%9C%BC%EB%A1%9C-%EA%B0%9C%EC%9D%B8%ED%99%94-%ED%91%B8%EC%8B%9C-ctr-21-3-%EB%A5%BC-%EB%A7%8C%EB%93%A0-%EA%B3%BC%EC%A0%95-08bd63623aff', '유저를 하나의 임베딩으로 이해하고 여러 결정이 그것을 같이 쓰게 만들어, 개인화 푸시의 클릭률을 21.3% 올린 과정이에요.', ['recommend'], ['임베딩', 'ML']),
      post('musinsa-semantic', '2026-08-25', 'AI Native 조직은 도메인 지식을 어떻게 공유하는가', 'https://techblog.musinsa.com/ai-native-%EC%A1%B0%EC%A7%81%EC%9D%80-%EB%8F%84%EB%A9%94%EC%9D%B8-%EC%A7%80%EC%8B%9D%EC%9D%84-%EC%96%B4%EB%96%BB%EA%B2%8C-%EA%B3%B5%EC%9C%A0%ED%95%98%EB%8A%94%EA%B0%80-f2e3de607df3', '사람과 여러 AI가 같은 코드를 다룰 때, 조직만의 도메인 지식을 모든 에이전트가 읽게 만드는 2층 시맨틱 레이어 이야기예요.', ['ai-dev', 'ai-agent'], ['DDD', 'LLM']),
    ],
  },
  {
    companyId: 'bucketplace',
    blog: 'https://www.bucketplace.com/culture/Tech/',
    platform: '오늘의집 기술 블로그',
    headline: '구성원 누구나 AI로 만든 앱과 분석을 안전하게 실제 서비스에 올리는 방법을 고민하고 있어요.',
    analysis:
      '최근 글 다섯 개 중 네 개가 누구나 직접 만드는 플랫폼 이야기예요. 데이터 분석, 사내 앱, DB 변경까지 셀프서비스로 바꾸면서도, 보안과 운영 기준, 지표의 정의는 플랫폼이 지키도록 설계하고 있어요.',
    concerns: [
      { title: '셀프서비스와 기준 지키기', body: 'AI가 사내 데이터를 읽고 답하거나 누구나 앱을 올리게 하면서도, 지표 정의와 보안 기준은 플랫폼이 붙잡아요.', posts: ['bp-self-analytics', 'bp-oligo', 'bp-playground'] },
      { title: 'DB 운영 자동화', body: 'DB 변경은 Git PR로, 반복 운영 업무는 셀프서비스로 바꾸고 AI 리뷰를 게이트로 세웠어요.', posts: ['bp-dbre'] },
      { title: '사용자 테스트로 AI 기능 다듬기', body: '정답이 없는 제품 문제를 사용성 테스트를 여러 번 돌리며 빠르게 고쳐 나가요.', posts: ['bp-autotag'] },
    ],
    interview: [
      '셀프서비스 도구를 만든 경험이 있다면 사용자가 실수하지 않게 어떤 장치를 뒀는지 말해 보세요.',
      'DB를 다뤄 봤다면 운영 중 스키마를 바꿀 때 잠금을 어떻게 피했는지 준비해 두세요.',
      '기능을 만든 뒤 사용자 테스트로 바꾼 점이 있다면, 오토태깅 글처럼 회차별로 무엇이 달라졌는지 말해 보세요.',
    ],
    posts: [
      post('bp-self-analytics', '2026-10-29', '오늘의집 Self-Service Data Analytics 구축기', 'https://www.bucketplace.com/post/2026-10-29-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-self-service-data-analytics-%EA%B5%AC%EC%B6%95%EA%B8%B0/', 'AI가 사내 데이터를 읽고 오늘의집의 기준으로 답하도록 셀프서비스 데이터 분석 시스템을 만든 이야기예요. 업무 문서, 카탈로그, 시맨틱 레이어를 목적에 맞게 나눠 써요.', ['ai-agent', 'data-platform'], ['시맨틱 레이어', 'LLM']),
      post('bp-oligo', '2026-10-16', 'AI로 만든 앱, 실제 서비스가 되려면: 오늘의집 AI 개발 플랫폼 구축 오디세이', 'https://www.bucketplace.com/post/2026-10-16-ai%EB%A1%9C-%EB%A7%8C%EB%93%A0-%EC%95%B1-%EC%8B%A4%EC%A0%9C-%EC%84%9C%EB%B9%84%EC%8A%A4%EA%B0%80-%EB%90%98%EB%A0%A4%EB%A9%B4-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-ai-%EA%B0%9C%EB%B0%9C-%ED%94%8C%EB%9E%AB%ED%8F%BC-%EA%B5%AC%EC%B6%95-%EC%98%A4%EB%94%94%EC%84%B8%EC%9D%B4/', '구성원이 AI로 만든 앱을 회사의 보안과 운영 기준에 맞춰 올릴 수 있게 AI 개발 플랫폼 올리고를 만든 과정이에요.', ['ai-platform'], ['플랫폼 엔지니어링', '보안']),
      post('bp-dbre', '2026-10-07', 'DB 업무, 어디까지 자동화할까? DBRE의 두 가지 답', 'https://www.bucketplace.com/post/2026-10-07-db-%EC%97%85%EB%AC%B4-%EC%96%B4%EB%94%94%EA%B9%8C%EC%A7%80-%EC%9E%90%EB%8F%99%ED%99%94%ED%95%A0%EA%B9%8C-dbre%EC%9D%98-%EB%91%90-%EA%B0%80%EC%A7%80-%EB%8B%B5/', 'DB 변경은 Git PR로, 반복 운영 업무는 셀프서비스로 바꾼 DBRE의 자동화 이야기예요. Online DDL 옵션 판별과 AI 리뷰 게이트까지 다뤄요.', ['db-ops', 'ai-dev'], ['MySQL', 'MongoDB']),
      post('bp-autotag', '2026-09-21', '정답 없는 제품 문제를 빠르게 푸는 법: 오토태깅 개발기', 'https://www.bucketplace.com/post/2026-09-21-%EC%A0%95%EB%8B%B5-%EC%97%86%EB%8A%94-%EC%A0%9C%ED%92%88-%EB%AC%B8%EC%A0%9C%EB%A5%BC-%EB%B9%A0%EB%A5%B4%EA%B2%8C-%ED%91%B8%EB%8A%94-%EB%B2%95-%EC%98%A4%ED%86%A0%ED%83%9C%EA%B9%85-%EA%B0%9C%EB%B0%9C%EA%B8%B0/', '사진 속 상품을 AI로 찾아 태그를 붙이는 오토태깅을, 사용성 테스트를 여러 번 돌리며 다듬은 기록이에요.', ['ai-model'], ['컴퓨터 비전', '사용성 테스트']),
      post('bp-playground', '2026-08-30', 'Data Playground: 오늘의집 바이브 코딩 플랫폼', 'https://www.bucketplace.com/post/2026-08-30-data-playground-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-%EB%B0%94%EC%9D%B4%EB%B8%8C-%EC%BD%94%EB%94%A9-%ED%94%8C%EB%9E%AB%ED%8F%BC/', 'SQL과 HTML 템플릿만으로 사내 데이터 앱을 만들고 배포하는 플랫폼 이야기예요. 한 사람이 데이터부터 배포까지 스스로 하게 만들었어요.', ['ai-platform', 'data-platform'], ['SQL', 'Athena']),
    ],
  },
  {
    companyId: 'wanted',
    blog: 'https://medium.com/wantedjobs',
    platform: '원티드랩 기술 블로그(미디엄)',
    headline: '작은 팀이 AI 에이전트로 기다리는 시간을 없애는 방식에 관심이 많아요.',
    analysis:
      '글이 자주 올라오지는 않지만, 최근 두 글 모두 AI로 반복 업무를 자동화한 이야기예요. 디자인 시스템을 에이전트 루프로 돌려 티켓에서 머지까지 걸리는 시간을 크게 줄였고, 방치된 앱 리뷰도 일주일 만에 자동화했어요. 그 전에는 SEO와 웹 성능, 클라우드 비용처럼 서비스 지표를 직접 끌어올린 글이 중심이었어요.',
    concerns: [
      { title: 'AI로 기다리는 시간 없애기', body: '구현보다 기다림이 길었다는 걸 숫자로 확인하고, 에이전트 루프로 그 시간을 없애고 있어요.', posts: ['wanted-aidd', 'wanted-review'] },
      { title: '웹 성능과 검색 노출', body: '코어 웹 바이탈을 꾸준히 보며 거의 모든 URL을 좋은 URL로 바꿨어요.', posts: ['wanted-seo'] },
      { title: '클라우드 비용', body: '지운 데이터만큼 줄지 않던 Aurora 스토리지 비용을 잡았어요.', posts: ['wanted-aurora'] },
    ],
    interview: [
      '원티드 글은 지표로 시작해 지표로 끝나요. 프로젝트를 말할 때도 바꾸기 전과 후의 숫자를 준비해 두세요.',
      '프론트엔드라면 코어 웹 바이탈을 개선해 본 경험을 물어볼 수 있어요.',
    ],
    posts: [
      post('wanted-review', '2026-10-21', '앱 리뷰 자동화 일주일만에 만들기', 'https://medium.com/wantedjobs/%EC%95%B1-%EB%A6%AC%EB%B7%B0-%EC%9E%90%EB%8F%99%ED%99%94-%EC%9D%BC%EC%A3%BC%EC%9D%BC%EB%A7%8C%EC%97%90-%EB%A7%8C%EB%93%A4%EA%B8%B0-00a798a73975', '3년 동안 방치된 앱 리뷰에 다시 답글을 달려고, Android와 iOS 개발자 두 명이 일주일 만에 자동화 사이트를 만든 이야기예요.', ['ai-dev'], ['자동화', '모바일']),
      post('wanted-aidd', '2026-08-05', 'AI-Driven Development의 시대', 'https://medium.com/wantedjobs/ai-driven-development%EC%9D%98-%EC%8B%9C%EB%8C%80-4036e171b6eb', 'iOS 디자인 시스템을 에이전트 루프로 만들어, 보통 34.9일 걸리던 티켓에서 머지까지가 3.9일로 줄었어요. 대부분은 구현이 아니라 기다리는 시간이 사라진 덕분이었어요.', ['ai-dev'], ['SwiftUI', '디자인 시스템']),
      post('wanted-email', '2026-01-02', '웹과 다른 세계: 이메일 템플릿 작업에서 겪은 시행착오', 'https://medium.com/wantedjobs/%EC%9B%B9%EA%B3%BC-%EB%8B%A4%EB%A5%B8-%EC%84%B8%EA%B3%84-%EC%9D%B4%EB%A9%94%EC%9D%BC-%ED%85%9C%ED%94%8C%EB%A6%BF-%EC%9E%91%EC%97%85%EC%97%90%EC%84%9C-%EA%B2%AA%EC%9D%80-%EC%8B%9C%ED%96%89%EC%B0%A9%EC%98%A4-e993d78f1a85', '채용 안내 이메일 템플릿을 반응형으로 바꾸며, 웹과 다른 이메일 클라이언트의 제약을 겪은 시행착오예요.', ['frontend'], ['HTML 이메일']),
      post('wanted-aurora', '2025-11-20', '데이터는 지웠는데 비용은 그대로? Aurora 스토리지 비용 최적화 하기', 'https://medium.com/wantedjobs/%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%8A%94-%EC%A7%80%EC%9B%A0%EB%8A%94%EB%8D%B0-%EB%B9%84%EC%9A%A9%EC%9D%80-%EA%B7%B8%EB%8C%80%EB%A1%9C-aurora-%EC%8A%A4%ED%86%A0%EB%A6%AC%EC%A7%80-%EB%B9%84%EC%9A%A9-%EC%B5%9C%EC%A0%81%ED%99%94-%ED%95%98%EA%B8%B0-43d208f6564d', '실제 데이터는 310GB인데 2TB만큼 비용이 나오던 Aurora 스토리지를 Snapshot과 Restore로 줄인 과정이에요.', ['db-ops'], ['Aurora', 'AWS']),
      post('wanted-seo', '2025-11-04', "SEO 주도 개발 실천기: 구글이 인정한 '좋은 URL' 99% 달성 여정", 'https://medium.com/wantedjobs/seo-%EC%A3%BC%EB%8F%84-%EA%B0%9C%EB%B0%9C-%EC%8B%A4%EC%B2%9C%EA%B8%B0-%EA%B5%AC%EA%B8%80%EC%9D%B4-%EC%9D%B8%EC%A0%95%ED%95%9C-%EC%A2%8B%EC%9D%80-url-99-%EB%8B%AC%EC%84%B1-%EC%97%AC%EC%A0%95-7e494b56d39b', 'Google Search Console의 코어 웹 바이탈을 꾸준히 보며 원티드 URL의 99%를 좋은 URL로 바꾼 SEO 주도 개발 이야기예요.', ['frontend'], ['Next.js', 'SEO']),
    ],
  },
  {
    companyId: 'coupang',
    blog: 'https://medium.com/coupang-engineering',
    platform: '쿠팡 엔지니어링 블로그(미디엄)',
    headline: '최근 1년 넘게 새 글이 없어요. 마지막 글들은 ML 플랫폼을 LLM까지 넓히는 이야기였어요.',
    analysis:
      '쿠팡 엔지니어링 블로그는 2024년 10월 이후 새 글이 없어요. 남아 있는 글은 ML 플랫폼, 로켓배송의 공간 색인, 클라우드 비용처럼 큰 규모의 물류와 커머스를 받치는 기반 기술이 중심이에요. 요즘 고민을 알려면 블로그보다 채용 공고의 우대 역량을 같이 보는 게 좋아요.',
    concerns: [
      { title: 'ML 플랫폼을 LLM까지', body: '검색, 광고, 추천에 쓰던 ML 플랫폼을 LLM 학습과 서빙까지 넓혔어요.', posts: ['coupang-llm', 'coupang-ml'] },
      { title: '물류를 위한 공간 데이터', body: '배송 영역을 공간 색인으로 나누고 시각화해서 배송 효율을 높였어요.', posts: ['coupang-geo'] },
      { title: '클라우드 비용', body: '여러 조직이 함께 온디맨드 비용을 관리하는 원칙을 세웠어요.', posts: ['coupang-cloud'] },
    ],
    interview: [
      '물류처럼 실제 공간을 다루는 문제를 풀어 본 경험이 있으면 이야기하기 좋아요.',
      '블로그가 오래되어서, 면접에서 글을 꺼낸다면 지금은 어떻게 바뀌었을지 질문으로 바꿔 보세요.',
    ],
    posts: [
      post('coupang-llm', '2024-10-14', 'Accelerating Coupang’s AI Journey with LLMs', 'https://medium.com/coupang-engineering/accelerating-coupangs-ai-journey-with-llms-2817d55004d3', '검색, 광고, 카탈로그, 추천에 쓰던 머신러닝을 LLM까지 넓히며 ML 플랫폼 팀이 겪은 일을 정리한 영어 글이에요.', ['ai-platform', 'ai-model'], ['LLM', 'ML 플랫폼']),
      post('coupang-ml', '2023-11-23', '쿠팡의 머신러닝 플랫폼을 통한 ML 개발 가속화', 'https://medium.com/coupang-engineering/%EC%BF%A0%ED%8C%A1%EC%9D%98-%EB%A8%B8%EC%8B%A0%EB%9F%AC%EB%8B%9D-%ED%94%8C%EB%9E%AB%ED%8F%BC%EC%9D%84-%ED%86%B5%ED%95%9C-ml-%EA%B0%9C%EB%B0%9C-%EA%B0%80%EC%86%8D%ED%99%94-de29804148bb', '쿠팡이츠, 쿠팡플레이까지 여러 서비스의 ML 개발 속도를 높이는 사내 ML 플랫폼을 소개해요.', ['ai-platform'], ['ML 파이프라인']),
      post('coupang-geo', '2023-04-18', '쿠팡 로켓배송: 공간 색인 기반의 새로운 배송 영역 관리 시스템', 'https://medium.com/coupang-engineering/%EC%BF%A0%ED%8C%A1-%EB%A1%9C%EC%BC%93%EB%B0%B0%EC%86%A1-%EA%B3%B5%EA%B0%84-%EC%83%89%EC%9D%B8-%EA%B8%B0%EB%B0%98%EC%9D%98-%EB%B0%B0%EC%86%A1-%EC%98%81%EC%97%AD-%EA%B4%80%EB%A6%AC-%EC%8B%9C%EC%8A%A4%ED%85%9C-a59006bc4b6e', '로켓배송의 배송 영역을 공간 색인으로 관리하고 시각화한 시스템이에요.', ['architecture'], ['H3', '지도']),
      post('coupang-cloud', '2023-03-27', '클라우드 서비스 사용량 관리를 통한 운영 비용 최적화', 'https://medium.com/coupang-engineering/%ED%81%B4%EB%9D%BC%EC%9A%B0%EB%93%9C-%EC%84%9C%EB%B9%84%EC%8A%A4-%EC%82%AC%EC%9A%A9%EB%9F%89-%EA%B4%80%EB%A6%AC%EB%A5%BC-%ED%86%B5%ED%95%9C-%EC%9A%B4%EC%98%81-%EB%B9%84%EC%9A%A9-%EC%B5%9C%EC%A0%81%ED%99%94-1521565c64ec', '여러 엔지니어링 조직이 함께 클라우드 온디맨드 비용을 줄인 원칙과 결과예요.', ['infra'], ['AWS', '비용 최적화']),
    ],
  },
  {
    companyId: 'zigbang',
    blog: 'https://medium.com/zigbang',
    platform: '직방 기술 블로그(미디엄)',
    headline: '2023년 12월 이후 새 글이 없어요. 마지막 글들은 Node.js 백엔드와 React Native 앱 운영 이야기였어요.',
    analysis:
      '직방 기술 블로그는 2023년 말 이후 멈춰 있어요. 남은 글로 보면 Node.js와 TypeScript 백엔드, React Native 앱, MySQL 튜닝처럼 쓰는 기술이 분명하게 드러나요. 요즘 고민은 공고의 요구 역량으로 같이 확인해 보세요.',
    concerns: [
      { title: '앱을 심사 없이 나눠 배포하기', body: 'React Native 앱에 모듈 페더레이션을 더해 모듈별로 업데이트하려 했어요.', posts: ['zigbang-mf'] },
      { title: '백엔드 흐름 추적', body: '로그와 지표만으로 안 보이던 흐름을 트레이스로 보려 했어요.', posts: ['zigbang-otel'] },
      { title: '쿼리 성능', body: '인덱스가 있는데도 느린 쿼리를 사례별로 정리했어요.', posts: ['zigbang-mysql'] },
    ],
    interview: [
      'Node.js나 React Native를 써 봤다면 직방의 스택과 바로 이어져요.',
      '블로그가 오래되어서, 지금도 같은 방식을 쓰는지 면접에서 질문으로 확인해 보세요.',
    ],
    posts: [
      post('zigbang-mysql', '2023-12-18', 'MYSQL 인덱스 튜닝', 'https://medium.com/zigbang/mysql-%EC%9D%B8%EB%8D%B1%EC%8A%A4-%ED%8A%9C%EB%8B%9D-18e183e9246d', '호갱노노 BE팀이 인덱스가 있는데도 느린 쿼리 사례를 중심으로 MySQL 인덱스 튜닝을 정리했어요.', ['db-ops'], ['MySQL']),
      post('zigbang-mf', '2023-10-26', 'react-native 에 모듈 페더레이션 더하기 (with. RePack)', 'https://medium.com/zigbang/react-native-%EC%97%90-%EB%AA%A8%EB%93%88-%ED%8E%98%EB%8D%94%EB%A0%88%EC%9D%B4%EC%85%98-%EB%8D%94%ED%95%98%EA%B8%B0-with-repack-12288f15e617', 'React Native 앱에 RePack으로 모듈 페더레이션을 더해, 심사 없이 모듈별로 업데이트하는 방법을 다뤄요.', ['frontend'], ['React Native', 'RePack']),
      post('zigbang-otel', '2023-09-15', 'Tracing NodeJs Applications with OpenTelemetry', 'https://medium.com/zigbang/tracing-nodejs-applications-with-opentelemetry-624958d38d4d', 'Node.js 애플리케이션에 OpenTelemetry로 트레이스를 붙여, 로그와 지표만으로는 안 보이던 흐름을 본 영어 글이에요.', ['observability'], ['Node.js', 'OpenTelemetry']),
    ],
  },
]

/** 기술 블로그 요약이 있는 기업이에요. 기업 목록(`COMPANIES`)의 순서를 따라요. */
export function blogCompaniesOf(digests: BlogDigest[]): Company[] {
  const ids = new Set(digests.map((digest) => digest.companyId))
  return COMPANIES.filter((company) => ids.has(company.id))
}

const dayMs = 86_400_000
const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / dayMs)

/** 마지막 글이 오래되어 멈춘 블로그인지예요. */
export const isStale = (digest: BlogDigest) => digest.posts.length > 0 && daysBetween(digest.posts[0].date, COLLECTED_AT) > STALE_DAYS

/** 기업의 글에 자주 나온 기술이에요. */
export function topSkills(digest: BlogDigest, limit = 8): string[] {
  const counts = new Map<string, number>()
  for (const item of digest.posts) for (const skill of item.skills) counts.set(skill, (counts.get(skill) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([skill]) => skill)
}

export interface ThemeTrend {
  theme: BlogTheme
  /** 이 주제로 최근에 글을 쓴 기업 */
  companies: string[]
  posts: number
}

/** 여러 기업에 걸친 요즘 흐름이에요. 최근 넉 달 글에서 주제마다 몇 곳이 썼는지 세요. */
export function themeTrends(digests: BlogDigest[]): { trends: ThemeTrend[]; active: number } {
  const map = new Map<BlogTheme, ThemeTrend>()
  let active = 0
  for (const digest of digests) {
    const recent = digest.posts.filter((item) => daysBetween(item.date, COLLECTED_AT) <= RECENT_DAYS)
    if (recent.length) active += 1
    for (const item of recent) {
      for (const theme of item.themes) {
        const trend = map.get(theme) ?? { theme, companies: [], posts: 0 }
        trend.posts += 1
        if (!trend.companies.includes(digest.companyId)) trend.companies.push(digest.companyId)
        map.set(theme, trend)
      }
    }
  }
  const trends = [...map.values()].sort((a, b) => b.companies.length - a.companies.length || b.posts - a.posts)
  return { trends, active }
}

/** 기술 블로그 요약 전체예요(GET /blogs). 서버에 닿지 못하면 적어 둔 글을 보여줘요. 글은 최신 순서로 맞춰 둬요. */
export async function fetchBlogDigests(): Promise<BlogDigest[]> {
  try {
    const result = await readResult<BlogDigest[]>(await fetch(apiUrl('/blogs')))
    if (result.ok && Array.isArray(result.data)) {
      COLLECTED_AT = today()
      return result.data.map((digest) => ({
        ...digest,
        concerns: digest.concerns ?? [],
        interview: digest.interview ?? [],
        posts: [...(digest.posts ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)),
      }))
    }
  } catch {
    // 아래에서 적어 둔 글을 보여줘요.
  }
  COLLECTED_AT = FALLBACK_COLLECTED_AT
  const ids = new Set(COMPANIES.map((company) => company.id))
  return DIGESTS.filter((digest) => ids.has(digest.companyId))
}
