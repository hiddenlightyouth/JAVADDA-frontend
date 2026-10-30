import { createStore, useStore } from './store'
import { authFetch } from './auth'

/** 서버에 보내는 피드백. 평가는 분석이 어땠는지, 버그는 문제가 생겼다는 신고예요. 지금 화면에서는 버그 신고만 보내요. */
export interface FeedbackInput {
  kind: 'RATING' | 'BUG'
  rating?: 'GOOD' | 'BAD'
  comment?: string
  chatId?: string | null
}

/** 평가나 버그 신고를 보내요. 지금 보고 있는 화면의 주소 경로를 함께 보내요. 로그인하지 않아도 보낼 수 있어요. */
export async function sendFeedback(input: FeedbackInput): Promise<boolean> {
  try {
    const result = await authFetch<null>('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, chatId: input.chatId ?? undefined, page: window.location.pathname.slice(0, 200) }),
    })
    return result.ok
  } catch {
    return false
  }
}

/** ready는 서버가 피드백을 받을 수 있는지, bugOpen은 버그 신고 창이 떠 있는지예요. */
const state = createStore({ ready: false, bugOpen: false })

const setState = (next: Partial<ReturnType<typeof state.get>>) => state.set({ ...state.get(), ...next })

export const setFeedbackReady = (ready: boolean) => setState({ ready })
export const openBugReport = () => setState({ bugOpen: true })
export const closeBugReport = () => setState({ bugOpen: false })

export function useFeedback() {
  return useStore(state)
}
