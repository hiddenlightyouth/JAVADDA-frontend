import { useId } from 'react'
import './Interviewer.css'

/** A lightweight 2D puppet of the interviewer, driven by the audible playback clock. */
export function Interviewer({ mouth, speaking, label }: { mouth: number; speaking: boolean; label: string }) {
  const id = useId()
  const opening = Math.max(0, Math.min(1, mouth))
  const depth = opening * 27
  return (
    <div className="interviewer mb-6 self-center" data-speaking={speaking}>
      <svg viewBox="0 0 1000 1000" role="img" aria-label={label} className="interviewer-portrait">
        <defs>
          <clipPath id={id}>
            <path d={`M 423 498 Q 489 510 553 488 Q 505 ${510 + depth} 466 ${507 + depth} Q 439 ${503 + depth * 0.4} 423 498`} />
          </clipPath>
        </defs>
        <image href="/images/interviewer.png" width="1000" height="1000" />
        <g className="interviewer-mouth" opacity={Math.min(1, opening * 12)}>
          <g clipPath={`url(#${id})`}>
            <path d="M 415 480 H 560 V 550 H 415 Z" fill="#46252a" />
            <path d="M 428 497 Q 490 508 550 489 L 546 500 Q 490 519 432 505 Z" fill="#f5e5dd" />
            <ellipse cx="490" cy={533 + depth * 0.25} rx="40" ry="12" fill="#b76c73" />
          </g>
          <path d={`M 423 498 Q 439 ${503 + depth * 0.4} 466 ${507 + depth} Q 505 ${510 + depth} 553 488`} fill="none" stroke="#bc7b72" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
