import { useEffect, useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import {
  CODE_VALUES,
  COMMON_ERRORS,
  ENDPOINTS,
  GUIDES,
  HEADERS,
  RESPONSE_HEADERS,
  TYPES,
  endpointPrompt,
  type EndpointDoc,
  type Field,
} from '../lib/apiDocs'
import { PUBLIC_API_BASE, type ScopeInfo } from '../lib/apiKeys'
import { showToast } from '../lib/toast'
import { CheckIcon, SparkleIcon } from './Icons'
import { Badge, ghostButton, Segmented, toolButton } from './ui'

type Lang = 'curl' | 'javascript' | 'python'
const LANGS: [Lang, string][] = [
  ['curl', 'cURL'],
  ['javascript', 'JavaScript'],
  ['python', 'Python'],
]

/** 주소의 한글을 인코딩해요. 예제 코드는 그대로 붙여 넣어 쓸 수 있어야 해요. */
const encodePath = (query: string) => {
  const [path, search] = query.split('?')
  const encodedPath = path.split('/').map((part) => (part ? encodeURIComponent(part) : part)).join('/')
  if (!search) return encodedPath
  const params = new URLSearchParams(search)
  return `${encodedPath}?${params.toString()}`
}

function requestCode(lang: Lang, query: string) {
  const url = `${PUBLIC_API_BASE}${encodePath(query)}`
  if (lang === 'curl') return `curl -X GET "${url}" \\\n  -H "X-API-Key: \${JAVADDA_API_KEY}"`
  if (lang === 'javascript')
    return `const response = await fetch("${url}", {\n  headers: { "X-API-Key": process.env.JAVADDA_API_KEY },\n})\nconst { data, error } = await response.json()\nif (!response.ok) throw new Error(\`\${error.code} \${error.message}\`)\nconsole.log(data)`
  return `import os\nimport requests\n\nresponse = requests.get(\n    "${url}",\n    headers={"X-API-Key": os.environ["JAVADDA_API_KEY"]},\n    timeout=10,\n)\nbody = response.json()\nif not response.ok:\n    raise RuntimeError(f"{body['error']['code']} {body['error']['message']}")\nprint(body["data"])`
}

const success = (data: unknown) => JSON.stringify({ data, error: { code: null, message: null } }, null, 2)

/** 공개 API 문서예요. 문구는 합쇼체(~합니다)로 써요. 넓은 화면에서는 왼쪽에 목차가 멈춰 있고, 누르면 그 자리로 가요. */
export function ApiDocs({ scopes }: { scopes: ScopeInfo[] }) {
  const [lang, setLang] = useState<Lang>('curl')
  const [active, setActive] = useState('overview')
  const scopeLabel = (value: string) => scopes.find((s) => s.value === value)?.label ?? value

  // 화면에 보이는 절을 목차에서 칠해요.
  useEffect(() => {
    const ids = [...GUIDES.map((g) => g.id), ...ENDPOINTS.map((e) => e.id)]
    const nodes = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => !!node)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const go = (id: string) => {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    track('api_docs_nav', { section: id })
  }

  const groups = scopes.length
    ? scopes.map((s) => ({ scope: s, endpoints: ENDPOINTS.filter((e) => e.scope === s.value) })).filter((g) => g.endpoints.length)
    : []

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="문서 목차" className="sticky top-0 hidden max-h-[calc(100dvh-12rem)] self-start overflow-y-auto pb-8 xl:block">
        <NavGroup title="가이드">
          {GUIDES.map((g) => (
            <NavItem key={g.id} active={active === g.id} onClick={() => go(g.id)}>
              {g.title}
            </NavItem>
          ))}
        </NavGroup>
        {groups.map(({ scope, endpoints }) => (
          <NavGroup key={scope.value} title={scope.label}>
            {endpoints.map((e) => (
              <NavItem key={e.id} active={active === e.id} onClick={() => go(e.id)}>
                {e.title}
              </NavItem>
            ))}
          </NavGroup>
        ))}
      </nav>

      <div className="min-w-0 max-w-[860px] pb-24">
        <Section id="overview" title="개요">
          <P>잡아따가 매일 모은 채용 공고, 기업, 역량 통계, 기술 블로그 요약, 공모전을 제공하는 REST API입니다.</P>
          <DocTable
            head={['권한', '값', '제공하는 자료', 'API']}
            rows={scopes.map((s) => [
              <span className="font-medium whitespace-nowrap text-gray-900">{s.label}</span>,
              <code className="font-mono text-[12px] whitespace-nowrap">{s.value}</code>,
              s.description,
              <span className="block font-mono text-[12px] whitespace-nowrap">
                {ENDPOINTS.filter((e) => e.scope === s.value).map((e) => (
                  <span key={e.path} className="block">
                    {e.path}
                  </span>
                ))}
              </span>,
            ])}
          />
        </Section>

        <Section id="start" title="시작하기">
          <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-gray-800">
            <li>내 키 탭에서 새 API 키를 요청하십시오.</li>
            <li>관리자가 승인하면 키 상세에서 키를 발급하십시오. 키는 한 번만 표시되고, 잃어버리면 재발급할 수 있습니다.</li>
            <li>X-API-Key 헤더에 키를 넣어 호출하십시오.</li>
          </ol>
          <H3>기본 정보</H3>
          <DocTable
            head={['항목', '값']}
            rows={[
              ['기본 주소', <code className="font-mono text-[12.5px] break-all">{PUBLIC_API_BASE}</code>],
              ['응답 형식', 'JSON, UTF-8'],
              ['시간대', '한국 시각(KST), 시간대 표기 없음'],
            ]}
          />
        </Section>

        <Section id="auth" title="인증">
          <FieldTable fields={HEADERS} required />
          <Note>키는 서버에서만 사용하십시오. 노출되었다면 바로 재발급하십시오. 예전 키는 즉시 막힙니다.</Note>
        </Section>

        <Section id="format" title="응답 형식">
          <FieldTable
            fields={[
              { name: 'data', type: 'Object', desc: '결과. 실패하면 null' },
              { name: 'error.code', type: 'String', desc: '오류 코드. 성공하면 null' },
              { name: 'error.message', type: 'String', desc: '오류 이유. 성공하면 null' },
            ]}
          />
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Code title="성공">{success({ id: 'toss', name: '토스' })}</Code>
            <Code title="실패">{JSON.stringify({ data: null, error: { code: 'C4033', message: '이 API를 사용할 권한이 없습니다.' } }, null, 2)}</Code>
          </div>
          <H3>값의 모양</H3>
          <DocTable
            head={['타입', '모양', '보기']}
            rows={[
              ['Datetime', 'YYYY-MM-DDTHH:mm:ss', <code className="font-mono text-[12px]">2026-10-27T15:50:29</code>],
              ['Date', 'YYYY-MM-DD', <code className="font-mono text-[12px]">2026-11-05</code>],
              ['null', '값이 없거나 모름', <code className="font-mono text-[12px]">"deadline": null</code>],
            ]}
          />
        </Section>

        <Section id="paging" title="페이지">
          <P>목록은 page(0부터)와 size(최대 100)로 나누어 조회합니다.</P>
          <TypeTable name="Page" />
          <Code title="모든 페이지 받기 (JavaScript)">{`let page = 0
const all = []
while (true) {
  const res = await fetch(\`${PUBLIC_API_BASE}/postings?size=100&page=\${page}\`, {
    headers: { "X-API-Key": process.env.JAVADDA_API_KEY },
  })
  const { data } = await res.json()
  all.push(...data.items)
  if (!data.hasNext) break
  page += 1
}`}</Code>
        </Section>

        <Section id="limits" title="호출 한도">
          <P>기본 1분 60번, 하루 10,000번(한국 시각 0시 초기화)입니다. 넘으면 429로 응답합니다.</P>
          <H3>응답 헤더</H3>
          <FieldTable fields={RESPONSE_HEADERS} />
        </Section>

        <Section id="errors" title="오류 코드">
          <DocTable
            head={['HTTP 상태', '코드', '뜻과 할 일']}
            rows={COMMON_ERRORS.map(([status, code, desc]) => [status, <code className="font-mono text-[12px] whitespace-nowrap">{code}</code>, desc])}
          />
        </Section>

        <Section id="values" title="코드 값">
          {CODE_VALUES.map((group) => (
            <div key={group.name}>
              <H3>{group.name}</H3>
              <DocTable head={['값', '뜻']} rows={group.values.map(([value, desc]) => [<code className="font-mono text-[12px]">{value}</code>, desc])} />
            </div>
          ))}
        </Section>

        {ENDPOINTS.map((e) => (
          <Endpoint key={e.id} doc={e} scopeLabel={scopeLabel(e.scope)} lang={lang} onLang={setLang} />
        ))}
      </div>
    </div>
  )
}

function Endpoint({ doc: e, scopeLabel, lang, onLang }: { doc: EndpointDoc; scopeLabel: string; lang: Lang; onLang: (lang: Lang) => void }) {
  return (
    <Section
      id={e.id}
      title={e.title}
      badge={<Badge tone="brand">{scopeLabel}</Badge>}
      action={<PromptCopy id={e.id} text={() => endpointPrompt(e, PUBLIC_API_BASE, scopeLabel)} />}
    >
      {e.desc.map((line) => (
        <P key={line}>{line}</P>
      ))}
      <H3>기본 정보</H3>
      <DocTable
        head={['항목', '값']}
        rows={[
          [
            '메서드',
            <Badge tone="white" strong>
              {e.method}
            </Badge>,
          ],
          [
            'URL',
            <code className="font-mono text-[12.5px] break-all">
              {PUBLIC_API_BASE}
              {e.path}
            </code>,
          ],
          ['권한', <code className="font-mono text-[12px]">{e.scope}</code>],
        ]}
      />

      {(e.pathParams || e.query) && <H3>요청</H3>}
      {e.pathParams && (
        <>
          <H4>경로 파라미터</H4>
          <FieldTable fields={e.pathParams} required />
        </>
      )}
      {e.query && (
        <>
          <H4>쿼리 파라미터</H4>
          <FieldTable fields={e.query} required />
        </>
      )}

      <H3>응답</H3>
      <FieldTable fields={e.response} anchorPrefix={e.id} />
      {e.types.map((name) => (
        <TypeTable key={name} name={name} anchor={`${e.id}-${name}`} />
      ))}

      <H3>예제</H3>
      <div className="mt-2 flex items-center justify-between gap-3">
        <H4 className="mt-0">요청</H4>
        <Segmented label="언어" options={LANGS} value={lang} onChange={onLang} />
      </div>
      <Code>{requestCode(lang, e.example.query)}</Code>
      <H4>응답</H4>
      <Code>{success(e.example.response)}</Code>

      {e.errors.length > 0 && (
        <>
          <H3>오류</H3>
          <DocTable head={['코드', '뜻']} rows={e.errors.map(([code, desc]) => [<code className="font-mono text-[12px]">{code}</code>, desc])} />
        </>
      )}
    </Section>
  )
}

// ── 문서 부품 ─────────────────────────────────────────

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 px-2.5 text-[12px] font-semibold text-gray-400">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active || undefined}
        className={`w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${active ? 'bg-brand-soft font-medium text-brand-hover' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        {children}
      </button>
    </li>
  )
}

function Section({ id, title, badge, action, children }: { id: string; title: string; badge?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 border-t border-gray-100 pt-10 pb-4 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="flex flex-wrap items-center gap-2 text-[22px] font-semibold text-gray-900">
          {title}
          {badge}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

const H3 = ({ children }: { children: ReactNode }) => <h3 className="mt-8 mb-2 text-[16px] font-semibold text-gray-900">{children}</h3>
const H4 = ({ children, className = 'mt-5' }: { children: ReactNode; className?: string }) => (
  <h4 className={`mb-2 text-[13.5px] font-semibold text-gray-700 ${className}`}>{children}</h4>
)
const P = ({ children }: { children: ReactNode }) => <p className="mb-2 text-[14px] leading-relaxed text-gray-700">{children}</p>
const Note = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 rounded-xl bg-brand-soft p-4 text-[13.5px] leading-relaxed text-gray-800">{children}</p>
)

function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-xl bg-gray-50">
      <table className={`w-full text-left text-[13px] ${head.length > 2 ? 'min-w-[520px]' : ''}`}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 pt-3 pb-2 text-[12px] font-medium whitespace-nowrap text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-200/60 align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 leading-relaxed text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 필드 표예요. 타입이 다른 객체(Posting, Course[])면 이름 옆에 그 표로 가는 링크를 달아요. */
function FieldTable({ fields, required = false, anchorPrefix }: { fields: Field[]; required?: boolean; anchorPrefix?: string }) {
  return (
    <DocTable
      head={required ? ['이름', '타입', '설명', '필수'] : ['이름', '타입', '설명']}
      rows={fields.map((f) => {
        const typeName = f.type.replace('[]', '')
        const linked = anchorPrefix && TYPES.some((t) => t.name === typeName)
        const cells: ReactNode[] = [
          <code className="font-mono text-[12.5px] font-medium whitespace-nowrap text-gray-900">{f.name}</code>,
          linked ? (
            <button
              type="button"
              className="font-mono text-[12px] whitespace-nowrap text-brand hover:text-brand-hover"
              onClick={() => document.getElementById(`${anchorPrefix}-${typeName}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {f.type}
            </button>
          ) : (
            <span className="font-mono text-[12px] whitespace-nowrap text-gray-500">{f.type}</span>
          ),
          f.desc,
        ]
        if (required) cells.push(f.required ? <Badge tone="brand">필수</Badge> : <span className="text-[12px] text-gray-400">선택</span>)
        return cells
      })}
    />
  )
}

function TypeTable({ name, anchor }: { name: string; anchor?: string }) {
  const type = TYPES.find((t) => t.name === name)
  if (!type) return null
  const prefix = anchor ? anchor.slice(0, anchor.lastIndexOf(`-${name}`)) : undefined
  return (
    <div id={anchor} className="scroll-mt-4">
      <H4>
        <code className="font-mono">{type.name}</code>
        {type.desc && <span className="ml-2 font-normal text-gray-500">{type.desc}</span>}
      </H4>
      <FieldTable fields={type.fields} anchorPrefix={prefix} />
    </div>
  )
}

/** API 하나를 코딩 에이전트에게 붙여 넣을 프롬프트로 복사해요. 복사하면 잠깐 체크와 "복사됨"으로 바뀌어요. */
function PromptCopy({ id, text }: { id: string; text: () => string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    const ok = await navigator.clipboard.writeText(text()).then(
      () => true,
      () => false,
    )
    track('api_docs_prompt_copy', { endpoint: id, success: ok })
    if (!ok) {
      showToast('복사하지 못했습니다.')
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button type="button" className={toolButton} onClick={() => void copy()} aria-live="polite">
      {copied ? <CheckIcon /> : <SparkleIcon />}
      {copied ? '복사됨' : '에이전트 전달 프롬프트'}
    </button>
  )
}

function Code({ children, title }: { children: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    const ok = await navigator.clipboard.writeText(children).then(
      () => true,
      () => false,
    )
    if (!ok) {
      showToast('복사하지 못했습니다.')
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="mt-2 min-w-0 overflow-hidden rounded-xl bg-gray-50">
      <div className="flex items-center justify-between gap-3 px-4 pt-2">
        <span className="text-[12px] text-gray-500">{title}</span>
        <button type="button" className={`${ghostButton} -mr-2 h-7 text-[12px]`} onClick={() => void copy()}>
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pt-1 pb-4 font-mono text-[12px] leading-relaxed text-gray-800">{children}</pre>
    </div>
  )
}
