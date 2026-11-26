
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useApp } from '../store.jsx'
import { useToast } from '../components/Layout.jsx'
import AuthScene, { PATH, Svg } from '../components/AuthScene.jsx'
import ForgotPassword from './ForgotPassword.jsx'

// Màn hình 02 – Đăng nhập
export default function Login() {
  const { login, googleLogin, guestLogin } = useApp()
  const nav = useNavigate()

  const [forgotOpen, setForgotOpen] = useState(false)
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)
  const [toast, setToast] = useToast()

  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  const googleConfigured = clientId && !clientId.startsWith('REPLACE_WITH_')

  const submit = async (e) => {
    e.preventDefault()

    if (!id.trim() || !pw) {
      return setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
    }

    setError('')
    const err = await login(id.trim(), pw)

    if (err) return setError(err)
    nav('/home', { replace: true })
  }

  const handleGoogleSuccess = async (response) => {
    if (!response.credential) {
      return setError('Google không trả về thông tin xác thực.')
    }

    setGoogleBusy(true)
    setError('')

    try {
      if (typeof googleLogin !== 'function') {
        setError('Chưa cấu hình googleLogin trong store.jsx.')
        return
      }

      const err = await googleLogin(response.credential)
      if (err) return setError(err)

      nav('/home', { replace: true })
    } catch {
      setError('Đăng nhập Google thất bại.')
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthScene title="Đăng Nhập" icon={PATH.user}>
      <form onSubmit={submit} noValidate>
        <label className="xa-field">
          <Svg d={PATH.user} />
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Tên đăng nhập hoặc Email"
            autoComplete="username"
            aria-label="Tên đăng nhập hoặc Email"
          />
        </label>

        <label className="xa-field">
          <Svg d={PATH.lock} />
          <input
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Mật khẩu"
            autoComplete="current-password"
            aria-label="Mật khẩu"
          />
          <button
            type="button"
            className="xa-eye"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            <Svg d={PATH.eye}>
              {!show && <path d="M4 4l16 16" strokeWidth="2.2" />}
            </Svg>
          </button>
        </label>

        {error && (
          <div className="xa-err" role="alert">
            {error}
          </div>
        )}

        <div className="xa-row">
          <label className="xa-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Ghi nhớ đăng nhập
          </label>

          <button
            type="button"
            className="xa-link"
            onClick={() => setForgotOpen(true)}
          >
            Quên mật khẩu?
          </button>
        </div>

        <button className="xa-btn" type="submit">
          <Svg d={PATH.enter} />
          Đăng Nhập
        </button>

        <div className="xa-or">Hoặc</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: 44 }}>
            {googleConfigured ? (
              <GoogleOAuthProvider clientId={clientId}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setToast('Đăng nhập Google thất bại.')}
                  theme="filled_blue"
                  size="large"
                  shape="rectangular"
                  text="signin_with"
                  logo_alignment="left"
                  width="380"
                  locale="vi"
                />
              </GoogleOAuthProvider>
            ) : (
              <span className="xa-err">Chưa thiết lập Google Client ID trong client/.env</span>
            )}
          </div>

          <button
            type="button"
            className="xa-btn alt"
            style={{ width: '100%', minHeight: 46 }}
            disabled={googleBusy}
            onClick={async () => {
              setGoogleBusy(true)
              setError('')
              try {
                const error = await guestLogin()
                if (error) return setError(error)
                nav('/home', { replace: true })
              } finally { setGoogleBusy(false) }
            }}
          >
            <Svg d={PATH.pad} />
            Đăng nhập nhanh
          </button>
        </div>

        <p className="xa-foot">
          Chưa có tài khoản?{' '}
          <Link className="xa-link" to="/register">
            Đăng ký ngay →
          </Link>
        </p>
      </form>

      {forgotOpen && <ForgotPassword onClose={() => setForgotOpen(false)} />}
      {toast}
    </AuthScene>
  )
}
