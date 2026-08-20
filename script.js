document.addEventListener('DOMContentLoaded', () => {
  // Navigation Mobile Toggle
  const menuBtn = document.getElementById('menuBtn');
  const navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      const open = navLinks.style.display === 'block';
      navLinks.style.display = open ? 'none' : 'block';
      if (!open) {
        navLinks.querySelector('ul').style.cssText = 'display:flex;flex-direction:column;gap:18px;position:fixed;top:76px;left:0;right:0;background:var(--paper);padding:26px 32px;border-bottom:1px solid var(--line);';
      }
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      if (window.innerWidth <= 900) { navLinks.style.display = 'none'; }
    }));
  }

  // History Toggle Logic
  const moreBtn = document.getElementById('moreToggle');
  const olderJobs = document.getElementById('olderJobs');
  if (moreBtn && olderJobs) {
    moreBtn.addEventListener('click', () => {
      const items = olderJobs.querySelectorAll('.job-hidden');
      const isShown = items[0].classList.contains('show');
      items.forEach(i => i.classList.toggle('show'));
      
      const isEn = document.documentElement.lang === 'en';
      if (isShown) {
        moreBtn.textContent = isEn ? 'Show full history (+5 positions)' : 'Vezi tot istoricul (+5 poziții)';
      } else {
        moreBtn.textContent = isEn ? 'Hide older history' : 'Ascunde istoricul vechi';
      }
    });
  }

  // Gallery Filter
  const filterBtns = document.querySelectorAll('.filter-btn');
  const sheetItems = document.querySelectorAll('#sheetGrid .sheet-item');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      sheetItems.forEach(item => {
        const show = f === 'all' || item.dataset.cat === f;
        item.classList.toggle('filtered-out', !show);
      });
    });
  });

  // Lightbox Modal Logic
  const lightbox = document.getElementById('lightbox');
  const lightboxBody = document.getElementById('lightbox-body');
  const lightboxClose = document.querySelector('.lightbox-close');
  const lightboxOverlay = document.querySelector('.lightbox-overlay');
  const btnPrev = document.querySelector('.lightbox-prev');
  const btnNext = document.querySelector('.lightbox-next');

  let currentIndex = 0;

  function getVisibleItems() {
    return Array.from(document.querySelectorAll('.sheet-item')).filter(item => {
      return getComputedStyle(item).display !== 'none';
    });
  }

  function showItem(index) {
    const visibleItems = getVisibleItems();
    if (visibleItems.length === 0) return;

    currentIndex = (index + visibleItems.length) % visibleItems.length;
    const currentItem = visibleItems[currentIndex];
    const type = currentItem.getAttribute('data-type');

    lightboxBody.innerHTML = '';

    if (type === 'video') {
      const videoId = currentItem.getAttribute('data-video');
      lightboxBody.innerHTML = `
        <div class="lightbox-video">
          <iframe 
            src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen>
          </iframe>
        </div>`;
    } else {
      const imgSrc = currentItem.querySelector('img').src;
      lightboxBody.innerHTML = `<img src="${imgSrc}" class="lightbox-img" alt="Enlarged view">`;
    }
  }

  document.querySelectorAll('.sheet-item').forEach(item => {
    item.addEventListener('click', () => {
      const visibleItems = getVisibleItems();
      currentIndex = visibleItems.indexOf(item);
      if (currentIndex !== -1) {
        showItem(currentIndex);
        lightbox.classList.add('active');
      }
    });
  });

  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      showItem(currentIndex + 1);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      showItem(currentIndex - 1);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'ArrowRight') showItem(currentIndex + 1);
    if (e.key === 'ArrowLeft') showItem(currentIndex - 1);
    if (e.key === 'Escape') closeLightbox();
  });

  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.remove('active');
      lightboxBody.innerHTML = '';
    }
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxOverlay) lightboxOverlay.addEventListener('click', closeLightbox);
});