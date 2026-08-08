# TOMSTORE

Website bán lẻ điện thoại, MacBook, máy tính bảng, tai nghe. Node.js + Express + EJS, dữ liệu qua Knex.js (SQLite khi phát triển local, MySQL khi chạy production trên Hostinger).

## Tính năng

- Trang chủ: slide banner đầu trang (quản lý trong admin), bảng **Hot Deal Trong Ngày** trên nền gradient thương hiệu có đồng hồ đếm ngược, 4 ô danh mục (hover nổi lên), khối **Sản phẩm Hot** (banner trái + sản phẩm phải).
- 4 danh mục: Điện thoại, MacBook, Máy tính bảng, Tai nghe.
- Tìm kiếm sản phẩm, trang chi tiết sản phẩm với thông số kỹ thuật.
- Giỏ hàng (session), đặt hàng COD hoặc chuyển khoản ngân hàng (chưa tích hợp cổng thanh toán online thật).
- Trang quản trị `/admin`: đăng nhập, quản lý sản phẩm (CRUD, upload ảnh trực tiếp, đánh dấu "Sản phẩm Hot"), quản lý Hot Deal, quản lý Banner trang chủ, quản lý đơn hàng.

## Ảnh upload từ trang quản trị

Ảnh banner và ảnh sản phẩm tải lên qua admin được lưu tại `public/images/uploads/`. Thư mục này **không nằm trong git** (xem `.gitignore`) vì là dữ liệu runtime, không phải source code. Khi deploy lên Hostinger, đây là dữ liệu cần **backup/giữ lại riêng** qua các lần cập nhật code — xem lưu ý trong [DEPLOY.md](DEPLOY.md).

## Cài đặt & chạy local

Yêu cầu: Node.js 18+.

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Mở `http://localhost:3000`. Mặc định `.env` dùng `NODE_ENV=development` nên chạy trên SQLite (file `dev.sqlite3`, tự tạo), không cần cài MySQL để phát triển.

Tài khoản admin mặc định (đổi ngay sau khi deploy thật): xem `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` trong `.env`. Đăng nhập tại `/admin/login`.

## Cấu trúc thư mục

```
server.js              Điểm khởi động Express
knexfile.js             Cấu hình Knex (development = sqlite, production = mysql2)
migrations/, seeds/     Schema và dữ liệu mẫu
src/
  db.js                 Kết nối Knex
  controllers/          Xử lý request (khách hàng + admin/)
  routes/                index.js (khách), admin.js (quản trị)
  middleware/            auth (bảo vệ /admin), locals (dữ liệu chung mọi trang), errorHandler
  services/               cart.js (giỏ hàng session), payment.js (COD/chuyển khoản, dễ mở rộng)
  utils/                  format (tiền tệ, mã đơn), slug, icons (placeholder SVG theo danh mục)
views/                  Template EJS (partials/, admin/)
public/                 css/style.css, js/main.js (đếm ngược, menu mobile), images/
```

## Đổi dữ liệu sản phẩm

Sản phẩm mẫu trong `seeds/001_seed_data.js` chỉ mang tính minh họa (không sao chép từ nguồn nào). Sau khi deploy, dùng trang quản trị `/admin/san-pham` để thêm/sửa sản phẩm thật, hoặc sửa file seed rồi chạy lại `npm run seed` (**seed sẽ xóa sạch dữ liệu cũ**, chỉ dùng cho môi trường dev).

## Thanh toán

Hiện chỉ hỗ trợ COD và chuyển khoản thủ công (thông tin ngân hàng cấu hình trong `.env`: `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`). Muốn nối cổng thanh toán thật (VNPay/Momo...), sửa `src/services/payment.js` — các controller khác không cần thay đổi.

## Deploy

Xem hướng dẫn deploy lên Hostinger + GitHub trong [DEPLOY.md](DEPLOY.md).
