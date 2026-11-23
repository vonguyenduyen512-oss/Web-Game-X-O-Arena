import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_API_URL || ''

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
})

export const connect = () => {
  if (!socket.connected && !socket.active) socket.connect()
  return socket
}

export const call = (event, payload, ms = 10000) => new Promise((resolve) => {
  connect()

  const t = setTimeout(() => {
    resolve({
      ok: false,
      error: 'Không kết nối được server. Vui lòng thử lại.',
    })
  }, ms)

  socket.emit(event, payload, (res) => {
    clearTimeout(t)
    resolve(res || { ok: false, error: 'Server không phản hồi' })
  })
})