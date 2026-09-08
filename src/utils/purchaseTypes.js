const TRANSACTION_TYPES = [
  { key: 'mua_moi', label: 'Mua mới' },
  { key: 'thu_cu_doi_moi', label: 'Thu cũ đổi mới' },
  { key: 'bao_hanh_doi_may', label: 'Bảo hành đổi máy' },
  { key: 'khac', label: 'Khác' }
];

const TRANSACTION_TYPE_KEYS = TRANSACTION_TYPES.map((t) => t.key);

function transactionTypeLabel(key) {
  const found = TRANSACTION_TYPES.find((t) => t.key === key);
  return found ? found.label : key;
}

module.exports = { TRANSACTION_TYPES, TRANSACTION_TYPE_KEYS, transactionTypeLabel };
