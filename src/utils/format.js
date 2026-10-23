function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

function discountPercent(price, salePrice) {
  if (!salePrice || salePrice >= price) return 0;
  return Math.round(((price - salePrice) / price) * 100);
}

function generateOrderCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TS${stamp}${rand}`;
}

// Chuan hoa 1 gia tri cot "date" lay tu DB (co the ve la string "YYYY-MM-DD",
// co the ve la JS Date object tuy driver/du lieu cu) thanh dung dinh dang
// "YYYY-MM-DD" ma <input type="date"> chap nhan -- sai dinh dang du chi 1 ky
// tu la trinh duyet tu am tham xoa trang ve rong, day la nguyen nhan cac o
// "Ngay mua"/"Han bao hanh" bi mat gia tri khi mo trang sua. Dung
// toISOString() (luon tra ve UTC) thay vi cac ham gio dia phuong de khong bi
// lech ngay theo timezone server.
function toDateInputValue(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

module.exports = { formatVND, discountPercent, generateOrderCode, toDateInputValue };
