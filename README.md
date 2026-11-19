# X-O Arena

X-O Arena là website game Caro được xây dựng bằng React, Vite, Node.js và Socket.IO. Game sử dụng bàn cờ 15×15, hỗ trợ chơi với máy, chơi hai người trên cùng thiết bị và chơi trực tuyến.

Ngoài ra, game có các chức năng quản lý tài khoản, lịch sử trận đấu, bảng xếp hạng, nhiệm vụ, điểm danh và nhận thưởng.

Chế độ Giải đấu dự kiến ra mắt năm 2027.

## 1. Yêu cầu

- Node.js 20 trở lên.
- Trình duyệt web như Chrome hoặc Edge.
- Kết nối Internet khi sử dụng OTP qua Gmail hoặc đăng nhập Google.

## 2. Cài đặt

Mở thư mục dự án bằng Visual Studio Code, sau đó mở Terminal tại thư mục gốc `xo-arena-github`.

Cài đặt thư viện Backend:

```powershell
npm --prefix server install
```

Cài đặt thư viện Frontend:

```powershell
npm --prefix client install
```

Chỉ cần cài đặt thư viện lần đầu hoặc khi thay đổi các gói phụ thuộc.

## 3. Cấu hình

Backend sử dụng file `server/.env` để lưu các thông số cấu hình.

Khi chạy bằng `npm --prefix server run dev`, chương trình có thể tự tạo file `.env` với `JWT_SECRET` ngẫu nhiên nếu file chưa tồn tại.

Để sử dụng chức năng gửi OTP qua Gmail, cần cấu hình các thông số SMTP phù hợp với tài khoản gửi email.

Để sử dụng Google Login, cấu hình `GOOGLE_CLIENT_ID` ở Backend và `VITE_GOOGLE_CLIENT_ID` trong `client/.env`. Hai giá trị này phải sử dụng cùng Google Client ID.

Không chia sẻ file `.env` hoặc thông tin đăng nhập cá nhân.

## 4. Chạy dự án

Mở hai Terminal riêng biệt trong VS Code.

**Terminal 1 – Backend**

```powershell
npm --prefix server run dev
```

Khi chạy thành công, Backend hiển thị:

```text
X-O Arena server chạy ở cổng 3001
```

Giữ Terminal này hoạt động.

**Terminal 2 – Frontend**

```powershell
npm --prefix client run dev
```

Khi chạy thành công, Vite hiển thị địa chỉ truy cập:

```text
http://localhost:5173/
```

Mở trình duyệt và truy cập:

http://localhost:5173/

Để dừng chương trình, nhấn `Ctrl + C` trong từng Terminal.

## 5. Chức năng chính

- Đăng ký, đăng nhập và quản lý tài khoản.
- Xác minh email bằng OTP và khôi phục mật khẩu.
- Hỗ trợ đăng nhập bằng Google khi đã cấu hình.
- Chơi Caro trên bàn cờ 15×15.
- Chơi với máy, chơi hai người và chơi trực tuyến.
- Tạo phòng, tham gia phòng và ghép trận nhanh.
- Đồng bộ nước đi giữa hai người chơi bằng Socket.IO.
- Hiển thị kết quả và lưu lịch sử trận đấu.
- Bảng xếp hạng người chơi.
- Nhiệm vụ, điểm danh và nhận thưởng.
- Hồ sơ người chơi và cài đặt tài khoản.
- Chat, đề nghị hòa, đầu hàng và yêu cầu chơi lại trong trận trực tuyến.

## 6. Kiểm tra dự án

Mở Terminal tại thư mục gốc dự án.

**Kiểm thử tích hợp:**

```powershell
node test-integration.mjs
```

**Kiểm tra build Frontend:**

```powershell
npm --prefix client run build
```

**Kiểm tra cú pháp Backend:**

```powershell
node --check server/index.js
node --check server/start.js
node --check server/register-otp.js
```

Các bước kiểm tra giúp phát hiện lỗi cú pháp, lỗi build và một số lỗi trong quá trình xử lý tài khoản, phần thưởng và trận đấu trực tuyến.

## 7. Lưu ý

- Giữ nguyên cấu trúc hai thư mục `client` và `server`.
- Không xóa các file JSON chứa dữ liệu tài khoản và lịch sử trận đấu.
- Nếu gặp lỗi `EADDRINUSE 3001`, kiểm tra xem Backend đã chạy ở Terminal khác chưa.
- Không cần chạy `npm install` mỗi lần mở game.
- Không đưa file `.env`, mật khẩu hoặc dữ liệu tài khoản thật lên GitHub.
- Chế độ Giải đấu hiện chỉ ở trạng thái sắp ra mắt, chưa phải chức năng thi đấu hoàn chỉnh.