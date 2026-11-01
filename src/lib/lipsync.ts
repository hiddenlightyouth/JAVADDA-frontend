/**
 * 읽고 있는 글자를 입 모양으로 바꿔요. 한글은 글자를 초성, 중성, 종성으로 나눠서
 * 글자를 읽는 동안 입이 초성에서 모음을 지나 종성으로 움직여요. ㅁ, ㅂ, ㅍ은 입술이 닫혀요.
 */

/** open은 벌린 정도, wide는 옆으로 당긴 정도, round는 오므린 정도예요. 모두 0에서 1이에요. */
export interface MouthPose {
  open: number
  wide: number
  round: number
}

export const REST: MouthPose = { open: 0, wide: 0, round: 0 }

const pose = (open: number, wide = 0, round = 0): MouthPose => ({ open, wide, round })

const AH = pose(1, 0.1)
const EH = pose(0.62, 0.45)
const UH = pose(0.72, 0, 0.12)
const OH = pose(0.46, 0, 0.85)
const OO = pose(0.28, 0, 1)
const EU = pose(0.2, 0.6)
const EE = pose(0.2, 0.85)
/** ㅘ, ㅝ처럼 입을 오므렸다가 다음 모음으로 가는 소리의 시작이에요. */
const W = pose(0.25, 0, 0.9)

/** 중성 21개의 순서(ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ)예요. 앞은 시작 모양, 뒤는 끝 모양이에요. */
const VOWELS: [MouthPose, MouthPose][] = [
  [AH, AH], [EH, EH], [AH, AH], [EH, EH], [UH, UH], [EH, EH], [UH, UH], [EH, EH],
  [OH, OH], [W, AH], [W, EH], [W, EH], [OH, OH], [OO, OO], [W, UH], [W, EH],
  [W, EE], [OO, OO], [EU, EU], [EU, EE], [EE, EE],
]

/** 입술을 붙이고 시작하는 초성이에요(ㅁ ㅂ ㅃ ㅍ). */
const CLOSED_INITIALS = new Set([6, 7, 8, 17])
/** 입술을 붙이고 끝나는 종성이에요(ㄻ ㅁ ㅂ ㅄ ㅍ). */
const CLOSED_FINALS = new Set([10, 16, 17, 18, 26])

const LATIN: Record<string, MouthPose> = { a: AH, e: EH, i: EE, o: OH, u: OO, y: EE, w: W, b: REST, m: REST, p: REST }
/** 모음이 아닌 영어 글자와 숫자는 살짝 벌린 입이에요. */
const CONSONANT = pose(0.3, 0.2)

const mix = (from: MouthPose, to: MouthPose, amount: number): MouthPose => ({
  open: from.open + (to.open - from.open) * amount,
  wide: from.wide + (to.wide - from.wide) * amount,
  round: from.round + (to.round - from.round) * amount,
})

const ease = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

/** 글자에서 소리가 나는 앞뒤 구간이에요. 앞 25%는 초성, 뒤 25%는 종성으로 움직이는 시간이에요. */
const ONSET = 0.25
const CODA = 0.75

function hangulPose(code: number, fraction: number): MouthPose {
  const initial = Math.floor(code / 588)
  const [start, end] = VOWELS[Math.floor((code % 588) / 28)]
  const final = code % 28
  const vowel = mix(start, end, ease((fraction - ONSET) / (CODA - ONSET)))
  if (fraction < ONSET) return CLOSED_INITIALS.has(initial) ? mix(REST, start, ease(fraction / ONSET)) : start
  if (fraction <= CODA || final === 0) return vowel
  // ㄴ, ㄹ, ㅇ처럼 입술을 붙이지 않는 받침은 입이 반쯤 다물어져요.
  const coda = CLOSED_FINALS.has(final) ? REST : mix(REST, end, 0.45)
  return mix(end, coda, ease((fraction - CODA) / (1 - CODA)))
}

/** position번째 글자를 읽는 입 모양이에요. position의 소수 부분은 그 글자를 읽은 정도예요. */
export function charPose(text: string, position: number): MouthPose {
  const index = Math.floor(position)
  const char = text[index]
  if (!char) return REST
  const code = char.charCodeAt(0) - 0xac00
  if (code >= 0 && code < 11172) return hangulPose(code, position - index)
  const latin = LATIN[char.toLowerCase()]
  if (latin) return latin
  return /[\p{L}\p{N}]/u.test(char) ? CONSONANT : REST
}

/** 소리의 크기(0에서 1)를 입 모양에 곱해요. 조용하면 글자와 상관없이 입이 닫혀요. */
export function withLoudness(mouth: MouthPose, loudness: number): MouthPose {
  const voiced = Math.min(1, loudness * 4)
  return { open: mouth.open * voiced * (0.5 + 0.5 * loudness), wide: mouth.wide * voiced, round: mouth.round * voiced }
}
