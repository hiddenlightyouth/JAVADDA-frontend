/**
 * 면접관 세 명의 목소리예요(ElevenLabs의 Voice ID, 직접 고른 목소리). 면접관마다 하나씩 고정이고, 고르는 설정은 없어요.
 * 서버(`worker/tts.ts`)는 여기 있는 것만 받아요. 맨 앞(서도윤)이 기본 목소리예요(`DEFAULT_VOICE`). 화면과 서버가 같은 값을 봐요.
 */

export interface PracticeVoice {
  key: string
  /** ElevenLabs의 Voice ID */
  id: string
  name: { ko: string; en: string }
  hint: { ko: string; en: string }
}

export const VOICES: PracticeVoice[] = [
  { key: 'doyun', id: 'rVUtObZZcKWXuuDGiQ9n', name: { ko: '서도윤', en: 'Doyun Seo' }, hint: { ko: '차분한 남성', en: 'Calm male' } },
  { key: 'jiho', id: 'mfID3WvcnG2r75MMq9LY', name: { ko: '한지호', en: 'Jiho Han' }, hint: { ko: '친근하고 자연스러운 남성', en: 'Friendly male' } },
  { key: 'taemin', id: 'RbBvMD54acwEpBm74TTD', name: { ko: '강태민', en: 'Taemin Kang' }, hint: { ko: '단단한 남성', en: 'Firm male' } },
]

/** 사용자가 고르지 않았을 때 쓰는 목소리예요. */
export const DEFAULT_VOICE = VOICES[0]

export const voiceOf = (key: string) => VOICES.find((voice) => voice.key === key)
