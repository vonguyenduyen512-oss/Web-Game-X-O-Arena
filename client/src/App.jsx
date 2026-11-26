import './components/clean-navigation.css'
import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './store.jsx'
import { useEffect } from 'react'
import { clickSound, unlockAudio } from './lib/gameAudio.js' // XO_SOUND_2026

const Splash = lazy(() => import('./pages/Splash.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const ModeSelect = lazy(() => import('./pages/ModeSelect.jsx'))
const Lobby = lazy(() => import('./pages/Lobby.jsx'))
const JoinRoom = lazy(() => import('./pages/JoinRoom.jsx'))
const Game = lazy(() => import('./pages/Game.jsx'))
const Result = lazy(() => import('./pages/Result.jsx'))
const EventHot = lazy(() => import('./pages/EventHot.jsx'))

const CreateRoom = lazy(() =>
  import('./pages/Rooms.jsx').then(m => ({ default: m.CreateRoom }))
)

const WaitingRoom = lazy(() =>
  import('./pages/Rooms.jsx').then(m => ({ default: m.WaitingRoom }))
)

const Profile = lazy(() =>
  import('./pages/Profile.jsx').then(m => ({ default: m.Profile }))
)

const History = lazy(() =>
  import('./pages/Profile.jsx').then(m => ({ default: m.History }))
)

const Leaderboard = lazy(() =>
  import('./pages/Profile.jsx').then(m => ({ default: m.Leaderboard }))
)

const Settings = lazy(() =>
  import('./pages/Settings.jsx').then(m => ({ default: m.Settings }))
)

const HowToPlay = lazy(() =>
  import('./pages/Settings.jsx').then(m => ({ default: m.HowToPlay }))
)

function Private({ children }) {
  const { user } = useApp()
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  useEffect(() => {
    const onTap = e => {
      const el = e.target instanceof Element
        ? e.target.closest('button, a, [role="button"]')
        : null
      if (!el || el.matches(':disabled')) return
      unlockAudio()
      if (!el.matches('.gm-cell, .xo-mobile-cell')) clickSound()
    }
    document.addEventListener('pointerdown', onTap, true)
    return () => document.removeEventListener('pointerdown', onTap, true)
  }, [])
  const p = (el) => <Private>{el}</Private>

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/home" element={p(<Home />)} />
        <Route path="/mode" element={p(<ModeSelect />)} />
        <Route path="/lobby" element={p(<Lobby />)} />
        <Route path="/create-room" element={p(<CreateRoom />)} />
        <Route path="/join-room" element={p(<JoinRoom />)} />
        <Route path="/waiting/:code" element={p(<WaitingRoom />)} />
        <Route path="/game/:code" element={p(<Game />)} />
        <Route path="/result" element={p(<Result />)} />
        <Route path="/events" element={p(<EventHot />)} />
        <Route path="/profile" element={p(<Profile />)} />
        <Route path="/history" element={p(<History />)} />
        <Route path="/leaderboard" element={p(<Leaderboard />)} />
        <Route path="/settings" element={p(<Settings />)} />
        <Route path="/how-to-play" element={p(<HowToPlay />)} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

