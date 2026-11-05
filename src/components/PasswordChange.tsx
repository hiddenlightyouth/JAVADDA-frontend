import { useId, useState, type FormEvent } from 'react'
import { track } from '../lib/analytics'
import { changePassword, signOut, useAuth } from '../lib/auth'
import { messages, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { Modal } from './Dialog'
import { ScriptMark } from './LofyScript'
import { FormError, primaryButton, primaryButtonLg, quietButton, textField } from './ui'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 64

const TEXT = messages({
  ko: {
    current: '지금 비밀번호',
    temporary: '임시 비밀번호',
    next: '새 비밀번호',
    confirm: '새 비밀번호 확인',
    nextHint: (min: number) => `${min}자 이상`,
    needCurrent: '지금 비밀번호를 적어 주세요.',
    needTemporary: '받은 임시 비밀번호를 적어 주세요.',
    length: (min: number, max: number) => `새 비밀번호는 ${min}자 이상 ${max}자 이하로 정해 주세요.`,
    mismatch: '새 비밀번호가 서로 달라요. 다시 확인해 주세요.',
    working: '바꾸는 중',
    change: '비밀번호 변경',
    cancel: '취소',
    changed: '비밀번호를 바꿨어요. 다른 기기는 로그아웃했어요.',
    title: '비밀번호 변경',
    body: '바꾸면 지금 쓰는 기기만 남기고 다른 기기에서는 로그아웃돼요.',
    forcedTitle: '새 비밀번호를 정해 주세요',
    forcedBody: '관리자가 비밀번호를 초기화했어요. 받은 임시 비밀번호를 넣고 새 비밀번호로 바꿔야 계속 쓸 수 있어요.',
    forcedSubmit: '새 비밀번호로 시작하기',
    signOut: '로그아웃',
  },
  en: {
    current: 'Current password',
    temporary: 'Temporary password',
    next: 'New password',
    confirm: 'Confirm new password',
    nextHint: (min: number) => `At least ${min} characters`,
    needCurrent: 'Please enter your current password.',
    needTemporary: 'Please enter the temporary password you received.',
    length: (min: number, max: number) => `Your new password must be ${min} to ${max} characters.`,
    mismatch: "The new passwords don't match. Please check again.",
    working: 'Saving',
    change: 'Change password',
    cancel: 'Cancel',
    changed: 'Password changed. Your other devices were signed out.',
    title: 'Change password',
    body: 'Your other devices will be signed out. This device stays signed in.',
    forcedTitle: 'Set a new password',
    forcedBody: 'An administrator reset your password. Enter the temporary password you received and choose a new one to continue.',
    forcedSubmit: 'Continue with new password',
    signOut: 'Sign out',
  },
})

function Field({ label, value, onChange, autoComplete, placeholder, autoFocus }: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-gray-600">{label}</span>
      <input
        type="password"
        value={value}
        maxLength={PASSWORD_MAX}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 ${textField}`}
      />
    </label>
  )
}

/**
 * 지금 비밀번호(초기화된 계정은 임시 비밀번호), 새 비밀번호, 확인을 받아 바꾸는 칸이에요.
 * 내 정보의 비밀번호 변경 창과, 초기화된 계정이 처음 들어왔을 때의 화면(`PasswordChangeRequired`)이 같이 써요.
 */
function PasswordForm({ forced, onDone, onCancel }: { forced: boolean; onDone: () => void; onCancel?: () => void }) {
  const text = useMessages(TEXT)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  function validate(): string {
    if (!current) return forced ? text.needTemporary : text.needCurrent
    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) return text.length(PASSWORD_MIN, PASSWORD_MAX)
    if (next !== confirm) return text.mismatch
    return ''
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (working) return
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    setError('')
    setWorking(true)
    const outcome = await changePassword(current, next)
    setWorking(false)
    track('auth_password_change', { forced, success: outcome.ok })
    if (!outcome.ok) {
      setError(outcome.message)
      return
    }
    showToast(text.changed)
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label={forced ? text.temporary : text.current} value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
      <Field label={text.next} value={next} onChange={setNext} autoComplete="new-password" placeholder={text.nextHint(PASSWORD_MIN)} />
      <Field label={text.confirm} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <FormError>{error}</FormError>
      {forced ? (
        <button type="submit" disabled={working} className={`mt-2 ${primaryButtonLg}`}>
          {working ? text.working : text.forcedSubmit}
        </button>
      ) : (
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className={quietButton}>
            {text.cancel}
          </button>
          <button type="submit" disabled={working} className={primaryButton}>
            {working ? text.working : text.change}
          </button>
        </div>
      )}
    </form>
  )
}

/** 내 정보의 비밀번호 변경 창이에요. */
export function PasswordChangeDialog({ onClose }: { onClose: () => void }) {
  const text = useMessages(TEXT)
  const titleId = useId()
  return (
    <Modal onClose={onClose} labelledBy={titleId} closeOnBackdrop={false} className="w-full max-w-sm p-6">
      <h2 id={titleId} className="text-[15px] font-semibold text-gray-900">
        {text.title}
      </h2>
      <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-gray-500">{text.body}</p>
      <PasswordForm forced={false} onDone={onClose} onCancel={onClose} />
    </Modal>
  )
}

/**
 * 관리자가 비밀번호를 초기화한 계정(`Me.passwordChangeRequired`)이 로그인하면 다른 화면 대신 이 화면만 보여줘요.
 * 새 비밀번호로 바꾸면 내 정보를 다시 받아서 표시가 지워지고 원래 화면으로 돌아가요. 바꾸지 않으려면 로그아웃만 할 수 있어요.
 */
export function PasswordChangeRequired() {
  const text = useMessages(TEXT)
  const { me } = useAuth()
  const [leaving, setLeaving] = useState(false)
  return (
    <main data-app-drag className="flex h-dvh overflow-y-auto bg-white">
      <div className="m-auto w-full max-w-sm px-5 py-16">
        <ScriptMark className="h-7 w-auto" />
        <h1 className="mt-8 text-[24px] font-semibold leading-snug text-gray-900">{text.forcedTitle}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-gray-500">{text.forcedBody}</p>
        {me?.email && <p className="mt-6 truncate text-[13px] font-medium text-gray-700">{me.email}</p>}
        <div className="mt-4">
          <PasswordForm forced onDone={() => undefined} />
        </div>
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={leaving}
            onClick={() => {
              setLeaving(true)
              track('auth_logout', { from: 'password-reset' })
              void signOut()
            }}
            className="text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            {text.signOut}
          </button>
        </div>
      </div>
    </main>
  )
}
