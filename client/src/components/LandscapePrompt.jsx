import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import './landscape-prompt.css'

export default function LandscapePrompt() {
  const [message, setMessage] = useState('')
  const { pathname } = useLocation()
  const isGame = /^\/game\/[^/]+\/?$/.test(pathname)

  async function turnLandscape() {
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) {
          throw new Error('Fullscreen unsupported')
        }
        await document.documentElement.requestFullscreen()
      }

      if (!screen.orientation?.lock) {
        throw new Error('Orientation lock unsupported')
      }

      await screen.orientation.lock('landscape')
      setMessage('')
    } catch {
      setMessage(
        'Trình duyệt không hỗ trợ tự xoay. Hãy bật xoay tự động và xoay ngang điện thoại.'
      )
    }
  }

  if (!isGame) return null

  return (
    <div className="xo-landscape-prompt">
      <div className="xo-landscape-panel">
        <svg
          width="76"
          height="76"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M4 8a9 9 0 0 1 3-4" />
          <path d="m3 4 4 0 0 4" />
          <path d="M20 16a9 9 0 0 1-3 4" />
          <path d="m21 20-4 0 0-4" />
        </svg>

        <h2>XOAY NGANG MÀN HÌNH</h2>
        <p>
          X-O Arena được tối ưu cho chế độ ngang.
          Hãy xoay điện thoại để chơi game.
        </p>

        <button type="button" onClick={turnLandscape}>
          Bật chế độ ngang
        </button>

        {message && <small>{message}</small>}
      </div>
    </div>
  )
}

