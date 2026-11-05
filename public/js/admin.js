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

  // Them nut cuon ngang (trai/phai) cho MOI bang ".admin-table-scroll" trong
  // toan bo trang admin -- bang van giu nguyen do rong tu nhien (khong bop
  // cot/xuong dong nhu truoc, xem white-space:nowrap o style.css), khi man
  // hinh/cua so hep hon noi dung se hien 2 nut mui ten de cuon thay vi chi
  // dua vao thanh cuon ngang (kho bam tren laptop/touchpad).
  document.querySelectorAll('.admin-table-scroll').forEach(function (scrollEl) {
    var wrapper = document.createElement('div');
    wrapper.className = 'admin-table-scroll-wrap';
    scrollEl.parentNode.insertBefore(wrapper, scrollEl);
    wrapper.appendChild(scrollEl);

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'admin-table-scroll-btn admin-table-scroll-btn-prev';
    prevBtn.setAttribute('aria-label', 'Cuộn sang trái');
    prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'admin-table-scroll-btn admin-table-scroll-btn-next';
    nextBtn.setAttribute('aria-label', 'Cuộn sang phải');
    nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    wrapper.appendChild(prevBtn);
    wrapper.appendChild(nextBtn);
    prevBtn.hidden = true;
    nextBtn.hidden = true;

    function refresh() {
      var canScroll = scrollEl.scrollWidth - scrollEl.clientWidth > 4;
      prevBtn.hidden = !canScroll || scrollEl.scrollLeft <= 4;
      nextBtn.hidden = !canScroll || scrollEl.scrollLeft >= scrollEl.scrollWidth - scrollEl.clientWidth - 4;
    }

    prevBtn.addEventListener('click', function () {
      scrollEl.scrollBy({ left: -scrollEl.clientWidth * 0.7, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', function () {
      scrollEl.scrollBy({ left: scrollEl.clientWidth * 0.7, behavior: 'smooth' });
    });
    scrollEl.addEventListener('scroll', refresh);
    window.addEventListener('resize', refresh);
    setTimeout(refresh, 50);
  });

  // Drawer sidebar admin tren mobile (nut hamburger) -- cung ngon ngu voi
  // drawer danh muc cong khai (category-nav, xem header.ejs + main.js) nhung
  // viet rieng o day vi main.js khong duoc load o trang admin. Nut
  // "#adminMenuToggle" duoc sidebar.ejs render lam anh em cua ".admin-sidebar"
  // (khong nam ben trong no) roi CHUYEN vao dau ".admin-main" o day -- xem
  // ghi chu chi tiet tai sao trong style.css (".admin-menu-toggle"): dat nut
  // ben trong .admin-sidebar se bi "transform" cua chinh no (dung de truot
  // an/hien tren mobile) keo theo, khong con dung yen tren man hinh duoc.
  (function () {
    var toggle = document.getElementById('adminMenuToggle');
    var sidebar = document.querySelector('.admin-sidebar');
    var closeBtn = document.getElementById('adminSidebarClose');
    var backdrop = document.getElementById('adminSidebarBackdrop');
    var main = document.querySelector('.admin-main');
    if (!toggle || !sidebar) return;

    if (main) main.insertBefore(toggle, main.firstChild);

    function openMenu() {
      document.body.classList.add('admin-nav-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      document.body.classList.remove('admin-nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      if (document.body.classList.contains('admin-nav-open')) closeMenu();
      else openMenu();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (backdrop) backdrop.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  })();
})();
