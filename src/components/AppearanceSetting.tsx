import type { AppTheme } from '../lib/app'
import { track } from '../lib/analytics'
import { pick } from '../lib/i18n'
import { ACCENTS, CONTRAST_RANGE, setAppAccent, setAppContrast, setAppTheme, toneOf, useAppSettings } from '../lib/theme'

type AccentItem = (typeof ACCENTS)[number]

/**
 * 설정 창의 화면 모드와 테마 고르기예요.
 * 화면 모드는 고른 테마로 그린 작은 앱 화면(사이드바, 제목, 글줄, 떠 있는 칸, 입력칸) 세 장이고, 시스템 설정은 왼쪽 반이 라이트, 오른쪽 반이 다크예요.
 * 테마는 라이트와 다크 구슬 두 개와 이름을 담은 칸이에요. 고른 테마는 두 구슬에 메인 컬러 고리와 해, 달 표시가 붙어요.
 * 구슬의 빛 번짐은 그라데이션이라 디자인 원칙(그라데이션 금지)의 예외예요.
 */

/** 고른 테마의 라이트나 다크 화면을 작게 그려요. 색은 그 화면 모드의 실제 값이라 지금 화면 모드와 상관없이 같아요. */
function Mock({ accent, mode }: { accent: AccentItem; mode: 'light' | 'dark' }) {
  const tone = (name: Parameters<typeof toneOf>[2]) => toneOf(accent, mode, name)
  const line = tone(mode === 'light' ? 'gray-200' : 'gray-300')
  return (
    <div className="absolute inset-0 flex" style={{ background: tone('white') }}>
      <div className="flex w-[22%] flex-col gap-[6%] px-[3%] pt-[6%]" style={{ background: tone('gray-50'), borderRight: `1px solid ${tone('gray-200')}` }}>
        <span className="h-[7%] rounded-full" style={{ background: tone('white'), border: `1px solid ${tone('gray-200')}` }} />
        {[0, 1, 2].map((row) => (
          <span key={row} className="h-[6%] rounded-full" style={{ background: row === 0 ? accent.color + '33' : tone('gray-100') }} />
        ))}
      </div>
      <div className="relative flex-1">
        <span className="absolute top-[10%] right-[34%] h-[8%] w-[26%] rounded-full" style={{ background: accent.color + (mode === 'light' ? '40' : '99') }} />
        <span className="absolute top-[30%] left-[9%] h-[5%] w-[38%] rounded-full" style={{ background: line }} />
        <span className="absolute top-[42%] left-[9%] h-[5%] w-[28%] rounded-full" style={{ background: line }} />
        <span className="absolute top-[8%] right-[6%] flex h-[42%] w-[22%] flex-col justify-center gap-[14%] rounded-md px-[4%]" style={{ background: tone('white'), border: `1px solid ${tone('gray-200')}` }}>
          {['#16b364', accent.color, '#f79009'].map((dot) => (
            <span key={dot} className="flex items-center gap-[12%]">
              <span className="size-[3px] shrink-0 rounded-full" style={{ background: dot }} />
              <span className="h-[3px] flex-1 rounded-full" style={{ background: line }} />
            </span>
          ))}
        </span>
        <span className="absolute right-[6%] bottom-[10%] left-[9%] flex h-[15%] items-center justify-between rounded-md px-[3%]" style={{ background: tone(mode === 'light' ? 'white' : 'gray-50'), border: `1px solid ${tone('gray-200')}` }}>
          <span className="h-[22%] w-[30%] rounded-full" style={{ background: line }} />
          <span className="aspect-square h-[55%] rounded-full" style={{ background: accent.color }} />
        </span>
      </div>
    </div>
  )
}

export function ModePicker({ label, names }: { label: string; names: Record<AppTheme, string> }) {
  const { theme, accent } = useAppSettings()
  const item = ACCENTS.find((entry) => entry.key === accent) ?? ACCENTS[0]
  const modes: AppTheme[] = ['system', 'light', 'dark']
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2.5">
      {modes.map((mode) => {
        const on = mode === theme
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              track('app_theme_change', { theme: mode })
              setAppTheme(mode)
            }}
            className={`rounded-2xl border p-1.5 pb-2 transition-colors ${on ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <span className="relative block aspect-[16/10] overflow-hidden rounded-xl border border-gray-200">
              {mode === 'dark' ? <Mock accent={item} mode="dark" /> : <Mock accent={item} mode="light" />}
              {mode === 'system' && (
                <span className="absolute inset-0" style={{ clipPath: 'inset(0 0 0 50%)' }}>
                  <Mock accent={item} mode="dark" />
                </span>
              )}
            </span>
            <span className={`mt-2 block text-[13px] ${on ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{names[mode]}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 빛이 비친 구슬이에요. 라이트는 흰 빛에서 테마 색으로, 다크는 어둠 속에서 테마 색이 아래에서 번져요. */
function Orb({ accent, mode, on }: { accent: AccentItem; mode: 'light' | 'dark'; on: boolean }) {
  const hue = accent.hue ?? 255
  const background =
    mode === 'light'
      ? `radial-gradient(circle at 34% 30%, #fff 0 16%, oklch(0.93 0.04 ${hue}) 42%, ${accent.color} 115%)`
      : `radial-gradient(circle at 62% 78%, oklch(0.62 0.13 ${hue}) 0%, oklch(0.34 0.07 ${hue}) 42%, oklch(0.17 0.025 ${hue}) 80%)`
  return (
    <span className={`relative grid size-14 place-items-center rounded-full transition-[box-shadow] ${on ? 'ring-2 ring-brand ring-offset-2 ring-offset-[var(--color-white)]' : ''}`}>
      <span className="size-full rounded-full" style={{ background }} />
      {on && (
        // 표시는 화면 모드와 상관없이 어두운 칸에 흰 그림이에요.
        <span style={{ background: '#26262b', color: '#fff' }} className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full">
          {mode === 'light' ? <SunMark /> : <MoonMark />}
        </span>
      )}
    </span>
  )
}

function SunMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1" />
    </svg>
  )
}

function MoonMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden>
      <path d="M13 9.6A5.2 5.2 0 0 1 6.4 3a5.2 5.2 0 1 0 6.6 6.6Z" />
    </svg>
  )
}

export function ThemePicker({ label }: { label: string }) {
  const { accent } = useAppSettings()
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {ACCENTS.map((item) => {
        const on = item.key === accent
        return (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              track('app_accent_change', { accent: item.key })
              setAppAccent(item.key)
            }}
            className={`flex flex-col rounded-2xl border px-4 pt-4 pb-3 text-left transition-colors ${on ? 'border-brand bg-brand-soft' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <span className="flex justify-center gap-3">
              <Orb accent={item} mode="light" on={on} />
              <Orb accent={item} mode="dark" on={on} />
            </span>
            <span className={`mt-3.5 text-[14px] ${on ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{pick(item.name)}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 명암 대비 한 줄이에요. 왼쪽에 이름과 되돌리기(100%가 아닐 때만), 설명이 있고, 오른쪽에 지금 값과 슬라이더가 있어요.
 * 낮추면 회색 글자와 테두리, 칸 바탕이 바탕색에 가까워지고 높이면 또렷해져요.
 */
export function ContrastRow({ label, note, reset }: { label: string; note: string; reset: string }) {
  const { contrast } = useAppSettings()
  const { min, max, step, base } = CONTRAST_RANGE
  const fill = ((contrast - min) / (max - min)) * 100
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] text-gray-900">{label}</span>
          {contrast !== base && (
            <button
              type="button"
              aria-label={reset}
              title={reset}
              onClick={() => {
                track('app_contrast_change', { contrast: base, from: 'reset' })
                setAppContrast(base)
              }}
              className="grid size-6 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3.5 6.5h6a3.5 3.5 0 1 1 0 7H6" />
                <path d="M6 3.5 3 6.5l3 3" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed break-keep text-gray-500">{note}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-14 rounded-md bg-gray-100 py-1 text-center font-mono text-[12.5px] text-gray-700 tabular-nums">{contrast}%</span>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={contrast}
          onChange={(event) => setAppContrast(Number(event.target.value))}
          onPointerUp={() => track('app_contrast_change', { contrast, from: 'slider' })}
          className="setting-range w-36"
          style={{ ['--fill' as string]: `${fill}%` }}
        />
      </div>
    </div>
  )
}
