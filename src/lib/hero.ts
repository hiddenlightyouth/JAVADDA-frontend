import { createStore } from './store'

// 소개 화면 맨 위의 검은 첫 화면이 헤더 뒤에 깔려 있는지예요. 이때 헤더는 투명해지고 글자가 흰색이 돼요.
export const heroDark = createStore(false)
