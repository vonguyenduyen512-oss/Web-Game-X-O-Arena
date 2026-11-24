// XO_SOUND_2026
// Am thanh tu tao, khong can MP3.
let ctx
let timer
let inGame = false
let index = 0
let musicOn = true

try {
  musicOn = localStorage.getItem('xo_music_on') !== 'false'
} catch {}

function audioContext() {
  if (typeof window === 'undefined') return null
  const Audio = window.AudioContext || window.webkitAudioContext
  if (!Audio) return null
  if (!ctx) ctx = new Audio()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq, duration, volume, type = 'sine', delay = 0) {
  const a = audioContext()
  if (!a) return
  const t = a.currentTime + delay
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + duration + 0.02)
}

export function unlockAudio() {
  audioContext()
}

export function clickSound() {
  tone(680, 0.06, 0.025)
  tone(940, 0.05, 0.012, 'sine', 0.03)
}

export function moveSound() {
  tone(310, 0.12, 0.065, 'triangle')
  tone(470, 0.09, 0.025, 'sine', 0.03)
}

const notes = [
  261.63, 311.13, 392, 466.16,
  392, 311.13, 293.66, 349.23,
  440, 523.25, 440, 349.23,
  261.63, 392, 311.13, 293.66
]

function playMusicNote() {
  if (!inGame || !musicOn || !ctx || ctx.state !== 'running') return
  const n = notes[index % notes.length]
  tone(n, 0.33, 0.012)
  if (index % 4 === 0) tone(n / 2, 0.45, 0.008, 'triangle')
  index++
}

function startMusic() {
  if (timer || !inGame || !musicOn) return
  playMusicNote()
  timer = setInterval(playMusicNote, 380)
}

function stopMusic() {
  if (timer) clearInterval(timer)
  timer = null
}

export function enterGameMusic() {
  inGame = true
  startMusic()
}

export function leaveGameMusic() {
  inGame = false
  stopMusic()
}

export function isMusicEnabled() {
  return musicOn
}

export function toggleGameMusic() {
  musicOn = !musicOn
  try {
    localStorage.setItem('xo_music_on', String(musicOn))
  } catch {}
  if (musicOn) {
    audioContext()
    startMusic()
  } else {
    stopMusic()
  }
  return musicOn
}
