import { Marked } from 'marked'

// 포트폴리오 항목의 마크다운을 HTML로 바꿔요. 글은 AI가 레포 자료로 쓰거나 사용자가 고친 것이라 그대로 믿지 않아요.
// HTML 태그는 글자로 바꾸고(<를 &lt;로), 링크는 http와 https만 남기고, 그림은 그리지 않아요.

const md = new Marked({
  gfm: true,
  breaks: true,
  walkTokens(token) {
    if (token.type === 'link' && !/^https?:\/\//i.test(token.href)) token.href = '#'
    if (token.type === 'image') token.href = ''
  },
})

/** AI가 비워 둔 "[직접 입력: ...]" 자리예요. 연한 메인 컬러로 칠해요. */
const PLACEHOLDER = /\[(?:직접 입력|Fill in):[^\]<]*\]/g

export function portfolioHtml(markdown: string): string {
  const escaped = markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const html = md.parse(escaped, { async: false })
  return html.replace(PLACEHOLDER, (text) => `<mark>${text}</mark>`)
}
