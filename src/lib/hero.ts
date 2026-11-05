import { aboutFromPath } from './routes'
import { createStore } from './store'

// 소개 화면 맨 위의 검은 첫 화면이 헤더 뒤에 깔려 있는지예요. 이때 헤더는 투명해지고 글자가 흰색이 돼요.
// 처음 열 때 소개 화면이면 첫 화면이 맨 위에 있으니 true로 시작해요. false로 시작하면 흰 헤더가 그려졌다가 투명해지며 깜빡여요.
export const heroDark = createStore(typeof window !== 'undefined' && aboutFromPath())
