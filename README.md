# X-O Arena

X-O Arena là game Caro trên nền tảng web, sử dụng bàn cờ 15×15. Game hỗ trợ chơi với máy, chơi hai người trên cùng thiết bị và chơi online.

## 1. Công nghệ sử dụng

- Frontend: React, Vite, CSS.
- Backend: Node.js, Express.
- Kết nối thời gian thực: Socket.IO.
- Lưu trữ dữ liệu: Supabase.
- Triển khai Frontend: Vercel.

## 2. Chức năng

- Đăng ký, đăng nhập bằng tài khoản, Google hoặc đăng nhập nhanh.
- Xác thực email và khôi phục mật khẩu bằng OTP.
- Chơi với máy, chơi hai người và chơi online.
- Tạo phòng, tham gia phòng, ghép trận nhanh.
- Chat, đầu hàng, đề nghị hòa và chơi lại.
- Hồ sơ cá nhân, lịch sử đấu và bảng xếp hạng.
- Nhiệm vụ, sự kiện, điểm danh và nhận thưởng.
- Hệ thống vàng, kim cương, EXP và cấp độ.

Tài khoản mới được cấp 500 vàng và 1.000 kim cương khi khởi tạo.

Chế độ Giải đấu dự kiến ra mắt năm 2027.

## 3. Cài đặt

Yêu cầu Node.js phiên bản 20 trở lên.

Mở thư mục dự án bằng Visual Studio Code và chạy các lệnh sau:

```powershell
npm --prefix server install
npm --prefix client install
```

Cấu hình file `server/.env` và `client/.env` để sử dụng Supabase, Gmail OTP và Google Login.

## 4. Chạy game

Mở hai Terminal trong Visual Studio Code.

**Terminal 1 – Backend**

```powershell
npm --prefix server run dev
```

Backend chạy tại cổng 3001.

**Terminal 2 – Frontend**

```powershell
npm --prefix client run dev
```

Truy cập: http://127.0.0.1:5173/

Giữ cả hai Terminal hoạt động trong quá trình chơi game. Nhấn `Ctrl + C` để dừng chương trình.

## 5. Kiểm tra

Kiểm tra Frontend:

```powershell
npm --prefix client run build
```

Kiểm tra cú pháp Backend:

```powershell
node --check server/index.js
node --check server/start.js
node --check server/supabase-store.js
```

Kiểm thử tích hợp:

```powershell
node test-integration.mjs
```

Khi kiểm tra chế độ online, sử dụng hai tài khoản khác nhau trên trình duyệt thường và trình duyệt ẩn danh.

## 6. Lưu ý

- Chỉ cần cài đặt thư viện khi chạy dự án lần đầu hoặc thay đổi thư viện.
- Không đưa file `.env` và dữ liệu tài khoản lên GitHub.
- Nếu cổng 3001 đang được sử dụng, kiểm tra Backend có đang chạy ở Terminal khác không.

## 7. Website

https://web-game-x-o-arena.vercel.app/