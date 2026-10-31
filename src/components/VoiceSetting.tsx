import { DEFAULT_VOICE, VOICES, voiceOf } from '../../shared/voices'
import { track } from '../lib/analytics'
import { messages, useLang, useMessages } from '../lib/i18n'
import { canSpeak, setPracticeVoice, usePracticeVoice, useSpeak } from '../lib/speech'
import { Dropdown } from './Dropdown'
import { SettingRow } from './SettingRow'

/** 설정의 설명은 격식체로 써요. */
const TEXT = messages({
  ko: {
    label: '면접관 목소리',
    note: '면접 연습에서 질문을 읽어 줄 목소리입니다. 고르면 미리 들려 드립니다.',
    noSpeech: '이 브라우저는 소리를 낼 수 없어서 질문을 글로만 보여 드립니다.',
    sample: '안녕하세요. 오늘 면접을 맡은 면접관입니다. 편하게 답해 주세요.',
  },
  en: {
    label: 'Interviewer voice',
    note: 'The voice that reads questions in interview practice. You will hear a sample when you pick one.',
    noSpeech: 'This browser cannot play speech, so questions are shown as text only.',
    sample: "Hello, I'll be your interviewer today. Take your time with each answer.",
  },
})

/**
 * 면접관 목소리 고르기 한 줄이에요. 설정 창과 내 정보 화면의 `settingList` 안에 AI 모델 고르기(`AiModelRow`)와 같은 모양으로 놓여요.
 * 고른 목소리는 이 기기에 기억하고(`setPracticeVoice`), 고르는 순간 짧은 인사를 그 목소리로 들려줘요. 고른 적이 없으면 기본 목소리(`DEFAULT_VOICE`)예요.
 * 서버에 사람 목소리 키가 없으면 브라우저 음성으로 읽어서, 어떤 것을 골라도 같은 소리가 나요.
 */
export function VoiceRow() {
  const text = useMessages(TEXT)
  const lang = useLang()
  const chosen = usePracticeVoice()
  const voice = useSpeak()
  const current = voiceOf(chosen ?? '') ?? DEFAULT_VOICE

  return (
    <SettingRow label={text.label} note={canSpeak() ? text.note : text.noSpeech}>
      <Dropdown
        align="right"
        value={current.name[lang]}
        groups={[
          {
            items: VOICES.map((item) => ({
              label: item.name[lang],
              hint: item.hint[lang],
              checked: current.key === item.key,
              onSelect: () => {
                setPracticeVoice(item.key)
                track('practice_voice_select', { voice: item.key, from: 'settings' })
                if (canSpeak()) void voice.speak(text.sample, item.key)
              },
            })),
          },
        ]}
      />
    </SettingRow>
  )
}
