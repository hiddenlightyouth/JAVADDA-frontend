import { appShell, isApp, postToApp, type AppTheme } from './app'
import { readItem, writeItem } from './storage'
import { createStore, useStore } from './store'

const THEME_STORAGE = 'javadda:app-theme'
const SHIELD_STORAGE = 'javadda:app-capture-shield'
/** 앱의 설정 창에서 화면 설정을 바꾸면 웹뷰에 보내는 이벤트예요. */
const SETTINGS_EVENT = 'javadda:app-settings'

const ACCENT_STORAGE = 'javadda:app-accent'
const CONTRAST_STORAGE = 'javadda:app-contrast'

/** 명암 대비를 고르는 범위(%)예요. 100이 기본이에요. */
export const CONTRAST_RANGE = { min: 50, max: 150, step: 5, base: 100 } as const

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

/**
 * 물들이지 않은 회색 단계 전부의 oklch(L, C, H)예요. 명암 대비를 바꿀 때 써요.
 * 라이트는 Tailwind v4의 기본 회색, 다크는 `index.css`의 `.dark` 값을 oklch로 옮긴 거예요.
 */
const NEUTRAL_TONES: Record<'light' | 'dark', [string, number, number, number][]> = {
  light: [
    ['white', 1, 0, 0], ['gray-50', 0.985, 0.002, 247.8], ['gray-100', 0.967, 0.003, 264.5], ['gray-200', 0.928, 0.006, 264.5],
    ['gray-300', 0.872, 0.01, 258.3], ['gray-400', 0.707, 0.022, 261.3], ['gray-500', 0.551, 0.027, 264.4], ['gray-600', 0.446, 0.03, 256.8],
    ['gray-700', 0.373, 0.034, 259.7], ['gray-800', 0.278, 0.033, 256.8], ['gray-900', 0.21, 0.034, 264.7], ['gray-950', 0.13, 0.028, 261.7],
  ],
  dark: [
    ['white', 0.227, 0.004, 286.1], ['gray-50', 0.257, 0.004, 286.1], ['gray-100', 0.294, 0.004, 286.2], ['gray-200', 0.349, 0.003, 286.2],
    ['gray-300', 0.402, 0.003, 286.3], ['gray-400', 0.648, 0.007, 286.2], ['gray-500', 0.711, 0.007, 286.2], ['gray-600', 0.787, 0.007, 286.2],
    ['gray-700', 0.862, 0.007, 286.3], ['gray-800', 0.923, 0.007, 286.3], ['gray-900', 0.963, 0.007, 286.3], ['gray-950', 1, 0, 0],
  ],
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
  /** 명암 대비(%). 100이 기본이고, 낮으면 회색과 테두리가 바탕에 가까워지고 높으면 또렷해져요. */
  contrast: number
  /** 화면 공유나 녹화가 감지되면 화면을 가릴지. 처음에는 켜져 있어요. */
  shield: boolean
}


function clampContrast(value: number) {
  if (!Number.isFinite(value)) return CONTRAST_RANGE.base
  return Math.min(CONTRAST_RANGE.max, Math.max(CONTRAST_RANGE.min, Math.round(value / CONTRAST_RANGE.step) * CONTRAST_RANGE.step))
}

function readSettings(): AppSettings {
  const theme = readItem(THEME_STORAGE) as AppTheme | null
  const accent = readItem(ACCENT_STORAGE)
  return {
    theme: theme && THEMES.includes(theme) ? theme : 'system',
    accent: isAccent(accent) ? accent : 'blue',
    contrast: clampContrast(Number(readItem(CONTRAST_STORAGE) ?? CONTRAST_RANGE.base)),
    shield: readItem(SHIELD_STORAGE) !== '0',
  }
}

const settings = createStore<AppSettings>(appShell ? readSettings() : { theme: 'light', accent: 'blue', contrast: CONTRAST_RANGE.base, shield: false })

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** html에 dark를 붙이면 index.css가 색 토큰을 어두운 값으로 바꾸고, data-accent를 붙이면 메인 컬러를 그 색으로 바꿔요. */
function apply() {
  const root = document.documentElement
  const { theme, accent, contrast } = settings.get()
  const dark = theme === 'dark' || (theme === 'system' && systemDark())
  root.classList.toggle('dark', dark)
  if (accent === 'blue') delete root.dataset.accent
  else root.dataset.accent = accent
  applyContrast(root, accent, dark ? 'dark' : 'light', contrast / 100)
}

/**
 * 명암 대비를 적용해요. 회색 단계마다 바탕(white)과의 밝기 차이에 배율을 곱해서 html의 style에 적어요.
 * 인라인 값이라 `index.css`의 테마 규칙보다 이겨요. 100%면 지우고 `index.css`의 값으로 돌아가요. 바탕 자체는 그대로예요.
 */
function applyContrast(root: HTMLElement, accent: Accent, mode: 'light' | 'dark', ratio: number) {
  const item = ACCENTS.find((entry) => entry.key === accent) ?? ACCENTS[0]
  const tones: [string, number, number, number][] =
    item.hue === null ? NEUTRAL_TONES[mode] : TONES[mode].map(([name, l, c]) => [name, l, c, item.hue as number])
  const base = tones[0][1]
  for (const [name, l, c, h] of tones.slice(1)) {
    const prop = `--color-${name}`
    if (ratio === 1) root.style.removeProperty(prop)
    else root.style.setProperty(prop, `oklch(${Math.min(1, Math.max(0, base + (l - base) * ratio)).toFixed(3)} ${c} ${h})`)
  }
}

function store(next: AppSettings) {
  // 저장하지 못해도 이번 화면에서는 그대로 동작해요.
  writeItem(THEME_STORAGE, next.theme)
  writeItem(ACCENT_STORAGE, next.accent)
  writeItem(CONTRAST_STORAGE, String(next.contrast))
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

/** 명암 대비를 바꾸고 앱에도 알려서, 앱의 설정 창 슬라이더가 같이 바뀌게 해요. */
export function setAppContrast(contrast: number) {
  const next = clampContrast(contrast)
  if (next === settings.get().contrast) return
  store({ ...settings.get(), contrast: next })
  // 슬라이더를 끄는 동안 값이 계속 바뀌어서, 멈춘 뒤에 한 번만 앱에 알려요.
  window.clearTimeout(contrastTimer)
  contrastTimer = window.setTimeout(() => postToApp({ type: 'contrast', contrast: next }), 250)
}

let contrastTimer = 0

/** 화면 공유 중에 화면을 가릴지 정하고 앱에도 알려서, 앱의 설정 창과 같이 바뀌게 해요. */
export function setAppShield(shield: boolean) {
  store({ ...settings.get(), shield })
  postToApp({ type: 'shield', on: shield })
}

/**
 * 고른 테마의 메인 컬러예요. 앱 화면 밖(바탕화면 펫 창 /pet-window)에서는 설정을 읽지 않아서, 이 기기에 적어 둔 값을 바로 읽어요.
 */
export function accentColor(accent?: Accent): string {
  const key = accent ?? readItem(ACCENT_STORAGE)
  return (ACCENTS.find((item) => item.key === key) ?? ACCENTS[0]).color
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
      contrast: typeof detail.contrast === 'number' ? clampContrast(detail.contrast) : settings.get().contrast,
      shield: typeof detail.shield === 'boolean' ? detail.shield : settings.get().shield,
    })
  })
}
