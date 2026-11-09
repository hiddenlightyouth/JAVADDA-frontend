import { useEffect, useState } from 'react'
import { PET_WINDOW_EVENT, type PetKind, type PetStatus } from '../lib/pet'
import { PetStage } from './PetStage'

interface Detail {
  kind?: PetKind | null
  busy?: boolean
  percent?: number | null
  event?: PetStatus['event']
  poke?: number
  look?: number
}

/**
 * macOS 앱(3.2부터)이 바탕화면에 띄우는 펫 창의 화면이에요(/pet-window?kind=claude). 바탕은 투명하고 펫만 그려요.
 * 상태와 누르기, 바라볼 쪽은 앱이 `javadda:pet` 이벤트로 넘겨줘요. 누르면 앱이 잡아따 창을 열어요.
 */
export function PetWindow() {
  const [kind, setKind] = useState<PetKind>(() => (new URLSearchParams(location.search).get('kind') === 'codex' ? 'codex' : 'claude'))
  const [status, setStatus] = useState<PetStatus>({ busy: false, percent: null, event: null })
  const [pokeAt, setPokeAt] = useState(0)
  const [look, setLook] = useState(0)

  useEffect(() => {
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<Detail>).detail ?? {}
      if (detail.kind === 'claude' || detail.kind === 'codex') setKind(detail.kind)
      if (detail.busy !== undefined) setStatus({ busy: detail.busy, percent: detail.percent ?? null, event: detail.event ?? null })
      if (detail.poke) setPokeAt(detail.poke)
      if (typeof detail.look === 'number') setLook(detail.look)
    }
    window.addEventListener(PET_WINDOW_EVENT, onEvent)
    return () => window.removeEventListener(PET_WINDOW_EVENT, onEvent)
  }, [])

  return (
    <div className="flex h-dvh items-end justify-center overflow-hidden select-none">
      <PetStage key={kind} kind={kind} status={status} pokeAt={pokeAt} look={look} bubbleAlign="center" />
    </div>
  )
}
