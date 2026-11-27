import { createContext, useContext, useEffect, useRef, useState } from 'react'

// Store tạm bằng localStorage. Khi có backend: thay login/register/addMatch bằng gọi API.

// XO_PERSIST_LOGIN_2026
// Chuyen token cu tu sessionStorage sang localStorage.
try {
  const previousToken = sessionStorage.getItem('xo_player_token')
  if (previousToken) {
    localStorage.setItem('xo_player_token', previousToken)
    sessionStorage.removeItem('xo_player_token')
  }
} catch {}

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const load = (k, d) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d } catch { return d }
}
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

export const DEFAULT_SETTINGS = {
  sfx: 70, music: 60, fx: 100, mode: 'classic',
  res: '1920 x 1080', quality: 'Cao', fullscreen: false, blur: true,
  publicInfo: true, notify: true,
}

// ===== Tài khoản chính (được lưu cố định) =====
// Chỉ tài khoản này giữ dữ liệu (level, xu, lịch sử trận). Các tài khoản khác chỉ là tạm.
const normName = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ')
// Danh sách tài khoản cố định: khóa (tên không dấu) -> thông tin. Thêm tài khoản mới chỉ cần thêm 1 dòng ở đây
// (và 1 dòng tương ứng trong MAIN_ACCOUNTS ở server/index.js).
export const MAIN_ACCOUNTS = {
  'nguyen duyen': { name: 'Nguyễn Duyên', id: '#62005', avatar: '👧' },
  'quynh': { name: 'Quỳnh', id: '#62001', avatar: 'a1' },
  'an':    { name: 'Ân',    id: '#62002', avatar: 'a2' },
  'vy':    { name: 'Vy',    id: '#62003', avatar: 'a3' },
  'quan':  { name: 'Quân',  id: '#62004', avatar: 'a4' },
  'luat':  { name: 'Luật',  id: '#62006', avatar: 'a5' },
  'huy':   { name: 'Huy',   id: '#62007', avatar: 'a6' },
}
const mainKeyOf = (u) => (u && !u.guest && u.main ? normName(u.name || '') : null)

// EXP cần để lên cấp: Lv1 = 300, mỗi cấp tăng thêm 100 (Lv2 = 400, Lv5 = 700, Lv10 = 1200...)
const expForLevel = (level) => 300 + (level - 1) * 100

// Áp lại mốc EXP hiện tại cho tài khoản đã lưu từ trước, giữ nguyên level
const fixExp = (u) => {
  let { level, exp } = u
  let expMax = expForLevel(level)
  while (exp >= expMax) { exp -= expMax; level++; expMax = expForLevel(level) }
  return { ...u, level, exp, expMax, id: u.main && MAIN_ACCOUNTS[normName(u.name || '')] ? MAIN_ACCOUNTS[normName(u.name)].id : u.id }
}

// EXP offline: dùng cùng quy tắc thưởng đã thiết lập cho AI.
const giveExp = (u, result) => fixExp({ ...u,
  level: Math.max(1, Number(u.level) || 1),
  exp: Math.max(0, Number(u.exp) || 0) + ({ win: 100, draw: 50, lose: 20 }[result] || 0)
})
const offlineKey = (u) => u && !u.guest && u.id ? 'xo_offline_matches_' + u.id : null
const mergeHistory = (matches, offline) => {
  const seen = new Set()
  return [...matches, ...offline].filter(m => {
    if (!m || seen.has(m.id)) return false
    seen.add(m.id)
    return true
  }).sort((a,b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
}

// Đồng bộ tài khoản chính với server (qua proxy /api của Vite)
const postMain = (path, key, body = {}) =>
  fetch('/api/main' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('xo_player_token') || '') },
    body: JSON.stringify(body),
  }).then((r) => r.json())
// Mỗi tài khoản cố định lưu riêng 1 ô localStorage (Nguyễn Duyên giữ ô cũ 'xo_main' để không mất dữ liệu)
const mainStoreKey = (key) => (key === 'nguyen duyen' ? 'xo_main' : 'xo_main_' + key)

const newUser = ({ name, email = '', birthday = '', guest = false, main = false }) => {
  const acc = main ? MAIN_ACCOUNTS[normName(name)] : null
  // Tài khoản cố định khởi tạo giống Nguyễn Duyên: level 6, ~1 triệu xu & gem
  const lv = acc ? 6 : 1
  return {
    id: acc ? acc.id : '#' + (10000 + Math.floor(Math.random() * 89999)),
    name: acc ? acc.name : name, email, birthday, guest, main: !!acc,
    avatar: acc ? acc.avatar : 'duo', level: lv, exp: acc ? 540 : 0, expMax: expForLevel(lv),
    coins: acc ? 1015099 : 500, gems: acc ? 1000559 : 0, score: 0,
  }
}

// Guest rewards are local-only; never submitted as verified server rewards.
const guestClaim = (user, matches, rewardId) => {
  const entry = { user: { ...user }, matches }
  const res = null
  const send = (_, code, data) => ({ ...data, ok: code === 200 && !!data.ok })
    const id = String(rewardId || '')
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
      if (nowVN < '2026-11-24' || nowVN > '2026-11-30') return send(res,409,{error:'Sự kiện tuần chưa diễn ra hoặc đã kết thúc.',data:entry})
      const history = (entry.matches || []).filter(m => (m.onlineVerified === true || m.room === 'AI' || m.room === 'LOCAL') && typeof m.at === 'string' && !Number.isNaN(Date.parse(m.at)) && (() => { const d = new Date(Date.parse(m.at) + 7*3600000).toISOString().slice(0,10); return d >= '2026-11-24' && d <= '2026-11-30' })())
      const sorted = [...history].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
      let streak=0,best=0
      for(const m of sorted){streak=m.result==='win'?streak+1:0;best=Math.max(best,streak)}
      const days=new Set((u.loginDays||[]).filter(d=>d>='2026-11-24'&&d<='2026-11-30')).size
      const progress=[history.length,history.filter(m=>m.result==='win').length,history.filter(m=>m.friendMatch===true).length,days,best]
      const max=[30,15,5,5,3]
      const points=progress.reduce((a,n,i)=>a+Math.min(n,max[i]),0)
      const eligible=weekMission ? progress[Number(weekMission[1])] >= max[Number(weekMission[1])] : points>=Number(weekMile[1])
      if(!eligible)return send(res,409,{error:'Chưa đủ điều kiện nhận thưởng.',data:entry})
      if((u.eventClaims||[]).includes(id))return send(res,409,{error:'Đã nhận phần thưởng này.',data:entry})
      const missionRewards=[{kind:'coin',n:1000},{kind:'gem',n:100},{kind:'coin',n:200},{kind:'coin',n:500},{kind:'gem',n:50}]
      const mileRewards={10:{kind:'coin',n:500},20:{kind:'gem',n:50},30:{kind:'coin',n:200},40:{kind:'gem',n:5000},50:{kind:'coin',n:1000}}
      const reward=weekMission?missionRewards[Number(weekMission[1])]:mileRewards[Number(weekMile[1])]
      u.eventClaims=[...(u.eventClaims||[]),id]
      if(reward.kind==='coin')u.coins=(u.coins||0)+reward.n
      if(reward.kind==='gem')u.gems=(u.gems||0)+reward.n
      if(reward.kind==='frame')u.frames=[...new Set([...(u.frames||[]),reward.id])]
      u.rev=(u.rev||0)+1
      u.updatedAt=Date.now()

      return send(res,200,{ok:true,data:entry})
    }
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
    const daily = /^nov26:daily:(\d{4}-\d{2}-\d{2}):(m[12])$/.exec(id)
    const dailyReward = daily?.[2] === 'm1' ? { kind: 'coin', n: 500 } : daily?.[2] === 'm2' ? { kind: 'gem', n: 50 } : null
    if (daily && (daily[1] !== today || !today.startsWith('2026-11-'))) return send(res, 409, { error: 'Nhiệm vụ này không thuộc ngày hôm nay.' })
    const reward = daily ? dailyReward : Object.hasOwn(rewards, id) ? rewards[id] : null
    if (!reward) return send(res, 400, { error: 'Phần thưởng không hợp lệ.' })
    const history = Array.isArray(entry.matches) ? entry.matches.filter(m => (m.onlineVerified === true || m.room === 'AI' || m.room === 'LOCAL')) : []
    const wins = history.filter(m => m.result === 'win').length
    const points = history.length * 10 + wins * 20
    const days = new Set((entry.user.loginDays || []).filter(d => /^2026-11-\d{2}$/.test(d))).size
    const todayHistory = history.filter(m => typeof m.at === 'string' && !Number.isNaN(Date.parse(m.at)) && new Date(Date.parse(m.at) + 7 * 3600000).toISOString().slice(0, 10) === today)
    const eligible = daily ? (daily[2] === 'm1' ? todayHistory.length >= 10 : todayHistory.filter(m => m.result === 'win').length >= 5)
      : id === 'nov26:m1' ? history.length >= 10
      : id === 'nov26:m2' ? wins >= 5
      : id === 'nov26:m3' ? days >= 7
      : points >= Number(id.split(':').at(-1))
    if (!eligible) return send(res, 409, { error: 'Chưa đạt điều kiện nhận thưởng.', data: entry })
    const u = entry.user
    if ((u.eventClaims || []).includes(id)) return send(res, 409, { error: 'Phần thưởng đã nhận.', data: entry })
    u.eventClaims = [...(u.eventClaims || []), id]
    if (reward.kind === 'coin') u.coins = (u.coins || 0) + reward.n
    if (reward.kind === 'gem') u.gems = (u.gems || 0) + reward.n
    if (reward.kind === 'frame') u.frames = [...new Set([...(u.frames || []), reward.id])]
    u.rev = (u.rev || 0) + 1
    u.updatedAt = Date.now()

    return send(res, 200, { ok: true, data: entry })
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = load('xo_user', null)
    if (!u) return u
    // Tài khoản Nguyễn Duyên đã có sẵn từ trước -> đánh dấu là tài khoản chính, giữ nguyên dữ liệu
    const isMain = !!mainKeyOf(u)
    // Chỉ Nguyễn Duyên được dùng ảnh '👧'; tài khoản khác dùng ảnh mặc định
    const onlyDuyen = isMain && mainKeyOf(u) === 'nguyen duyen'
    return fixExp({ ...u, main: isMain, avatar: !onlyDuyen && (u.avatar === '👧' || !u.avatar) ? 'duo' : u.avatar })
  })
  const [matches, setMatches] = useState(() => load('xo_matches', []))
  // XO_XP_SYNC_FIX
  useEffect(() => {
    if (!user) return
    const fixed = fixExp(user)
    if (fixed.level !== user.level ||
        fixed.exp !== user.exp ||
        fixed.expMax !== user.expMax) setUser(fixed)
  }, [user])
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load('xo_settings', {}) }))

  const pulled = useRef(false)
  const [syncTick, setSyncTick] = useState(0)

  // Kéo dữ liệu tài khoản chính từ server; chỉ dùng nếu mới hơn bản đang có
  const pullMain = (localUser) => {
    const key = mainKeyOf(localUser)
    if (!key || !localStorage.getItem('xo_player_token')) return
    pulled.current = false
    const done = (data) => {
      if (data?.user && ((data.user.rev || 0) > (localUser?.rev || 0) || ((data.user.rev || 0) === (localUser?.rev || 0) && (data.user.updatedAt || 0) > (localUser?.updatedAt || 0)))) {
        setUser(fixExp({ ...data.user, main: true, loginDays: [...new Set([...(data.user.loginDays || []), ...(localUser.loginDays || [])])] }))
        setMatches(data.matches || [])
      }
      pulled.current = true
      setSyncTick((t) => t + 1)
    }
    postMain('/load', key).then((r) => done(r.data)).catch(() => done(null))
  }
  useEffect(() => { if (user?.main && localStorage.getItem('xo_player_token')) pullMain(user) }, []) // mở lại app khi đang đăng nhập
// Đẩy dữ liệu lên server mỗi khi thay đổi (sau khi đã kéo xong)
useEffect(() => {
  if (user?.main && mainKeyOf(user) && pulled.current && localStorage.getItem('xo_player_token')) postMain('/save', mainKeyOf(user), { user, matches }).catch(() => {})
}, [user, matches, syncTick])
  useEffect(() => {
    if (user && !user.main && !user.guest && user.id) {
      save('xo_account_score_' + user.id, user.score || 0)
    }
  }, [user])
  useEffect(() => save('xo_user', user), [user])
  useEffect(() => save('xo_matches', matches), [matches])
  useEffect(() => save('xo_settings', settings), [settings])
  // XO_GUEST_PERSIST_V1
  useEffect(() => {
    if (user?.guest) {
      save('xo_guest_profile_v1', { user, matches })
    }
  }, [user, matches])
  // Tài khoản chính: lưu riêng, không bị ghi đè khi đăng nhập tài khoản khác
  useEffect(() => { if (user?.main && mainKeyOf(user)) save(mainStoreKey(mainKeyOf(user)), { user, matches }) }, [user, matches])

  // Trả về chuỗi lỗi nếu đăng nhập thất bại, null nếu thành công
  const login = async (identity, pw) => {
    const mk = normName(identity)
    if (MAIN_ACCOUNTS[mk]) {
      try {
        const res = await fetch('/api/main/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: mk, password: pw }) })
        const data = await res.json()
        if (!res.ok) return data.error || 'Đăng nhập thất bại.'
        localStorage.setItem('xo_player_token', data.token)
        const saved = data.data || load(mainStoreKey(mk), null)
        const u = fixExp({ ...(saved?.user || newUser({ name: MAIN_ACCOUNTS[mk].name, main: true })), main: true })
        setUser(u); setMatches(saved?.matches || []); pulled.current = true
        return null
      } catch { return 'Không kết nối được backend.' }
    }
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: identity, password: pw }) })
      const data = await res.json()
      if (!res.ok) return data.error || 'Đăng nhập thất bại.'
      localStorage.setItem('xo_player_token', data.token)
      setUser({ ...data.user, main: false, coins: data.user.coins ?? 500, gems: data.user.gems ?? 500, score: data.user.score || 0 })
      setMatches(data.matches || [])
      return null
    } catch { return 'Không kết nối được backend.' }
  }
  const register = async (data) => {
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.name, email: data.email, birthday: data.birthday, password: data.password }) })
      const result = await res.json()
      if (!res.ok) return result.error || 'Đăng ký thất bại.'
      localStorage.setItem('xo_player_token', result.token)
      setUser({ ...result.user, main: false, coins: result.user.coins ?? 500, gems: result.user.gems ?? 0, score: result.user.score || 0 }); setMatches(result.matches || [])
      return null
    } catch { return 'Không kết nối được backend.' }
  }


  const requestRegisterOtp = async (data) => {
    try {
      const res = await fetch('/api/register/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()
      return res.ok ? null : result.error || 'Không gửi được OTP.'
    } catch {
      return 'Không kết nối được backend.'
    }
  }

  const verifyRegisterOtp = async (email, otp) => {
    try {
      const res = await fetch('/api/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      })
      const result = await res.json()

      if (!res.ok) return result.error || 'OTP không hợp lệ.'

      localStorage.setItem('xo_player_token', result.token)
      setUser({
        ...result.user,
        main: false,
        coins: result.user.coins ?? 500,
        gems: result.user.gems ?? 0,
        score: result.user.score || 0
      })
      setMatches(result.matches || [])
      return null
    } catch {
      return 'Không kết nối được backend.'
    }
  }

  const googleLogin = async (credential) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      })

      const data = await res.json()

      if (!res.ok) {
        return data.error || 'Đăng nhập Google thất bại.'
      }

      localStorage.setItem('xo_player_token', data.token)

      setUser({
        ...data.user,
        main: false,
        guest: false,
        coins: data.user.coins ?? 500,
        gems: data.user.gems ?? 500,
        score: data.user.score ?? 0
      })

      setMatches(data.matches || [])
      return null
    } catch {
      return 'Không kết nối được Backend.'
    }
  }

  const guestBusy = useRef(false)
  const guestLogin = async (resumeOnly = false) => {
    if (guestBusy.current) return 'Đang đăng nhập.'
    guestBusy.current = true
    try {
      let credential = localStorage.getItem('xo_guest_credential_v2')
      if (!credential) {
        if (resumeOnly) return 'Không tìm thấy tài khoản khách đã lưu.'
        credential = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('')
        localStorage.setItem('xo_guest_credential_v2', credential)
      }
      const res = await fetch('/api/auth/guest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, resumeOnly })
      })
      const data = await res.json()
      if (res.status === 404) return 'Backend online chưa cập nhật chức năng đăng nhập khách.'; if (!res.ok || !data.token || !data.user) return data.error || 'Đăng nhập khách thất bại.'
      localStorage.setItem('xo_player_token', data.token)
      setUser(fixExp({ ...data.user, main: false, guest: false }))
      setMatches(mergeHistory(data.matches || [], load(offlineKey(data.user), [])))
      return null
    } catch { return 'Không kết nối được Backend.' }
    finally { guestBusy.current = false }
  }
  useEffect(() => {
    if (user?.provider === 'guest') guestLogin(true).catch(() => {})
    // Legacy local-only guests must explicitly sign in again.
    if (user?.guest) { localStorage.removeItem('xo_player_token'); setUser(null); setMatches([]) }
  }, [])
  // Đăng xuất: dữ liệu tài khoản chính đã nằm trong xo_main nên không mất
  const logout = () => { localStorage.removeItem('xo_player_token'); setUser(null); setMatches([]) }

  const applyMatchBalance = (balance) => {
    if (!balance || !Number.isFinite(balance.coins)) return
    setUser(u => u ? fixExp({
      ...u,
      coins: balance.coins,
      ...(Number.isFinite(balance.gems) ? { gems: balance.gems } : {}),
      ...(Number.isFinite(balance.level) ? { level: balance.level } : {}),
      ...(Number.isFinite(balance.exp) ? { exp: balance.exp } : {}),
      ...(u.main && balance.rev ? { rev: balance.rev, updatedAt: balance.updatedAt } : {})
    }) : u) // XO_XP_BALANCE_FIX
  }

  const addMatch = (m) => {
    const key = offlineKey(user)
    if (key && (m.room === 'AI' || m.room === 'LOCAL') && !m.serverVerified) {
      save(key, mergeHistory([m], load(key, [])))
    }
    setMatches((list) => [m, ...list])
    // Chỉ khách và trận chơi ngoại tuyến tự cập nhật tại máy.
    // Tài khoản đăng nhập chơi online do server xác nhận kết quả và lưu vàng.
    setUser((u) => {
      if (!u || m.serverVerified || (m.onlineVerified && !u.guest)) return u
      if (u.main) return m.room === 'AI' ? giveExp(u,m.result) : u // XO_XP_AI_FIX
      const delta = m.result === 'win' ? 200 : m.result === 'lose' ? -200 : 100
      const gemDelta = m.result === 'win' ? 100 : m.result === 'lose' ? -100 : 50
      return { ...(m.room === 'AI' ? giveExp(u,m.result) : u), coins: Math.max(0,(u.coins || 0) + delta), gems: Math.max(0,(u.gems || 0) + gemDelta), updatedAt: Date.now() }
    })
  }

  // Nhận thưởng qua server, không tự cộng số dư ở trình duyệt.
// Nhận thưởng trực tiếp qua Backend.
// Backend kiểm tra điều kiện và chống nhận trùng.
const eventBusy = useRef(false)
  const eventAction = async (path, id) => {
    if (!user) return { ok: false, error: 'Chưa đăng nhập.' }
    if (eventBusy.current) return { ok: false, error: 'Đang xử lý.' }
    eventBusy.current = true
    try {
      if (user.guest) {
        const saved = load('xo_guest_profile_v1', null)
        const current = saved?.user?.id === user.id ? saved.user : user
        let r
        if (path === '/checkin') {
          const today = new Date(Date.now() + 7*3600000).toISOString().slice(0,10)
          const days = current.loginDays || []
          r = { ok: true, already: days.includes(today), data: { user: { ...current, loginDays: [...new Set([...days,today])] }, matches } }
        } else r = guestClaim(current, matches, id)
        if (r.ok && r.data?.user) {
          save('xo_guest_profile_v1', r.data)
          setUser(fixExp(r.data.user))
        }
        return r
      }
      const r = await postMain(path, mainKeyOf(user), id ? { id } : {})
      if (r.data?.user) {
        setUser(fixExp({ ...r.data.user, main: !!user.main }))
        setMatches(r.data.matches || [])
      }
      return r
    } catch { return { ok: false, error: 'Không kết nối được server.' } }
    finally { eventBusy.current = false }
  }
  const claimEventReward = id => eventAction('/claim', id)
  const checkInToday = () => eventAction('/checkin')

  const renameProfile = async (name) => {
    if (!user || user.guest) return { ok: false, error: 'Tài khoản khách không thể đổi tên.' }
    try {
      const res = await fetch('/api/profile/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('xo_player_token') || '') },
        body: JSON.stringify({ name })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Không đổi được tên.' }
      setUser(u => u ? { ...u, ...data.user, main: u.main } : u)
      return { ok: true }
    } catch { return { ok: false, error: 'Không kết nối được server.' } }
  }

const updateProfile = async (patch) => {
  if (!user) return { ok: false, error: 'Chưa đăng nhập.' }

  if (patch.avatar && patch.avatar !== user.avatar) {
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (localStorage.getItem('xo_player_token') || '')
        },
        body: JSON.stringify({ avatar: patch.avatar })
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        return {
          ok: false,
          error: data.error || 'Không lưu được ảnh đại diện.'
        }
      }

      setUser(u => u ? {
        ...u,
        ...data.user,
        avatar: data.user.avatar
      } : u)

      return { ok: true }
    } catch {
      return { ok: false, error: 'Không kết nối được server.' }
    }
  }

  if (!user) return { ok: false, error: 'Chưa đăng nhập.' }

  const key = mainKeyOf(user)
  const p = { ...patch }
  delete p.name

  if (key !== 'nguyen duyen' && p.avatar === '👧') {
    p.avatar = 'duo'
  }

  if (!key) {
  return {
    ok: false,
    error: 'Tài khoản này chưa có chức năng lưu hồ sơ lên server.'
  }
}

  try {
    const latest = await postMain('/load', key)

    if (!latest.data?.user) {
      return { ok: false, error: 'Không tải được hồ sơ.' }
    }

    const current = latest.data.user
    const next = {
      ...current,
      ...p,
      updatedAt: Math.max(Date.now(), (current.updatedAt || 0) + 1)
    }

    const result = await postMain('/save', key, {
      user: next,
      matches: latest.data.matches || []
    })

    if (!result.ok || result.stale || !result.data?.user) {
      return { ok: false, error: 'Không lưu được hồ sơ.' }
    }

    setUser(fixExp({ ...result.data.user, main: true }))
    setMatches(result.data.matches || [])

    return { ok: true }
  } catch {
    return { ok: false, error: 'Không kết nối được backend.' }
  }
}

  return (
    <Ctx.Provider value={{
      user, matches: mergeHistory(matches, offlineKey(user) ? load(offlineKey(user), []) : []), settings, setSettings,
      login, register, requestRegisterOtp, verifyRegisterOtp, googleLogin, guestLogin, logout, addMatch, applyMatchBalance, updateProfile, renameProfile, claimEventReward, checkInToday,
    }}>
      {children}
    </Ctx.Provider>
  )
}