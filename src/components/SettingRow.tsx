import type { ReactNode } from 'react'

/** 위아래와 줄 사이에 옅은 선을 두른 목록이에요. 설정 창과 내 정보 화면의 목록이 같이 써요. */
export const lineList = 'divide-y divide-gray-100 border-y border-gray-100'
/** 설정 줄(`SettingRow`)을 담는 목록이에요. */
export const settingList = `${lineList} text-[14px]`

/** 설정 한 줄이에요. 왼쪽에 이름과 설명, 오른쪽에 고르는 칸이 있어요. `settingList` 안에 둬요. */
export function SettingRow({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <dt className="min-w-0">
        <span className="block text-gray-900">{label}</span>
        {note && <span className="mt-0.5 block text-[12.5px] leading-relaxed break-keep text-gray-500">{note}</span>}
      </dt>
      <dd className="shrink-0">{children}</dd>
    </div>
  )
}
