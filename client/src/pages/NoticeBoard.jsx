import { useEffect, useState } from 'react'
import './NoticeBoard.css'

const notices = [
  { id:'update', icon:'🔄', tag:'Cập nhật game', title:'Cập nhật phiên bản mới', date:'Hằng ngày', summary:'Cập nhật tính năng, cải thiện hiệu suất và sửa một số lỗi nhỏ.', detailTitle:'Thông báo cập nhật game', groups:[{label:'⚙ Nội dung cập nhật hôm nay',items:['Tối ưu hiệu suất, giúp trận đấu ổn định hơn.','Cải thiện hệ thống ghép trận, giảm thời gian chờ.','Sửa một số lỗi nhỏ và nâng cao trải nghiệm người chơi.']},{label:'🎮 Mẹo chơi hữu ích',items:['Ưu tiên chọn 2 đầu để hạn chế đối thủ tạo chuỗi.','Giữ trung tâm bàn cờ để kiểm soát thế trận tốt hơn.','Tham gia nhiệm vụ hằng ngày để nhận thêm vàng và kim cương.']}], footer:'Cảm ơn bạn đã đồng hành cùng X-O Arena!\nChúng mình sẽ tiếp tục cập nhật để mang đến trải nghiệm tốt hơn.' },
  { id:'maintenance',icon:'🛠️',tag:'Bảo trì hệ thống',title:'Bảo trì hệ thống định kỳ',date:'Hằng ngày',summary:<>Hệ thống sẽ bảo trì mỗi ngày từ <strong>02:00 – 04:00</strong> để nâng cấp, tối ưu và đảm bảo ổn định.</>,detailTitle:'Thông báo bảo trì hệ thống',groups:[{label:'⚙ Thời gian bảo trì',items:['Từ 02:00 – 04:00 hằng ngày.','Trong thời gian này, hệ thống sẽ tạm ngừng hoạt động.']},{label:'🎮 Nội dung bảo trì',items:['Kiểm tra và tối ưu hiệu suất máy chủ.','Sửa một số lỗi và cải thiện độ ổn định.','Nâng cấp hệ thống để mang lại trải nghiệm tốt hơn.']}],footer:'Rất mong bạn thông cảm!\nSau thời gian bảo trì, bạn có thể đăng nhập lại và tiếp tục trải nghiệm X-O Arena.'},
  { id:'ranking',icon:'🏆',tag:'Sự kiện',title:'Đua Top Tháng 11 – 12',date:'01/11 – 20/12/2026',summary:'Tham gia xếp hạng tích lũy điểm trong thời gian 01/11 – 20/12/2026 để nhận nhiều phần thưởng hấp dẫn!',detailTitle:'Đua Top Tháng 11 – 12',groups:[{label:'⚙ Nội dung sự kiện',items:['Thi đấu và tích lũy điểm xếp hạng trong thời gian diễn ra sự kiện.','Xếp hạng theo điểm tích lũy của người chơi.']},{label:'🎮 Phần thưởng hấp dẫn',items:['Kim cương','Vàng']}],footer:'Tham gia Đua Top Tháng 11 – 12 để tranh hạng và nhận phần thưởng hấp dẫn!'}
]
export default function NoticeBoard(){
 const [selected,setSelected]=useState(null)
 useEffect(()=>{if(!selected)return;const onKey=e=>{if(e.key==='Escape')setSelected(null)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[selected])
 return <div className="xo-notice-board">
  <div className="xo-notice-list">{notices.map(n=><article className="xo-notice-card" key={n.id}>
    <div className="xo-notice-illustration" aria-hidden="true">{n.icon}</div>
    <div className="xo-notice-copy"><span className={'xo-notice-tag '+n.id}>{n.tag}</span><h3>{n.title}</h3><p>{n.summary}</p></div>
    <div className="xo-notice-side"><span className="xo-notice-date">▦ &nbsp;{n.date}</span><button type="button" onClick={()=>setSelected(n)}>Xem chi tiết ❯</button></div>
  </article>)}</div>
  {selected&&<div className="xo-notice-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
    <section className="xo-notice-modal" role="dialog" aria-modal="true" aria-label={selected.detailTitle}>
      <button type="button" className="xo-notice-close" aria-label="Đóng" onClick={()=>setSelected(null)}>×</button>
      <div className="xo-notice-modal-heading">Thông báo</div>
      <div className="xo-notice-modal-intro"><span className="xo-notice-modal-icon">{selected.id==='update'?'📣':selected.icon}</span><div><span className="xo-notice-tag">{selected.tag}</span><h2>{selected.detailTitle}</h2><p>▦ &nbsp;{selected.date}</p>{selected.id==='ranking'&&<p>Thời gian: 01/11 – 20/12/2026</p>}</div></div>
      <div className="xo-notice-modal-sections">{selected.groups.map(g=><div className="xo-notice-group" key={g.label}><h4>{g.label}</h4><ul>{g.items.map(t=><li key={t}>{t}</li>)}</ul></div>)}</div>
      <p className="xo-notice-footer">✦ &nbsp;{selected.footer}&nbsp; ✦</p>
    </section>
  </div>}
 </div>
}
