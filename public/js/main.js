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
  var galleryThumbs = document.querySelectorAll('.gallery-thumb');
  var galleryCurrent = 0;

  function galleryGoTo(index) {
    if (!gallerySlides.length) return;
    galleryCurrent = (index + gallerySlides.length) % gallerySlides.length;
    gallerySlides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === galleryCurrent);
    });
    galleryThumbs.forEach(function (thumb, i) {
      thumb.classList.toggle('active', i === galleryCurrent);
    });
  }

  if (gallerySlides.length > 1) {
    var galleryPrev = document.getElementById('galleryPrev');
    var galleryNext = document.getElementById('galleryNext');

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

  // Product detail: storage/capacity variant picker + color picker. Colors can
  // be scoped to a specific variant (own price, only shown for that capacity)
  // or "general" (apply to every capacity, no price of their own).
  var variantColorDataEl = document.getElementById('variantColorData');
  var variantOptions = document.querySelectorAll('.variant-option');
  var colorPickerEl = document.getElementById('colorPicker');
  var colorOptionsWrap = colorPickerEl ? colorPickerEl.querySelector('.color-options') : null;
  if (variantColorDataEl || variantOptions.length || document.querySelectorAll('.color-option').length) {
    var variantIdInput = document.getElementById('variantIdInput');
    var variantPriceDisplay = document.getElementById('variantPriceDisplay');
    var colorIdInput = document.getElementById('colorIdInput');
    var colorNameDisplay = document.getElementById('colorNameDisplay');
    var pickerStockText = document.getElementById('productStockText');
    var pickerAddBtn = document.querySelector('.product-detail-cta-row button[value="add"]');
    var pickerCheckoutBtn = document.querySelector('.product-detail-cta-row button[value="checkout"]');
    var vndFormatter = window.Intl ? new Intl.NumberFormat('vi-VN') : null;

    function formatVNDClient(amount) {
      return (vndFormatter ? vndFormatter.format(amount) : String(amount)) + '₫';
    }

    function jumpGalleryForColor(colorId) {
      if (!galleryMain || !colorId) return;
      var targetSlide = galleryMain.querySelector('.gallery-slide[data-color-id="' + colorId + '"]');
      if (targetSlide) {
        var slideIndex = Array.prototype.indexOf.call(gallerySlides, targetSlide);
        if (slideIndex > -1) galleryGoTo(slideIndex);
      }
    }

    if (variantColorDataEl) {
      var data = JSON.parse(variantColorDataEl.textContent);
      var activeVariantIndex = 0;
      var activeColorId = null;

      var colorsForVariant = function (variant) {
        return (variant.colors && variant.colors.length > 0) ? variant.colors : data.generalColors;
      };

      var updatePriceAndStock = function () {
        var variant = data.variants[activeVariantIndex];
        var colors = colorsForVariant(variant);
        var color = activeColorId != null ? colors.filter(function (c) { return c.id === activeColorId; })[0] : null;
        var price = (color && color.price != null) ? color.price : variant.price;
        var inStock = variant.inStock && (color ? color.inStock : true);

        if (variantPriceDisplay) variantPriceDisplay.textContent = formatVNDClient(price);
        if (pickerStockText) {
          pickerStockText.textContent = inStock ? 'Còn hàng' : 'Hết hàng';
          pickerStockText.classList.toggle('product-stock-out', !inStock);
        }
        if (pickerAddBtn) {
          pickerAddBtn.disabled = !inStock;
          pickerAddBtn.textContent = inStock ? 'Thêm vào giỏ hàng' : 'Hết hàng';
        }
        if (pickerCheckoutBtn) pickerCheckoutBtn.disabled = !inStock;
      };

      var renderColorOptions = function () {
        var variant = data.variants[activeVariantIndex];
        var colors = colorsForVariant(variant);
        if (!colorOptionsWrap || !colorPickerEl) return;

        colorOptionsWrap.innerHTML = '';
        if (colors.length === 0) {
          colorPickerEl.hidden = true;
          activeColorId = null;
          if (colorIdInput) colorIdInput.value = '';
          return;
        }

        colorPickerEl.hidden = false;
        colors.forEach(function (c, i) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'color-option' + (i === 0 ? ' active' : '');
          btn.style.backgroundColor = c.hex;
          btn.title = c.name;
          btn.disabled = !c.inStock;
          btn.addEventListener('click', function () {
            if (btn.disabled) return;
            colorOptionsWrap.querySelectorAll('.color-option').forEach(function (o) { o.classList.remove('active'); });
            btn.classList.add('active');
            activeColorId = c.id;
            if (colorIdInput) colorIdInput.value = c.id;
            if (colorNameDisplay) colorNameDisplay.textContent = c.name;
            updatePriceAndStock();
            jumpGalleryForColor(c.id);
          });
          colorOptionsWrap.appendChild(btn);
        });

        activeColorId = colors[0].id;
        if (colorIdInput) colorIdInput.value = colors[0].id;
        if (colorNameDisplay) colorNameDisplay.textContent = colors[0].name;
      };

      renderColorOptions();
      updatePriceAndStock();

      variantOptions.forEach(function (opt, i) {
        opt.addEventListener('click', function () {
          if (opt.disabled) return;
          variantOptions.forEach(function (o) { o.classList.remove('active'); });
          opt.classList.add('active');
          activeVariantIndex = i;
          if (variantIdInput) variantIdInput.value = data.variants[i].id;
          renderColorOptions();
          updatePriceAndStock();
        });
      });
    } else {
      // No variants: at most a flat "general colors" picker with no price of
      // its own.
      var colorOptions = document.querySelectorAll('.color-option');
      var colorInStock = colorOptions.length ? colorOptions[0].getAttribute('data-in-stock') === '1' : true;

      var updateSimpleAvailability = function () {
        if (pickerStockText) {
          pickerStockText.textContent = colorInStock ? 'Còn hàng' : 'Hết hàng';
          pickerStockText.classList.toggle('product-stock-out', !colorInStock);
        }
        if (pickerAddBtn) {
          pickerAddBtn.disabled = !colorInStock;
          pickerAddBtn.textContent = colorInStock ? 'Thêm vào giỏ hàng' : 'Hết hàng';
        }
        if (pickerCheckoutBtn) pickerCheckoutBtn.disabled = !colorInStock;
      };

      colorOptions.forEach(function (opt) {
        opt.addEventListener('click', function () {
          if (opt.disabled) return;
          colorOptions.forEach(function (o) { o.classList.remove('active'); });
          opt.classList.add('active');
          colorInStock = opt.getAttribute('data-in-stock') === '1';
          if (colorIdInput) colorIdInput.value = opt.getAttribute('data-color-id');
          if (colorNameDisplay) colorNameDisplay.textContent = opt.getAttribute('data-color-name');
          updateSimpleAvailability();
          jumpGalleryForColor(opt.getAttribute('data-color-id'));
        });
      });
    }
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

  // Product detail page: "Thêm vào giỏ hàng" stays on page (AJAX). "Thanh toán ngay"
  // is a real form submit (via formaction) straight to the buy-now checkout route,
  // so it never touches the persistent cart.
  var productDetailCartForm = document.getElementById('productDetailCartForm');
  if (productDetailCartForm) {
    productDetailCartForm.addEventListener('submit', function (e) {
      var isCheckout = e.submitter && e.submitter.value === 'checkout';
      if (isCheckout) return;
      e.preventDefault();
      postForm(productDetailCartForm.action, new FormData(productDetailCartForm)).then(function (data) {
        if (!data.success) return;
        updateCartBadge(data.cartCount);
        showCartToast('Đã thêm vào giỏ hàng');
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
