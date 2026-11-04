import { marked } from 'marked'

/**
 * 잡아따 Labs 기술 면접의 답변 원문이에요. 매일메일(maeil-mail-contents)의 답변 마크다운을 `public/labs/tech-interview/아이디.md`로 옮겨 두고(이모지는 뺐어요),
 * 질문을 열 때만 받아서 HTML로 바꿔요. 원문 안에 HTML(그림, 접기, 줄바꿈 등)이 섞여 있어서, 허용한 태그와 속성만 남겨요(`clean`).
 * 한 번 받은 답은 이번 접속 동안 기억해요.
 */

/** 원문 출처예요. 답변 아래에 적어요. */
export const TECH_ANSWER_SOURCE = 'https://github.com/maeil-mail/maeil-mail-contents'

const cache = new Map<string, Promise<string | null>>()

/** 남겨 두는 태그예요. 나머지 태그는 글자만 남겨요. */
const TAGS = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'sup', 'sub', 'span', 'div',
])
/** 아예 지우는 태그예요(내용까지). */
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button', 'textarea', 'select'])

const safeUrl = (value: string | null) => !!value && /^https?:\/\//i.test(value.trim())

function clean(node: Element) {
  for (const child of [...node.children]) {
    const tag = child.tagName.toLowerCase()
    if (DROP.has(tag)) {
      child.remove()
      continue
    }
    clean(child)
    if (!TAGS.has(tag)) {
      child.replaceWith(...child.childNodes)
      continue
    }
    for (const attribute of [...child.attributes]) {
      const name = attribute.name.toLowerCase()
      const keep =
        (tag === 'a' && name === 'href' && safeUrl(attribute.value)) ||
        (tag === 'img' && (name === 'alt' || name === 'width' || (name === 'src' && safeUrl(attribute.value)))) ||
        ((tag === 'code' || tag === 'pre') && name === 'class' && /^language-[\w-]+$/.test(attribute.value))
      if (!keep) child.removeAttribute(attribute.name)
    }
    if (tag === 'img' && !child.getAttribute('src')) child.remove()
    if (tag === 'img') child.setAttribute('loading', 'lazy')
    if (tag === 'a') {
      child.setAttribute('target', '_blank')
      child.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

function toHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false })
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  clean(root)
  return root.innerHTML
}

/** 질문 하나의 답변 HTML이에요. 원문이 없거나 받지 못하면 null이에요. */
export function fetchTechAnswer(id: string): Promise<string | null> {
  if (!/^(be|fe)-\d+$/.test(id)) return Promise.resolve(null)
  let pending = cache.get(id)
  if (!pending) {
    pending = fetch(`/labs/tech-interview/${id}.md`)
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => (text && !text.trimStart().startsWith('<!') ? toHtml(text) : null))
      .catch(() => null)
    // 실패한 것은 기억하지 않아서 다시 열면 한 번 더 받아요.
    void pending.then((html) => {
      if (html === null) cache.delete(id)
    })
    cache.set(id, pending)
  }
  return pending
}
