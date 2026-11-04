import { useEffect, useRef } from 'react'
import { INTERVIEWERS, type InterviewerProfile } from '../lib/interviewers'
import { pick, useLang } from '../lib/i18n'
import './InterviewerPicker.css'

/**
 * 면접 연습 시작 화면의 면접관 고르기예요. 고른 면접관 카드가 가운데에 크게 서고, 나머지는 양옆으로 비스듬히 물러나요.
 * 옆 카드를 누르거나 좌우 방향키로 바꾸고, 카드 아래에 고른 면접관의 성격 소개가 나와요. 가운데 카드를 다시 눌러도 onChange를 불러서 인사를 한 번 더 들어요.
 */
export function InterviewerPicker({ value, onChange }: { value: InterviewerProfile; onChange: (next: InterviewerProfile) => void }) {
  const lang = useLang()
  const at = INTERVIEWERS.findIndex((item) => item.key === value.key)
  const total = INTERVIEWERS.length
  const step = (by: number) => onChange(INTERVIEWERS[(at + by + total) % total])
  const stepRef = useRef(step)
  stepRef.current = step

  // 좌우 방향키로 면접관을 바꿔요. 글을 쓰는 중에는 받지 않아요.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return
      if (event.key === 'ArrowLeft') stepRef.current(-1)
      else if (event.key === 'ArrowRight') stepRef.current(1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="picker-stage" role="radiogroup" aria-label={lang === 'ko' ? '면접관 고르기' : 'Choose an interviewer'}>
        {INTERVIEWERS.map((item, order) => {
          // 가운데에서 몇 칸 떨어졌는지예요. 셋이라 늘 왼쪽 하나, 가운데, 오른쪽 하나로 둘러요.
          let offset = order - at
          if (offset > total / 2) offset -= total
          if (offset < -total / 2) offset += total
          const selected = offset === 0
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${pick(item.name)}, ${pick(item.role)}`}
              data-offset={offset}
              onClick={() => onChange(item)}
              className="picker-card"
              style={{ backgroundColor: item.card }}
            >
              <img src={item.portrait.url} alt="" draggable={false} className="picker-photo" />
              <span className="picker-caption">
                <span className="text-[12px] font-semibold text-[#000]/45">#{item.traits[lang][0]}</span>
                <span className="mt-0.5 text-[22px] leading-tight font-bold text-[#000]/85">{pick(item.name)}</span>
                <span className="mt-0.5 text-[12.5px] font-medium text-[#000]/55">{pick(item.role)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* 고른 면접관의 프로필이에요. 성격을 짧게 소개하고, 묻는 질문과 채점이 어떻게 다른지 알려줘요. */}
      <div key={value.key} className="mx-auto mt-7 max-w-md animate-fade text-center">
        <div className="flex flex-wrap justify-center gap-1.5">
          {value.traits[lang].map((trait) => (
            <span key={trait} className="rounded-full bg-[#fff]/10 px-3 py-1 text-[12.5px] font-medium text-[#fff]/80">
              #{trait}
            </span>
          ))}
        </div>
        <p className="mt-3.5 text-[14.5px] leading-relaxed break-keep text-[#fff]/65">{pick(value.intro)}</p>
      </div>
    </div>
  )
}
