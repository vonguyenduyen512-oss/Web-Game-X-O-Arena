import { validatePassword } from '../passwordValidation.js'
import { useState } from 'react'

export default function ForgotPassword({ onClose }) {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (step === 2 && validatePassword(password)) {
      return setError(validatePassword(password))
    }

    if (step === 2 && password !== confirm) {
      return setError('Mật khẩu xác nhận không khớp.')
    }

    setBusy(true)

    try {
      const endpoint = step === 1
        ? '/api/forgot-password/request-otp'
        : '/api/forgot-password/reset'

      const body = step === 1
        ? { email }
        : { email, otp, newPassword: password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra.')
      }

      if (step === 1) {
        setStep(2)
        setMessage(data.message || 'Nếu Gmail đã đăng ký, mã OTP sẽ được gửi.')
      } else {
        setStep(3)
        setMessage(data.message || 'Đổi mật khẩu thành công.')
      }
    } catch (err) {
      setError(err.message || 'Không kết nối được máy chủ.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quên mật khẩu"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.72)',
        display: 'grid',
        placeItems: 'center',
        padding: 16
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 410,
          background: '#16213e',
          color: '#fff',
          padding: 24,
          borderRadius: 16,
          boxShadow: '0 12px 45px #0008'
        }}
      >
        <h2 style={{ marginTop: 0 }}>Quên mật khẩu</h2>

        {step < 3 ? (
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <input
              type="email"
              required
              placeholder="Gmail đã đăng ký"
              value={email}
              disabled={step === 2}
              onChange={e => setEmail(e.target.value)}
              style={{ padding: 12, borderRadius: 8 }}
            />

            {step === 2 && (
              <>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="Mã OTP 6 số"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  style={{ padding: 12, borderRadius: 8 }}
                />

                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Mật khẩu mới"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ padding: 12, borderRadius: 8 }}
                />

                <input
                  required
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ padding: 12, borderRadius: 8 }}
                />
              </>
            )}

            {error && (
              <p role="alert" style={{ color: '#ff9e9e', margin: 0 }}>
                {error}
              </p>
            )}

            {message && (
              <p role="status" style={{ margin: 0 }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="xa-btn"
            >
              {busy
                ? 'Đang xử lý...'
                : step === 1
                  ? 'Gửi mã OTP'
                  : 'Đặt lại mật khẩu'}
            </button>
          </form>
        ) : (
          <p role="status">{message}</p>
        )}

        <button
          type="button"
          className="xa-link"
          onClick={onClose}
          style={{ marginTop: 16 }}
        >
          {step === 3 ? 'Về đăng nhập' : 'Đóng'}
        </button>
      </div>
    </div>
  )
}



