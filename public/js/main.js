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

  // Product detail gallery: track-based slider (drag-follows-finger on touch)
  // plus arrows/thumbnails. onGallerySlideChange (wired up by the variant/color
  // picker below) keeps price + color selection in sync with whichever photo
  // is showing, however the customer got there.
  var galleryMain = document.getElementById('galleryMain');
  var galleryTrack = document.getElementById('galleryTrack');
  var gallerySlides = galleryTrack ? galleryTrack.querySelectorAll('.gallery-slide') : [];
  var galleryThumbs = document.querySelectorAll('.gallery-thumb');
  var galleryCurrent = 0;
  var onGallerySlideChange = null;

  function galleryGoTo(index) {
    if (!gallerySlides.length) return;
    galleryCurrent = (index + gallerySlides.length) % gallerySlides.length;
    if (galleryTrack) galleryTrack.style.transform = 'translateX(-' + (galleryCurrent * 100) + '%)';
    galleryThumbs.forEach(function (thumb, i) {
      thumb.classList.toggle('active', i === galleryCurrent);
    });
    var activeThumb = galleryThumbs[galleryCurrent];
    if (activeThumb && activeThumb.scrollIntoView) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    if (onGallerySlideChange) onGallerySlideChange(galleryCurrent);
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

    // Drag-follows-finger swipe: the track tracks the finger while dragging,
    // then snaps to the next/prev slide or springs back on release.
    // preventDefault() only fires once the gesture is confirmed horizontal,
    // so vertical page scrolling still works normally.
    var dragStartX = 0;
    var dragStartY = 0;
    var dragDeltaX = 0;
    var dragAxis = null;

    galleryMain.addEventListener('touchstart', function (e) {
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragDeltaX = 0;
      dragAxis = null;
      if (galleryTrack) galleryTrack.classList.add('is-dragging');
    }, { passive: true });

    galleryMain.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].clientX - dragStartX;
      var dy = e.touches[0].clientY - dragStartY;
      if (dragAxis === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        dragAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (dragAxis !== 'x') return;
      e.preventDefault();
      dragDeltaX = dx;
      if (galleryTrack) {
        var percent = (dx / galleryMain.offsetWidth) * 100;
        galleryTrack.style.transform = 'translateX(calc(-' + (galleryCurrent * 100) + '% + ' + percent + '%))';
      }
    }, { passive: false });

    galleryMain.addEventListener('touchend', function () {
      if (galleryTrack) galleryTrack.classList.remove('is-dragging');
      if (dragAxis === 'x') {
        var threshold = galleryMain.offsetWidth * 0.18;
        if (dragDeltaX < -threshold) galleryGoTo(galleryCurrent + 1);
        else if (dragDeltaX > threshold) galleryGoTo(galleryCurrent - 1);
        else galleryGoTo(galleryCurrent);
      }
      dragAxis = null;
      dragDeltaX = 0;
    }, { passive: true });
  }

  // Product detail: storage/capacity variant picker + color picker. Colors can
  // be scoped to a specific variant (own price, only shown for that capacity)
  // or "general" (apply to every capacity, no price of their own). Picking a
  // color jumps the gallery to its photo, and landing on a color's photo any
  // other way (swipe, arrows, thumbnail) updates the picker to match.
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

    // Keeps the full/short label pair (CSS hides one or the other on narrow
    // phone screens) intact when JS updates the add-to-cart button's state.
    function setAddBtnLabel(inStock) {
      if (!pickerAddBtn) return;
      pickerAddBtn.disabled = !inStock;
      pickerAddBtn.innerHTML = inStock
        ? '<span class="btn-text-full">Thêm vào giỏ hàng</span><span class="btn-text-short">Thêm vào giỏ</span>'
        : 'Hết hàng';
    }

    function jumpGalleryForColor(colorId) {
      if (!galleryMain || colorId == null) return;
      var targetSlide = null;
      gallerySlides.forEach(function (slide) {
        if (targetSlide) return;
        var idsAttr = slide.getAttribute('data-color-ids');
        if (idsAttr && idsAttr.split(',').indexOf(String(colorId)) > -1) targetSlide = slide;
      });
      if (targetSlide) {
        var slideIndex = Array.prototype.indexOf.call(gallerySlides, targetSlide);
        if (slideIndex > -1) galleryGoTo(slideIndex);
      }
    }

    if (variantColorDataEl) {
      var data = JSON.parse(variantColorDataEl.textContent);

      if (data.variantGroups && data.variantGroups.length > 0) {
        // 3-level products (e.g. MacBook screen size, iPad connectivity): a
        // group picker sits above the usual variant(capacity)/color pickers.
        // Both the group's variant list and the color list get rebuilt from
        // scratch on selection, same pattern as renderColorButtons below.
        var groupOptionsWrap = document.getElementById('groupOptionsWrap');
        var variantOptionsWrap = document.getElementById('variantOptionsWrap');
        var activeGroupIndex = 0;
        var activeVariantIndex = 0;
        var activeColorId = null;

        var colorsForVariant = function (variant) {
          return (variant.colors && variant.colors.length > 0) ? variant.colors : data.generalColors;
        };

        var updatePriceAndStock = function () {
          var variant = data.variantGroups[activeGroupIndex].variants[activeVariantIndex];
          var colors = colorsForVariant(variant);
          var color = activeColorId != null ? colors.filter(function (c) { return c.id === activeColorId; })[0] : null;
          var price = (color && color.price != null) ? color.price : variant.price;
          var inStock = variant.inStock && (color ? color.inStock : true);

          if (variantPriceDisplay) variantPriceDisplay.textContent = formatVNDClient(price);
          if (pickerStockText) {
            pickerStockText.textContent = inStock ? 'Còn hàng' : 'Hết hàng';
            pickerStockText.classList.toggle('product-stock-out', !inStock);
          }
          setAddBtnLabel(inStock);
          if (pickerCheckoutBtn) pickerCheckoutBtn.disabled = !inStock;
        };

        var selectColor = function (color, jumpGallery) {
          activeColorId = color.id;
          if (colorOptionsWrap) {
            colorOptionsWrap.querySelectorAll('.color-option').forEach(function (btn) {
              btn.classList.toggle('active', Number(btn.getAttribute('data-color-id')) === color.id);
            });
          }
          if (colorIdInput) colorIdInput.value = color.id;
          if (colorNameDisplay) colorNameDisplay.textContent = color.name;
          updatePriceAndStock();
          if (jumpGallery) jumpGalleryForColor(color.id);
        };

        var renderColorButtons = function (colors) {
          if (!colorOptionsWrap || !colorPickerEl) return;
          colorOptionsWrap.innerHTML = '';
          if (colors.length === 0) {
            colorPickerEl.hidden = true;
            return;
          }
          colorPickerEl.hidden = false;
          colors.forEach(function (c) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-option';
            btn.style.backgroundColor = c.hex;
            btn.title = c.name;
            btn.disabled = !c.inStock;
            btn.setAttribute('data-color-id', c.id);
            btn.addEventListener('click', function () {
              if (btn.disabled) return;
              selectColor(c, true);
            });
            colorOptionsWrap.appendChild(btn);
          });
        };

        var selectVariant = function (variantIndex, opts) {
          opts = opts || {};
          activeVariantIndex = variantIndex;
          if (variantOptionsWrap) {
            variantOptionsWrap.querySelectorAll('.variant-option').forEach(function (btn, i) {
              btn.classList.toggle('active', i === variantIndex);
            });
          }
          var variant = data.variantGroups[activeGroupIndex].variants[variantIndex];
          if (variantIdInput) variantIdInput.value = variant.id;

          var colors = colorsForVariant(variant);
          renderColorButtons(colors);

          var preferred = opts.preferColorId != null ? colors.filter(function (c) { return c.id === opts.preferColorId; })[0] : null;
          var toSelect = preferred || colors[0] || null;
          if (toSelect) {
            selectColor(toSelect, !!opts.jumpGallery);
          } else {
            activeColorId = null;
            if (colorIdInput) colorIdInput.value = '';
            updatePriceAndStock();
          }
        };

        var renderVariantButtons = function (variants, opts) {
          opts = opts || {};
          if (!variantOptionsWrap) return;
          variantOptionsWrap.innerHTML = '';
          variants.forEach(function (v) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'variant-option';
            btn.textContent = v.label;
            btn.disabled = !v.inStock;
            btn.setAttribute('data-variant-id', v.id);
            variantOptionsWrap.appendChild(btn);
          });
          var preferredIndex = opts.preferVariantId != null
            ? variants.findIndex(function (v) { return v.id === opts.preferVariantId; })
            : -1;
          selectVariant(preferredIndex > -1 ? preferredIndex : 0, { jumpGallery: false, preferColorId: opts.preferColorId });
        };

        // Buttons are rebuilt by renderVariantButtons on every group switch, so
        // clicks are delegated on the wrapper instead of bound per-button.
        if (variantOptionsWrap) {
          variantOptionsWrap.addEventListener('click', function (e) {
            var btn = e.target.closest('.variant-option');
            if (!btn || btn.disabled) return;
            var idx = Array.prototype.indexOf.call(variantOptionsWrap.children, btn);
            selectVariant(idx, { jumpGallery: true });
          });
        }

        var selectGroup = function (groupIndex, opts) {
          activeGroupIndex = groupIndex;
          if (groupOptionsWrap) {
            groupOptionsWrap.querySelectorAll('.variant-option').forEach(function (btn, i) {
              btn.classList.toggle('active', i === groupIndex);
            });
          }
          renderVariantButtons(data.variantGroups[groupIndex].variants, opts);
        };

        // Reverse sync: arriving at a color's photo updates group + capacity +
        // color to match, however far apart they are in the tree.
        onGallerySlideChange = function (slideIndex) {
          var slide = gallerySlides[slideIndex];
          var idsAttr = slide && slide.getAttribute('data-color-ids');
          if (!idsAttr) return;
          var ids = idsAttr.split(',').map(Number);

          var match = null, matchGroupIndex = -1, matchVariantIndex = -1;
          for (var gi = 0; gi < data.variantGroups.length && !match; gi++) {
            var groupVariants = data.variantGroups[gi].variants;
            for (var vi = 0; vi < groupVariants.length; vi++) {
              var found = colorsForVariant(groupVariants[vi]).filter(function (c) { return ids.indexOf(c.id) > -1; })[0];
              if (found) { match = found; matchGroupIndex = gi; matchVariantIndex = vi; break; }
            }
          }
          if (!match) return;
          selectGroup(matchGroupIndex, {
            jumpGallery: false,
            preferVariantId: data.variantGroups[matchGroupIndex].variants[matchVariantIndex].id,
            preferColorId: match.id
          });
        };

        var initialColorId = colorIdInput && colorIdInput.value ? Number(colorIdInput.value) : null;
        var initialVariantId = variantIdInput && variantIdInput.value ? Number(variantIdInput.value) : null;
        var initialGroupIndex = 0;
        if (initialVariantId != null) {
          for (var gi2 = 0; gi2 < data.variantGroups.length; gi2++) {
            if (data.variantGroups[gi2].variants.some(function (v) { return v.id === initialVariantId; })) {
              initialGroupIndex = gi2;
              break;
            }
          }
        }
        selectGroup(initialGroupIndex, { jumpGallery: false, preferVariantId: initialVariantId, preferColorId: initialColorId });

        if (groupOptionsWrap) {
          groupOptionsWrap.querySelectorAll('.variant-option').forEach(function (opt, i) {
            opt.addEventListener('click', function () {
              if (opt.disabled) return;
              selectGroup(i, { jumpGallery: true });
            });
          });
        }
      } else {
        // Flat products: just a variant(capacity)/color picker, no group above it.
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
          setAddBtnLabel(inStock);
          if (pickerCheckoutBtn) pickerCheckoutBtn.disabled = !inStock;
        };

        var selectColor = function (color, jumpGallery) {
          activeColorId = color.id;
          if (colorOptionsWrap) {
            colorOptionsWrap.querySelectorAll('.color-option').forEach(function (btn) {
              btn.classList.toggle('active', Number(btn.getAttribute('data-color-id')) === color.id);
            });
          }
          if (colorIdInput) colorIdInput.value = color.id;
          if (colorNameDisplay) colorNameDisplay.textContent = color.name;
          updatePriceAndStock();
          if (jumpGallery) jumpGalleryForColor(color.id);
        };

        var renderColorButtons = function (colors) {
          if (!colorOptionsWrap || !colorPickerEl) return;
          colorOptionsWrap.innerHTML = '';
          if (colors.length === 0) {
            colorPickerEl.hidden = true;
            return;
          }
          colorPickerEl.hidden = false;
          colors.forEach(function (c) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-option';
            btn.style.backgroundColor = c.hex;
            btn.title = c.name;
            btn.disabled = !c.inStock;
            btn.setAttribute('data-color-id', c.id);
            btn.addEventListener('click', function () {
              if (btn.disabled) return;
              selectColor(c, true);
            });
            colorOptionsWrap.appendChild(btn);
          });
        };

        var selectVariant = function (index, opts) {
          opts = opts || {};
          activeVariantIndex = index;
          variantOptions.forEach(function (o, i) { o.classList.toggle('active', i === index); });
          if (variantIdInput) variantIdInput.value = data.variants[index].id;

          var colors = colorsForVariant(data.variants[index]);
          renderColorButtons(colors);

          var preferred = opts.preferColorId != null ? colors.filter(function (c) { return c.id === opts.preferColorId; })[0] : null;
          var toSelect = preferred || colors[0] || null;
          if (toSelect) {
            selectColor(toSelect, !!opts.jumpGallery);
          } else {
            activeColorId = null;
            if (colorIdInput) colorIdInput.value = '';
            updatePriceAndStock();
          }
        };

        // Reverse sync: arriving at a color's photo updates the picker to match,
        // switching capacity too if that photo belongs to a different one (e.g.
        // the same White shared across several capacities).
        onGallerySlideChange = function (slideIndex) {
          var slide = gallerySlides[slideIndex];
          var idsAttr = slide && slide.getAttribute('data-color-ids');
          if (!idsAttr) return;
          var ids = idsAttr.split(',').map(Number);

          var currentColors = colorsForVariant(data.variants[activeVariantIndex]);
          var match = currentColors.filter(function (c) { return ids.indexOf(c.id) > -1; })[0];
          var matchVariantIndex = match ? activeVariantIndex : -1;

          if (!match) {
            for (var vi = 0; vi < data.variants.length; vi++) {
              var found = colorsForVariant(data.variants[vi]).filter(function (c) { return ids.indexOf(c.id) > -1; })[0];
              if (found) { match = found; matchVariantIndex = vi; break; }
            }
          }
          if (!match) return;
          selectVariant(matchVariantIndex, { jumpGallery: false, preferColorId: match.id });
        };

        var initialColorId = colorIdInput && colorIdInput.value ? Number(colorIdInput.value) : null;
        selectVariant(0, { jumpGallery: false, preferColorId: initialColorId });

        variantOptions.forEach(function (opt, i) {
          opt.addEventListener('click', function () {
            if (opt.disabled) return;
            selectVariant(i, { jumpGallery: true });
          });
        });
      }
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
        setAddBtnLabel(colorInStock);
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

      onGallerySlideChange = function (slideIndex) {
        var slide = gallerySlides[slideIndex];
        var idsAttr = slide && slide.getAttribute('data-color-ids');
        if (!idsAttr) return;
        var ids = idsAttr.split(',');
        var match = Array.prototype.filter.call(colorOptions, function (o) {
          return ids.indexOf(o.getAttribute('data-color-id')) > -1;
        })[0];
        if (match && !match.disabled) match.click();
      };
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

  // Category tiles slider (only rendered once there are more than 4
  // categories) -- plain native scroll, arrows just nudge it by one "page".
  var categorySlider = document.getElementById('categoryTilesSlider');
  var categoryPrev = document.getElementById('categoryPrev');
  var categoryNext = document.getElementById('categoryNext');
  if (categorySlider && categoryPrev && categoryNext) {
    categoryPrev.addEventListener('click', function () {
      categorySlider.scrollBy({ left: -categorySlider.clientWidth * 0.9, behavior: 'smooth' });
    });
    categoryNext.addEventListener('click', function () {
      categorySlider.scrollBy({ left: categorySlider.clientWidth * 0.9, behavior: 'smooth' });
    });
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

  // Product detail page: "Thêm vào giỏ hàng" stays on page (AJAX). "Đặt hàng ngay"
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
