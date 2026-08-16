(function () {
  'use strict';

  // Mobile category menu toggle (slide-in drawer from the right)
  var menuToggle = document.getElementById('menuToggle');
  var categoryNav = document.getElementById('categoryNav');
  var navBackdrop = document.getElementById('navBackdrop');
  var navCloseBtn = document.getElementById('navCloseBtn');

  function openMenu() {
    categoryNav.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
  }

  function closeMenu() {
    categoryNav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }

  if (menuToggle && categoryNav) {
    menuToggle.addEventListener('click', function () {
      if (categoryNav.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
    if (navBackdrop) navBackdrop.addEventListener('click', closeMenu);
    if (navCloseBtn) navCloseBtn.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // Hot deal countdown timers
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function updateTimers() {
    var cards = document.querySelectorAll('.hotdeal-card[data-expires]');
    cards.forEach(function (card) {
      var expiresAt = new Date(card.getAttribute('data-expires')).getTime();
      var timerEl = card.querySelector('.hotdeal-timer');
      var textEl = card.querySelector('.timer-text');
      if (!timerEl || !textEl) return;

      var diff = expiresAt - Date.now();
      if (diff <= 0) {
        timerEl.classList.add('expired');
        textEl.textContent = 'Đã hết deal';
        card.classList.add('is-expired');
        return;
      }

      var hours = Math.floor(diff / (1000 * 60 * 60));
      var minutes = Math.floor((diff / (1000 * 60)) % 60);
      var seconds = Math.floor((diff / 1000) % 60);
      textEl.textContent = pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    });
  }

  if (document.querySelector('.hotdeal-card[data-expires]')) {
    updateTimers();
    setInterval(updateTimers, 1000);
  }

  // Product detail gallery: arrows + thumbnails, same crossfade/zoom style as the hero banner
  var galleryMain = document.getElementById('galleryMain');
  var gallerySlides = galleryMain ? galleryMain.querySelectorAll('.gallery-slide') : [];
  if (gallerySlides.length > 1) {
    var galleryThumbs = document.querySelectorAll('.gallery-thumb');
    var galleryPrev = document.getElementById('galleryPrev');
    var galleryNext = document.getElementById('galleryNext');
    var galleryCurrent = 0;

    function galleryGoTo(index) {
      galleryCurrent = (index + gallerySlides.length) % gallerySlides.length;
      gallerySlides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === galleryCurrent);
      });
      galleryThumbs.forEach(function (thumb, i) {
        thumb.classList.toggle('active', i === galleryCurrent);
      });
    }

    if (galleryNext) galleryNext.addEventListener('click', function () { galleryGoTo(galleryCurrent + 1); });
    if (galleryPrev) galleryPrev.addEventListener('click', function () { galleryGoTo(galleryCurrent - 1); });
    galleryThumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        galleryGoTo(Number(thumb.getAttribute('data-index')));
      });
    });

    // Swipe left/right on touch devices
    var galleryTouchStartX = null;
    var galleryTouchStartY = null;
    galleryMain.addEventListener('touchstart', function (e) {
      galleryTouchStartX = e.touches[0].clientX;
      galleryTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    galleryMain.addEventListener('touchend', function (e) {
      if (galleryTouchStartX === null) return;
      var dx = e.changedTouches[0].clientX - galleryTouchStartX;
      var dy = e.changedTouches[0].clientY - galleryTouchStartY;
      galleryTouchStartX = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      galleryGoTo(dx < 0 ? galleryCurrent + 1 : galleryCurrent - 1);
    }, { passive: true });
  }

  // Product detail: storage/capacity variant picker
  var variantOptions = document.querySelectorAll('.variant-option');
  if (variantOptions.length) {
    var variantIdInput = document.getElementById('variantIdInput');
    var variantPriceDisplay = document.getElementById('variantPriceDisplay');
    var variantQtyInput = document.getElementById('quantity');
    var variantStockText = document.getElementById('productStockText');
    var variantAddBtn = document.querySelector('.product-detail-cta-row button[value="add"]');
    var variantCheckoutBtn = document.querySelector('.product-detail-cta-row button[value="checkout"]');
    var vndFormatter = window.Intl ? new Intl.NumberFormat('vi-VN') : null;

    function formatVNDClient(amount) {
      return (vndFormatter ? vndFormatter.format(amount) : String(amount)) + '₫';
    }

    variantOptions.forEach(function (opt) {
      opt.addEventListener('click', function () {
        if (opt.disabled) return;
        variantOptions.forEach(function (o) { o.classList.remove('active'); });
        opt.classList.add('active');

        var price = Number(opt.getAttribute('data-price'));
        var stock = Number(opt.getAttribute('data-stock'));
        var inStock = stock > 0;

        if (variantIdInput) variantIdInput.value = opt.getAttribute('data-variant-id');
        if (variantPriceDisplay) variantPriceDisplay.textContent = formatVNDClient(price);
        if (variantQtyInput) {
          variantQtyInput.max = Math.max(stock, 1);
          if (Number(variantQtyInput.value) > stock) variantQtyInput.value = Math.max(stock, 1);
        }
        if (variantStockText) {
          variantStockText.textContent = inStock ? 'Còn hàng' : 'Hết hàng';
          variantStockText.classList.toggle('product-stock-out', !inStock);
        }
        if (variantAddBtn) {
          variantAddBtn.disabled = !inStock;
          variantAddBtn.textContent = inStock ? 'Thêm vào giỏ hàng' : 'Hết hàng';
        }
        if (variantCheckoutBtn) variantCheckoutBtn.disabled = !inStock;
      });
    });
  }

  // Hero banner slider
  var track = document.getElementById('heroSliderTrack');
  if (track) {
    var slides = track.children;
    var dotsWrap = document.getElementById('heroDots');
    var dots = dotsWrap ? dotsWrap.querySelectorAll('button') : [];
    var prevBtn = document.getElementById('heroPrev');
    var nextBtn = document.getElementById('heroNext');
    var current = 0;
    var autoplayTimer;

    function goTo(index) {
      current = (index + slides.length) % slides.length;
      dots.forEach(function (dot, i) {
        dot.classList.toggle('active', i === current);
      });
      Array.prototype.forEach.call(slides, function (slide, i) {
        slide.classList.toggle('is-active', i === current);
      });
    }

    function startAutoplay() {
      stopAutoplay();
      autoplayTimer = setInterval(function () {
        goTo(current + 1);
      }, 6000);
    }

    function stopAutoplay() {
      if (autoplayTimer) clearInterval(autoplayTimer);
    }

    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); startAutoplay(); });
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); startAutoplay(); });
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        goTo(Number(dot.getAttribute('data-index')));
        startAutoplay();
      });
    });

    // Swipe left/right to change slide on touch devices
    var touchStartX = null;
    var touchStartY = null;
    track.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) {
        goTo(current + 1);
      } else {
        goTo(current - 1);
      }
      startAutoplay();
    }, { passive: true });

    goTo(0);
    if (slides.length > 1) {
      startAutoplay();
    }
  }

  // Hero banner: shrinks and darkens as the user scrolls down past it
  var heroWrap = document.getElementById('heroWrap');
  var heroSlider = document.getElementById('heroSlider');
  var heroOverlay = document.getElementById('heroOverlay');
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (heroWrap && heroSlider && heroOverlay && !reducedMotion) {
    var heroTicking = false;

    function updateHeroScrollEffect() {
      var rect = heroWrap.getBoundingClientRect();
      var progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);
      var scale = 1 - progress * 0.12;
      heroSlider.style.transform = 'scale(' + scale + ')';
      heroOverlay.style.opacity = progress * 0.6;
      heroTicking = false;
    }

    window.addEventListener(
      'scroll',
      function () {
        if (!heroTicking) {
          window.requestAnimationFrame(updateHeroScrollEffect);
          heroTicking = true;
        }
      },
      { passive: true }
    );

    updateHeroScrollEffect();
  }

  // Footer: columns fade + slide up, staggered, the first time they scroll into view
  var footerCols = document.querySelectorAll('.footer-col');
  if (footerCols.length) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      footerCols.forEach(function (col) { col.classList.add('is-visible'); });
    } else {
      var footerObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      footerCols.forEach(function (col) { footerObserver.observe(col); });
    }
  }

  // ===== Cart: add/update/remove without a full page reload =====
  function updateCartBadge(count) {
    var cartLink = document.querySelector('.cart-link');
    if (!cartLink) return;
    var badge = cartLink.querySelector('.cart-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        cartLink.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  var cartToastTimer;
  function showCartToast(message) {
    var toast = document.getElementById('cartToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cartToast';
      toast.className = 'cart-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(cartToastTimer);
    cartToastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function postForm(action, formData) {
    // These cart routes read application/x-www-form-urlencoded bodies (no multer
    // attached), so re-encode the FormData instead of sending it as multipart.
    var params = new URLSearchParams();
    formData.forEach(function (value, key) { params.append(key, value); });
    return fetch(action, {
      method: 'POST',
      body: params,
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }).then(function (res) { return res.json(); });
  }

  // Add-to-cart forms on product cards / hot deal cards: no navigation, just badge + toast
  document.querySelectorAll('.add-to-cart-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      postForm(form.action, new FormData(form)).then(function (data) {
        if (data.success) {
          updateCartBadge(data.cartCount);
          showCartToast('Đã thêm vào giỏ hàng');
        }
      });
    });
  });

  // Product detail page: "Thêm vào giỏ hàng" stays on page, "Thanh toán ngay" adds then goes to checkout
  var productDetailCartForm = document.getElementById('productDetailCartForm');
  if (productDetailCartForm) {
    productDetailCartForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var isCheckout = e.submitter && e.submitter.value === 'checkout';
      postForm(productDetailCartForm.action, new FormData(productDetailCartForm)).then(function (data) {
        if (!data.success) return;
        if (isCheckout) {
          window.location.href = '/thanh-toan';
        } else {
          updateCartBadge(data.cartCount);
          showCartToast('Đã thêm vào giỏ hàng');
        }
      });
    });
  }

  // Cart page: update quantity / remove item without reloading, and without
  // the footer snapping into place when the cart empties out.
  function renderEmptyCart() {
    var cartContent = document.getElementById('cartContent');
    var template = document.getElementById('cartEmptyTemplate');
    if (!cartContent || !template) { window.location.reload(); return; }
    cartContent.classList.add('is-fading');
    setTimeout(function () {
      cartContent.innerHTML = template.innerHTML;
      cartContent.classList.remove('is-fading');
    }, 220);
  }

  var qtyForms = document.querySelectorAll('.qty-form');
  qtyForms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      postForm(form.action, new FormData(form)).then(function (data) {
        if (!data.success) return;
        if (data.isEmpty) { renderEmptyCart(); updateCartBadge(data.cartCount); return; }
        var row = form.closest('tr');
        var lineTotalCell = row ? row.querySelector('.cart-line-total') : null;
        if (lineTotalCell) lineTotalCell.textContent = data.formattedLineTotal;
        var summaryTotal = document.getElementById('cartSummaryTotal');
        if (summaryTotal) summaryTotal.textContent = data.formattedTotal;
        updateCartBadge(data.cartCount);
      });
    });
  });

  document.querySelectorAll('.cart-remove-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var row = form.closest('tr');
      postForm(form.action, new FormData(form)).then(function (data) {
        if (!data.success) return;
        if (row) row.classList.add('cart-row-removing');
        setTimeout(function () {
          if (data.isEmpty) {
            renderEmptyCart();
          } else {
            if (row) row.remove();
            var summaryTotal = document.getElementById('cartSummaryTotal');
            if (summaryTotal) summaryTotal.textContent = data.formattedTotal;
          }
          updateCartBadge(data.cartCount);
        }, row ? 200 : 0);
      });
    });
  });
})();
