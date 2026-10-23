// Trang thai xu ly 1 yeu cau sua chua tu trang cong khai -- giong het
// tradeInStatus.js (khong dung cho repair_history, bang do khong co status).
const STATUSES = [
  { key: 'moi', label: 'Yêu cầu mới' },
  { key: 'da_lien_he', label: 'Đã liên hệ' },
  { key: 'hoan_tat', label: 'Hoàn tất' },
  { key: 'huy', label: 'Đã huỷ' }
];

const STATUS_KEYS = STATUSES.map((s) => s.key);
const DEFAULT_STATUS = 'moi';

function statusLabel(key) {
  const found = STATUSES.find((s) => s.key === key);
  return found ? found.label : key;
}

module.exports = { STATUSES, STATUS_KEYS, DEFAULT_STATUS, statusLabel };
