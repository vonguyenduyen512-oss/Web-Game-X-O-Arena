import { useState } from 'react'
import './landscape-prompt.css'

export default function LandscapePrompt() {
  const [message, setMessage] = useState('')

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
        'Trinh duyet khong ho tro tu xoay. Hay bat xoay tu dong va xoay ngang dien thoai.'
      )
    }
  }

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

        <h2>XOAY NGANG MAN HINH</h2>
        <p>
          X-O Arena duoc toi uu cho che do ngang.
          Hay xoay dien thoai de choi game.
        </p>

        <button type="button" onClick={turnLandscape}>
          Bat che do ngang
        </button>

        {message && <small>{message}</small>}
      </div>
    </div>
  )
}
