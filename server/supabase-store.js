import { fileURLToPath } from 'node:url'

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'

const FILES = [
  'users.json',
  'main-account.json',
  'main-auth.json',
  'leaderboard.json',
  'online-matches.json',
  'friends.json',
  'features.json'
]

const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 15000
    })
  : null

const queues = new Map()
const expected = new Map()
// Replace a cache file only after the complete JSON has been written.
async function writeCache(destination, data) {
  const tmp = destination + '.' + randomUUID() + '.tmp'
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
        fs.renameSync(tmp, destination)
        return
      } catch (error) {
        if (attempt >= 4 || !['UNKNOWN', 'EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error
        await delay(150 * (attempt + 1))
      }
    }
  } finally {
    try { fs.unlinkSync(tmp) } catch (error) { if (error.code !== 'ENOENT') console.error('[database] Cache cleanup failed:', error.code) }
  }
}
let databaseReady = false

export async function initializeGameData() {
  if (!pool) {
    console.log('[database] Local JSON mode')
    return
  }

  const result = await pool.query(
    'SELECT data_key, data_value FROM public.game_data'
  )

  const records = new Map(
    result.rows.map(row => [row.data_key, row.data_value])
  )

  const required = FILES.filter(f => f !== 'features.json')
  const missing = required.filter(f => !records.has(f))

  if (missing.length) {
    throw new Error(
      'Supabase thieu du lieu: ' + missing.join(', ')
    )
  }

  for (const file of FILES) {
    if (!records.has(file)) continue

    const destination = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      file
    )

    // File local chi la ban sao tam thoi
    await writeCache(destination, records.get(file))
    expected.set(file, JSON.stringify(records.get(file)))
  }

  databaseReady = true
  console.log('[database] Loaded game data from Supabase')
}

export function persistGameData(file, data) {
  if (!pool) return

  if (!databaseReady) {
    throw new Error('Supabase chua san sang')
  }

  const name = path.basename(file.pathname)
  if (!FILES.includes(name)) return

  const snapshot = JSON.stringify(data)
  const previous = queues.get(name) || Promise.resolve()

  const next = previous.then(async () => {
    const old = expected.get(name)
    const result = old === undefined
      ? await pool.query(`INSERT INTO public.game_data (data_key, data_value, updated_at)
          VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (data_key) DO NOTHING`, [name, snapshot])
      : await pool.query(`UPDATE public.game_data SET data_value = $2::jsonb, updated_at = NOW()
          WHERE data_key = $1 AND data_value = $3::jsonb`, [name, snapshot, old])
    if (result.rowCount !== 1) throw new Error('Concurrent database change; refusing stale overwrite')
    expected.set(name, snapshot)
  })

  queues.set(name, next)

  next.catch(error => {
    console.error('[database] SAVE FAILED:', name, error.message)
    // Fail closed: do not continue serving from a stale snapshot.
    process.exit(1)
  })
}

export async function waitForGameSaves() {
  await Promise.all([...queues.values()])
}
