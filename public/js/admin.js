(function () {
  'use strict';

  // VNĐ price/cost inputs trong admin ("Giá đã bán", "Chi phí"...): hiện dấu
  // "." ngăn cách hàng nghìn khi gõ (5000000 -> 5.000.000), giống hệt logic
  // .vnd-input o public/js/main.js -- nhung main.js chi duoc load o cac trang
  // public, khong load o admin, nen phai co ban rieng nay cho admin. Input
  // van la type="text" de giu duoc dau cham; server tu strip ky tu khong
  // phai so truoc khi luu (xem purchaseFieldsFromBody / cac validator gia).
  document.querySelectorAll('.vnd-input').forEach(function (input) {
    function formatValue() {
      var digits = input.value.replace(/[^\d]/g, '');
      input.value = digits ? Number(digits).toLocaleString('vi-VN') : '';
    }
    formatValue();
    input.addEventListener('input', formatValue);
  });
})();
