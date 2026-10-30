import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { closeBugReport, sendFeedback } from '../lib/feedback'
import { showToast } from '../lib/toast'
import { Modal } from './Dialog'
import { messages, pick, useMessages } from '../lib/i18n'
import { primaryButton, quietButton, textArea } from './ui'

const TEXT = messages({
  ko: {
    working: '처리 중',
    send: '보내기',
    // 버그 신고의 문구는 격식체로 써요.
    bugFailed: '신고를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    bugDone: '버그 신고가 접수되었습니다. 불편을 겪지 않도록 빠른 시일 내로 해결하겠습니다.',
    bugTitle: '버그 신고',
    bugNotice: '이 보고서에는 귀하의 설명과 현재 세션 기록이 포함됩니다. 관련 문제를 디버그하고 Javadda를 개선하기 위해 이 정보를 사용할 수 있습니다.',
    bugPlaceholder: '문제를 설명해 주세요',
    bugLabel: '문제 설명',
    cancel: '취소',
  },
  en: {
    working: 'Sending',
    send: 'Send',
    bugFailed: "Couldn't send the report. Please try again in a moment.",
    bugDone: "Your bug report has been received. We'll fix it as soon as we can.",
    bugTitle: 'Report a bug',
    bugNotice: 'This report includes your description and the current session record. We may use this information to debug the issue and improve Javadda.',
    bugPlaceholder: 'Describe the problem',
    bugLabel: 'Problem description',
    cancel: 'Cancel',
  },
})

/** 버그를 신고하는 창이에요. 무엇이 문제였는지 적어서 보내요. 보고 있던 화면의 주소와 채팅 ID가 함께 가요. */
export function BugReport({ chatId }: { chatId: string | null }) {
  const text = useMessages(TEXT)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    track('bug_report_open')
    inputRef.current?.focus()
  }, [])

  const ready = comment.trim().length >= 5

  async function send() {
    if (!ready || sending) return
    setSending(true)
    const ok = await sendFeedback({ kind: 'BUG', comment, chatId })
    setSending(false)
    track('feedback_send', { kind: 'bug', success: ok })
    if (!ok) {
      showToast(pick(TEXT).bugFailed)
      return
    }
    showToast(pick(TEXT).bugDone)
    closeBugReport()
  }

  return (
    <Modal onClose={closeBugReport} labelledBy="bug-report-title" className="w-full max-w-md p-5">
      <h2 id="bug-report-title" className="text-[15px] font-semibold text-gray-900">
        {text.bugTitle}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{text.bugNotice}</p>
      <textarea
        ref={inputRef}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={5}
        maxLength={2000}
        placeholder={text.bugPlaceholder}
        aria-label={text.bugLabel}
        className={`mt-3.5 ${textArea}`}
      />
      <div className="mt-3.5 flex justify-end gap-2">
        <button type="button" onClick={closeBugReport} className={quietButton}>
          {text.cancel}
        </button>
        <button
          type="button"
          disabled={!ready || sending}
          onClick={() => void send()}
          className={primaryButton}
        >
          {sending ? text.working : text.send}
        </button>
      </div>
    </Modal>
  )
}
