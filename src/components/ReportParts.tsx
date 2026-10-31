import type { ReactNode } from 'react'
import type { PracticeFeedback } from '../lib/gap'
import { messages, useMessages } from '../lib/i18n'
import { Bullets, label } from './ui'

/**
 * 리포트, 예상 질문, 면접 연습이 같이 쓰는 작은 부품이에요. 연한 메인 컬러 안내 칸, 모범 답변 칸, 답변 피드백 묶음이 있어요.
 * 이 화면들만 쓰는 모양이라 `GapParts`가 아니라 여기에 둬요.
 */

const TEXT = messages({
  ko: { modelAnswer: '이렇게 답했으면 좋았어요', good: '좋았어요', improve: '보완할 점', rephrase: '이렇게 말해 보세요' },
  en: { modelAnswer: 'A stronger answer', good: 'What went well', improve: 'To improve', rephrase: 'Try saying it like this' },
})

/**
 * 연한 메인 컬러 바탕의 안내 칸이에요. 제목과 설명은 두 줄로 나눠 적고, 오른쪽에 버튼을 둘 수 있어요.
 * 리포트의 이력서 업데이트 안내와 예상 질문의 질문을 모두 연습했어요 안내가 같이 써요.
 */
export function Callout({ title, body, icon, action, className = '' }: { title: string; body: string; icon?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-brand-soft px-5 py-4 ${className}`}>
      {icon}
      {/* 제목과 설명은 두 줄로 나눠 적어요. 한 줄에 이어 붙이면 문장 두 개가 한 문장처럼 읽혀요. */}
      <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-gray-700">{body}</p>
      </div>
      {action}
    </div>
  )
}

/** 모범 답변(이렇게 답했으면 좋았어요)을 연한 메인 컬러 칸에 적어요. 예상 질문의 지난 답변과 지난 기록 칸이 같이 써요. */
export function ModelAnswer({ text, className = '' }: { text: string; className?: string }) {
  const L = useMessages(TEXT)
  return (
    <div className={`rounded-lg bg-brand-soft p-3 ${className}`}>
      <h3 className="text-[12.5px] font-semibold text-brand-hover">{L.modelAnswer}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-gray-800">{text}</p>
    </div>
  )
}

/** 작은 제목 아래에 점 목록을 붙인 묶음이에요. 비어 있으면 그리지 않아요. */
function LabeledBullets({ title, items, brand = false }: { title: string; items: readonly string[]; brand?: boolean }) {
  if (items.length === 0) return null
  return (
    <section>
      <h3 className={label}>{title}</h3>
      <Bullets items={items} brand={brand} className="mt-1" />
    </section>
  )
}

/**
 * 답변 피드백의 좋았어요, 보완할 점, 이렇게 말해 보세요 묶음이에요. 감싸는 칸(세로로 쌓거나 두 칸으로 놓거나)은 쓰는 쪽이 정해요.
 * 예상 질문의 지난 기록 칸과 면접 연습의 결과가 같이 써요.
 */
export function FeedbackSections({ feedback }: { feedback: PracticeFeedback }) {
  const L = useMessages(TEXT)
  return (
    <>
      <LabeledBullets title={L.good} items={feedback.good} brand />
      <LabeledBullets title={L.improve} items={feedback.improve} />
      <LabeledBullets title={L.rephrase} items={feedback.rephrase} />
    </>
  )
}

/** 리포트 화면 안에서 다른 리포트로 주소를 바꿔요. replace면 뒤로 가기 기록을 남기지 않아요(재진단). 보던 탭은 그대로예요. */
export function switchReport(from: string, to: string, replace = false) {
  const path = window.location.pathname.replace(`/r/${from}`, `/r/${to}`)
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
