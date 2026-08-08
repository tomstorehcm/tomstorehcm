(function () {
  'use strict';

  // Mobile category menu toggle
  var menuToggle = document.getElementById('menuToggle');
  var categoryNav = document.getElementById('categoryNav');
  if (menuToggle && categoryNav) {
    menuToggle.addEventListener('click', function () {
      var isOpen = categoryNav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
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

  // Product gallery thumbnail swap
  var galleryThumbs = document.querySelectorAll('.gallery-thumb');
  var galleryMainImg = document.getElementById('galleryMainImg');
  if (galleryThumbs.length > 0 && galleryMainImg) {
    galleryThumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        galleryMainImg.src = thumb.getAttribute('data-src');
        galleryThumbs.forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
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
      track.style.transform = 'translateX(-' + current * 100 + '%)';
      dots.forEach(function (dot, i) {
        dot.classList.toggle('active', i === current);
      });
    }

    function startAutoplay() {
      stopAutoplay();
      autoplayTimer = setInterval(function () {
        goTo(current + 1);
      }, 5000);
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

    if (slides.length > 1) {
      startAutoplay();
    }
  }
})();
