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

export const interviewerOf = (key: string | null) => INTERVIEWERS.find((item) => item.key === key) ?? DEFAULT_INTERVIEWER

const STORE_KEY = 'javadda:practice-interviewer'
const chosen = createStore<InterviewerKey>(interviewerOf(readItem(STORE_KEY)).key)

/** 고른 면접관이에요. 고르지 않았으면 맨 앞의 실무 팀장이에요. 이 기기에 기억해요. */
export const useInterviewer = () => interviewerOf(useStore(chosen, (value) => value, DEFAULT_INTERVIEWER.key))

export function setInterviewer(key: InterviewerKey) {
  writeItem(STORE_KEY, key)
  chosen.set(key)
}
