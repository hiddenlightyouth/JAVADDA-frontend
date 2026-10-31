import { apiUrl, readWithLoad, type OnLoad } from './http'
import { readItem, writeItem } from './storage'
import { createStore, useStore } from './store'

/** 서버가 쓸 수 있는 AI 모델 하나예요. */
export interface AiModel {
  id: string
  provider: 'openai' | 'claude'
  /** 설정 창에 보여줄 이름 */
  label: string
}

export interface AiConfig {
  /** 고르지 않았을 때 서버가 쓰는 모델의 아이디 */
  defaultModel: string
  /** 서버에 키가 있는 모델만 와요. 비어 있으면 설정 창에서 모델 고르기를 숨겨요. */
  models: AiModel[]
}

/**
 * 서버가 지원하는 기능이에요. 회원, 피드백, 관리자, 진단(공고, 이력서, 리포트) 모두 백엔드가 맡아요.
 */
export interface ServerConfig {
  /** 서버에 관리자 API가 있는지. 없으면 앱의 관리자 화면에서 AI 사용량만 보여줘요. */
  admin: boolean
  /** 서버가 평가와 버그 신고를 받는지. 없으면 평가를 묻지 않고 버그 신고 버튼도 숨겨요. */
  feedback: boolean
  /** GitHub 로그인에 쓰는 공개 값. 서버가 GitHub 로그인을 켜 두지 않았으면 null이에요. */
  githubClientId: string | null
  /** 카카오 로그인에 쓰는 공개 값. 서버가 카카오 로그인을 켜 두지 않았으면 null이에요. */
  kakaoClientId: string | null
  /** 앱에서 시작한 계정 연결을 브라우저에서 마무리하는 API가 서버에 있는지. 없으면 앱의 내 정보에서 연결 버튼을 숨겨요. */
  socialAppLink: boolean
  /** 서버에 소셜 계정 연결 해제 API가 있는지. 없으면 내 정보에서 해제 버튼을 숨겨요. */
  socialUnlink: boolean
  /** 서버에 회원 탈퇴 API가 있는지. 없으면 내 정보에서 회원 탈퇴를 숨겨요. */
  withdraw: boolean
  /** 서버가 주간 사용량과 요금제를 다루는지. 없으면 사용량을 보여주지 않아요. */
  usage: boolean
  /** 고를 수 있는 AI 모델 */
  ai: AiConfig
  /** 서버에 닿았는지. false면 나머지 값은 모두 꺼진 기본값이에요. */
  online: boolean
}

const NONE: ServerConfig = {
  admin: false,
  feedback: false,
  githubClientId: null,
  kakaoClientId: null,
  socialAppLink: false,
  socialUnlink: false,
  withdraw: false,
  usage: false,
  ai: { defaultModel: '', models: [] },
  online: false,
}

function readAi(value: unknown): AiConfig {
  const ai = (value ?? {}) as Partial<AiConfig>
  const models = Array.isArray(ai.models)
    ? ai.models.filter((model): model is AiModel => !!model && typeof model.id === 'string' && model.id !== '' && typeof model.label === 'string')
    : []
  return { defaultModel: typeof ai.defaultModel === 'string' ? ai.defaultModel : '', models }
}

/** 서버가 어떤 기능을 지원하는지 물어봐요. 서버에 닿지 못하면 모두 꺼진 것으로 봐요. onLoad를 주면 받는 정도(0에서 1)를 알려요. */
async function fetchConfig(onLoad?: OnLoad): Promise<ServerConfig> {
  try {
    const result = await readWithLoad<Partial<ServerConfig>>(await fetch(apiUrl('/config')), onLoad)
    if (!result.ok) return NONE
    return {
      admin: result.data?.admin === true,
      feedback: result.data?.feedback === true,
      githubClientId: result.data?.githubClientId || null,
      kakaoClientId: result.data?.kakaoClientId || null,
      socialAppLink: result.data?.socialAppLink === true,
      socialUnlink: result.data?.socialUnlink === true,
      withdraw: result.data?.withdraw === true,
      usage: result.data?.usage === true,
      ai: readAi(result.data?.ai),
      online: true,
    }
  } catch {
    onLoad?.(1)
    return NONE
  }
}

let configOnce: Promise<ServerConfig> | null = null

/** 서버에 다시 물어봐요. 설정 창을 열 때 써서, 앱을 연 뒤에 서버가 켜졌거나 키가 바뀌어도 새 목록을 보여줘요. */
export function refreshConfig(onLoad?: OnLoad): Promise<ServerConfig> {
  configOnce = fetchConfig(onLoad)
  return configOnce
}

/** 서버가 지원하는 기능을 한 번만 물어보고 나눠 써요. 로그인 화면과 내 정보처럼 따로 뜨는 화면에서 써요. */
export function loadConfig(): Promise<ServerConfig> {
  configOnce ??= fetchConfig()
  return configOnce
}

const AI_MODEL_KEY = 'whoisloafing:ai-model'

/** 설정 창에서 고른 AI 모델의 아이디예요. 고르지 않았으면 null이고, 그때는 서버의 기본 모델을 써요. */
const aiModel = createStore<string | null>(readItem(AI_MODEL_KEY))

export const useAiModel = () => useStore(aiModel, (value) => value, null)

export function setAiModel(id: string | null) {
  writeItem(AI_MODEL_KEY, id)
  aiModel.set(id)
}

/** AI를 쓰는 요청에 붙이는 헤더예요. 고른 모델이 서버의 목록에 있을 때만 붙여요. */
export async function aiModelHeaders(): Promise<Record<string, string>> {
  const id = aiModel.get()
  if (!id) return {}
  const config = await loadConfig()
  return config.ai.models.some((model) => model.id === id) ? { 'X-AI-Model': id } : {}
}
