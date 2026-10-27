/**
 * 탭 제목과 링크 미리보기 태그(description, canonical, og, twitter)를 화면과 언어에 맞게 바꿔요.
 * 미리보기 카드를 만드는 서비스는 자바스크립트를 돌리지 않아서, 공유용 값은 scripts/prerender.mjs가 빌드할 때도 같은 값으로 적어 둬요.
 */
import { localizePath, messages, type Lang } from './i18n'

export const SITE = 'https://lofy.hidly.dev'
export const SITE_TITLE = 'Lofy'

export interface PageMeta {
  /** 탭 제목 */
  title: string
  description: string
  /** 미리보기 카드의 제목과 설명. 없으면 탭 제목과 설명을 써요. */
  ogTitle?: string
  ogDescription?: string
}

export const OG_LOCALES: Record<Lang, string> = { ko: 'ko_KR', en: 'en_US' }

/** 미리보기 카드의 대표 이미지. 영어 카드는 영어 문구가 적힌 그림을 써요. */
export const OG_IMAGES: Record<Lang, string> = { ko: `${SITE}/og.png`, en: `${SITE}/og-en.png` }

/** 메인 화면과, 따로 정하지 않은 화면의 값이에요. */
export const HOME_META = messages<PageMeta>({
  ko: {
    title: SITE_TITLE,
    description: '기업이나 공고를 기준으로 이력서를 진단하고, 부족한 역량과 채우는 방법, 맞는 공고까지 한 리포트로 받아요.',
    ogTitle: 'Lofy, 내 역량과 공고 사이 얼마나 멀까요?',
  },
  en: {
    title: 'Lofy - How far are you from the job you want?',
    description: 'Measure your resume against a real company or posting. Get skill gaps, how to close them, and the postings that fit you now.',
    ogTitle: 'How far are you from the job you want?',
    ogDescription: 'Pick a posting, upload your resume, and get the gaps, the plan, and the interview questions in one report.',
  },
})

function setAttr(selector: string, attr: string, value: string) {
  document.head.querySelector(selector)?.setAttribute(attr, value)
}

/** 지금 화면의 제목과 미리보기 태그를 바꿔요. path는 언어 표시를 뗀 경로예요. */
export function applyMeta(meta: PageMeta, lang: Lang, path: string) {
  if (typeof document === 'undefined') return
  const url = SITE + localizePath(path, lang)
  const ogTitle = meta.ogTitle ?? meta.title
  const ogDescription = meta.ogDescription ?? meta.description
  document.title = meta.title
  document.documentElement.lang = lang
  setAttr('meta[name="description"]', 'content', meta.description)
  setAttr('link[rel="canonical"]', 'href', url)
  setAttr('meta[property="og:title"]', 'content', ogTitle)
  setAttr('meta[property="og:description"]', 'content', ogDescription)
  setAttr('meta[property="og:url"]', 'content', url)
  setAttr('meta[property="og:locale"]', 'content', OG_LOCALES[lang])
  setAttr('meta[property="og:locale:alternate"]', 'content', OG_LOCALES[lang === 'ko' ? 'en' : 'ko'])
  setAttr('meta[name="twitter:title"]', 'content', ogTitle)
  setAttr('meta[name="twitter:description"]', 'content', ogDescription)
  setAttr('meta[property="og:image"]', 'content', OG_IMAGES[lang])
  setAttr('meta[name="twitter:image"]', 'content', OG_IMAGES[lang])
}
