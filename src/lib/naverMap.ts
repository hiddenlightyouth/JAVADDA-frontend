/**
 * 네이버 지도(NAVER Maps JavaScript API v3)를 불러와요. 기업 상세의 위치 칸이 써요.
 * 네이버 클라우드 플랫폼에서 받은 Client ID(`VITE_NAVER_MAP_KEY_ID`)가 있을 때만 켜지고, 없거나 인증에 실패하면 SVG 지도(`KoreaMap`)로 그려요.
 * Client ID는 브라우저에 공개되는 값이고, 대신 네이버 클라우드 콘솔에 등록한 사이트 주소에서만 동작해요.
 */

const KEY_ID = (import.meta.env.VITE_NAVER_MAP_KEY_ID as string | undefined) || undefined

/** 화면이 쓰는 만큼만 적은 네이버 지도 타입이에요. */
export interface NaverMaps {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => { destroy: () => void }
  LatLng: new (lat: number, lng: number) => unknown
  Marker: new (options: Record<string, unknown>) => unknown
}

declare global {
  interface Window {
    naver?: { maps: NaverMaps }
    navermap_authFailure?: () => void
  }
}

export const naverMapEnabled = Boolean(KEY_ID)

let loading: Promise<NaverMaps> | null = null

/** 스크립트를 한 번만 받아요. 인증에 실패하면(등록하지 않은 주소 등) 실패로 끝나서 화면이 SVG 지도로 바꿔요. */
export function loadNaverMaps(): Promise<NaverMaps> {
  if (!KEY_ID) return Promise.reject(new Error('no naver map key'))
  if (window.naver?.maps) return Promise.resolve(window.naver.maps)
  loading ??= new Promise<NaverMaps>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(KEY_ID)}`
    script.async = true
    script.onload = () => (window.naver?.maps ? resolve(window.naver.maps) : reject(new Error('naver map missing')))
    script.onerror = () => reject(new Error('naver map load failed'))
    window.navermap_authFailure = () => {
      authFailed = true
      listeners.forEach((listener) => listener())
      reject(new Error('naver map auth failed'))
    }
    document.head.appendChild(script)
  })
  return loading
}

// 인증 실패는 스크립트를 받은 뒤 지도를 그릴 때 알려 와서, 이미 그린 화면도 SVG 지도로 바꿀 수 있게 알려요.
let authFailed = false
const listeners = new Set<() => void>()

/** 네이버 지도 인증에 실패했을 때 불러요. 이미 실패했으면 바로 불러요. 돌려주는 함수로 그만 들어요. */
export function onNaverMapAuthFailure(listener: () => void): () => void {
  if (authFailed) listener()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 네이버 지도에서 주소나 이름을 찾는 주소예요. 네이버 지도는 다른 사이트 안에 띄울 수 없어서 새 탭으로 열어요. */
export const naverMapSearchUrl = (query: string) => `https://map.naver.com/p/search/${encodeURIComponent(query)}`
