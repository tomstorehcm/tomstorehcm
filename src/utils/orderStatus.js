const STATUSES = [
  { key: 'moi', label: 'Đơn mới' },
  { key: 'da_lien_he', label: 'Đã liên hệ' },
  { key: 'da_giao', label: 'Đã giao máy' }
];

const STATUS_KEYS = STATUSES.map((s) => s.key);
const DEFAULT_STATUS = 'moi';

function statusLabel(key) {
  const found = STATUSES.find((s) => s.key === key);
  return found ? found.label : key;
}

module.exports = { STATUSES, STATUS_KEYS, DEFAULT_STATUS, statusLabel };
