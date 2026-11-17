# X-O Arena

X-O Arena là game Caro được xây dựng bằng React, Vite, Node.js và Socket.IO.

Game hỗ trợ đăng ký bằng Gmail có xác minh OTP, đăng nhập bằng mật khẩu hoặc Google, chơi với máy, chơi hai người và chơi online. Ngoài ra còn có lịch sử đấu, bảng xếp hạng, nhiệm vụ, phần thưởng và cửa hàng khung avatar.

Chế độ Giải đấu dự kiến ra mắt năm 2027.

## 1. Yêu cầu

- Node.js 20 trở lên.
- Trình duyệt web.
- Kết nối Internet để sử dụng Gmail OTP và Google Login.

## 2. Cài đặt

Mở Terminal tại thư mục dự án.

**Backend**

```powershell
cd server
npm ci
```

**Frontend**

```powershell
cd client
npm ci
```

## 3. Cấu hình

Tạo `server/.env` từ `server/.env.example` và cấu hình `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `GOOGLE_CLIENT_ID`.

Để sử dụng Google Login, đặt `VITE_GOOGLE_CLIENT_ID` trong `client/.env`, trùng với Google Client ID của Backend. Cấu hình địa chỉ Frontend trong Authorized JavaScript origins trên Google Cloud.

Không chia sẻ các file `.env`.

## 4. Chạy game

Mở hai Terminal riêng biệt.

**Terminal 1 – Backend**

```powershell
cd server
npm start
```

**Terminal 2 – Frontend**

```powershell
cd client
npm run dev
```

Mở địa chỉ http://localhost:5173/login.

## 5. Chức năng chính

- Đăng ký Gmail và xác minh OTP 6 số.
- Đăng nhập bằng tài khoản hoặc Google.
- Chơi với máy, chơi hai người và chơi online.
- Tạo phòng và tham gia phòng.
- Lưu kết quả trận đấu và cập nhật điểm xếp hạng.
- Lịch sử đấu, nhiệm vụ, điểm danh và nhận thưởng.
- Cửa hàng mua và trang bị khung avatar.
- Hồ sơ người chơi và cài đặt tài khoản.

## 6. Kiểm tra

Frontend:

```powershell
cd client
npm run build
```

Backend:

```powershell
cd server
node --check index.js
node --check start.js
node --check register-otp.js
```

## 7. Lưu ý

- Không xóa các file JSON chứa dữ liệu tài khoản và lịch sử trận đấu.
- Giữ nguyên cấu trúc thư mục `client` và `server`.
- Nếu gặp lỗi `EADDRINUSE 3001`, kiểm tra Backend đang chạy trước khi khởi động thêm.
- Không đưa `.env`, dữ liệu tài khoản thật hoặc `node_modules` lên GitHub.
