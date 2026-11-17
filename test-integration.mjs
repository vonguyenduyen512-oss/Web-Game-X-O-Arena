
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import bcrypt from './server/node_modules/bcryptjs/index.js'
import { io } from './client/node_modules/socket.io-client/build/esm/index.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xo-test-'))

fs.mkdirSync(path.join(tmp, 'server'), { recursive: true })
fs.mkdirSync(path.join(tmp, 'client/src/lib'), { recursive: true })

for (const name of [
  'index.js',
  'users.json',
  'main-account.json',
  'leaderboard.json',
  'friends.json'
]) {
  fs.copyFileSync(
    path.join(root, 'server', name),
    path.join(tmp, 'server', name)
  )
}

fs.copyFileSync(
  path.join(root, 'client/src/lib/game.js'),
  path.join(tmp, 'client/src/lib/game.js')
)

fs.writeFileSync(
  path.join(tmp, 'package.json'),
  '{"type":"module"}'
)

// Sua loi EPERM tren Windows bang junction
fs.symlinkSync(
  path.join(root, 'server', 'node_modules'),
  path.join(tmp, 'server', 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir'
)

const main = JSON.parse(
  fs.readFileSync(
    path.join(tmp, 'server/main-account.json'),
    'utf8'
  )
)

main['thanh duyen'] = {
  user: {
    id: '#TEST01',
    name: 'Thanh Duyên',
    main: true,
    level: 1,
    exp: 0,
    expMax: 300,
    coins: 0,
    gems: 0,
    rev: 1,
    updatedAt: Date.now()
  },
  matches: []
}

main['duyen duyen'] = {
  user: {
    id: '#TEST02',
    name: 'Duyên Duyên',
    main: true,
    level: 1,
    exp: 0,
    expMax: 300,
    coins: 0,
    gems: 0,
    rev: 1,
    updatedAt: Date.now()
  },
  matches: []
}

fs.writeFileSync(
  path.join(tmp, 'server/main-account.json'),
  JSON.stringify(main)
)

const pw1 = 'test-password-1'
const pw2 = 'test-password-2'
const adminPassword = 'admin-test-password'

const auth = {
  'thanh duyen': {
    hash: bcrypt.hashSync(pw1, 8),
    locked: false
  },
  'nguyen duyen': {
    hash: bcrypt.hashSync(pw2, 8),
    locked: false
  }
}

for (const [k, p] of Object.entries({
  quynh: '123',
  an: '123',
  vy: '123',
  quan: '123',
  luat: '123',
  huy: '123'
})) {
  auth[k] = {
    hash: bcrypt.hashSync(p, 4),
    locked: false
  }
}

fs.writeFileSync(
  path.join(tmp, 'server/main-auth.json'),
  JSON.stringify(auth)
)

const port = 32000 + Math.floor(Math.random() * 2000)
const url = `http://127.0.0.1:${port}`

const child = spawn(
  process.execPath,
  ['index.js'],
  {
    cwd: path.join(tmp, 'server'),
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: 'integration-test-secret-32-characters-minimum',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: bcrypt.hashSync(adminPassword, 8)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  }
)

let logs = ''

child.stderr.on('data', b => logs += b.toString())
child.stdout.on('data', b => logs += b.toString())

const post = async (route, body = {}, token = '') => {
  const r = await fetch(url + route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify(body)
  })

  return {
    status: r.status,
    data: await r.json()
  }
}

const get = async (route, token = '') => {
  const r = await fetch(url + route, {
    headers: token
      ? { Authorization: 'Bearer ' + token }
      : {}
  })

  return {
    status: r.status,
    data: await r.json()
  }
}

const emit = (s, event, p) =>
  new Promise((resolve, reject) => {
    s.timeout(4000).emit(event, p, (err, v) =>
      err ? reject(err) : resolve(v)
    )
  })

const sleep = ms =>
  new Promise(r => setTimeout(r, ms))

let a, b

try {
  let ready = false

  for (let i = 0; i < 70; i++) {
    if (child.exitCode !== null) {
      throw Error('Server exited: ' + logs)
    }

    try {
      await fetch(url)
      ready = true
      break
    } catch {
      await sleep(100)
    }
  }

  assert.ok(ready, 'Server failed to start: ' + logs)

  // Dang nhap hai tai khoan
  const l1 = await post('/api/main/login', {
    key: 'thanh duyen',
    password: pw1
  })

  const l2 = await post('/api/main/login', {
    key: 'nguyen duyen',
    password: pw2
  })

  assert.equal(l1.status, 200)
  assert.equal(l2.status, 200)

  const t1 = l1.data.token
  const t2 = l2.data.token

  // Kiem tra mat khau sai
  assert.equal(
    (await post('/api/main/login', {
      key: 'thanh duyen',
      password: 'wrong'
    })).status,
    401
  )

  // Kiem tra du lieu rieng
  assert.equal(
    (await post('/api/main/load', {}, t1)).data.data.user.name,
    'Thanh Duyên'
  )

  assert.equal(
    (await post('/api/main/load', {}, t2)).data.data.user.name,
    'Nguyễn Duyên'
  )

  assert.equal(
    (await post('/api/main/load', {})).status,
    401
  )


  // Kiem tra diem danh khong trung
  const c1 = await post('/api/main/checkin', {}, t1)
  const c2 = await post('/api/main/checkin', {}, t1)

  
  
  // Kiem tra diem danh khong trung va du lieu doc lap
  const otherDaysBefore = (
    await post('/api/main/load', {}, t2)
  ).data.data.user.loginDays || []

  assert.equal(c1.status, 200)
  assert.equal(c1.data.already, false)
  assert.equal(c2.status, 200)
  assert.equal(c2.data.already, true)

  const otherDaysAfter = (
    await post('/api/main/load', {}, t2)
  ).data.data.user.loginDays || []

  assert.deepEqual(otherDaysAfter, otherDaysBefore)


  // Khong duoc nhan thuong khi chua du dieu kien
  assert.equal(
    (await post(
      '/api/main/claim',
      { id: 'nov26:mile:2000' },
      t1
    )).status,
    409
  )

  // Chong gia mao xu, kim cuong va ket qua tran
  const old =
    (await post('/api/main/load', {}, t1)).data.data

  const malicious = {
    ...old.user,
    coins: 999999999,
    gems: 999999999,
    frames: ['november'],
    loginDays: ['2026-11-01'],
    updatedAt: Date.now() + 5000
  }

  await post('/api/main/save', {
    user: malicious,
    matches: [
      {
        id: 'fake',
        onlineVerified: true,
        result: 'win'
      }
    ]
  }, t1)

  const afterTamper =
    (await post('/api/main/load', {}, t1)).data.data

  assert.notEqual(
    afterTamper.user.coins,
    999999999
  )

  assert.equal(
    afterTamper.matches.some(m => m.id === 'fake'),
    false
  )

  // Ket noi Socket.IO hai nguoi choi
  a = io(url, {
    transports: ['websocket'],
    forceNew: true
  })

  b = io(url, {
    transports: ['websocket'],
    forceNew: true
  })

  await Promise.all([
    new Promise(r => a.once('connect', r)),
    new Promise(r => b.once('connect', r))
  ])

  // Tao phong
  assert.equal(
    (await emit(a, 'room:create', {
      code: '8642',
      user: { token: t1 },
      mode: 'Caro 2 người'
    })).ok,
    true
  )

  // Tham gia phong
  assert.equal(
    (await emit(b, 'room:join', {
      code: '8642',
      user: { token: t2 }
    })).ok,
    true
  )

  await sleep(100)

  a.emit('game:move', { x: 0, y: 0 })

  await sleep(100)

  b.emit('game:resign')

  await sleep(250)

  // Kiem tra lich su hai tai khoan
  const h1 =
    (await post('/api/main/load', {}, t1))
      .data.data.matches

  const h2 =
    (await post('/api/main/load', {}, t2))
      .data.data.matches

  const m1 = h1.find(
    m => m.onlineVerified && m.room === '8642'
  )

  const m2 = h2.find(
    m => m.onlineVerified && m.room === '8642'
  )

  assert.ok(
    m1 && m2,
    'Both accounts must have match history'
  )

  assert.equal(m1.id, m2.id)
  assert.equal(m1.result, 'win')
  assert.equal(m2.result, 'lose')

  // Doi mat khau
  const change = await post('/api/main/change-password', {
    currentPassword: pw1,
    newPassword: 'a-new-strong-test-password-123'
  }, t1)

  assert.equal(change.status, 200)

  assert.equal(
    (await post('/api/main/load', {}, t1)).status,
    401
  )

  assert.equal(
    (await post('/api/main/load', {}, change.data.token)).status,
    200
  )

  assert.equal(
    (await post('/api/main/login', {
      key: 'thanh duyen',
      password: pw1
    })).status,
    401
  )


  console.log(
    'PASS integration checks: login, isolation, ' +
    'check-in duplicate, reward denial, ' +
    'tamper protection, two-account online history, ' +
    'password change'
  )

} finally {
  a?.disconnect()
  b?.disconnect()
  child.kill('SIGTERM')

  fs.rmSync(tmp, {
    recursive: true,
    force: true
  })
}
