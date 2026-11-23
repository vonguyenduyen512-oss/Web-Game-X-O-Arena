
// Khoi dong Backend X-O Arena
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const dir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(dir, '.env')

// Chi tao va doc .env khi chay tren may
if (process.env.NODE_ENV !== 'production') {
  if (!fs.existsSync(envPath)) {
    const secret = randomBytes(48).toString('hex')
    const content = `PORT=3001\nJWT_SECRET=${secret}\nGOOGLE_CLIENT_ID=\n`

    try {
      fs.writeFileSync(envPath, content, {
        flag: 'wx',
        mode: 0o600
      })
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }
  }

  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath)
  }
}

await import('./index.js')
