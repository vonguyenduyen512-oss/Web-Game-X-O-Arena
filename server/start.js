// Khoi dong Backend va tu tao file .env neu chua co.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const dir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(dir, '.env')

if (!fs.existsSync(envPath)) {
  const secret = randomBytes(48).toString('hex')
  const content = `PORT=3001\nJWT_SECRET=${secret}\nGOOGLE_CLIENT_ID=\n`
  try {
    fs.writeFileSync(envPath, content, { flag: 'wx', mode: 0o600 })
    console.log('[setup] Da tao server/.env voi JWT_SECRET ngau nhien. Google Login can dien GOOGLE_CLIENT_ID vao file nay.')
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

process.loadEnvFile(envPath)
await import('./index.js')
