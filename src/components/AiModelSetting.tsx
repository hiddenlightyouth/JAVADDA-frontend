import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { refreshConfig, setAiModel, useAiModel, type AiConfig, type AiModel } from '../lib/api'
import { messages, useMessages } from '../lib/i18n'
import { useLoadProgress } from '../lib/load'
import { Dropdown } from './Dropdown'
import { SettingRow } from './SettingRow'

const TEXT = messages({
  ko: {
    label: 'AI 모델',
    note: '진단, 서류 검증, 예상 질문, 면접 연습에 사용할 모델입니다.',
    defaultHint: '기본',
    loading: '불러오고 있어요',
    none: '고를 수 있는 모델이 없어요',
    noneNote: '서버에 OpenAI나 Claude 키가 없어서 AI 없이 규칙으로 분석해요.',
    offline: '서버에 연결하지 못해서 모델 목록을 받지 못했어요.',
    providers: { openai: 'OpenAI', claude: 'Claude' } as Record<AiModel['provider'], string>,
  },
  en: {
    label: 'AI model',
    note: 'The model used for diagnosis, document review, interview questions, and practice.',
    defaultHint: 'Default',
    loading: 'Loading',
    none: 'No models available',
    noneNote: 'The server has no OpenAI or Claude key, so analysis runs on rules without AI.',
    offline: "Couldn't reach the server to load the model list.",
    providers: { openai: 'OpenAI', claude: 'Claude' },
  },
})

/**
 * AI 모델 고르기예요. 이름, 설명, 고르는 칸을 돌려주고, 설정 창과 내 정보 화면은 이것을 한 줄로 그린 `AiModelRow`를 써요.
 * 쓸 때마다 서버에 `/config`를 다시 물어서(`refreshConfig`), 화면을 연 뒤에 서버를 켰거나 키를 바꿔도 바로 맞춰요.
 * 드롭다운에는 늘 모델 이름을 보여줘요. 공급자(OpenAI, Claude)마다 묶어 서버에 키가 있는 모델만 늘어놓고, 서버의 기본 모델에는 "기본"을 옅게 붙여요.
 * 고른 것은 localStorage의 `whoisloafing:ai-model`에 두고, 서버의 기본 모델을 고르면 지워서 헤더를 보내지 않아요.
 */
export function useAiModelSetting() {
  const text = useMessages(TEXT)
  // null은 아직 받는 중, 'offline'은 서버에 닿지 못했을 때예요.
  const [ai, setAi] = useState<AiConfig | 'offline' | null>(null)
  const chosen = useAiModel()
  const load = useLoadProgress()

  useEffect(() => {
    let stale = false
    void refreshConfig(load.one()).then((config) => {
      if (!stale) setAi(config.online ? config.ai : 'offline')
    })
    return () => {
      stale = true
    }
  }, [load.one])

  const models = ai && ai !== 'offline' ? ai.models : []
  const serverDefault = ai && ai !== 'offline' ? (models.find((model) => model.id === ai.defaultModel) ?? models[0]) : undefined
  // 고른 모델이 서버 목록에 없으면(키를 뺐으면) 서버의 기본 모델을 쓰고 있는 것으로 보여줘요.
  const current = models.find((model) => model.id === chosen) ?? serverDefault
  const providers = [...new Set(models.map((model) => model.provider))]
  // 서버의 기본 모델을 고르면 저장한 값을 지워서 헤더를 보내지 않아요.
  const select = (model: AiModel) => {
    const id = model.id === serverDefault?.id ? null : model.id
    track('app_ai_model_change', { model: id ?? 'default' })
    setAiModel(id)
  }

  const note = ai === 'offline' ? text.offline : ai && models.length === 0 ? text.noneNote : text.note
  const control =
    ai === null ? (
      <Dropdown align="right" value={text.loading} groups={[{ items: [], progress: load.percent }]} />
    ) : models.length === 0 ? (
      <span className="text-[13px] text-gray-400">{text.none}</span>
    ) : (
      <Dropdown
        align="right"
        value={current?.label}
        groups={providers.map((provider) => ({
          title: text.providers[provider],
          items: models
            .filter((model) => model.provider === provider)
            .map((model) => ({
              label: model.label,
              hint: model.id === serverDefault?.id ? text.defaultHint : undefined,
              checked: current?.id === model.id,
              onSelect: () => select(model),
            })),
        }))}
      />
    )

  return { label: text.label, note, control }
}

/** AI 모델 고르기 한 줄이에요. 설정 창과 내 정보 화면의 `settingList` 안에 같은 모양으로 놓여요. */
export function AiModelRow() {
  const { label, note, control } = useAiModelSetting()
  return (
    <SettingRow label={label} note={note}>
      {control}
    </SettingRow>
  )
}
