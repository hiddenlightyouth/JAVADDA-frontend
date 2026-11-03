/**
 * 면접 질문을 소리 내어 읽기 좋은 글로 바꿔요(`worker/tts.ts`가 ElevenLabs에 보내기 전에 불러요).
 * 모델은 한국어 문장 속의 숫자와 영어를 그대로 두면 영어 억양으로 튀거나, 3개를 삼개로 읽거나, 엉뚱한 자리에서 숨을 쉬어요.
 * 화면 글자는 그대로 두고 읽을 글만 바꿔서, 글자 시각을 화면 글자 기준으로 되돌릴 수 있게 조각(Piece)으로 나눠 둬요.
 */

/** 화면에 보이는 글 조각과 소리 내어 읽을 조각이에요. 둘이 같으면 바꾸지 않은 조각이에요. */
export interface Piece { shown: string; spoken: string }

const LETTERS: Record<string, string> = {
  A: '에이', B: '비', C: '씨', D: '디', E: '이', F: '에프', G: '지', H: '에이치', I: '아이', J: '제이', K: '케이', L: '엘', M: '엠',
  N: '엔', O: '오', P: '피', Q: '큐', R: '알', S: '에스', T: '티', U: '유', V: '브이', W: '더블유', X: '엑스', Y: '와이', Z: '지',
}

/**
 * 영어 기술 용어의 한국어 발음이에요. 대소문자는 가리지 않아요.
 * 대문자 약어는 사전에 없으면 알파벳을 하나씩 읽으니, JSON(제이슨)이나 CRUD(크루드)처럼 낱말로 읽는 약어만 적어요.
 * useEffect, ConcurrentHashMap처럼 붙여 쓴 이름은 낱말로 나눠 찾으니, 낱말 하나씩 적어 두면 돼요.
 */
const WORDS: Record<string, string> = {
  // 언어
  java: '자바', javascript: '자바스크립트', typescript: '타입스크립트', js: '제이에스', ts: '티에스', python: '파이썬', kotlin: '코틀린', swift: '스위프트',
  go: '고', golang: '고랭', rust: '러스트', scala: '스칼라', ruby: '루비', php: '피에이치피', dart: '다트', sql: '에스큐엘', nosql: '노에스큐엘',
  // 프레임워크와 라이브러리
  spring: '스프링', boot: '부트', batch: '배치', security: '시큐리티', webflux: '웹플럭스', jpa: '제이피에이', hibernate: '하이버네이트',
  querydsl: '쿼리디에스엘', mybatis: '마이바티스', junit: '제이유닛', mockito: '모키토', gradle: '그레이들', maven: '메이븐', lombok: '롬복',
  react: '리액트', vue: '뷰', next: '넥스트', nuxt: '넉스트', node: '노드', nest: '네스트', express: '익스프레스', angular: '앵귤러', svelte: '스벨트',
  redux: '리덕스', recoil: '리코일', zustand: '주스탠드', webpack: '웹팩', vite: '비트', tailwind: '테일윈드', storybook: '스토리북', jest: '제스트',
  android: '안드로이드', ios: '아이오에스', flutter: '플러터', compose: '컴포즈', swiftui: '스위프트유아이', jetpack: '젯팩', coroutine: '코루틴', coroutines: '코루틴',
  django: '장고', flask: '플라스크', fastapi: '패스트에이피아이', pandas: '판다스', numpy: '넘파이', pytorch: '파이토치', tensorflow: '텐서플로',
  // 데이터와 인프라
  mysql: '마이에스큐엘', postgresql: '포스트그레스큐엘', postgres: '포스트그레스', mongodb: '몽고디비', redis: '레디스', oracle: '오라클', mariadb: '마리아디비',
  elasticsearch: '엘라스틱서치', kafka: '카프카', rabbitmq: '래빗엠큐', spark: '스파크', hadoop: '하둡', airflow: '에어플로우', dynamodb: '다이나모디비',
  docker: '도커', kubernetes: '쿠버네티스', k8s: '쿠버네티스', jenkins: '젠킨스', terraform: '테라폼', ansible: '앤서블', nginx: '엔진엑스', linux: '리눅스',
  prometheus: '프로메테우스', grafana: '그라파나', github: '깃허브', gitlab: '깃랩', git: '깃', actions: '액션스', lambda: '람다', argo: '아르고', helm: '헬름',
  aws: '에이더블유에스', azure: '애저', cloud: '클라우드', cloudflare: '클라우드플레어', vercel: '버셀', firebase: '파이어베이스',
  // 통신과 보안
  graphql: '그래프큐엘', rest: '레스트', restful: '레스트풀', grpc: '지알피씨', websocket: '웹소켓', socket: '소켓', oauth: '오어스', auth: '오스',
  json: '제이슨', yaml: '야믈', ajax: '에이잭스', https: '에이치티티피에스', handshake: '핸드셰이크', token: '토큰', session: '세션', cookie: '쿠키',
  // 약어지만 낱말로 읽는 것
  crud: '크루드', solid: '솔리드', dom: '돔', ram: '램', acid: '애시드', rag: '래그', saas: '사스', dao: '다오', dry: '드라이', kiss: '키스', wal: '왈',
  // 설계와 운영
  deadlock: '데드락', index: '인덱스', cache: '캐시', caching: '캐싱', query: '쿼리', thread: '스레드', transaction: '트랜잭션', lock: '락',
  pool: '풀', connection: '커넥션', replication: '레플리케이션', sharding: '샤딩', partition: '파티션', partitioning: '파티셔닝', scale: '스케일', out: '아웃', up: '업',
  load: '로드', balancer: '밸런서', balancing: '밸런싱', circuit: '서킷', breaker: '브레이커', retry: '리트라이', timeout: '타임아웃', fallback: '폴백',
  consumer: '컨슈머', producer: '프로듀서', topic: '토픽', broker: '브로커', offset: '오프셋', event: '이벤트', driven: '드리븐', sourcing: '소싱',
  saga: '사가', outbox: '아웃박스', microservice: '마이크로서비스', microservices: '마이크로서비스', monolith: '모놀리스', gateway: '게이트웨이',
  deploy: '디플로이', deployment: '디플로이먼트', rollback: '롤백', canary: '카나리', blue: '블루', green: '그린', pipeline: '파이프라인', monitoring: '모니터링',
  logging: '로깅', log: '로그', trace: '트레이스', tracing: '트레이싱', metric: '메트릭', metrics: '메트릭', alert: '얼럿', hotfix: '핫픽스',
  // 협업
  pull: '풀', push: '푸시', request: '리퀘스트', response: '리스폰스', merge: '머지', rebase: '리베이스', branch: '브랜치', commit: '커밋', review: '리뷰',
  refactoring: '리팩터링', refactor: '리팩터', sprint: '스프린트', scrum: '스크럼', agile: '애자일', kanban: '칸반', jira: '지라', slack: '슬랙', notion: '노션', figma: '피그마',
  // 코드
  map: '맵', hash: '해시', hashmap: '해시맵', list: '리스트', set: '셋', tree: '트리', heap: '힙', stack: '스택', queue: '큐', array: '어레이', string: '스트링',
  object: '오브젝트', class: '클래스', interface: '인터페이스', async: '어싱크', await: '어웨이트', promise: '프로미스', callback: '콜백', closure: '클로저',
  hook: '훅', hooks: '훅스', state: '스테이트', props: '프롭스', component: '컴포넌트', components: '컴포넌트', virtual: '버추얼', rendering: '렌더링', render: '렌더',
  hydration: '하이드레이션', bundle: '번들', bundling: '번들링', lazy: '레이지', loading: '로딩', memo: '메모', use: '유즈', effect: '이펙트', callbacks: '콜백',
  concurrent: '컨커런트', local: '로컬', repository: '리포지토리', service: '서비스', controller: '컨트롤러', entity: '엔티티', bean: '빈', proxy: '프록시',
  garbage: '가비지', collection: '컬렉션', collector: '컬렉터', stream: '스트림', optional: '옵셔널', null: '널', exception: '익셉션', runtime: '런타임',
  frontend: '프론트엔드', backend: '백엔드', devops: '데브옵스', server: '서버', client: '클라이언트', test: '테스트', code: '코드', data: '데이터', way: '웨이',
}

/** 숫자 바로 뒤에 붙은 단위예요. 숫자는 일, 이, 삼으로 읽어요. */
const UNITS: Record<string, string> = {
  ms: '밀리초', sec: '초', kb: '킬로바이트', mb: '메가바이트', gb: '기가바이트', tb: '테라바이트', tps: '티피에스', qps: '큐피에스', rps: '알피에스',
}

/** 수를 세는 말이에요. 앞의 숫자를 한, 두, 세로 읽어요(99까지). 개월은 개가 아니라서 빼요. */
const NATIVE_COUNTER = /^(?:번째|가지|시간|군데|개(?!월)|명|번|살|잔|곳|달|배|마리|권|건)/
/** 일, 이, 삼으로 읽는 단위예요. 숫자와 띄어 읽어야 또렷해서 따로 알아봐요. */
const SINO_COUNTER = /^(?:년|개월|주|일|초|분|차|회|단계|문단|위|점|원|층|대)/

const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉']
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔']
/** HTTP/2, EC2, N+1처럼 영어에 붙은 숫자는 영어로 읽어요. */
const ENGLISH = ['제로', '원', '투', '쓰리', '포', '파이브', '식스', '세븐', '에잇', '나인', '텐', '일레븐', '트웰브', '써틴', '포틴', '피프틴', '식스틴', '세븐틴', '에이틴', '나인틴', '트웬티']

/** 1234를 천이백삼십사로 읽어요. 일만이 아니라 만, 일천이 아니라 천이에요. */
function sino(n: number): string {
  if (n === 0) return '영'
  const groups = ['', '만', '억', '조']
  let out = ''
  for (let group = 0; n > 0 && group < groups.length; group++, n = Math.floor(n / 10000)) {
    const part = n % 10000
    if (!part) continue
    const digits = [Math.floor(part / 1000), Math.floor(part / 100) % 10, Math.floor(part / 10) % 10, part % 10]
    const units = ['천', '백', '십', '']
    let words = digits.map((digit, index) => (!digit ? '' : (digit === 1 && units[index] ? '' : SINO[digit]) + units[index])).join('')
    if (group === 1 && part === 1) words = ''
    out = words + groups[group] + (out ? ' ' : '') + out
  }
  return out
}

function native(n: number, ordinal: boolean): string {
  if (ordinal && n === 1) return '첫'
  if (n === 20) return '스무'
  return NATIVE_TENS[Math.floor(n / 10)] + NATIVE_ONES[n % 10]
}

function english(digits: string): string {
  const n = Number(digits)
  return n <= 20 && !/^0\d/.test(digits) ? ENGLISH[n] : [...digits].map((digit) => ENGLISH[Number(digit)]).join('')
}

const spell = (letters: string) => [...letters.toUpperCase()].map((letter) => LETTERS[letter] ?? letter).join('')

/** 영어 낱말 하나를 읽어요. 모르는 낱말은 그대로 둬서 모델이 영어로 읽어요. */
function pronounceWord(word: string): string {
  const known = WORDS[word.toLowerCase()]
  if (known) return known
  // APIs, DBs처럼 대문자 약어에 붙은 s
  if (/^[A-Z]{2,}s$/.test(word)) return spell(word.slice(0, -1)) + '스'
  if (/^[A-Z]+$/.test(word)) return word.length <= 6 ? spell(word) : word
  // EC2, S3, OAuth2처럼 뒤에 붙은 숫자
  const tail = word.match(/^([A-Za-z]+)(\d+)$/)
  if (tail) {
    const head = pronounceWord(tail[1])
    return head === tail[1] ? word : head + english(tail[2])
  }
  // useEffect, ConcurrentHashMap, JpaRepository처럼 붙여 쓴 이름은 낱말마다 읽어요. 하나라도 모르면 통째로 영어로 둬요.
  const parts = word.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? []
  if (parts.length > 1) {
    const spoken = parts.map((part) => (/^\d+$/.test(part) ? english(part) : WORDS[part.toLowerCase()] ?? (/^[A-Z]+$/.test(part) ? spell(part) : null)))
    if (spoken.every((part) => part !== null)) return spoken.join('')
  }
  return word
}

const ATOM = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?[A-Za-z]*|[A-Za-z][A-Za-z0-9]*|\+\+|[.\-/+~#]/g
const isLetters = (atom: string | undefined) => !!atom && /^[A-Za-z]/.test(atom)
const isNumber = (atom: string | undefined) => !!atom && /^\d/.test(atom)

/**
 * 영어와 숫자가 섞인 덩어리 하나(Node.js, HTTP/2, N+1, 3~5, 99.9%, 200ms)를 읽어요.
 * after는 덩어리 바로 뒤의 글이에요. 3개, 3년처럼 뒤에 오는 말을 보고 숫자를 세 개로 읽을지 삼 년으로 읽을지 정해요.
 */
function speakChunk(chunk: string, after: string): string {
  const percent = chunk.match(/%p?$/)?.[0] ?? ''
  const atoms = chunk.slice(0, chunk.length - percent.length).match(ATOM) ?? []
  const counter = percent ? null : after.match(NATIVE_COUNTER)?.[0] ?? null
  const unit = percent ? null : counter ?? after.match(SINO_COUNTER)?.[0] ?? null
  const words = atoms.map((atom, index) => {
    const before = atoms[index - 1]
    const next = atoms[index + 1]
    if (atom === '#') return '샵'
    if (atom === '++') return '플러스플러스'
    if (atom === '+') return ' 플러스 '
    if (atom === '.') return ''
    if (atom === '/') return ' '
    // 3~5명은 세에서 다섯 명보다 세 명에서 다섯 명이 자연스러워요.
    if (atom === '~' || (atom === '-' && isNumber(before) && isNumber(next))) return unit ? ` ${unit}에서 ` : '에서 '
    if (atom === '-') return ' '
    if (isLetters(atom)) return pronounceWord(atom)
    const [, whole, fraction, letters] = atom.match(/^([\d,]+)(?:\.(\d+))?([A-Za-z]*)$/) ?? []
    const n = Number(whole.replace(/,/g, ''))
    if (letters) {
      const suffix = UNITS[letters.toLowerCase()]
      if (suffix) return `${sino(n)}${fraction ? ` 점 ${[...fraction].map((digit) => sino(Number(digit))).join('')}` : ''} ${suffix}`
      if (letters.toLowerCase() === 'x' && !fraction && n > 0 && n < 100) return `${native(n, false)} 배`
      return english(whole) + pronounceWord(letters)
    }
    const attached = !fraction && ((isLetters(atoms[index - 2]) && (before === '+' || before === '-' || before === '/')) || (next === '-' && isLetters(atoms[index + 2])))
    if (attached) return english(whole)
    if (fraction) return `${sino(n)} 점 ${[...fraction].map((digit) => sino(Number(digit))).join('')}`
    return counter && n > 0 && n < 100 ? native(n, counter === '번째') : sino(n)
  })
  const spoken = (words.join('') + (percent === '%p' ? ' 퍼센트포인트' : percent ? ' 퍼센트' : '')).replace(/ {2,}/g, ' ').trim()
  return unit && isNumber(atoms[atoms.length - 1]) ? spoken + ' ' : spoken
}

/** 영어나 숫자로 시작하는 덩어리예요. 점, 줄표, 빗금, 더하기, 물결로 이은 것까지 한 덩어리로 읽어요. 혼자 쓴 더하기와 괄호도 같이 찾아요. */
const CHUNK = /(?:[A-Za-z][A-Za-z0-9]*|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?[A-Za-z]*)(?:[.\-/+~](?:[A-Za-z][A-Za-z0-9]*|\d+(?:\.\d+)?[A-Za-z]*)|\+\+|#)*(?:%p?)?|\+|[()]/g

export function piecesOf(text: string): Piece[] {
  const pieces: Piece[] = []
  let last = 0
  for (const match of text.matchAll(CHUNK)) {
    const index = match.index ?? 0
    if (index > last) pieces.push({ shown: text.slice(last, index), spoken: text.slice(last, index) })
    const shown = match[0]
    const after = text.slice(index + shown.length)
    let spoken: string
    if (shown === '+') spoken = '플러스'
    // 괄호는 소리 내지 않고, 괄호 안을 덧붙이는 말처럼 살짝 쉬어 읽어요.
    else if (shown === '(') spoken = ' '
    else if (shown === ')') spoken = /^\s/.test(after) ? ',' : ''
    else spoken = speakChunk(shown, after)
    pieces.push({ shown, spoken })
    last = index + shown.length
    if (spoken === shown) continue
    const particle = particleFor(spoken, after)
    if (particle) {
      pieces.push(particle)
      last += particle.shown.length
    }
  }
  if (last < text.length) pieces.push({ shown: text.slice(last), spoken: text.slice(last) })
  return text.length >= PAUSE_MIN_CHARS ? withPauses(pieces) : pieces
}

/**
 * 영어 낱말 뒤의 조사는 글쓴이가 영어 철자를 보고 붙여서, 한국어로 읽으면 어긋나곤 해요(Actions을, Redis이). 읽은 소리의 받침에 맞춰 조사를 고쳐 읽어요.
 * 이에요, 이고처럼 뒤에 말이 더 붙은 이는 조사가 아닐 수 있어서 건드리지 않아요.
 */
const PARTICLES: [RegExp, string, string][] = [
  [/^(?:을|를)(?![가-힣])/, '을', '를'],
  [/^(?:은|는)(?![가-힣])/, '은', '는'],
  [/^(?:이|가)(?![가-힣])/, '이', '가'],
  [/^(?:과|와)(?![가-힣])/, '과', '와'],
  [/^(?:으로|로)/, '으로', '로'],
]

function particleFor(spoken: string, after: string): Piece | null {
  const last = spoken.charCodeAt(spoken.length - 1) - 0xac00
  if (last < 0 || last > 11171) return null
  const final = last % 28
  for (const [pattern, withFinal, without] of PARTICLES) {
    const shown = after.match(pattern)?.[0]
    if (!shown) continue
    // ㄹ 받침 뒤에는 으로가 아니라 로예요.
    const want = final && !(withFinal === '으로' && final === 8) ? withFinal : without
    return { shown, spoken: want }
  }
  return null
}

/** 이보다 짧은 문장은 쉼표 없이도 한 호흡에 자연스럽게 읽어요. */
const PAUSE_MIN_CHARS = 30
/** 앞에서 쉰 뒤로 이만큼은 말해야 다시 쉬어요. 너무 자주 쉬면 말이 뚝뚝 끊겨요. */
const PAUSE_GAP = 8
/** 남은 말이 이보다 짧으면 쉬지 않고 이어서 끝내요. "설명해 주세요" 앞에서 쉬면 어색해요. */
const PAUSE_TAIL = 8
/**
 * 쉼표 없이 긴 문장을 주면 모델이 엉뚱한 자리에서 숨을 쉬어요. 절이 이어지는 어미(~는데, ~면서, ~했을 때) 뒤에 읽기용 쉼표를 넣어 사람이 쉬는 자리에서 쉬게 해요.
 * 화면 글자에는 없는 쉼표라 보이는 글자 수가 0인 조각으로 넣고, 글자 시각을 되돌릴 때 건너뛰어요.
 */
const PAUSE_AFTER = /(?:는데|은데|면서|으며|하며|이며|지만|했고|하고|되고|있고|다면|려면|라면|으면|어서|아서|해서|니까|는지|은지|인지|을지|할지|때)(?= )/g

/** 마지막 문장부호 뒤로 몇 글자를 말했는지 세요. */
function advance(since: number, text: string): number {
  const mark = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'), text.lastIndexOf('?'), text.lastIndexOf('!'))
  return mark >= 0 ? text.length - mark - 1 : since + text.length
}

function withPauses(pieces: Piece[]): Piece[] {
  const total = pieces.reduce((sum, piece) => sum + piece.shown.length, 0)
  const out: Piece[] = []
  let seen = 0
  let since = 0
  for (const piece of pieces) {
    if (piece.shown !== piece.spoken) {
      out.push(piece)
      since = advance(since, piece.spoken)
      seen += piece.shown.length
      continue
    }
    let last = 0
    let cursor = 0
    for (const match of piece.shown.matchAll(PAUSE_AFTER)) {
      const end = (match.index ?? 0) + match[0].length
      since = advance(since, piece.shown.slice(cursor, end))
      cursor = end
      if (since < PAUSE_GAP || total - (seen + end) < PAUSE_TAIL) continue
      out.push({ shown: piece.shown.slice(last, end), spoken: piece.shown.slice(last, end) }, { shown: '', spoken: ',' })
      last = end
      since = 0
    }
    since = advance(since, piece.shown.slice(cursor))
    out.push({ shown: piece.shown.slice(last), spoken: piece.shown.slice(last) })
    seen += piece.shown.length
  }
  return out
}
