import type { Portrait } from './mouthRenderer'
import { readItem, writeItem } from './storage'
import { createStore, useStore } from './store'

/**
 * 면접 연습의 가상 면접관 세 명이에요. 사진(입 자리), 목소리, 성격이 다르고,
 * 성격에 따라 서버의 AI가 질문을 따로 만들고(질문을 받을 때의 `interviewer`), 채점 기준도 달라져요(답변을 보낼 때의 `interviewer`).
 */

export type InterviewerKey = 'balanced' | 'friendly' | 'strict'

type Text = { ko: string; en: string }

export interface InterviewerProfile {
  key: InterviewerKey
  name: Text
  /** 프로필에서 이름 아래에 적는 직함이에요. */
  role: Text
  /** 프로필의 성격 소개 한두 문장이에요. */
  intro: Text
  /** 시작 화면에서 이 면접관을 고르면 그 목소리로 읽는 인사 한 줄이에요. 뒤에 음량 안내(`VOLUME_TIP`)가 이어져요. */
  greeting: Text
  /** AI가 이 면접관의 질문을 만드는 동안 시간을 때우는 잡담이에요. 맨 앞은 늘 먼저 하는 말이고, 그 뒤는 돌아가며 해요. */
  smallTalk: { ko: string[]; en: string[] }
  /** 성격을 한눈에 보여주는 이름표 세 개예요. */
  traits: { ko: string[]; en: string[] }
  /** 이 면접관이 읽는 목소리(`shared/voices.ts`의 key)예요. 면접관마다 다른 목소리로 고정이에요. */
  voice: string
  /** 고르기 카드의 바탕색이에요. 사진의 바탕과 같은 색이라 사진이 카드에 이어져요. */
  card: string
  portrait: Portrait
}

export const INTERVIEWERS: InterviewerProfile[] = [
  {
    key: 'balanced',
    name: { ko: '서도윤', en: 'Doyun Seo' },
    role: { ko: '실무 팀장', en: 'Team lead' },
    intro: {
      ko: '기술과 경험을 고르게 물어요. 나올 확률이 높은 질문부터 차분하게 듣고, 잘한 점과 보완할 점을 균형 있게 짚어 줘요.',
      en: 'Asks about skills and experience evenly, starting with the most likely questions, and gives balanced feedback.',
    },
    traits: { ko: ['차분함', '균형 잡힌 채점', '실전형 질문'], en: ['Calm', 'Balanced grading', 'Realistic'] },
    greeting: {
      ko: '안녕하세요. 실무 팀장 서도윤이에요. 기술과 경험을 고르게, 차분하게 여쭤볼게요.',
      en: "Hi, I'm Doyun Seo, a team lead. I'll calmly ask about both your skills and your experience.",
    },
    smallTalk: {
      ko: [
        '잠시만요, 서류를 보면서 질문을 정리하고 있어요.',
        '오늘 컨디션은 어떠세요? 긴장 푸시고 편하게 하시면 돼요.',
        '저도 첫 면접 때는 손에 땀이 엄청 났었어요. 다들 그래요.',
        '커피 한 잔 하고 오셨어요? 저는 벌써 세 잔째예요.',
        '창밖 날씨가 좋네요. 끝나고 산책이라도 하세요.',
        '거의 다 됐어요. 조금만 기다려 주세요.',
      ],
      en: [
        'One moment, I am putting questions together from your documents.',
        'How are you feeling today? Relax, you will do fine.',
        'My hands were sweating at my first interview too. Everyone goes through it.',
        'Did you grab a coffee? I am already on my third.',
        'Almost there. Thanks for waiting.',
      ],
    },
    voice: 'chris',
    card: '#d4e1f3',
    portrait: {
      url: '/images/interviewer-balanced.png',
      window: { x: 188, y: 40, size: 860 },
      mouth: { x: 618, y: 618, angle: 0, half: 80, lip: 6, nose: 50 },
    },
  },
  {
    key: 'friendly',
    name: { ko: '한지호', en: 'Jiho Han' },
    role: { ko: '다정한 선배 개발자', en: 'Friendly senior developer' },
    intro: {
      ko: '편하게 이야기하듯 프로젝트 경험과 협업을 먼저 물어요. 잘한 점부터 칭찬하고, 다음에 더 잘 말할 방법을 부드럽게 알려 줘요.',
      en: 'Starts with your projects and teamwork like a casual chat. Praises what went well first, then gently shows how to say it better.',
    },
    traits: { ko: ['편안함', '경험과 협업 중심', '격려형 피드백'], en: ['Relaxed', 'Projects and teamwork', 'Encouraging'] },
    greeting: {
      ko: '안녕하세요. 선배 개발자 한지호예요. 편하게 이야기하듯 프로젝트 경험부터 들어 볼게요.',
      en: "Hi, I'm Jiho Han, a senior developer. Let's chat casually, starting with your projects.",
    },
    smallTalk: {
      ko: [
        '잠깐만요, 물어볼 거 몇 개 고르고 있어요.',
        '오늘 점심은 뭐 드셨어요? 저는 김치찌개 먹었어요.',
        '면접이라고 너무 부담 갖지 마세요. 그냥 수다 떤다고 생각하시면 돼요.',
        '아, 이 프로젝트 재밌어 보이네요. 이건 꼭 물어봐야겠어요.',
        '저희 회사 앞에 고양이가 한 마리 사는데, 이름이 버그예요. 잡히질 않아서요.',
        '조금만요, 거의 다 골랐어요.',
      ],
      en: [
        'Hang on, I am picking a few things to ask.',
        'What did you have for lunch? I had kimchi stew.',
        'No pressure, just think of this as a chat.',
        'Oh, this project looks fun. I have to ask about it.',
        'There is a cat near our office named Bug. Nobody can catch it.',
        'Almost done picking.',
      ],
    },
    voice: 'taehyung',
    card: '#9dc7f8',
    portrait: {
      url: '/images/interviewer-friendly.jpg',
      window: { x: 124, y: 8, size: 1020 },
      mouth: { x: 634, y: 694, angle: 0.172, half: 95, lip: -4, nose: 62 },
    },
  },
  {
    key: 'strict',
    name: { ko: '강태민', en: 'Taemin Kang' },
    role: { ko: '깐깐한 기술 리드', en: 'Strict tech lead' },
    intro: {
      ko: '기술과 CS 기초를 깊게 파고들어요. 근거와 숫자가 없는 답에는 점수가 박하고, 빈틈을 찌르는 꼬리 질문을 던져요.',
      en: 'Digs deep into tech and CS fundamentals. Grades answers without evidence or numbers harshly and follows up on every gap.',
    },
    traits: { ko: ['압박 면접', '기술 깊이', '엄격한 채점'], en: ['Pressure', 'Technical depth', 'Strict grading'] },
    greeting: {
      ko: '안녕하세요. 기술 리드 강태민이에요. 원리와 근거까지 깊게 물어볼 테니 단단히 준비해 주세요.',
      en: "Hi, I'm Taemin Kang, a tech lead. I'll dig into principles and evidence, so come prepared.",
    },
    smallTalk: {
      ko: [
        '질문을 만들고 있어요. 쉬운 질문은 없을 거예요.',
        '서류에 적힌 숫자, 하나하나 다 볼 거예요.',
        '제가 깐깐하다는 말 자주 들어요. 칭찬으로 듣고 있어요.',
        '기다리는 동안 시간 복잡도 하나 떠올려 보세요.',
        '모른다고 말하는 것도 실력이에요. 아는 척은 금방 티 나요.',
        '거의 끝났어요. 마음의 준비 되셨죠?',
      ],
      en: [
        'I am writing your questions. None of them will be easy.',
        'I will check every number on your documents.',
        'People call me strict. I take it as a compliment.',
        'While you wait, think about a time complexity or two.',
        'Saying you do not know is a skill too. Bluffing shows quickly.',
        'Almost done. Ready?',
      ],
    },
    voice: 'minjoon',
    card: '#9fc9f5',
    portrait: {
      url: '/images/interviewer-strict.jpg',
      window: { x: 189, y: 24, size: 868 },
      mouth: { x: 623, y: 645, angle: -0.042, half: 81, lip: 1, nose: 70 },
    },
  },
]

export const DEFAULT_INTERVIEWER = INTERVIEWERS[0]

/** 인사 뒤에 이어 읽는 음량 안내예요. 소리 크기는 면접 화면 오른쪽 위에서 맞춰요. */
export const VOLUME_TIP: Text = {
  ko: '소리가 너무 크다면 오른쪽 위에서 음량을 조절해 주세요.',
  en: "If I'm too loud, you can turn the volume down at the top right.",
}

/** 시작 화면에서 면접관이 읽는 말이에요. 인사 한 줄과 음량 안내예요. */
export const greetingOf = (interviewer: InterviewerProfile, lang: 'ko' | 'en') => `${interviewer.greeting[lang]} ${VOLUME_TIP[lang]}`

export const interviewerOf = (key: string | null) => INTERVIEWERS.find((item) => item.key === key) ?? DEFAULT_INTERVIEWER

const STORE_KEY = 'javadda:practice-interviewer'
const chosen = createStore<InterviewerKey>(interviewerOf(readItem(STORE_KEY)).key)

/** 고른 면접관이에요. 고르지 않았으면 맨 앞의 실무 팀장이에요. 이 기기에 기억해요. */
export const useInterviewer = () => interviewerOf(useStore(chosen, (value) => value, DEFAULT_INTERVIEWER.key))

export function setInterviewer(key: InterviewerKey) {
  writeItem(STORE_KEY, key)
  chosen.set(key)
}
