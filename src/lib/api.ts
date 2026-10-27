import { apiUrl, readResult } from './http'

/**
 * 서버가 지원하는 기능이에요. 회원, 피드백, 관리자 같은 공통 기능은 백엔드가 맡고,
 * 공고와 리포트 같은 진단 기능은 아직 서버가 없어서 `src/lib/gap.ts`의 가짜 API를 써요.
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
}

const NONE: ServerConfig = { admin: false, feedback: false, githubClientId: null, kakaoClientId: null, socialAppLink: false, socialUnlink: false, withdraw: false, usage: false }

/** 서버가 어떤 기능을 지원하는지 물어봐요. 서버에 닿지 못하면 모두 꺼진 것으로 봐요. */
export async function fetchConfig(): Promise<ServerConfig> {
  try {
    const result = await readResult<Partial<ServerConfig>>(await fetch(apiUrl('/config')))
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
    }
  } catch {
    return NONE
  }
}

let configOnce: Promise<ServerConfig> | null = null

/** 서버가 지원하는 기능을 한 번만 물어보고 나눠 써요. 로그인 화면과 내 정보처럼 따로 뜨는 화면에서 써요. */
export function loadConfig(): Promise<ServerConfig> {
  configOnce ??= fetchConfig()
  return configOnce
}
