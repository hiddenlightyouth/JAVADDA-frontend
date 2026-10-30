import { useEffect, useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { refreshConfig, setAiModel, useAiModel, type AiConfig, type AiModel } from '../lib/api'
import { Dropdown } from './Dropdown'
import { Modal } from './Dialog'
import { appAtLeast, appVersion, postToApp, type AppTheme } from '../lib/app'
import { setShortcutHintsPinned, useShortcutHintsPinned } from '../lib/shortcuts'
import { setAppShield, setAppTheme, useAppSettings } from '../lib/theme'
import { LANG_NAMES, LANGS, messages, setLang, useLang, useMessages } from '../lib/i18n'
import { CloseButton } from './Icons'
import { label, Segmented, softButton } from './ui'

const THEMES: AppTheme[] = ['system', 'light', 'dark']

/** 설정의 설명은 격식체로 써요. */
const TEXT = messages({
  ko: {
    themes: { system: '시스템 설정', light: '라이트', dark: '다크' } as Record<AppTheme, string>,
    title: '설정',
    close: '닫기',
    display: '화면',
    theme: '화면 모드',
    language: '언어',
    hints: '단축키 항상 표시',
    hintsNote: '단축키가 사용 가능한 메뉴에 어떤 단축키를 사용하는지 항상 표시합니다.',
    privacy: '개인정보 보호',
    shield: '화면 녹화 감지 시 가리기',
    shieldNote: 'macOS에서 화면 녹화가 감지되면 해제 시까지 화면을 가립니다.',
    ai: 'AI',
    aiModel: 'AI 모델',
    aiModelNote: '진단, 서류 검증, 예상 질문, 면접 연습에 사용할 모델입니다.',
    aiDefault: (name: string) => `서버 기본 (${name})`,
    aiDefaultShort: '서버 기본',
    aiLoading: '불러오고 있어요',
    aiNone: '고를 수 있는 모델이 없어요',
    aiNoneNote: '서버에 OpenAI나 Claude 키가 없어서 AI 없이 규칙으로 분석해요.',
    aiOffline: '서버에 연결하지 못해서 모델 목록을 받지 못했어요.',
    providers: { openai: 'OpenAI', claude: 'Claude' } as Record<AiModel['provider'], string>,
    app: '앱',
    version: '버전',
    update: '업데이트 확인',
  },
  en: {
    themes: { system: 'System', light: 'Light', dark: 'Dark' },
    title: 'Settings',
    close: 'Close',
    display: 'Display',
    theme: 'Appearance',
    language: 'Language',
    hints: 'Always show shortcuts',
    hintsNote: 'Always show which keyboard shortcut each menu uses.',
    privacy: 'Privacy',
    shield: 'Hide screen while recording',
    shieldNote: 'When screen recording is detected on macOS, the screen stays hidden until you reveal it.',
    ai: 'AI',
    aiModel: 'AI model',
    aiModelNote: 'The model used for diagnosis, document review, interview questions, and practice.',
    aiDefault: (name: string) => `Server default (${name})`,
    aiDefaultShort: 'Server default',
    aiLoading: 'Loading',
    aiNone: 'No models available',
    aiNoneNote: 'The server has no OpenAI or Claude key, so analysis runs on rules without AI.',
    aiOffline: "Couldn't reach the server to load the model list.",
    providers: { openai: 'OpenAI', claude: 'Claude' },
    app: 'App',
    version: 'Version',
    update: 'Check for updates',
  },
})

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h3 className={label}>{title}</h3>
      <dl className="mt-2 divide-y divide-gray-100 border-y border-gray-100 text-[14px]">{children}</dl>
    </section>
  )
}

/** 설정 한 줄이에요. 왼쪽에 이름과 설명, 오른쪽에 고르는 칸이 있어요. */
function Row({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <dt className="min-w-0">
        <span className="block text-gray-900">{label}</span>
        {note && <span className="mt-0.5 block text-[12.5px] leading-relaxed break-keep text-gray-500">{note}</span>}
      </dt>
      <dd className="shrink-0">{children}</dd>
    </div>
  )
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-brand' : 'bg-gray-200'}`}
    >
      {/* 손잡이는 다크 모드에서도 흰색이라 색 토큰을 쓰지 않아요. */}
      <span style={{ background: '#fff' }} className={`size-5 rounded-full transition-transform duration-200 ease-spring ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

/**
 * 앱의 설정 창이에요. 보던 화면 위에 떠서, 앱이 어떻게 보이고 움직일지 정하는 것만 모아 둬요.
 * 이름, 이메일, 로그인한 기기처럼 계정에 딸린 것은 내 정보 화면에 있어요.
 * 바깥을 누르거나 Esc를 누르면 닫혀요. 바꾼 값은 바로 적용돼서 저장 버튼은 없어요.
 */
export function Settings({ onClose }: { onClose: () => void }) {
  const { theme, shield } = useAppSettings()
  const hints = useShortcutHintsPinned()
  const lang = useLang()
  const text = useMessages(TEXT)
  // null은 아직 받는 중, 'offline'은 서버에 닿지 못했을 때예요.
  const [ai, setAi] = useState<AiConfig | 'offline' | null>(null)
  const chosen = useAiModel()

  // 열 때마다 서버에 다시 물어봐요. 앱을 연 뒤에 서버를 켰거나 키를 넣었어도 바로 보여요.
  useEffect(() => {
    let stale = false
    void refreshConfig().then((config) => {
      if (stale) return
      setAi(config.online ? config.ai : 'offline')
    })
    return () => {
      stale = true
    }
  }, [])

  const models = ai && ai !== 'offline' ? ai.models : []
  const serverDefault = ai && ai !== 'offline' ? models.find((model) => model.id === ai.defaultModel) ?? models[0] : undefined
  // 고른 모델이 서버 목록에 없으면(키를 뺐으면) 서버 기본을 쓰고 있는 것으로 보여줘요.
  const picked = models.find((model) => model.id === chosen)
  const providers = [...new Set(models.map((model) => model.provider))]

  return (
    <Modal onClose={onClose} labelledBy="settings-title" className="flex max-h-[85dvh] w-full max-w-lg flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4">
        <h2 id="settings-title" className="text-[17px] font-semibold text-gray-900">
          {text.title}
        </h2>
        <CloseButton label={text.close} onClick={onClose} size="md" className="-mr-2" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">

      <Section title={text.display}>
        <Row label={text.theme}>
          <Segmented
            size="md"
            label={text.theme}
            value={theme}
            options={THEMES.map((value) => [value, text.themes[value]])}
            onChange={(value) => {
              track('app_theme_change', { theme: value })
              setAppTheme(value)
            }}
          />
        </Row>
        <Row label={text.language}>
          <Segmented
            size="md"
            label={text.language}
            value={lang}
            options={LANGS.map((value) => [value, LANG_NAMES[value]])}
            onChange={(value) => {
              track('language_change', { lang: value, from: 'settings' })
              setLang(value)
            }}
          />
        </Row>
        <Row label={text.hints} note={text.hintsNote}>
          <Switch
            on={hints}
            label={text.hints}
            onChange={(next) => {
              track('app_shortcut_hints_change', { on: next })
              setShortcutHintsPinned(next)
            }}
          />
        </Row>
      </Section>

      {/* 고를 모델이 없어도 칸은 늘 보여주고, 왜 고를 수 없는지 알려요. */}
      <Section title={text.ai}>
        <Row
          label={text.aiModel}
          note={ai === 'offline' ? text.aiOffline : ai && models.length === 0 ? text.aiNoneNote : text.aiModelNote}
        >
          {ai === null ? (
            <Dropdown align="right" value={text.aiLoading} groups={[{ items: [], loading: true }]} />
          ) : models.length === 0 ? (
            <span className="text-[13px] text-gray-400">{text.aiNone}</span>
          ) : (
            <Dropdown
              align="right"
              value={picked ? picked.label : text.aiDefaultShort}
              groups={[
                {
                  items: [
                    {
                      label: serverDefault ? text.aiDefault(serverDefault.label) : text.aiDefaultShort,
                      checked: !picked,
                      onSelect: () => {
                        track('app_ai_model_change', { model: 'default' })
                        setAiModel(null)
                      },
                    },
                  ],
                },
                ...providers.map((provider) => ({
                  title: text.providers[provider],
                  items: models
                    .filter((model) => model.provider === provider)
                    .map((model) => ({
                      label: model.label,
                      checked: picked?.id === model.id,
                      onSelect: () => {
                        track('app_ai_model_change', { model: model.id })
                        setAiModel(model.id)
                      },
                    })),
                })),
              ]}
            />
          )}
        </Row>
      </Section>

      {/* 화면 공유를 알아채는 것은 앱 1.2부터라, 그보다 낮은 앱에서는 보여주지 않아요. */}
      {appAtLeast('1.2') && (
        <Section title={text.privacy}>
          <Row label={text.shield} note={text.shieldNote}>
            <Switch
              on={shield}
              label={text.shield}
              onChange={(next) => {
                track('app_shield_change', { on: next })
                setAppShield(next)
              }}
            />
          </Row>
        </Section>
      )}

      {/* 버전과 업데이트 확인은 macOS 앱에서만 보여줘요. 웹의 /app에는 버전이 없어요. */}
      {appVersion && (
      <Section title={text.app}>
        <Row label={text.version}>
          <span className="flex items-center gap-3">
            <span className="font-medium text-gray-900 tabular-nums">{appVersion}</span>
            {/* 예전 앱은 이 메시지를 받지 못해서, 받을 수 있는 버전에서만 버튼을 보여줘요. */}
            {appAtLeast('1.1') && (
              <button
                type="button"
                onClick={() => {
                  track('app_update_check')
                  postToApp({ type: 'update' })
                }}
                className={softButton}
              >
                {text.update}
              </button>
            )}
          </span>
        </Row>
      </Section>
      )}
      </div>
    </Modal>
  )
}
