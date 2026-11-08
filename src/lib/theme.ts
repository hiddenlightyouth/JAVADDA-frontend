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
 * 메인 컬러로 고를 수 있는 색이에요. 화면 모드와 따로 골라서, 다크 모드에서도 라이트 모드에서도 같은 색이 메인 컬러가 돼요.
 * 색 값은 `index.css`의 `[data-accent]` 규칙에 있고, 여기는 이름과 설정 창의 동그라미 색만 적어요. blue가 기본이에요.
 */
export const ACCENTS = [
  { key: 'blue', name: { ko: '파랑', en: 'Blue' }, color: '#2e90fa' },
  { key: 'iris', name: { ko: '보라', en: 'Iris' }, color: '#7a5af8' },
  { key: 'rose', name: { ko: '분홍', en: 'Rose' }, color: '#ee46bc' },
  { key: 'ember', name: { ko: '주황', en: 'Ember' }, color: '#ef6820' },
  { key: 'grove', name: { ko: '초록', en: 'Grove' }, color: '#16b364' },
  { key: 'ocean', name: { ko: '청록', en: 'Ocean' }, color: '#0ba5c0' },
] as const

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

/** 메인 컬러를 바꿔요. 앱 창의 색은 그대로라 앱에는 알리지 않아요. */
export function setAppAccent(accent: Accent) {
  store({ ...settings.get(), accent })
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
      shield: typeof detail.shield === 'boolean' ? detail.shield : settings.get().shield,
    })
  })
}
