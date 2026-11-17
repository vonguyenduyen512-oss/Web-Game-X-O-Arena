import nodemailer from 'nodemailer'
import { randomInt, createHash, timingSafeEqual } from 'node:crypto'

const pending = new Map()
const limits = new Map()

const TTL = 5 * 60 * 1000
const COOLDOWN = 60 * 1000
const MAX_ATTEMPTS = 5
const WINDOW = 60 * 60 * 1000
const MAX_SENDS = 5

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

const digest = (email, otp) =>
  createHash('sha256')
    .update(`${email}:${otp}:${process.env.JWT_SECRET}`)
    .digest()

function cleanup() {
  const now = Date.now()

  for (const [email, item] of pending) {
    if (now > item.expires) pending.delete(email)
  }

  for (const [email, item] of limits) {
    if (now > item.windowEnd && now >= item.nextSend) {
      limits.delete(email)
    }
  }
}

export async function requestRegistrationOtp(email, registration) {
  cleanup()

  const now = Date.now()
  const limit = limits.get(email)

  if (limit && now < limit.nextSend) {
    return {
      error: 'Vui lòng chờ 60 giây trước khi gửi lại mã.',
      status: 429
    }
  }

  if (limit && now < limit.windowEnd && limit.count >= MAX_SENDS) {
    return {
      error: 'Đã gửi quá nhiều mã OTP. Vui lòng thử lại sau.',
      status: 429
    }
  }

  const otp = String(randomInt(0, 1000000)).padStart(6, '0')

  // Khóa tạm trước khi gửi để tránh yêu cầu đồng thời.
  const next = limit && now < limit.windowEnd
    ? { ...limit }
    : { count: 0, windowEnd: now + WINDOW, nextSend: 0 }

  next.count++
  next.nextSend = now + COOLDOWN
  limits.set(email, next)

  try {
    await mailer.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'X-O Arena - Mã xác minh đăng ký',
      text: `Mã xác minh X-O Arena của bạn là: ${otp}\nMã có hiệu lực trong 5 phút. Không chia sẻ mã này với người khác.`
    })
  } catch {
    return {
      error: 'Không gửi được email xác minh. Vui lòng thử lại sau.',
      status: 502
    }
  }

  pending.set(email, {
    registration,
    hash: digest(email, otp),
    expires: Date.now() + TTL,
    attempts: 0
  })

  return { ok: true }
}

export function verifyRegistrationOtp(email, otp) {
  cleanup()

  const item = pending.get(email)

  if (!item || Date.now() > item.expires) {
    pending.delete(email)
    return {
      error: 'Mã OTP không tồn tại hoặc đã hết hạn.',
      status: 400
    }
  }

  if (item.attempts >= MAX_ATTEMPTS) {
    pending.delete(email)
    return {
      error: 'Đã nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.',
      status: 429
    }
  }

  // Mọi lần xác minh không đúng đều được tính.
  item.attempts++

  if (!/^\d{6}$/.test(String(otp || ''))) {
    if (item.attempts >= MAX_ATTEMPTS) pending.delete(email)
    return {
      error: 'Mã OTP phải gồm 6 chữ số.',
      status: 400
    }
  }

  if (!timingSafeEqual(item.hash, digest(email, String(otp)))) {
    if (item.attempts >= MAX_ATTEMPTS) pending.delete(email)
    return {
      error: 'Mã OTP không chính xác.',
      status: 400
    }
  }

  pending.delete(email)
  return { ok: true, registration: item.registration }
}
