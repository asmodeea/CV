document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const MOBILE = '(max-width: 900px)';

  /* ---------- Meniu mobil ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const navLinks = document.getElementById('navLinks');

  function setMenu(open) {
    if (!menuBtn || !header) return;
    header.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? menuBtn.dataset.labelClose : menuBtn.dataset.labelOpen);
  }

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => setMenu(!header.classList.contains('nav-open')));
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('click', e => {
      if (header.classList.contains('nav-open') && !header.contains(e.target)) setMenu(false);
    });
    window.matchMedia(MOBILE).addEventListener('change', e => { if (!e.matches) setMenu(false); });
  }

  /* ---------- Istoric experiență ---------- */
  const moreBtn = document.getElementById('moreToggle');
  const olderJobs = document.getElementById('olderJobs');
  if (moreBtn && olderJobs) {
    moreBtn.addEventListener('click', () => {
      const expanded = moreBtn.getAttribute('aria-expanded') === 'true';
      olderJobs.querySelectorAll('.job-hidden').forEach(j => j.classList.toggle('show', !expanded));
      moreBtn.setAttribute('aria-expanded', String(!expanded));
      moreBtn.textContent = expanded ? moreBtn.dataset.labelShow : moreBtn.dataset.labelHide;
    });
  }

  /* ---------- Filtre galerie ---------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const sheetItems = document.querySelectorAll('#sheetGrid .sheet-item');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const f = btn.dataset.filter;
      sheetItems.forEach(item => {
        item.classList.toggle('filtered-out', !(f === 'all' || item.dataset.cat === f));
      });
    });
  });

  /* ---------- Lightbox ---------- */
  const lightbox = document.getElementById('lightbox');
  const body = document.getElementById('lightbox-body');
  const content = lightbox && lightbox.querySelector('.lightbox-content');
  const closeBtn = lightbox && lightbox.querySelector('.lightbox-close');
  const overlay = lightbox && lightbox.querySelector('.lightbox-overlay');
  const prevBtn = lightbox && lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox && lightbox.querySelector('.lightbox-next');
  if (!lightbox) return;

  let current = 0;
  let lastFocus = null;

  const visibleItems = () => Array.from(sheetItems).filter(i => !i.classList.contains('filtered-out'));
  const isOpen = () => lightbox.classList.contains('active');

  function render(index) {
    const items = visibleItems();
    if (!items.length) return;
    current = (index + items.length) % items.length;
    const item = items[current];
    const thumb = item.querySelector('img');
    const label = thumb ? thumb.alt : '';
    body.replaceChildren();

    if (item.dataset.type === 'video') {
      const wrap = document.createElement('div');
      wrap.className = 'lightbox-video';
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.dataset.video)}?autoplay=1&modestbranding=1&rel=0`;
      frame.title = label;
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      wrap.appendChild(frame);
      body.appendChild(wrap);
    } else {
      const big = document.createElement('img');
      big.className = 'lightbox-img';
      big.src = thumb.currentSrc || thumb.src;
      big.alt = label;
      body.appendChild(big);
    }
  }

  function open(item) {
    const index = visibleItems().indexOf(item);
    if (index === -1) return;
    lastFocus = document.activeElement;
    render(index);
    lightbox.classList.add('active');
    document.body.classList.add('lightbox-open');
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('active');
    document.body.classList.remove('lightbox-open');
    body.replaceChildren(); // oprește video-ul
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  sheetItems.forEach(item => item.addEventListener('click', () => open(item)));
  nextBtn.addEventListener('click', e => { e.stopPropagation(); render(current + 1); });
  prevBtn.addEventListener('click', e => { e.stopPropagation(); render(current - 1); });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (isOpen()) close();
      else if (header && header.classList.contains('nav-open')) { setMenu(false); menuBtn.focus(); }
      return;
    }
    if (!isOpen()) return;
    if (e.key === 'ArrowRight') render(current + 1);
    if (e.key === 'ArrowLeft') render(current - 1);
    if (e.key === 'Tab') { // focus rămâne în lightbox
      const f = [closeBtn, prevBtn, nextBtn];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  });

  /* swipe pe touch */
  let startX = 0, startY = 0;
  content.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].clientX;
    startY = e.changedTouches[0].clientY;
  }, { passive: true });
  content.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) render(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
});
