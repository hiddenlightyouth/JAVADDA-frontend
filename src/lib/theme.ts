import { appShell, isApp, postToApp, type AppTheme } from './app'
import { readItem, writeItem } from './storage'
import { createStore, useStore } from './store'

const THEME_STORAGE = 'javadda:app-theme'
const SHIELD_STORAGE = 'javadda:app-capture-shield'
/** 앱의 설정 창에서 화면 설정을 바꾸면 웹뷰에 보내는 이벤트예요. */
const SETTINGS_EVENT = 'javadda:app-settings'

const ACCENT_STORAGE = 'javadda:app-accent'

const THEMES: AppTheme[] = ['system', 'light', 'dark']

/**
 * 고를 수 있는 테마예요. 화면 모드와 따로 골라서, 다크 모드에서도 라이트 모드에서도 같은 테마가 적용돼요.
 * 테마는 메인 컬러(color)와 함께 바탕과 회색 단계 전부를 그 색상(hue)으로 살짝 물들여요. 파랑(기본)만 물들이지 않아요(hue null).
 * 실제 색 값은 `index.css`의 `[data-accent]` 규칙이고, 그 규칙은 아래 TONES의 숫자로 만들었어요. 숫자를 바꾸면 규칙도 같이 바꿔요.
 * 여기의 숫자는 설정 창의 미리보기(화면 모드 카드)가 그 테마의 라이트와 다크 화면을 그릴 때 써요.
 */
export const ACCENTS = [
  { key: 'blue', name: { ko: '자바따', en: 'Javadda' }, color: '#2e90fa', hue: null },
  { key: 'iris', name: { ko: '아이리스', en: 'Iris' }, color: '#7a5af8', hue: 290 },
  { key: 'rose', name: { ko: '로즈', en: 'Rose' }, color: '#ee46bc', hue: 350 },
  { key: 'ember', name: { ko: '엠버', en: 'Ember' }, color: '#ef6820', hue: 45 },
  { key: 'grove', name: { ko: '그로브', en: 'Grove' }, color: '#16b364', hue: 155 },
  { key: 'ocean', name: { ko: '오션', en: 'Ocean' }, color: '#0ba5c0', hue: 215 },
] as const

export type Tone = 'white' | 'gray-50' | 'gray-100' | 'gray-200' | 'gray-300'

/** 회색 단계마다 밝기와 물들이는 정도(oklch의 L, C)예요. 라이트와 다크 두 벌이에요. */
export const TONES: Record<'light' | 'dark', [string, number, number][]> = {
  light: [
    ['white', 0.995, 0.008], ['gray-50', 0.97, 0.018], ['gray-100', 0.95, 0.024], ['gray-200', 0.91, 0.03],
    ['gray-300', 0.85, 0.034], ['gray-400', 0.7, 0.04], ['gray-500', 0.56, 0.042], ['gray-600', 0.45, 0.04],
    ['gray-700', 0.37, 0.036], ['gray-800', 0.28, 0.032], ['gray-900', 0.21, 0.026], ['gray-950', 0.14, 0.02],
  ],
  dark: [
    ['white', 0.2, 0.038], ['gray-50', 0.24, 0.045], ['gray-100', 0.275, 0.048], ['gray-200', 0.325, 0.05],
    ['gray-300', 0.385, 0.05], ['gray-400', 0.65, 0.04], ['gray-500', 0.71, 0.034], ['gray-600', 0.79, 0.026],
    ['gray-700', 0.86, 0.018], ['gray-800', 0.92, 0.012], ['gray-900', 0.96, 0.007], ['gray-950', 1, 0],
  ],
}

/** 물들이지 않은 파랑(기본) 테마의 회색이에요. Tailwind의 기본 회색과 `index.css`의 다크 모드 값이에요. */
const NEUTRAL: Record<'light' | 'dark', Record<Tone, string>> = {
  light: { white: '#ffffff', 'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb', 'gray-300': '#d1d5dc' },
  dark: { white: '#1c1c1e', 'gray-50': '#232325', 'gray-100': '#2c2c2e', 'gray-200': '#3a3a3c', 'gray-300': '#48484a' },
}

/** 테마 하나의 라이트나 다크 화면에서 회색 한 단계의 색이에요. 설정 창의 미리보기가 써요. */
export function toneOf(accent: (typeof ACCENTS)[number], mode: 'light' | 'dark', tone: Tone) {
  if (accent.hue === null) return NEUTRAL[mode][tone]
  const [, l, c] = TONES[mode].find(([name]) => name === tone)!
  return `oklch(${l} ${c} ${accent.hue})`
}

export type Accent = (typeof ACCENTS)[number]['key']
const isAccent = (value: string | null): value is Accent => ACCENTS.some((item) => item.key === value)

interface AppSettings {
  /** 화면 모드 */
  theme: AppTheme
  /** 메인 컬러 */
  accent: Accent
  /** 화면 공유나 녹화가 감지되면 화면을 가릴지. 처음에는 켜져 있어요. */
  shield: boolean
}


function readSettings(): AppSettings {
  const theme = readItem(THEME_STORAGE) as AppTheme | null
  const accent = readItem(ACCENT_STORAGE)
  return {
    theme: theme && THEMES.includes(theme) ? theme : 'system',
    accent: isAccent(accent) ? accent : 'blue',
    shield: readItem(SHIELD_STORAGE) !== '0',
  }
}

const settings = createStore<AppSettings>(appShell ? readSettings() : { theme: 'light', accent: 'blue', shield: false })

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** html에 dark를 붙이면 index.css가 색 토큰을 어두운 값으로 바꾸고, data-accent를 붙이면 메인 컬러를 그 색으로 바꿔요. */
function apply() {
  const root = document.documentElement
  const { theme, accent } = settings.get()
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && systemDark()))
  if (accent === 'blue') delete root.dataset.accent
  else root.dataset.accent = accent
}

function store(next: AppSettings) {
  // 저장하지 못해도 이번 화면에서는 그대로 동작해요.
  writeItem(THEME_STORAGE, next.theme)
  writeItem(ACCENT_STORAGE, next.accent)
  writeItem(SHIELD_STORAGE, next.shield ? '1' : '0')
  settings.set(next)
  apply()
}

/** 화면 모드를 바꾸고 앱에도 알려서, 창과 설정 창이 같이 바뀌게 해요. */
export function setAppTheme(theme: AppTheme) {
  store({ ...settings.get(), theme })
  postToApp({ type: 'theme', theme })
}

/** 테마를 바꾸고 앱에도 알려서, 앱의 설정 창과 창 바탕이 같이 바뀌게 해요. */
export function setAppAccent(accent: Accent) {
  store({ ...settings.get(), accent })
  postToApp({ type: 'accent', accent })
}

/** 화면 공유 중에 화면을 가릴지 정하고 앱에도 알려서, 앱의 설정 창과 같이 바뀌게 해요. */
export function setAppShield(shield: boolean) {
  store({ ...settings.get(), shield })
  postToApp({ type: 'shield', on: shield })
}

export function useAppSettings(): AppSettings {
  return useStore(settings)
}

// 화면 설정은 앱 화면(macOS 앱, 웹의 /app)에서만 써요. 소개와 아티클은 늘 밝은 화면이에요.
if (appShell) {
  apply()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
}
if (isApp) {
  window.addEventListener(SETTINGS_EVENT, (event) => {
    const detail = (event as CustomEvent<Partial<AppSettings>>).detail ?? {}
    store({
      ...settings.get(),
      theme: detail.theme && THEMES.includes(detail.theme) ? detail.theme : settings.get().theme,
      accent: isAccent(detail.accent ?? null) ? (detail.accent as Accent) : settings.get().accent,
      shield: typeof detail.shield === 'boolean' ? detail.shield : settings.get().shield,
    })
  })
}
