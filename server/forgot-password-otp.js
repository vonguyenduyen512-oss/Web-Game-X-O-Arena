import nodemailer from 'nodemailer'
import { randomInt, createHash, timingSafeEqual } from 'node:crypto'

const pending = new Map()
const limits = new Map()

const TTL = 5 * 60 * 1000
const COOLDOWN = 60 * 1000
const WINDOW = 60 * 60 * 1000
const MAX_SENDS = 5
const MAX_ATTEMPTS = 5

function digest(email, code) {
  return createHash('sha256')
    .update(email + ':' + code + ':' + process.env.JWT_SECRET)
    .digest()
}

export async function requestPasswordReset(email, exists) {
  const now = Date.now()
  const current = limits.get(email)

  if (current && now < current.nextSend) {
    return {
      error: 'Vui lòng chờ 60 giây trước khi gửi lại.',
      status: 429
    }
  }

  if (current && now < current.windowEnd && current.count >= MAX_SENDS) {
    return {
      error: 'Đã yêu cầu quá nhiều mã. Vui lòng thử lại sau.',
      status: 429
    }
  }

  const next = current && now < current.windowEnd
    ? { ...current }
    : { count: 0, windowEnd: now + WINDOW, nextSend: 0 }

  next.count++
  next.nextSend = now + COOLDOWN
  limits.set(email, next)
  pending.delete(email)

  // Không tiết lộ email có tồn tại hay không.
  if (!exists) {
    console.warn('[Password reset] Không tìm thấy tài khoản trong users.json')
    return { ok: true }
  }

  const code = String(randomInt(0, 1000000)).padStart(6, '0')

  try {
   const response = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
    accept: 'application/json'
  },
  body: JSON.stringify({
    sender: {
      name: 'X-O Arena',
      email: process.env.BREVO_SENDER_EMAIL
    },
    to: [{ email }],
    subject: 'X-O Arena - Đặt lại mật khẩu',
    textContent:
      'Mã đặt lại mật khẩu X-O Arena: ' + code +
      '\nMã có hiệu lực 5 phút. Không chia sẻ mã này.'
  })
})

if (response.ok) {
  console.log('[Password reset email] Brevo accepted request')
}

if (!response.ok) {
  const detail = await response.text()
  console.error(
    '[Password reset email] Brevo status=' +
    response.status + ' ' + detail
  )
  return {
    error: 'Không gửi được OTP. Vui lòng thử lại sau.',
    status: 502
  }
}
  } catch (error) {
    console.error('[Password reset email] ' + error.message)
    return {
      error: 'Không gửi được OTP. Vui lòng thử lại sau.',
      status: 502
    }
  }
  pending.set(email, {
    hash: digest(email, code),
    expires: Date.now() + TTL,
    attempts: 0
  })

  return { ok: true }
}

export function verifyPasswordReset(email, code) {
  const item = pending.get(email)

  if (!item || Date.now() > item.expires) {
    pending.delete(email)
    return {
      error: 'Mã OTP không tồn tại hoặc đã hết hạn.',
      status: 400
    }
  }

  item.attempts++

  if (item.attempts > MAX_ATTEMPTS) {
    pending.delete(email)
    return {
      error: 'Đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.',
      status: 429
    }
  }

  const valid = /^\d{6}$/.test(String(code || '')) &&
    timingSafeEqual(item.hash, digest(email, String(code)))

  if (!valid) {
    if (item.attempts >= MAX_ATTEMPTS) pending.delete(email)
    return {
      error: 'Mã OTP không đúng.',
      status: 400
    }
  }

  pending.delete(email)
  return { ok: true }
}

