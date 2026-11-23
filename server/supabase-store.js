import { fileURLToPath } from 'node:url'

import fs from 'node:fs'
import path from 'node:path'
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
    fs.writeFileSync(
      destination,
      JSON.stringify(records.get(file), null, 2)
    )
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

  const next = previous
    .catch(() => {})
    .then(() => pool.query(
      `INSERT INTO public.game_data
         (data_key, data_value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (data_key)
       DO UPDATE SET
         data_value = EXCLUDED.data_value,
         updated_at = NOW()`,
      [name, snapshot]
    ))

  queues.set(name, next)

  next.catch(error => {
    console.error('[database] SAVE FAILED:', name, error.message)
  })
}

export async function waitForGameSaves() {
  await Promise.all([...queues.values()])
}
