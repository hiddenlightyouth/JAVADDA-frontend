/**
 * 면접 연습에서 고를 수 있는 목소리예요. 화면은 목록을 보여주고, 서버(`worker/tts.ts`)는 여기 있는 것만 받아요.
 * 맨 앞이 기본 목소리예요.
 */

export interface PracticeVoice {
  key: string
  /** ElevenLabs의 Voice ID */
  id: string
  name: { ko: string; en: string }
  hint: { ko: string; en: string }
}

export const VOICES: PracticeVoice[] = [
  { key: 'midnight', id: 'aQzFKIjVemqRAhfd9est', name: { ko: '웅장한 면접관', en: 'Grand interviewer' }, hint: { ko: '낮은 남성', en: 'Deep male' } },
  { key: 'kyungduk', id: '2gbExjiWDnG1DMGr81Bx', name: { ko: '압박 면접관', en: 'Tough interviewer' }, hint: { ko: '묵직한 남성', en: 'Weighty male' } },
  { key: 'marcus', id: 'ibCGc01503OQd2R6i1n1', name: { ko: '허스키 바리톤', en: 'Husky baritone' }, hint: { ko: '낮은 남성', en: 'Deep male' } },
  { key: 'juan', id: 'hjCvGtSCRPyjYwe2lDf1', name: { ko: '또렷한 임원', en: 'Clear executive' }, hint: { ko: '깊은 남성', en: 'Deep male' } },
  { key: 'yohan', id: '4JJwo477JUAx3HV0T7n7', name: { ko: '자신감 있는 선배', en: 'Confident senior' }, hint: { ko: '30대 남성', en: 'Male, 30s' } },
  { key: 'harry', id: 'pb3lVZVjdFWbkhPKlelB', name: { ko: '차분한 대화체', en: 'Calm conversation' }, hint: { ko: '중년 남성', en: 'Middle-aged male' } },
  { key: 'han', id: '8jHHF8rMqMlg8if2mOUe', name: { ko: '편안한 대화체', en: 'Easy conversation' }, hint: { ko: '젊은 여성', en: 'Young female' } },
  { key: 'rosa', id: 'sf8Bpb1IU97NI9BHSMRf', name: { ko: '부드러운 면접관', en: 'Gentle interviewer' }, hint: { ko: '젊은 여성', en: 'Young female' } },
]

export const voiceOf = (key: string) => VOICES.find((voice) => voice.key === key)
