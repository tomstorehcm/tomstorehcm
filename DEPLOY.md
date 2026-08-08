# Hướng dẫn Deploy TOMSTORE

## 1. Đẩy code lên GitHub

```bash
# Tạo repo rỗng trên GitHub trước (không tick "Add README"), rồi:
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

`.env` đã nằm trong `.gitignore` nên sẽ không bị đẩy lên GitHub — đúng như mong muốn, vì file này chứa thông tin nhạy cảm (mật khẩu DB, session secret).

## 2. Chọn gói Hostinger phù hợp

Node.js **không chạy được** trên gói Shared Hosting thường của Hostinger. Cần một trong các gói sau (đều có tính năng **Node.js App Manager** trong hPanel):

- Hostinger **Cloud Hosting** hoặc **Business Web Hosting** trở lên, hoặc
- **VPS Hosting** (tự cài Node.js qua SSH, linh hoạt hơn nhưng cần tự quản trị server).

Gói cũng cần có **MySQL Database** đi kèm (hầu hết các gói trên đều có sẵn qua phpMyAdmin/hPanel).

## 3. Tạo MySQL Database trên Hostinger

1. hPanel → **Databases** → **MySQL Databases** → tạo database mới (ví dụ `tomstore`), tạo user + mật khẩu, gán quyền đầy đủ cho user vào database.
2. Ghi lại: tên database, username, password, host (thường là `localhost` khi app chạy cùng server, hoặc host riêng nếu dùng Remote MySQL).

## 4. Tạo Node.js App trên hPanel

1. hPanel → **Advanced** → **Node.js** → **Create Application**.
2. Chọn phiên bản Node.js (khuyến nghị bản LTS mới nhất mà Hostinger hỗ trợ, ví dụ 18/20/22).
3. **Application root**: thư mục chứa code (ví dụ `tomstore`).
4. **Application startup file**: `server.js`.
5. **Application URL**: chọn domain/subdomain sẽ dùng cho site.

## 5. Kết nối GitHub để deploy

Trong mục Node.js App vừa tạo, Hostinger hỗ trợ **Git** (hPanel → **Advanced** → **Git**, hoặc trực tiếp trong app Node.js nếu có tab Git):

1. Chọn **Create a new repository** hoặc **Clone from URL**, dán URL repo GitHub đã tạo ở bước 1.
2. Chọn branch `main`, thư mục đích trùng với **Application root** ở bước 4.
3. Sau khi clone xong, mỗi lần cập nhật code chỉ cần push lên GitHub rồi bấm **Pull/Deploy** trong hPanel (hoặc thiết lập auto-deploy nếu Hostinger hỗ trợ webhook).

Nếu gói không có tính năng Git tích hợp, có thể tải code lên qua **File Manager** (upload file zip rồi giải nén) hoặc `git clone` qua SSH (chỉ có ở gói VPS/Cloud có SSH).

## 6. Cấu hình biến môi trường

Trong Node.js App Manager, mục **Environment variables**, thêm:

```
NODE_ENV=production
PORT=<port hPanel yêu cầu, thường tự cấu hình proxy>
SESSION_SECRET=<chuỗi ngẫu nhiên dài, khác với giá trị mẫu>
DB_HOST=localhost
DB_PORT=3306
DB_USER=<user MySQL bước 3>
DB_PASSWORD=<password MySQL bước 3>
DB_NAME=tomstore
ADMIN_DEFAULT_USERNAME=<đổi username admin thật>
ADMIN_DEFAULT_PASSWORD=<đổi mật khẩu admin thật, đủ mạnh>
BANK_NAME=<tên ngân hàng thật>
BANK_ACCOUNT_NAME=<chủ tài khoản thật>
BANK_ACCOUNT_NUMBER=<số tài khoản thật>
STORE_HOTLINE=<hotline thật>
```

## 7. Cài dependency và khởi tạo database

Qua nút **Run NPM Install** trong Node.js App Manager (hoặc SSH nếu có):

```bash
npm install --production
npx knex migrate:latest
npx knex seed:run   # chỉ chạy 1 lần đầu để có dữ liệu mẫu ban đầu, có thể bỏ qua nếu muốn tự nhập từ /admin
```

Sau đó bấm **Restart** app trong hPanel.

## 8. Trỏ domain

- Nếu dùng domain mua ngoài Hostinger: trỏ nameserver hoặc bản ghi DNS (A record) về Hostinger, rồi gán domain cho Node.js App trong hPanel.
- Nếu mua domain ngay trên Hostinger: gán trực tiếp domain/subdomain cho Node.js App trong bước 4.
- Bật SSL miễn phí (Let's Encrypt) trong hPanel → **SSL** cho domain đó.

## 8b. Lưu ý ảnh upload từ trang quản trị

Ảnh banner/sản phẩm upload qua `/admin` được lưu trực tiếp vào `public/images/uploads/` trên server — **không nằm trong Git**. Nếu deploy lại bằng cách `git pull`/`rebuild` mà xoá sạch thư mục cũ, ảnh đã upload sẽ mất. Để an toàn:

- Không xoá toàn bộ thư mục project khi deploy lại, chỉ pull code mới đè lên (Git sẽ không đụng tới file không được track).
- Định kỳ tải thư mục `public/images/uploads/` về máy để backup (qua File Manager hoặc SFTP trong hPanel).
- Nếu sau này chuyển sang hosting khác hoặc cần độ tin cậy cao hơn, cân nhắc chuyển sang lưu ảnh ở dịch vụ ngoài (Cloudinary, S3...).

## 9. Sau khi deploy

- Đăng nhập `/admin/login` bằng tài khoản admin thật đã đặt ở bước 6, đổi lại nếu cần.
- Vào `/admin/san-pham` nhập sản phẩm thật (giá, ảnh, thông số) thay cho dữ liệu mẫu.
- Vào `/admin/hot-deal` bật các Hot Deal đầu tiên.
- Kiểm tra luồng đặt hàng thật (COD/chuyển khoản) trên domain thật trước khi công bố.
