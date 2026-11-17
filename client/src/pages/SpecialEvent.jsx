import React, { useState } from 'react';
import './SpecialEvent.css';

// Nội dung nằm trong khung tab có sẵn của trang Sự kiện.
export default function SpecialEvent() {
  const [notify, setNotify] = useState(() => localStorage.getItem('xo_special_event_notify') === 'true');
  const toggleNotify = () => {
    const next = !notify;
    setNotify(next);
    localStorage.setItem('xo_special_event_notify', String(next));
  };

  return (
    <section className="xo-special" aria-label="Sự kiện đặc biệt">
      <div className="xo-special-empty">
        <img className="xo-special-art" src="/img/special-event-calendar.png" alt="Lịch sự kiện và hộp quà" />
        <h2>Hiện chưa có sự kiện đặc biệt!</h2>
        <p>Các sự kiện đặc biệt sẽ được mở trong thời gian sắp tới.</p>
        <button type="button" className="xo-special-button" onClick={toggleNotify}>
          <span aria-hidden="true">♟</span> {notify ? 'Đã bật nhắc sự kiện' : 'Thông báo khi có sự kiện'}
        </button>
      </div>
    </section>
  );
}
