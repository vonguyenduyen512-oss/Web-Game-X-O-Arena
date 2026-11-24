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

  const guestLogin = () => {
  localStorage.removeItem('xo_player_token')
  const guest = newUser({
    name: 'Khach' + Math.floor(Math.random() * 9000 + 1000),
    guest: true
  })
  setUser({ ...guest, coins: 500, gems: 500 })
  setMatches([])
}
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
    setMatches((list) => [m, ...list])
    // Chỉ khách và trận chơi ngoại tuyến tự cập nhật tại máy.
    // Tài khoản đăng nhập chơi online do server xác nhận kết quả và lưu vàng.
    setUser((u) => {
      if (!u || (m.onlineVerified && !u.guest)) return u
      if (u.main) return m.room === 'AI' ? giveExp(u,m.result) : u // XO_XP_AI_FIX
      const delta = m.result === 'win' ? 200 : m.result === 'lose' ? -200 : 100
      const gemDelta = m.result === 'win' ? 100 : m.result === 'lose' ? -100 : 50
      return { ...(m.room === 'AI' ? giveExp(u,m.result) : u), coins: Math.max(0,(u.coins || 0) + delta), gems: Math.max(0,(u.gems || 0) + gemDelta), updatedAt: Date.now() }
    })
  }

  // Nhận thưởng qua server, không tự cộng số dư ở trình duyệt.
// Nhận thưởng trực tiếp qua Backend.
// Backend kiểm tra điều kiện và chống nhận trùng.
const claimEventReward = async (id) => {
  if (!user?.main || !mainKeyOf(user)) {
    return {
      ok: false,
      error: 'Hãy đăng nhập tài khoản cố định.'
    }
  }

  try {
    const r = await postMain('/claim', mainKeyOf(user), { id })

    if (r.data?.user) {
      setUser(fixExp({ ...r.data.user, main: true }))
      setMatches(r.data.matches || [])
    }

    return {
      ok: !!r.ok,
      error: r.error
    }
  } catch {
    return {
      ok: false,
      error: 'Không kết nối được server. Vui lòng thử lại.'
    }
  }
}
  const checkInToday = async () => {
    if (!user?.main || !mainKeyOf(user)) return { ok: false, error: 'Hãy đăng nhập tài khoản cố định.' }
    try {
      const r = await postMain('/checkin', mainKeyOf(user))
      if (r.data?.user) {
        setUser(fixExp({ ...r.data.user, main: true }))
        setMatches(r.data.matches || [])
      }
      return { ok: !!r.ok, already: !!r.already, error: r.error }
    } catch { return { ok: false, error: 'Không kết nối được server.' } }
  }

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
      user, matches, settings, setSettings,
      login, register, requestRegisterOtp, verifyRegisterOtp, googleLogin, guestLogin, logout, addMatch, applyMatchBalance, updateProfile, renameProfile, claimEventReward, checkInToday,
    }}>
      {children}
    </Ctx.Provider>
  )
}