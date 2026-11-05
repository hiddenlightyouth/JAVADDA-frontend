import { DotLottieReact, setWasmUrl } from '@lottiefiles/dotlottie-react'
import wasmUrl from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url'

/**
 * AI를 기다리는 동안 진행 고리 위에 띄우는 로봇 애니메이션이에요. `AiProgress`가 필요할 때만 불러와요(lazy).
 * 애니메이션은 LottieFiles의 무료 애니메이션(Lottie Simple License)을 `public/lottie/ai-loading.lottie`에 받아 둔 것이에요.
 * 그리는 엔진(wasm)은 CDN 대신 우리 빌드에 같이 실어요. macOS 앱이나 CDN이 막힌 곳에서도 보이게요.
 * 움직임 줄이기를 켠 사람에게는 멈춘 첫 장면만 보여요.
 * src로 다른 애니메이션도 그려요. 빈 서류 안내의 펄럭이는 종이(`public/lottie/empty-document.lottie`, LottieFiles의 Empty file or document, Lottie Simple License)가 이것을 써요.
 */
setWasmUrl(wasmUrl)

export default function AiLoader({ className = '', src = '/lottie/ai-loading.lottie' }: { className?: string; src?: string }) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return <DotLottieReact src={src} loop autoplay={!still} className={className} />
}
