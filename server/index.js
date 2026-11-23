function validatePasswordComplexity(password, minLength = 8) {
  if (typeof password !== 'string' || password.length < minLength || password.length > 128) {
    return `Máº­t kháº©u pháº£i cÃ³ tá»« ${minLength} Ä‘áº¿n 128 kÃ½ tá»±.`
  }
  if (!/[A-Z]/.test(password)) return 'Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 1 chá»¯ hoa.'
  if (!/[a-z]/.test(password)) return 'Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 1 chá»¯ thÆ°á»ng.'
  if (!/[0-9]/.test(password)) return 'Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 1 chá»¯ sá»‘.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 1 kÃ½ tá»± Ä‘áº·c biá»‡t.'
  return null
}

 // Server realtime cho X-O Arena (Socket.IO). Cháº¡y: cd server && npm install && npm start
// DÃ¹ng láº¡i Ä‘Ãºng logic bÃ n cá» cá»§a client (client/src/lib/game.js).
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { SIZE, TURN_TIME, checkWin, createBoard } from '../client/src/lib/game.js'
import fs from 'node:fs'
import { persistGameData } from './supabase-store.js'
import { randomUUID, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { requestRegistrationOtp, verifyRegistrationOtp } from './register-otp.js'
import { requestPasswordReset, verifyPasswordReset } from './forgot-password-otp.js'

const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
const googleClient = new OAuth2Client(googleClientId)
// ===== TÃ i khoáº£n (lÆ°u vÃ o server/users.json) =====
const DB_FILE = new URL('./users.json', import.meta.url)
const SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex')
if (!process.env.JWT_SECRET) console.warn('[security] JWT_SECRET chÆ°a cáº¥u hÃ¬nh; token Ä‘Äƒng nháº­p sáº½ háº¿t hiá»‡u lá»±c khi khá»Ÿi Ä‘á»™ng láº¡i server.')
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new
 Error('Production yÃªu cáº§u JWT_SECRET tá»‘i thiá»ƒu 32 kÃ½ tá»±')
let users = []
try { users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } catch {}
const atomicSave = (file, data) => {
  const path = new URL(file)
  const tmp = new URL(path.href + '.tmp')
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, path)
  persistGameData(file, data)
}
const saveUsers = () => atomicSave(DB_FILE, users)
const safe = ({ hash, ...u }) => u
const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: '30d' })

// ===== TÃ i khoáº£n chÃ­nh Nguyá»…n DuyÃªn: lÆ°u dá»¯ liá»‡u lÃªn server (server/main-account.json) =====
const MAIN_FILE = new URL('./main-account.json', import.meta.url)
const ONLINE_FILE = new URL('./online-matches.json', import.meta.url)
let onlineMatches = []
try { const saved = JSON.parse(fs.readFileSync(ONLINE_FILE, 'utf8')); if (Array.isArray(saved)) onlineMatches = saved } catch {}
const saveOnline = () => atomicSave(ONLINE_FILE, onlineMatches.slice(-5000))
// Máº­t kháº©u tá»«ng tÃ i khoáº£n cá»‘ Ä‘á»‹nh (khÃ³a = tÃªn khÃ´ng dáº¥u, chá»¯ thÆ°á»ng). Pháº£i khá»›p MAIN_ACCOUNTS á»Ÿ client/src/store.jsx
const LEGACY_MAIN_PASSES = JSON.parse(
  process.env.LEGACY_MAIN_PASSES_JSON || '{}'
)
// mainData: { [khÃ³a]: { user, matches } }. Tá»± chuyá»ƒn tá»« Ä‘á»‹nh dáº¡ng cÅ© { user, matches } (chá»‰ cÃ³ Nguyá»…n DuyÃªn)
let mainData = {}
try {
  const raw = JSON.parse(fs.readFileSync(MAIN_FILE, 'utf8'))
  mainData = raw && raw.user ? { 'nguyen duyen': raw } : (raw || {})
} catch {}
const MAIN_AUTH_FILE = new URL('./main-auth.json', import.meta.url)
let mainAuth = {}
try { mainAuth = JSON.parse(fs.readFileSync(MAIN_AUTH_FILE, 'utf8')) } catch {}
// Upgrade existing fixed accounts to server-side bcrypt hashes without changing saved player data.
let migrated = false

for (const [key, password] of Object.entries(LEGACY_MAIN_PASSES)) {
  if (!mainAuth[key] && typeof password === 'string' && password.length >= 12) {
    mainAuth[key] = {
      hash: bcrypt.hashSync(password, 12),
      locked: false
    }
    migrated = true
  }
}

const saveMainAuth = () => atomicSave(MAIN_AUTH_FILE, mainAuth)
if (migrated) saveMainAuth()
const mainToken = (key) => jwt.sign({ role: 'player', key, version: mainAuth[key]?.version || 0 }, SECRET, { expiresIn: '7d' })
const mainKey = (req) => {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const payload = jwt.verify(token, SECRET)
    return payload.role === 'player' && mainAuth[payload.key] && !mainAuth[payload.key].locked && (payload.version || 0) === (mainAuth[payload.key].version || 0) ? payload.key : null
  } catch { return null }
}


// ===== Báº£ng xáº¿p háº¡ng tháº­t (server/leaderboard.json) â€” server tá»± tÃ­nh káº¿t quáº£ tá»«ng vÃ¡n =====
const LB_FILE = new URL('./leaderboard.json', import.meta.url)
const SCORE = { win: 200, draw: 0, lose: -200 } // Ä‘iá»ƒm xáº¿p háº¡ng má»—i vÃ¡n (khÃ´ng xuá»‘ng dÆ°á»›i 0)
// CÃ¡c cháº¿ Ä‘á»™ chÆ¡i: turn = sá»‘ giÃ¢y má»—i lÆ°á»£t, mult = há»‡ sá»‘ nhÃ¢n Ä‘iá»ƒm xáº¿p háº¡ng (tháº¯ng/hÃ²a/thua Ä‘á»u nhÃ¢n; hiá»‡n cáº£ hai Ä‘á»u x1)
const MODES = {
  'Caro 2 ngÆ°á»i': { turn: TURN_TIME, mult: 1 },
  'Caro nhanh': { turn: 10, mult: 1 },
}
const DEFAULT_MODE = 'Caro 2 ngÆ°á»i'
const modeOf = (m) => (MODES[m] ? m : DEFAULT_MODE)
let lb = {}
try { lb = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')) } catch {}
const saveLb = () => atomicSave(LB_FILE, lb)
const lbKey = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Ä‘/g, 'd').replace(/Ä/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ')
function recordResult(info, result, mult = 1) {
  if (!info || info.guest || !info.verified) return // khÃ¡ch khÃ´ng lÃªn báº£ng
  const k = lbKey(info.name)
  if (!k) return
  const e = lb[k] || (lb[k] = { name: info.name, avatar: info.avatar, level: info.level, wins: 0, draws: 0, losses: 0, score: 0 })
  e.name = info.name; e.avatar = info.avatar; e.level = info.level || e.level || 1
  if (result === 'win') e.wins++; else if (result === 'draw') e.draws++; else e.losses++
  e.score = (e.score || 0) + SCORE[result] * mult
  e.updatedAt = Date.now()
}
const topPlayers = () => Object.values(lb)
  .sort((a, b) => b.score - a.score || b.wins - a.wins || (a.updatedAt || 0) - (b.updatedAt || 0))
  .slice(0, 100)

// ===== Báº¡n bÃ¨ (server/friends.json): { key: { friends: [key], incoming: [{key, name}] } } =====
const FR_FILE = new URL('./friends.json', import.meta.url)
let fr = {}
try { fr = JSON.parse(fs.readFileSync(FR_FILE, 'utf8')) } catch {}
const saveFr = () => atomicSave(FR_FILE, fr)
const safeFriendKey = (k) => !!k && !['__proto__', 'prototype', 'constructor'].includes(k)
const frOf = (k) => Object.hasOwn(fr, k) ? fr[k] : (fr[k] = { friends: [], incoming: [] })
const card = (k) => lb[k] || { name: k, avatar: 'ðŸ§‘', level: 1, wins: 0, draws: 0, losses: 0, score: 0 }
function friendsApi(b) {
  const me = lbKey(b.me), to = lbKey(b.to)
  if (!safeFriendKey(me) || (to && !safeFriendKey(to))) return [400, { error: 'TÃªn ngÆ°á»i chÆ¡i khÃ´ng há»£p lá»‡.' }]
  const mine = frOf(me)
  if (b.action === 'add') {
    if (!to || to === me) return [400, { error: 'TÃªn khÃ´ng há»£p lá»‡.' }]
    if (!lb[to]) return [404, { error: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i chÆ¡i nÃ y (ngÆ°á»i Ä‘Ã³ pháº£i tá»«ng Ä‘áº¥u online).' }]
    if (mine.friends.includes(to)) return [409, { error: 'Hai báº¡n Ä‘Ã£ lÃ  báº¡n bÃ¨.' }]
    const other = frOf(to)
    if (mine.incoming.some((x) => x.key === to)) { // há» Ä‘Ã£ má»i mÃ¬nh trÆ°á»›c -> tá»± cháº¥p nháº­n
      mine.incoming = mine.incoming.filter((x) => x.key !== to)
      mine.friends.push(to); other.friends.push(me)
    } else if (!other.incoming.some((x) => x.key === me)) other.incoming.push({ key: me, name: String(b.myName || b.me).slice(0, 24) })
  } else if (b.action === 'accept') {
    if (!mine.incoming.some((x) => x.key === to)) return [404, { error: 'KhÃ´ng cÃ³ lá»i má»i nÃ y.' }]
    mine.incoming = mine.incoming.filter((x) => x.key !== to)
    if (!mine.friends.includes(to)) mine.friends.push(to)
    const other = frOf(to); if (!other.friends.includes(me)) other.friends.push(me)
  } else if (b.action === 'decline') {
    mine.incoming = mine.incoming.filter((x) => x.key !== to)
  } else if (b.action === 'remove') {
    mine.friends = mine.friends.filter((x) => x !== to)
    const other = frOf(to); other.friends = other.friends.filter((x) => x !== me)
  } else if (b.action !== 'list') return [400, { error: 'HÃ nh Ä‘á»™ng khÃ´ng há»£p lá»‡.' }]
  saveFr()
  return [200, { friends: mine.friends.map(card), incoming: mine.incoming.map((x) => ({ ...card(x.key), key: x.key, name: lb[x.key]?.name || x.name })) }]
}


// ===== Dá»‹ch vá»¥ bá»• sung cho cÃ¡c mÃ n hÃ¬nh chÆ°a cÃ³ API =====
// KhÃ´ng táº¡o dá»¯ liá»‡u máº«u, khÃ´ng thay Ä‘á»•i há»“ sÆ¡ hoáº·c sá»‘ dÆ° cá»§a ngÆ°á»i chÆ¡i.
const FEATURES_FILE = new URL('./features.json', import.meta.url)
let features = { messages: [], notices: {}, mailbox: {}, news: [], events: [] }
try {
  const stored = JSON.parse(fs.readFileSync(FEATURES_FILE, 'utf8'))
  if (stored && typeof stored === 'object') {
    for (const field of Object.keys(features)) {
      if (Array.isArray(features[field]) ? Array.isArray(stored[field]) : stored[field] && typeof stored[field] === 'object' && !Array.isArray(stored[field])) features[field] = stored[field]
    }
  }
} catch {}
const saveFeatures = () => atomicSave(FEATURES_FILE, features)
const ownArray = (obj, key) => Object.hasOwn(obj, key) && Array.isArray(obj[key]) ? obj[key] : []
const limitedText = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
const playerExists = (key) => !!mainAuth[key] && !!mainData[key]?.user && !mainAuth[key].locked
const friendsWith = (a, b) => ownArray(frOf(a), 'friends').includes(b) && ownArray(frOf(b), 'friends').includes(a)
const achievementsFor = (key) => {
  const history = (mainData[key]?.matches || []).filter(m => m.onlineVerified === true)
  const wins = history.filter(m => m.result === 'win').length
  return [
    { id: 'first-match', title: 'Tráº­n Ä‘áº§u tiÃªn', progress: Math.min(history.length, 1), target: 1, unlocked: history.length >= 1 },
    { id: 'five-matches', title: 'ChÆ¡i 5 tráº­n', progress: Math.min(history.length, 5), target: 5, unlocked: history.length >= 5 },
    { id: 'first-win', title: 'Chiáº¿n tháº¯ng Ä‘áº§u tiÃªn', progress: Math.min(wins, 1), target: 1, unlocked: wins >= 1 },
    { id: 'ten-wins', title: 'Tháº¯ng 10 tráº­n', progress: Math.min(wins, 10), target: 10, unlocked: wins >= 10 },
  ]
}
async function featureApi(req, res, url) {
  const key = mainKey(req)
  if (!key || !playerExists(key)) return send(res, 401, { error: 'Vui lÃ²ng Ä‘Äƒng nháº­p.' })
  const method = req.method
  if (url === '/api/achievements' && method === 'GET') return send(res, 200, { achievements: achievementsFor(key) })
  if (url === '/api/news' && method === 'GET') return send(res, 200, { news: features.news })
  if (url === '/api/events' && method === 'GET') return send(res, 200, { events: features.events })
  if (url === '/api/daily-tasks' && method === 'GET') {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
    const matches = (mainData[key]?.matches || []).filter(m => m.onlineVerified === true && typeof m.at === 'string' && !Number.isNaN(Date.parse(m.at)) && new Date(Date.parse(m.at) + 7 * 3600000).toISOString().slice(0, 10) === today)
    return send(res, 200, { date: today, tasks: [
      { id: 'play-1', title: 'ChÆ¡i 1 tráº­n online', progress: Math.min(matches.length, 1), target: 1, completed: matches.length >= 1 },
      { id: 'win-1', title: 'Tháº¯ng 1 tráº­n online', progress: Math.min(matches.filter(m => m.result === 'win').length, 1), target: 1, completed: matches.some(m => m.result === 'win') },
    ], note: 'Tiáº¿n Ä‘á»™ chá»‰ Ä‘á»ƒ hiá»ƒn thá»‹; pháº§n thÆ°á»Ÿng pháº£i nháº­n qua API /api/main/claim.' })
  }
  if (url === '/api/messages' && method === 'GET') {
    const peer = new URL(req.url, 'http://localhost').searchParams.get('with')
    if (peer) {
      const to = lbKey(peer)
      if (!playerExists(to) || !friendsWith(key, to)) return send(res, 403, { error: 'Chá»‰ xem tin nháº¯n vá»›i báº¡n bÃ¨.' })
      return send(res, 200, { messages: features.messages.filter(m => (m.from === key && m.to === to) || (m.from === to && m.to === key)).slice(-200) })
    }
    const peers = [...new Set(features.messages.filter(m => m.from === key || m.to === key).map(m => m.from === key ? m.to : m.from))]
    return send(res, 200, { conversations: peers.filter(k => friendsWith(key, k)).map(k => ({ key: k, name: mainData[k]?.user?.name || k })) })
  }
  if (url === '/api/messages' && method === 'POST') {
    const b = await readBody(req)
    const to = lbKey(b.to), content = limitedText(b.text, 1000)
    if (!playerExists(to) || !friendsWith(key, to)) return send(res, 403, { error: 'Chá»‰ gá»­i tin nháº¯n cho báº¡n bÃ¨.' })
    if (!content || typeof b.text !== 'string' || b.text.length > 1000) return send(res, 400, { error: 'Tin nháº¯n pháº£i tá»« 1 Ä‘áº¿n 1000 kÃ½ tá»±.' })
    const message = { id: randomUUID(), from: key, to, text: content, at: new Date().toISOString() }
    features.messages.push(message)
    if (features.messages.length > 10000) features.messages = features.messages.slice(-10000)
    saveFeatures()
    return send(res, 201, { message })
  }
  const kind = url === '/api/notifications' ? 'notices' : url === '/api/mailbox' ? 'mailbox' : null
  if (kind && method === 'GET') return send(res, 200, { items: ownArray(features[kind], key).slice(-200).reverse() })
  if (kind && method === 'POST') {
    const b = await readBody(req)
    if (b.action !== 'read' || typeof b.id !== 'string') return send(res, 400, { error: 'YÃªu cáº§u khÃ´ng há»£p lá»‡.' })
    const item = ownArray(features[kind], key).find(x => x.id === b.id)
    if (!item) return send(res, 404, { error: 'KhÃ´ng tÃ¬m tháº¥y má»¥c.' })
    item.read = true
    saveFeatures()
    return send(res, 200, { ok: true, item })
  }
  return send(res, 405, { error: 'PhÆ°Æ¡ng thá»©c hoáº·c Ä‘Æ°á»ng dáº«n khÃ´ng há»— trá»£.' })
}

// ===== VÃ¡ dá»¯ liá»‡u 1 láº§n (tá»± cháº¡y khi khá»Ÿi Ä‘á»™ng, cháº¡y láº¡i nhiá»u láº§n váº«n an toÃ n) =====
// 1) Äá»•i tÃ i khoáº£n AC -> Ã‚n (giá»¯ nguyÃªn level, xu, lá»‹ch sá»­, báº£ng xáº¿p háº¡ng, báº¡n bÃ¨)
// 2) Nguyá»…n DuyÃªn: Lv30, EXP 1450/3200, 70 tháº¯ng 30 thua, 1800 Ä‘iá»ƒm rank (rev 2)
function patchData() {
  let changed = false
  if (mainData['ac'] && !mainData['an']) {
    mainData['an'] = mainData['ac']; delete mainData['ac']
    Object.assign(mainData['an'].user, { name: 'Ã‚n', id: '#62002' })
    if (lb['ac']) { lb['an'] = { ...lb['ac'], name: 'Ã‚n' }; delete lb['ac'] }
    if (fr['ac']) { fr['an'] = fr['ac']; delete fr['ac'] }
    for (const f of Object.values(fr)) {
      f.friends = f.friends.map((x) => (x === 'ac' ? 'an' : x))
      f.incoming = f.incoming.map((x) => (x.key === 'ac' ? { ...x, key: 'an', name: 'Ã‚n' } : x))
    }
    changed = true
  }
  const d = mainData['nguyen duyen']
  if (d && (d.user.rev || 0) < 2) {
    const now = Date.now()
    Object.assign(d.user, { level: 30, exp: 1450, expMax: 3200, rev: 2, updatedAt: now })
    lb['nguyen duyen'] = { ...(lb['nguyen duyen'] || { name: d.user.name, avatar: d.user.avatar }), level: 30, wins: 70, draws: 0, losses: 30, score: 1800, updatedAt: now }
    changed = true
  }
  // 3) Äáº·t level + Ä‘iá»ƒm xáº¿p háº¡ng cho 6 tÃ i khoáº£n cá»‘ Ä‘á»‹nh (Nguyá»…n DuyÃªn giá»¯ nguyÃªn). Cháº¡y 1 láº§n (rev 4).
  //    Äiá»ƒm rank khá»›p cÃ´ng thá»©c: tháº¯ng +30, thua -10 (Ä‘iá»ƒm = 30*tháº¯ng - 10*thua), level cao thÃ¬ Ä‘iá»ƒm cao.
  //    Muá»‘n Ä‘á»•i sá»‘ liá»‡u: sá»­a báº£ng SIX rá»“i tÄƒng REV lÃªn 1 (vd 5) Ä‘á»ƒ server Ã¡p láº¡i khi khá»Ÿi Ä‘á»™ng.
  const REV = 4
  const now3 = Date.now()
  const expMaxOf = (lv) => 300 + (lv - 1) * 100
  // [khÃ³a, tÃªn, id, avatar máº·c Ä‘á»‹nh, level, tháº¯ng, thua]
  const SIX = [
    ['quynh', 'Quá»³nh', '#62001', 'a1', 9, 12, 2], // 340
    ['an',    'Ã‚n',    '#62002', 'a2', 8, 11, 3], // 300
    ['vy',    'Vy',    '#62003', 'a3', 7, 9, 2],  // 250
    ['huy',   'Huy',   '#62007', 'a6', 6, 8, 3],  // 210
    ['quan',  'QuÃ¢n',  '#62004', 'a4', 5, 6, 2],  // 160
    ['luat',  'Luáº­t',  '#62006', 'a5', 5, 6, 3],  // 150
  ]
  SIX.forEach(([k, name, id, av, level, wins, losses], i) => {
    const m = mainData[k]
    const expMax = expMaxOf(level)
    if (!m) {
      const avatar = m?.user?.avatar && m.user.avatar !== 'duo' ? m.user.avatar : av
      const user = { id, name, email: '', birthday: '', guest: false, main: true, avatar, level, exp: Math.round(expMax / 2), expMax, coins: 500, gems: 0, updatedAt: now3, rev: REV }
      mainData[k] = { user, matches: m?.matches || [] } // giá»¯ nguyÃªn lá»‹ch sá»­ tráº­n Ä‘Ã£ cÃ³
      changed = true
    }
    // Báº£ng xáº¿p háº¡ng kiá»ƒm tra riÃªng (dáº¥u rev) Ä‘á»ƒ dÃ¹ file nÃ o bá»‹ lá»‡ch cÅ©ng tá»± sá»­a Ä‘Ãºng 1 láº§n
    if ((lb[k]?.rev || 0) < REV) {
      lb[k] = { name, avatar: mainData[k].user.avatar, level, wins, draws: 0, losses, score: Math.max(0, wins * 30 - losses * 10), updatedAt: now3 + i, rev: REV }
      changed = true
    }
  })
  if (changed) {
    try { atomicSave(MAIN_FILE, mainData); saveLb(); saveFr() } catch {}
  }
}
// KhÃ´ng tá»± Ä‘á»™ng ghi Ä‘Ã¨ Ä‘iá»ƒm rank, cáº¥p Ä‘á»™ hoáº·c lá»‹ch sá»­ khi khá»Ÿi Ä‘á»™ng.
// patchData()

const send = (res, code, data) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  })
  res.end(JSON.stringify(data))
}
const readBody = (req) => new Promise((ok) => {
  let s = ''
  req.on('data', (c) => { s += c; if (s.length > 5e6) req.destroy() })
  req.on('end', () => { try { ok(JSON.parse(s || '{}')) } catch { ok({}) } })
})
const authUser = (req) => {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '')
    const payload = jwt.verify(t, SECRET)
    return payload.id && !payload.role ? users.find((u) => u.id === payload.id && !u.locked) || null : null
  } catch { return null }
}

async function api(req, res) {
  const url = req.url.split('?')[0]
  if (req.method === 'OPTIONS') return send(res, 200, {})
  if (['/api/achievements', '/api/news', '/api/events', '/api/daily-tasks', '/api/messages', '/api/notifications', '/api/mailbox'].includes(url)) return featureApi(req, res, url)

  if (req.method === 'POST' && url === '/api/friends') {
    const key = mainKey(req)
    if (!key) return send(res, 401, { error: 'Vui lÃ²ng Ä‘Äƒng nháº­p tÃ i khoáº£n chÃ­nh Ä‘á»ƒ quáº£n lÃ½ báº¡n bÃ¨.' })
    const body = await readBody(req)
    const [code, data] = friendsApi({ ...body, me: key, myName: mainData[key]?.user?.name || key })
    return send(res, code, data)
  }
  if (req.method === 'GET' && url === '/api/rooms') {
    const list = [...rooms.values()]
      .filter((r) => r.pub && !r.over && r.players.length > 0 && /^\d{4}$/.test(r.code))
      .map((r) => ({ code: r.code, name: r.name, mode: r.mode, players: r.players.length, playing: r.started, hasPw: !!r.password, createdAt: r.createdAt }))
      .sort((a, b) => Number(a.playing) - Number(b.playing) || b.createdAt - a.createdAt)
    return send(res, 200, { online: io.engine.clientsCount, rooms: list })
  }
  if (req.method === 'GET' && url === '/api/leaderboard') return send(res, 200, { players: topPlayers() })

  // Äiá»ƒm danh theo ngÃ y Viá»‡t Nam (UTC+7), chá»‰ server quyáº¿t Ä‘á»‹nh ngÃ y há»£p lá»‡.
  if (req.method === 'POST' && url === '/api/main/login') {
    const b = await readBody(req)
    const key = lbKey(b.key)
    const account = mainAuth[key]
    if (!account || account.locked || !bcrypt.compareSync(String(b.password || ''), account.hash))
      return send(res, 401, { error: 'Sai tÃ i khoáº£n, máº­t kháº©u hoáº·c tÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a.' })
    return send(res, 200, { token: mainToken(key), data: mainData[key] || null })
  }
  if (req.method === 'POST' && url === '/api/main/change-password') {
    const key = mainKey(req)
    if (!key) return send(res, 401, { error: 'ChÆ°a Ä‘Äƒng nháº­p.' })
    const b = await readBody(req)
    if (!bcrypt.compareSync(String(b.currentPassword || ''), mainAuth[key].hash)) return send(res, 401, { error: 'Máº­t kháº©u hiá»‡n táº¡i khÃ´ng Ä‘Ãºng.' })
    if (validatePasswordComplexity(b.newPassword, 12)) return send(res, 400, { error: validatePasswordComplexity(b.newPassword, 12) })
    mainAuth[key].hash = bcrypt.hashSync(b.newPassword, 12)
    mainAuth[key].version = (mainAuth[key].version || 0) + 1
    saveMainAuth()
    return send(res, 200, { ok: true, token: mainToken(key) })
  }
  if (req.method === 'POST' && url === '/api/main/checkin') {
    const b = await readBody(req)
    const k = mainKey(req)
    if (!k) return send(res, 401, { error: 'Sai thÃ´ng tin tÃ i khoáº£n.' })
    const entry = mainData[k]
    if (!entry?.user) return send(res, 404, { error: 'KhÃ´ng cÃ³ dá»¯ liá»‡u tÃ i khoáº£n.' })
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const days = [...new Set((entry.user.loginDays || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today))]
    if (days.includes(today)) return send(res, 200, { ok: true, already: true, data: entry })
    entry.user.loginDays = [...days, today]
    entry.user.updatedAt = Date.now()
    entry.user.rev = (entry.user.rev || 0) + 1
    atomicSave(MAIN_FILE, mainData)
    return send(res, 200, { ok: true, already: false, data: entry })
  }
  // Nháº­n thÆ°á»Ÿng trÃªn server: kiá»ƒm tra Ä‘iá»u kiá»‡n vÃ  ghi má»™t láº§n, khÃ´ng tin pháº§n thÆ°á»Ÿng client gá»­i.
  if (req.method === 'POST' && url === '/api/main/claim') {
    const b = await readBody(req)
    const k = mainKey(req)
    if (!k) return send(res, 401, { error: 'Sai thÃ´ng tin tÃ i khoáº£n.' })
    const entry = mainData[k]
    if (!entry?.user) return send(res, 404, { error: 'KhÃ´ng cÃ³ dá»¯ liá»‡u tÃ i khoáº£n.' })
    const id = String(b.id || '')
    const rewards = {
      'nov26:m1': { kind: 'coin', n: 500 },
      'nov26:m2': { kind: 'gem', n: 50 },
      'nov26:m3': { kind: 'coin', n: 200 },
      'nov26:mile:200': { kind: 'coin', n: 500 },
      'nov26:mile:500': { kind: 'gem', n: 100 },
      'nov26:mile:1000': { kind: 'coin', n: 200 },
      'nov26:mile:2000': { kind: 'gem', n: 5000 },
    }
    const weekMission = /^week26:mission:([0-4])$/.exec(id)
    const weekMile = /^week26:mile:(10|20|30|40|50)$/.exec(id)
    if (weekMission || weekMile) {
      const u = entry.user
      const nowVN = new Date(Date.now() + 7*3600000).toISOString().slice(0,10)
      if (nowVN < '2026-11-24' || nowVN > '2026-11-30') return send(res,409,{error:'Sá»± kiá»‡n tuáº§n chÆ°a diá»…n ra hoáº·c Ä‘Ã£ káº¿t thÃºc.',data:entry})
      const history = (entry.matches || []).filter(m => m.onlineVerified === true && typeof m.at === 'string' && !Number.isNaN(Date.parse(m.at)) && (() => { const d = new Date(Date.parse(m.at) + 7*3600000).toISOString().slice(0,10); return d >= '2026-11-24' && d <= '2026-11-30' })())
      const sorted = [...history].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
      let streak=0,best=0
      for(const m of sorted){streak=m.result==='win'?streak+1:0;best=Math.max(best,streak)}
      const days=new Set((u.loginDays||[]).filter(d=>d>='2026-11-24'&&d<='2026-11-30')).size
      const progress=[history.length,history.filter(m=>m.result==='win').length,history.filter(m=>m.friendMatch===true).length,days,best]
      const max=[30,15,5,5,3]
      const points=progress.reduce((a,n,i)=>a+Math.min(n,max[i]),0)
      const eligible=weekMission ? progress[Number(weekMission[1])] >= max[Number(weekMission[1])] : points>=Number(weekMile[1])
      if(!eligible)return send(res,409,{error:'ChÆ°a Ä‘á»§ Ä‘iá»u kiá»‡n nháº­n thÆ°á»Ÿng.',data:entry})
      if((u.eventClaims||[]).includes(id))return send(res,409,{error:'ÄÃ£ nháº­n pháº§n thÆ°á»Ÿng nÃ y.',data:entry})
      const missionRewards=[{kind:'coin',n:1000},{kind:'gem',n:100},{kind:'coin',n:200},{kind:'coin',n:500},{kind:'gem',n:50}]
      const mileRewards={10:{kind:'coin',n:500},20:{kind:'gem',n:50},30:{kind:'coin',n:200},40:{kind:'gem',n:5000},50:{kind:'coin',n:1000}}
      const reward=weekMission?missionRewards[Number(weekMission[1])]:mileRewards[Number(weekMile[1])]
      u.eventClaims=[...(u.eventClaims||[]),id]
      if(reward.kind==='coin')u.coins=(u.coins||0)+reward.n
      if(reward.kind==='gem')u.gems=(u.gems||0)+reward.n
      if(reward.kind==='frame')u.frames=[...new Set([...(u.frames||[]),reward.id])]
      u.rev=(u.rev||0)+1
      u.updatedAt=Date.now()
      atomicSave(MAIN_FILE, mainData)
      return send(res,200,{ok:true,data:entry})
    }
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
    const daily = /^nov26:daily:(\d{4}-\d{2}-\d{2}):(m[12])$/.exec(id)
    const dailyReward = daily?.[2] === 'm1' ? { kind: 'coin', n: 500 } : daily?.[2] === 'm2' ? { kind: 'gem', n: 50 } : null
    if (daily && (daily[1] !== today || !today.startsWith('2026-11-'))) return send(res, 409, { error: 'Nhiá»‡m vá»¥ nÃ y khÃ´ng thuá»™c ngÃ y hÃ´m nay.' })
    const reward = daily ? dailyReward : rewards[id]
    if (!reward) return send(res, 400, { error: 'Pháº§n thÆ°á»Ÿng khÃ´ng há»£p lá»‡.' })
    const history = Array.isArray(entry.matches) ? entry.matches.filter(m => m.onlineVerified === true) : []
    const wins = history.filter(m => m.result === 'win').length
    const points = history.length * 10 + wins * 20
    const days = new Set((entry.user.loginDays || []).filter(d => /^2026-11-\d{2}$/.test(d))).size
    const todayHistory = history.filter(m => typeof m.at === 'string' && !Number.isNaN(Date.parse(m.at)) && new Date(Date.parse(m.at) + 7 * 3600000).toISOString().slice(0, 10) === today)
    const eligible = daily ? (daily[2] === 'm1' ? todayHistory.length >= 10 : todayHistory.filter(m => m.result === 'win').length >= 5)
      : id === 'nov26:m1' ? history.length >= 10
      : id === 'nov26:m2' ? wins >= 5
      : id === 'nov26:m3' ? days >= 7
      : points >= Number(id.split(':').at(-1))
    if (!eligible) return send(res, 409, { error: 'ChÆ°a Ä‘áº¡t Ä‘iá»u kiá»‡n nháº­n thÆ°á»Ÿng.', data: entry })
    const u = entry.user
    if ((u.eventClaims || []).includes(id)) return send(res, 409, { error: 'Pháº§n thÆ°á»Ÿng Ä‘Ã£ nháº­n.', data: entry })
    u.eventClaims = [...(u.eventClaims || []), id]
    if (reward.kind === 'coin') u.coins = (u.coins || 0) + reward.n
    if (reward.kind === 'gem') u.gems = (u.gems || 0) + reward.n
    if (reward.kind === 'frame') u.frames = [...new Set([...(u.frames || []), reward.id])]
    u.updatedAt = Date.now()
    atomicSave(MAIN_FILE, mainData)
    return send(res, 200, { ok: true, data: entry })
  }
  if (req.method === 'POST' && url === '/api/main/load') {
    const b = await readBody(req)
    const k = mainKey(req)
    if (!k) return send(res, 401, { error: 'Sai máº­t kháº©u.' })
    return send(res, 200, { data: mainData[k] || null })
  }
  if (req.method === 'POST' && url === '/api/main/save') {
    const k = mainKey(req)
    if (!k) return send(res, 401, { error: 'ChÆ°a Ä‘Äƒng nháº­p.' })

    const b = await readBody(req)
    const entry = mainData[k]
    if (!entry?.user) {
      return send(res, 404, { error: 'TÃ i khoáº£n chÆ°a cÃ³ dá»¯ liá»‡u trÃªn server.' })
    }

    const incoming = b.user
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return send(res, 400, { error: 'Dá»¯ liá»‡u khÃ´ng há»£p lá»‡.' })
    }

    const old = entry.user

    if ((incoming.rev || 0) < (old.rev || 0)) {
      return send(res, 200, { ok: false, stale: true, data: entry })
    }

    const changes = {}

    if (typeof incoming.birthday === 'string') {
      changes.birthday = incoming.birthday.slice(0, 20)
    }

    if (
      typeof incoming.activeFrame === 'string' &&
      (incoming.activeFrame === 'none' ||
        (Array.isArray(old.frames) && old.frames.includes(incoming.activeFrame)))
    ) {
      changes.activeFrame = incoming.activeFrame
    }

    if (Object.keys(changes).some(field => changes[field] !== old[field])) {
      entry.user = {
        ...old,
        ...changes,
        rev: (old.rev || 0) + 1,
        updatedAt: Date.now()
      }
      atomicSave(MAIN_FILE, mainData)
    }

    return send(res, 200, { ok: true, data: entry })
  }

  if (req.method === 'POST' && url === '/api/profile/avatar') {
    const b = await readBody(req)
    const avatar = String(b.avatar || '').trim()
    if (!avatar || avatar.length > 500_000) return send(res, 400, { error: 'áº¢nh Ä‘áº¡i diá»‡n khÃ´ng há»£p lá»‡.' })
    const key = mainKey(req)
    const account = key ? mainData[key]?.user : authUser(req)
    if (!account) return send(res, 401, { error: 'Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.' })
    if (avatar === account.avatar) return send(res, 200, { ok: true, user: key ? account : safe(account), unchanged: true })
    if ((Number(account.gems) || 0) < 500) return send(res, 409, { error: 'Cáº§n 500 kim cÆ°Æ¡ng Ä‘á»ƒ Ä‘á»•i áº£nh Ä‘áº¡i diá»‡n.' })
    account.avatar = avatar
    account.gems = Number(account.gems) - 500
    account.updatedAt = Date.now()
    if (key) {
      account.rev = (account.rev || 0) + 1
      atomicSave(MAIN_FILE, mainData)
    } else saveUsers()
    return send(res, 200, { ok: true, user: key ? account : safe(account) })
  }

  if (req.method === 'POST' && url === '/api/profile/rename') {
    const b = await readBody(req)
    const name = String(b.name || '').trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 20) return send(res, 400, { error: 'TÃªn pháº£i cÃ³ tá»« 2 Ä‘áº¿n 20 kÃ½ tá»±.' })
    const key = mainKey(req)
    const account = key ? mainData[key]?.user : authUser(req)
    if (!account) return send(res, 401, { error: 'Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.' })
    if (name.toLocaleLowerCase('vi') === String(account.name || '').toLocaleLowerCase('vi')) return send(res, 400, { error: 'TÃªn má»›i pháº£i khÃ¡c tÃªn hiá»‡n táº¡i.' })
    const taken = [...Object.values(mainData).map(x => x?.user), ...users].some(u => u && u !== account && String(u.name || '').toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))
    if (taken) return send(res, 409, { error: 'TÃªn nÃ y Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.' })
    if ((Number(account.gems) || 0) < 500) return send(res, 409, { error: 'Cáº§n 500 kim cÆ°Æ¡ng Ä‘á»ƒ Ä‘á»•i tÃªn.' })
    const oldName = account.name
    account.name = name
    account.gems = (Number(account.gems) || 0) - 500
    account.updatedAt = Date.now()
    if (key) {
      account.rev = (account.rev || 0) + 1
      atomicSave(MAIN_FILE, mainData)
    } else saveUsers()
    const oldLbKey = lbKey(oldName), newLbKey = lbKey(name)
    if (lb[oldLbKey]) {
      lb[newLbKey] = { ...lb[oldLbKey], name }
      if (oldLbKey !== newLbKey) delete lb[oldLbKey]
      saveLb()
    }
    return send(res, 200, { ok: true, user: key ? account : safe(account) })
  }


  // API Ä‘Äƒng kÃ½ cÅ© khÃ´ng cÃ²n Ä‘Æ°á»£c phÃ©p táº¡o tÃ i khoáº£n trá»±c tiáº¿p.
  // QuÃªn máº­t kháº©u cho tÃ i khoáº£n cÃ³ Gmail trong users.json.
  if (req.method === 'POST' && url === '/api/forgot-password/request-otp') {
    const { email } = await readBody(req)
    const em = String(email || '').trim().toLowerCase()

    if (!/^\S+@\S+\.\S+$/.test(em))
      return send(res, 400, { error: 'Email khÃ´ng há»£p lá»‡.' })

const account = users.find(
  u => u.email === em
)

    const result = await requestPasswordReset(em, Boolean(account))

    if (result.error)
      return send(res, result.status || 400, { error: result.error })

    return send(res, 200, {
      ok: true,
      message: 'Náº¿u Gmail Ä‘Ã£ Ä‘Äƒng kÃ½, mÃ£ OTP sáº½ Ä‘Æ°á»£c gá»­i Ä‘áº¿n há»™p thÆ°.'
    })
  }

  if (req.method === 'POST' && url === '/api/forgot-password/reset') {
    const { email, otp, newPassword } = await readBody(req)
    const em = String(email || '').trim().toLowerCase()

    if (validatePasswordComplexity(newPassword)) {
      return send(res, 400, {
        error: validatePasswordComplexity(newPassword)
      })
    }

    const account = users.find(
     u => u.email === em
    )

    if (!account)
      return send(res, 400, {
        error: 'MÃ£ OTP khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.'
      })

    const result = verifyPasswordReset(em, otp)

    if (result.error)
      return send(res, result.status || 400, { error: result.error })

    account.hash = bcrypt.hashSync(newPassword, 12)
    saveUsers()

    return send(res, 200, {
      ok: true,
      message: 'Äá»•i máº­t kháº©u thÃ nh cÃ´ng. HÃ£y Ä‘Äƒng nháº­p láº¡i.'
    })
  }

  if (req.method === 'POST' && url === '/api/register') {
    return send(res, 410, { error: 'Vui lÃ²ng xÃ¡c minh Gmail báº±ng OTP Ä‘á»ƒ Ä‘Äƒng kÃ½.' })
  }

  // BÆ°á»›c 1: Kiá»ƒm tra thÃ´ng tin vÃ  gá»­i OTP.
  if (req.method === 'POST' && url === '/api/register/request-otp') {
    const { email, password, name, birthday } = await readBody(req)
    const em = String(email || '').trim().toLowerCase()
    const requestedName = String(name || '').trim().slice(0, 24)

    if (!/^\S+@\S+\.\S+$/.test(em))
      return send(res, 400, { error: 'Email khÃ´ng há»£p lá»‡.' })

    if (validatePasswordComplexity(password))
      return send(res, 400, { error: validatePasswordComplexity(password) })

    if (!requestedName)
      return send(res, 400, { error: 'Vui lÃ²ng nháº­p há» vÃ  tÃªn.' })

    if (users.some(u => u.email === em))
      return send(res, 409, { error: 'Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½.' })

    if (users.some(u => lbKey(u.name) === lbKey(requestedName)) ||
        mainAuth[lbKey(requestedName)]) {
      return send(res, 409, { error: 'TÃªn ngÆ°á»i chÆ¡i Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.' })
    }

    const result = await requestRegistrationOtp(em, {
      name: requestedName,
      email: em,
      birthday: birthday || '',
      hash: bcrypt.hashSync(password, 10)
    })

    if (result.error)
      return send(res, result.status || 400, { error: result.error })

    return send(res, 200, {
      ok: true,
      message: 'ÄÃ£ gá»­i mÃ£ OTP Ä‘áº¿n Gmail. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt.'
    })
  }

  // BÆ°á»›c 2: XÃ¡c minh OTP rá»“i má»›i táº¡o tÃ i khoáº£n.
  if (req.method === 'POST' && url === '/api/register/verify-otp') {
    const { email, otp } = await readBody(req)
    const em = String(email || '').trim().toLowerCase()

    const result = verifyRegistrationOtp(em, otp)

    if (result.error)
      return send(res, result.status || 400, { error: result.error })

    const data = result.registration

    // Kiá»ƒm tra láº¡i Ä‘á»ƒ trÃ¡nh táº¡o tÃ i khoáº£n trÃ¹ng.
    if (users.some(u => u.email === em))
      return send(res, 409, { error: 'Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½.' })

    if (users.some(u => lbKey(u.name) === lbKey(data.name)) ||
        mainAuth[lbKey(data.name)]) {
      return send(res, 409, { error: 'TÃªn ngÆ°á»i chÆ¡i Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.' })
    }

    const u = {
      id: randomUUID(),
      email: em,
      name: data.name,
      birthday: data.birthday,
      avatar: 'ðŸ§‘',
      level: 1,
      exp: 0,
      coins: 500,
      gems: 0,
      score: 0,
      hash: data.hash,
      createdAt: Date.now()
    }

    users.push(u)
    saveUsers()

    return send(res, 200, {
      token: sign(u),
      user: safe(u),
      matches: []
    })
  }

  // ÄÄƒng nháº­p báº±ng tÃ i khoáº£n Google
  if (req.method === 'POST' && url === '/api/auth/google') {
    if (!googleClientId || googleClientId.startsWith('REPLACE_WITH_')) {
      return send(res, 503, { error: 'Google Login chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh.' })
    }

    const { credential } = await readBody(req)
    if (typeof credential !== 'string' || !credential) {
      return send(res, 400, { error: 'Thiáº¿u thÃ´ng tin xÃ¡c thá»±c Google.' })
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId
      })

      const profile = ticket.getPayload()
      if (!profile?.sub || !profile.email_verified || !profile.email) {
        return send(res, 401, { error: 'TÃ i khoáº£n Google khÃ´ng há»£p lá»‡.' })
      }

      let u = users.find(x => x.googleSub === profile.sub)

      if (!u) {
        const email = profile.email.toLowerCase()
        if (users.some(x => x.email === email)) {
          return send(res, 409, {
            error: 'Email Ä‘Ã£ cÃ³ tÃ i khoáº£n. HÃ£y Ä‘Äƒng nháº­p báº±ng máº­t kháº©u trÆ°á»›c.'
          })
        }

        const baseName = String(profile.name || 'NgÆ°á»i chÆ¡i').trim().slice(0, 24)
        let name = baseName
        let n = 2

        const nameTaken = value =>
          users.some(x => lbKey(x.name) === lbKey(value)) ||
          !!mainAuth[lbKey(value)] ||
          Object.values(mainData).some(x =>
            x?.user?.name?.toLowerCase() === value.toLowerCase()
          )

        while (nameTaken(name)) {
          const suffix = ` ${n++}`
          name = baseName.slice(0, 24 - suffix.length) + suffix
        }

        u = {
          id: randomUUID(),
          googleSub: profile.sub,
          email,
          name,
          birthday: '',
          avatar: 'ðŸ§‘',
          level: 1,
          exp: 0,
          coins: 500,
          gems: 0,
          score: 0,
          createdAt: Date.now()
        }

        users.push(u)
        saveUsers()
      }

      if (u.locked) {
        return send(res, 403, { error: 'TÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a.' })
      }

      return send(res, 200, {
        token: sign(u),
        user: safe(u),
        matches: u.matches || []
      })
    } catch (err) {
      console.error('[Google Login]', err.message)
      return send(res, 401, { error: 'XÃ¡c thá»±c Google tháº¥t báº¡i.' })
    }
  }

  // ÄÄƒng nháº­p báº±ng email vÃ  máº­t kháº©u
  if (req.method === 'POST' && url === '/api/login') {
    const { id, password } = await readBody(req)
    const key = String(id || '').trim().toLowerCase()
    const u = users.find((x) => x.email === key || x.name.toLowerCase() === key)

    if (!u || u.locked || typeof u.hash !== 'string' ||
        !bcrypt.compareSync(String(password || ''), u.hash)) {
      return send(res, 401, { error: 'Sai tÃªn Ä‘Äƒng nháº­p hoáº·c máº­t kháº©u.' })
    }

    return send(res, 200, {
  token: sign(u),
  user: safe(u),
  matches: u.matches || []
})
  }

  if (url === '/api/me') {
    const u = authUser(req)
    if (!u) return send(res, 401, { error: 'ChÆ°a Ä‘Äƒng nháº­p.' })
    if (req.method === 'GET') return send(res, 200, { user: safe(u) })
    if (req.method === 'PATCH') {
      const b = await readBody(req)
      // Äá»•i tÃªn chá»‰ thá»±c hiá»‡n qua /api/profile/rename (500 kim cÆ°Æ¡ng).
      // Äá»•i avatar pháº£i qua /api/profile/avatar Ä‘á»ƒ trá»« 500 kim cÆ°Æ¡ng.
      saveUsers()
      return send(res, 200, { user: safe(u) })
    }
  }
  send(res, 404, { error: 'KhÃ´ng tÃ¬m tháº¥y' })
}

const PORT = process.env.PORT || 3001
const httpServer = createServer((req, res) => {
  if (req.url.startsWith('/api/')) return api(req, res)
  res.writeHead(200)
  res.end('X-O Arena server OK')
})
const io = new Server(httpServer, { cors: { origin: true } })

/** @type {Map<string, any>} */
const rooms = new Map()

// Chá»‰ tÃ i khoáº£n cá»‘ Ä‘á»‹nh Ä‘Ã£ xÃ¡c thá»±c má»›i Ä‘Æ°á»£c ghi lá»‹ch sá»­ vÃ o tÃ i khoáº£n.
const verifiedKey = (u) => {
  try {
    const payload = jwt.verify(String(u?.token || ''), SECRET)
    return payload.role === 'player' && mainAuth[payload.key] &&
      !mainAuth[payload.key].locked &&
      (payload.version || 0) === (mainAuth[payload.key].version || 0)
      ? payload.key : null
  } catch {
    return null
  }
}

const verifiedInfo = (u) => {
  const key = verifiedKey(u)
  if (key) {
    const account = mainData[key]?.user || {
      name: key, level: 1, avatar: 'ðŸ§‘'
    }
    return { info: pub(account), key, userId: null }
  }

  try {
    const payload = jwt.verify(String(u?.token || ''), SECRET)
    const account = users.find(x => x.id === payload.id && !x.locked)
    if (account) {
      return { info: pub(account), key: null, userId: account.id }
    }
  } catch {}

  return {
    info: pub({
      name: u?.name || 'KhÃ¡ch',
      level: u?.level,
      avatar: u?.avatar,
      guest: true
    }),
    key: null,
    userId: null
  }
}

const saveVerifiedMatch = (r, over) => {
  const id = r.matchId
  if (!id || onlineMatches.some(m => m.id === id)) return

  const at = new Date().toISOString()
  const match = {
    id,
    room: r.code,
    mode: r.mode,
    at,
    reason: over.reason,
    winner: over.winner,
    moves: r.moves.map(m => ({ ...m })),
    players: r.players.map(p => ({
      name: p.info.name,
      sym: p.sym
    }))
  }

  onlineMatches.push(match)
  saveOnline()

  let mainChanged = false
  let usersChanged = false

  for (const p of r.players) {
    const result = !over.winner
      ? 'draw'
      : over.winner === p.sym ? 'win' : 'lose'

    const delta = result === 'win' ? 200 : result === 'lose' ? -200 : 100
    const gemDelta = result === 'win' ? 100 : result === 'lose' ? -100 : 50
    const opponent = r.players.find(q => q.id !== p.id)?.info || {
      name: 'Äá»‘i thá»§'
    }

    if (p.accountKey) {
      const entry = mainData[p.accountKey]
      if (!entry?.user) continue

      const isFriendMatch = Boolean(
        r.players.some(q =>
          q.id !== p.id &&
          q.accountKey &&
          frOf(lbKey(entry.user.name)).friends.includes(lbKey(opponent.name))
        )
      )

      const item = {
        id,
        room: r.code,
        opponent,
        result,
        moves: match.moves,
        reason: over.reason,
        at,
        onlineVerified: true,
        friendMatch: isFriendMatch
      }

      entry.matches = [
        item,
        ...(entry.matches || []).filter(m => m.id !== id)
      ].slice(0, 500)

      entry.user.coins = Math.max(
        0, (Number(entry.user.coins) || 0) + delta
      )
      entry.user.gems = Math.max(
        0, (Number(entry.user.gems) || 0) + gemDelta
      )
      entry.user.updatedAt = Date.now()
      entry.user.rev = (entry.user.rev || 0) + 1
      mainChanged = true

      io.to(p.id).emit('game:balance', {
        matchId: id,
        coins: entry.user.coins,
        gems: entry.user.gems,
        rev: entry.user.rev,
        updatedAt: entry.user.updatedAt
      })
    } else if (p.userId) {
      const account = users.find(u => u.id === p.userId)
      if (!account) continue
const item = {
  id,
  room: r.code,
  opponent,
  result,
  moves: match.moves,
  reason: over.reason,
  at,
  onlineVerified: true,
  friendMatch: false
}

account.matches = [
  item,
  ...(account.matches || []).filter(m => m.id !== id)
].slice(0, 500)
      account.coins = Math.max(
        0, (Number(account.coins) || 0) + delta
      )
      account.gems = Math.max(
        0, (Number(account.gems) || 0) + gemDelta
      )
      usersChanged = true

      io.to(p.id).emit('game:balance', {
        matchId: id,
        coins: account.coins,
        gems: account.gems
      })
    }
  }

  if (mainChanged) atomicSave(MAIN_FILE, mainData)
  if (usersChanged) saveUsers()
}

let quickWaiting = null

const pub = (u) => ({
  name: String(u?.name || 'NgÆ°á»i chÆ¡i').slice(0, 24),
  level: Number(u?.level) || 1,
  avatar: u?.avatar || 'ðŸ§‘',
  guest: !!u?.guest
})

const playersOf = (r) =>
  r.players.map((p) => ({ ...p.info, sym: p.sym }))

const symOf = (r, sock) =>
  r.players.find((p) => p.id === sock.id)?.sym

function newRoom(code, mode = DEFAULT_MODE) {
  const r = {
    matchId: randomUUID(),
    code,
    mode: modeOf(mode),
    name: '',
    pub: true,
    password: '',
    createdAt: Date.now(),
    players: [],
    board: createBoard(),
    moves: [],
    turn: 'X',
    started: false,
    over: null,
    timer: null,
    deadline: 0,
    drawFrom: null
  }

  rooms.set(code, r)
  return r
}

function startTurnTimer(r) {
  clearTimeout(r.timer)
  const sec = MODES[r.mode].turn
  r.deadline = Date.now() + sec * 1000

  r.timer = setTimeout(
    () => finish(r, {
      winner: r.turn === 'X' ? 'O' : 'X',
      reason: 'timeout'
    }),
    sec * 1000 + 800
  )
}

function finish(r, over) {
  if (r.over) return

  clearTimeout(r.timer)
  r.over = over

  if (r.players.length === 2 && over.reason !== 'admin-close') {
    for (const p of r.players) {
      recordResult(
        p.info,
        over.winner
          ? (over.winner === p.sym ? 'win' : 'lose')
          : 'draw',
        MODES[r.mode].mult
      )
    }
    saveLb()
    saveVerifiedMatch(r, over)
  }

  io.to(r.code).emit('game:over', {
    ...over,
    matchId: r.matchId
  })

  r.cleanup = setTimeout(() => {
    if (rooms.get(r.code) === r) rooms.delete(r.code)
  }, 60_000)
}

function startGame(r) {
  r.started = true
  startTurnTimer(r)
  io.to(r.code).emit('game:start', { code: r.code })
}

function snapshotFor(r, sock) {
  return {
    code: r.code,
    matchId: r.matchId,
    mode: r.mode,
    turnTime: MODES[r.mode].turn,
    mult: MODES[r.mode].mult,
    you: symOf(r, sock),
    players: playersOf(r),
    moves: r.moves,
    turn: r.turn,
    timeLeft: Math.max(
      0, Math.ceil((r.deadline - Date.now()) / 1000)
    ),
    over: r.over
  }
}

io.on('connection', (sock) => {
  sock.data.room = null

  const joinRoom = (r, user) => {
    const v = verifiedInfo(user)
    if (!v.key && !v.userId) return false

    if ((v.key && r.players.some(p => p.accountKey === v.key)) ||
        (v.userId && r.players.some(p => p.userId === v.userId))) {
      return false
    }

    if (v.key || v.userId) v.info.verified = true

    r.players.push({
      id: sock.id,
      sym: r.players.length === 0 ? 'X' : 'O',
      info: v.info,
      accountKey: v.key,
      userId: v.userId
    })

    sock.join(r.code)
    sock.data.room = r.code

    io.to(r.code).emit('room:updated', {
      code: r.code,
      players: playersOf(r)
    })

    if (r.players.length === 2) startGame(r)
    return true
  }

  sock.on('room:create', ({
    code, user, mode, password, name, pub
  } = {}, cb) => {
      const identity = verifiedInfo(user)
      if (!identity.key && !identity.userId) {
        return cb?.({
          ok: false,
          error: 'PhiÃªn Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.'
        })
      }
    if (sock.data.room) {
      return cb?.({
        ok: false,
        error: 'HÃ£y rá»i phÃ²ng hiá»‡n táº¡i trÆ°á»›c.'
      })
    }

    let c = String(code || '').toUpperCase().slice(0, 8)

    if (!c) {
      do {
        c = String(1000 + Math.floor(Math.random() * 9000))
      } while (rooms.has(c))
    }

    if (!/^[A-Z0-9]{4,8}$/.test(c)) {
      return cb?.({ ok: false, error: 'MÃ£ phÃ²ng khÃ´ng há»£p lá»‡' })
    }

    const old = rooms.get(c)
    if (old && !old.over) {
      return cb?.({
        ok: false,
        error: 'MÃ£ phÃ²ng Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng'
      })
    }

    if (old) {
      clearTimeout(old.timer)
      rooms.delete(c)
    }

    const nr = newRoom(c, mode)
    nr.password = String(password || '').slice(0, 20)
    nr.name = String(name || 'PhÃ²ng ' + c).trim().slice(0, 30)
    nr.pub = pub !== false

    console.log(
      '[room] tao phong', c,
      '- che do:', nr.mode,
      '- mat khau:', nr.password ? 'CO' : 'khong',
      '-', nr.pub ? 'cong khai' : 'rieng tu'
    )

    joinRoom(nr, user)
    cb?.({ ok: true, code: c })
  })

  sock.on('room:join', ({
    code, user, password
  } = {}, cb) => {
      const identity = verifiedInfo(user)
      if (!identity.key && !identity.userId) {
        return cb?.({
          ok: false,
          error: 'PhiÃªn Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.'
        })
      }
    if (sock.data.room) {
      return cb?.({
        ok: false,
        error: 'HÃ£y rá»i phÃ²ng hiá»‡n táº¡i trÆ°á»›c.'
      })
    }

    const r = rooms.get(String(code || '').toUpperCase())

    if (!r || r.over) {
      return cb?.({ ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y phÃ²ng' })
    }

    if (r.players.length >= 2) {
      return cb?.({ ok: false, error: 'PhÃ²ng Ä‘Ã£ Ä‘áº§y' })
    }

    if (r.password && String(password || '') !== r.password) {
      return cb?.({
        ok: false,
        needPassword: true,
        error: password
          ? 'Sai máº­t kháº©u phÃ²ng'
          : 'PhÃ²ng nÃ y cÃ³ máº­t kháº©u, hÃ£y nháº­p máº­t kháº©u'
      })
    }

    if (!joinRoom(r, user)) {
      return cb?.({
        ok: false,
        error: 'KhÃ´ng thá»ƒ vÃ o phÃ²ng. HÃ£y kiá»ƒm tra Ä‘Äƒng nháº­p hoáº·c tÃ i khoáº£n Ä‘Ã£ cÃ³ trong phÃ²ng.'
      })
    }

    cb?.({ ok: true, code: r.code })
  })

  sock.on('quick:join', ({ user } = {}, cb) => {
      const identity = verifiedInfo(user)
      if (!identity.key && !identity.userId) {
        return cb?.({
          ok: false,
          error: 'PhiÃªn Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.'
        })
      }
    if (sock.data.room) {
      return cb?.({
        ok: false,
        error: 'Báº¡n Ä‘ang á»Ÿ trong má»™t phÃ²ng.'
      })
    }

    if (
      quickWaiting &&
      quickWaiting.id !== sock.id &&
      quickWaiting.connected
    ) {
      const other = quickWaiting
      const firstIdentity = verifiedInfo(other.data.user)
      const nextIdentity = verifiedInfo(user)

      if ((firstIdentity.key && firstIdentity.key === nextIdentity.key) ||
          (firstIdentity.userId && firstIdentity.userId === nextIdentity.userId)) {
        return cb?.({
          ok: false,
          error: 'KhÃ´ng thá»ƒ tá»± ghÃ©p tráº­n báº±ng cÃ¹ng má»™t tÃ i khoáº£n.'
        })
      }

      quickWaiting = null
      let code

      do {
        code = 'Q' + randomUUID()
          .replace(/-/g, '')
          .slice(0, 7)
          .toUpperCase()
      } while (rooms.has(code))

      const r = newRoom(code, 'Caro nhanh')
      const first = firstIdentity

      if (first.key || first.userId) first.info.verified = true

      r.players.push({
        id: other.id,
        sym: 'X',
        info: first.info,
        accountKey: first.key,
        userId: first.userId
      })

      other.join(r.code)
      other.data.room = r.code

      if (!joinRoom(r, user)) {
        other.leave(r.code)
        other.data.room = null
        rooms.delete(r.code)
        quickWaiting = other

        return cb?.({
          ok: false,
          error: 'KhÃ´ng thá»ƒ ghÃ©p tráº­n.'
        })
      }
    } else {
      quickWaiting = sock
      sock.data.user = user
    }

    cb?.({ ok: true })
  })

  sock.on('game:sync', ({ code } = {}, cb) => {
    const r = rooms.get(String(code || '').toUpperCase())

    if (
      !r ||
      sock.data.room !== r.code ||
      !symOf(r, sock)
    ) {
      return cb?.({ ok: false })
    }

    cb?.({
      ok: true,
      state: snapshotFor(r, sock)
    })
  })

  sock.on('game:move', ({ x, y } = {}) => {
    const r = rooms.get(sock.data.room)

    if (!r) {
      return console.log(
        '[move] TU CHOI: khong co phong.',
        sock.data.room
      )
    }

    if (!r.started || r.over) {
      return console.log(
        '[move] TU CHOI: phong',
        r.code,
        'started =', r.started,
        'over =', !!r.over
      )
    }

    const sym = symOf(r, sock)

    if (
      sym !== r.turn ||
      !Number.isInteger(x) ||
      !Number.isInteger(y)
    ) {
      return console.log(
        '[move] TU CHOI: sai luot.',
        sym,
        r.turn
      )
    }

    if (
      x < 0 || y < 0 ||
      x >= SIZE || y >= SIZE ||
      r.board[y][x]
    ) {
      return console.log(
        '[move] TU CHOI: o khong hop le',
        x, y
      )
    }

    r.board[y][x] = sym
    r.moves.push({ x, y, s: sym })

    console.log(
      '[move] OK',
      sym, x, y,
      '- nuoc thu', r.moves.length,
      '- phong', r.code
    )

    r.drawFrom = null
    io.to(r.code).emit('game:moved', { x, y, s: sym })

    const line = checkWin(r.board, x, y, sym)

    if (line) {
      return finish(r, {
        winner: sym,
        reason: 'five',
        line
      })
    }

    if (r.moves.length === SIZE * SIZE) {
      return finish(r, {
        winner: null,
        reason: 'full'
      })
    }

    r.turn = sym === 'X' ? 'O' : 'X'
    startTurnTimer(r)
  })

  sock.on('game:resign', () => {
    const r = rooms.get(sock.data.room)
    const sym = r && symOf(r, sock)

    if (r && sym && r.started && !r.over) {
      finish(r, {
        winner: sym === 'X' ? 'O' : 'X',
        reason: 'resign'
      })
    }
  })

  sock.on('draw:offer', () => {
    const r = rooms.get(sock.data.room)

    if (
      !r ||
      !r.started ||
      r.over ||
      !symOf(r, sock) ||
      r.moves.length < 6 ||
      r.drawFrom
    ) return

    r.drawFrom = sock.id
    sock.to(r.code).emit('draw:offered')
  })

  sock.on('draw:answer', ({ accept } = {}) => {
    const r = rooms.get(sock.data.room)

    if (
      !r ||
      !r.started ||
      r.over ||
      !symOf(r, sock) ||
      !r.drawFrom ||
      r.drawFrom === sock.id
    ) return

    if (accept) {
      finish(r, {
        winner: null,
        reason: 'agreed'
      })
    } else {
      sock.to(r.code).emit('draw:declined')
    }

    r.drawFrom = null
  })

  sock.on('chat:send', ({ text } = {}) => {
    const r = rooms.get(sock.data.room)
    const p = r?.players.find(q => q.id === sock.id)
    const t = String(text || '').trim().slice(0, 200)

    if (p && t && !r.over) {
      sock.to(r.code).emit('chat:message', {
        from: p.info.name,
        text: t
      })
    }
  })

  // ChÆ¡i láº¡i: cáº£ 2 ngÆ°á»i cÃ¹ng Ä‘á»“ng Ã½
  sock.on('rematch:request', (a, b) => {
    const cb = typeof a === 'function' ? a : b
    const r = rooms.get(sock.data.room)

    if (!r || !r.over || !symOf(r, sock)) {
      return cb?.({ ok: false })
    }

    if (r.players.length < 2) {
      return cb?.({
        ok: false,
        error: 'Äá»‘i thá»§ Ä‘Ã£ rá»i phÃ²ng'
      })
    }

    r.rematch = r.rematch || new Set()
    r.rematch.add(sock.id)

    if (r.rematch.size < 2) {
      sock.to(r.code).emit('rematch:asked')
      return cb?.({
        ok: true,
        waiting: true
      })
    }

    clearTimeout(r.cleanup)
    r.rematch.clear()

    r.matchId = randomUUID()
    r.board = createBoard()
    r.moves = []
    r.turn = 'X'
    r.over = null
    r.started = false
    r.drawFrom = null

    r.players.forEach(p => {
      p.sym = p.sym === 'X' ? 'O' : 'X'
    })

    io.to(r.code).emit('room:updated', {
      code: r.code,
      players: playersOf(r)
    })

    startGame(r)
    cb?.({
      ok: true,
      started: true
    })
  })

  const leave = () => {
    if (quickWaiting?.id === sock.id) {
      quickWaiting = null
    }

    const r = rooms.get(sock.data.room)

    if (!r || !symOf(r, sock)) {
      sock.data.room = null
      return
    }

    sock.leave(r.code)
    sock.data.room = null

    if (r.over) {
      r.players = r.players.filter(p => p.id !== sock.id)
      r.rematch?.delete(sock.id)
      sock.to(r.code).emit('rematch:left')

      if (!r.players.length) {
        clearTimeout(r.cleanup)
        rooms.delete(r.code)
      }
      return
    }

    const sym = symOf(r, sock)

    if (r.started && !r.over) {
      finish(r, {
        winner: sym === 'X' ? 'O' : 'X',
        reason: 'resign'
      })
    } else if (!r.started) {
      clearTimeout(r.timer)
      rooms.delete(r.code)
    }
  }

  sock.on('room:leave', leave)
  sock.on('disconnect', leave)
})

httpServer.listen(PORT, () => {
  console.log(`X-O Arena server cháº¡y á»Ÿ cá»•ng ${PORT}`)
})


