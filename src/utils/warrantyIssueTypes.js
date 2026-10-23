// Danh sach co dinh cac loai tinh trang / loi mang toi bao hanh -- chon
// duoc NHIEU muc cung luc (vd vua "Sửa màn hình" vua "Thay Pin"), luu trong
// cot TEXT `purchase_warranty_visits.issue` duoi dang cac key noi nhau bang
// dau phay (vd "thay_pin,sua_man_hinh"), khong can migration schema rieng.
const WARRANTY_ISSUE_TYPES = [
  { key: 'thay_pin', label: 'Thay Pin' },
  { key: 'thay_man_hinh', label: 'Thay màn hình' },
  { key: 'sua_man_hinh', label: 'Sửa màn hình' },
  { key: 'sua_may', label: 'Sửa máy' },
  { key: 'sua_vo_may', label: 'Sửa vỏ máy' },
  { key: 'bao_hanh_phan_cung', label: 'Bảo hành phần cứng' },
  { key: 'bao_hanh_phan_mem', label: 'Bảo hành phần mềm' }
];

const WARRANTY_ISSUE_KEYS = WARRANTY_ISSUE_TYPES.map((t) => t.key);

// req.body.issue tu 1 nhom checkbox cung name="issue": Express/body-parser
// tra ve 1 string neu chi tick 1 o, 1 mang neu tick >=2 o, va undefined neu
// khong tick o nao -- ham nay chuan hoa ca 3 truong hop thanh 1 mang cac key
// hop le (bo qua key la nhung khong nam trong danh sach co dinh o tren).
function issueKeysFromBody(body) {
  const raw = body.issue;
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return arr.filter((k) => WARRANTY_ISSUE_KEYS.includes(k));
}

function warrantyIssueLabel(csv) {
  if (!csv) return '';
  return csv
    .split(',')
    .map((key) => {
      const found = WARRANTY_ISSUE_TYPES.find((t) => t.key === key.trim());
      return found ? found.label : key.trim();
    })
    .filter(Boolean)
    .join(', ');
}

module.exports = { WARRANTY_ISSUE_TYPES, WARRANTY_ISSUE_KEYS, issueKeysFromBody, warrantyIssueLabel };
