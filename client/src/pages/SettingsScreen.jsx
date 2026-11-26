import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Layout.jsx'
import { useApp } from '../store.jsx'
import { Ico, PETALS, TopHud, useFit } from '../components/hud.jsx'
import { Backdrop, NeonFrame } from './WaitingRoom.jsx'
import { NAV } from './ProfileScreen.jsx'
import { NAV_ICON } from './LeaderboardScreen.jsx'

import '../components/home.css'
import '../components/join-fonts.css'
import '../components/join.css'
import '../components/waiting.css'
import '../components/profile.css'
import '../components/settings.css'

const NAV_TOPS = [96, 155, 202, 250, 298, 347]

const Panel = ({ cls, id, title, children }) => (
  <section className={`sx-panel ${cls}`} style={{ width: 392, height: 151 }}>
    <NeonFrame
      w={392} h={151} c={16} id={id}
      c1="#6fc4ff" c2="#8a6bff"
      fill={['rgba(12,24,136,.55)', 'rgba(8,12,104,.72)']}
      inset={5} sw={2}
    />
    <div className="sx-head">
      <Ico n="user" size={25} fill="#fff" />
      <b>{title}</b>
    </div>
    <i className="sx-line" />
    {children}
  </section>
)

const InfoRow = ({ top, label, value }) => (
  <div
    style={{
      position: 'absolute',
      left: 22,
      right: 22,
      top,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: '#eef3ff',
      fontSize: 13
    }}
  >
    <span>{label}</span>
    <b style={{ color: '#fff' }}>{value}</b>
  </div>
)

export default function SettingsScreen() {
  const { user, logout } = useApp()
  const nav = useNavigate()
  const scale = useFit(1280, 720)
  const [toast, setToast] = useToast()

  if (!user) return null

  const doLogout = () => {
    logout()
    nav('/login')
  }

  const soon = () => {}

  return (
    <div className="hm-root">
      <div
        className="hm-stage jr-stage wr-stage sx-stage"
        style={{
          width: Math.max(1280, window.innerWidth / Math.max(scale, 0.001)),
transform: `translate(-50%, -50%) scale(${scale})`
        }}
      >
        <div className="sx-bg"><Backdrop /></div>

        {PETALS.slice(0, 12).map((p, i) => (
          <i
            key={i}
            className="hm-petal"
            style={{
              left: p.x + '%',
              animationDuration: p.d + 's',
              animationDelay: p.delay + 's',
              transform: `scale(${p.s})`
            }}
          />
        ))}

        <div className="sx-s">
          {NAV.map((n, i) => {
            const on = n.k === 'settings'

            return (
              <button
                key={n.k}
                type="button"
                className={`sx-nav ${on ? 'on' : ''}`}
                style={{ top: NAV_TOPS[i] }}
                onClick={!on && n.to ? () => nav(n.to) : undefined}
              >
                <NeonFrame
                  w={143} h={39} c={9}
                  id={`sxn${i}`}
                  inset={3}
                  sw={on ? 1.8 : 1.4}
                  c1={on ? '#ff9af5' : '#78b4ff'}
                  c2={on ? '#c05cff' : '#5a7cff'}
                  fill={
                    on
                      ? ['rgba(92,34,200,.95)', 'rgba(44,16,140,.97)']
                      : ['rgba(16,28,140,.9)', 'rgba(8,12,96,.94)']
                  }
                />
                <span className="sx-nav-in">
                  {NAV_ICON[n.k] || n.icon}
                  <b>{n.label}</b>
                </span>
              </button>
            )
          })}

          <div className="sx-title">
            <NeonFrame
              w={269} h={47} c={18} id="sxt"
              c1="#e8f4ff" c2="#6aa8ff"
              fill={['rgba(8,12,96,.92)', 'rgba(4,8,70,.95)']}
              inset={4} sw={1.6}
            />
            <span className="sx-title-in">
              <b>
                <Ico n="gear" size={27} fill="#fff" />
                Cài đặt
              </b>
              <em>Thông tin và tài khoản</em>
            </span>
          </div>

          <Panel cls="tl" id="sxp1" title="Thông tin tài khoản">
            <InfoRow top={55} label="Tên người chơi" value={user.name} />
            <InfoRow top={90} label="Cấp độ" value={user.level} />
            <InfoRow top={122} label="Trạng thái" value="Đã đăng nhập" />
          </Panel>

          <Panel cls="tr" id="sxp2" title="Thông tin game">
            <InfoRow top={55} label="Tên game" value="X-O Arena" />
            <InfoRow top={90} label="Phiên bản" value="v1.0.0" />
            <InfoRow top={122} label="Chế độ" value="Caro online" />
          </Panel>

          <div
            style={{
              position: 'absolute',
              left: 420,
              top: 330,
              width: 220,
              textAlign: 'center'
            }}
          >
            <button
              type="button"
              onClick={doLogout}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: '1px solid #ff9af5',
                background: 'linear-gradient(180deg,#7134cb,#34138b)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(210,110,255,.55)'
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>

        <TopHud
          user={user}
          soon={soon}
          onProfile={() => nav('/profile')}
          onSettings={() => {}}
          onLogout={doLogout}
        />

        <img
          className="sx-logo"
          src="/img/join-logo.png"
          alt="X-O Arena"
          draggable={false}
        />
      </div>

      {toast}
    </div>
  )
}
