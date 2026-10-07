/* ==========================================================
   BASE: meniu, temă, istoric, filtre, lightbox
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const header = document.querySelector('header');
  const MOBILE = '(max-width: 900px)';

  /* ---------- Temă dark / light ---------- */
  const themeBtn = document.getElementById('themeBtn');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const THEME_COLORS = { dark: '#120E18', light: '#E6DDEB' };

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (metaTheme) metaTheme.setAttribute('content', THEME_COLORS[theme]);
    if (themeBtn) {
      themeBtn.setAttribute('aria-label',
        theme === 'dark' ? themeBtn.dataset.labelToLight : themeBtn.dataset.labelToDark);
    }
    if (persist) {
      try { localStorage.setItem('theme', theme); } catch (e) { /* ignorăm */ }
    }
  }

  if (themeBtn) {
    applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);
    themeBtn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.classList.add('theme-switching');
      applyTheme(next, true);
      setTimeout(() => root.classList.remove('theme-switching'), 450);
    });
  }

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
      // anunțăm modulul de mișcare (dacă există) ca să animeze joburile noi
      document.dispatchEvent(new CustomEvent('history:toggle', { detail: { expanded: !expanded } }));
    });
  }

  /* ---------- Filtre galerie ---------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const realItems = Array.from(document.querySelectorAll('#sheetGrid .sheet-item'));
  let onFilter = () => {}; // planșa se reconstruiește la schimbarea filtrului (vezi mai jos)

  // numerotăm automat cadrele, în ordinea din HTML
  realItems.forEach((item, n) => {
    const no = item.querySelector('.frame-no');
    if (no) no.textContent = String(n + 1).padStart(2, '0');
  });

  // ascundem filtrele care nu au nicio lucrare
  filterBtns.forEach(btn => {
    const f = btn.dataset.filter;
    if (f !== 'all' && !realItems.some(i => i.dataset.cat.split(' ').includes(f))) btn.hidden = true;
  });
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const f = btn.dataset.filter;
      realItems.forEach(item => {
        item.classList.toggle('filtered-out', f !== 'all' && !item.dataset.cat.split(' ').includes(f));
      });
      onFilter();
      document.dispatchEvent(new CustomEvent('portfolio:filter'));
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

  const visibleItems = () => realItems.filter(i => !i.classList.contains('filtered-out'));
  const isOpen = () => lightbox.classList.contains('active');

  /* ---------- Player video propriu: YouTube IFrame API, fără interfața YouTube ---------- */
  const RO = document.documentElement.lang === 'ro';
  const TXT = RO
    ? { toggle: 'Redare / Pauză', seek: 'Progres', fail: 'Videoclipul nu poate fi redat aici.' }
    : { toggle: 'Play / Pause', seek: 'Progress', fail: "This video can't be played here." };
  let ytReady = null, player = null, tick = 0;

  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytReady) return ytReady;
    ytReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytReady = null; reject(); };
      document.head.appendChild(s);
    });
    return ytReady;
  }

  function destroyPlayer() {
    clearInterval(tick); tick = 0;
    if (player && player.destroy) { try { player.destroy(); } catch (e) { /* ignorăm */ } }
    player = null;
  }

  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function buildVideo(item, label) {
    const box = document.createElement('div');
    box.className = 'vp';
    box.innerHTML =
      '<div class="vp-screen" title="' + label.replace(/"/g, '&quot;') + '"><div id="vp-target"></div><p class="vp-msg" hidden></p></div>' +
      '<div class="vp-bar"><button type="button" class="vp-btn" aria-label="' + TXT.toggle + '"><span class="vp-ico" aria-hidden="true"></span></button>' +
      '<input class="vp-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="' + TXT.seek + '">' +
      '<span class="vp-time">0:00</span></div>';
    const screen = box.querySelector('.vp-screen');
    const btn = box.querySelector('.vp-btn');
    const seek = box.querySelector('.vp-seek');
    const time = box.querySelector('.vp-time');
    const msg = box.querySelector('.vp-msg');
    screen.style.paddingBottom = item.dataset.ratio === '4/3' ? '75%' : '56.25%';
    body.appendChild(box);

    let dragging = false;
    const setPlaying = p => box.classList.toggle('is-playing', p);
    const toggle = () => {
      if (!player || !player.getPlayerState) return;
      player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
    };
    const fail = () => { msg.textContent = TXT.fail; msg.hidden = false; };
    const paint = (t, d) => {
      const p = d > 0 ? Math.min(100, t / d * 100) : 0;
      seek.style.setProperty('--p', p + '%');
      time.textContent = d > 0 ? fmt(t) + ' / ' + fmt(d) : fmt(t);
    };

    btn.addEventListener('click', toggle);
    screen.addEventListener('click', toggle);
    seek.addEventListener('input', () => {
      dragging = true;
      const d = player && player.getDuration ? player.getDuration() : 0;
      paint(d * seek.value / 1000, d);
    });
    seek.addEventListener('change', () => {
      const d = player && player.getDuration ? player.getDuration() : 0;
      if (d > 0) player.seekTo(d * seek.value / 1000, true);
      dragging = false;
    });

    loadYT().then(() => {
      if (!box.isConnected) return; // lightbox-ul s-a închis între timp
      const vars = { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1, cc_load_policy: 0 };
      if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
      player = new YT.Player('vp-target', {
        host: 'https://www.youtube-nocookie.com',
        videoId: item.dataset.video,
        playerVars: vars,
        events: {
          onReady: e => e.target.playVideo(),
          onStateChange: e => {
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) setPlaying(true);
            else if (e.data === S.PAUSED || e.data === S.CUED) setPlaying(false);
            else if (e.data === S.ENDED) { e.target.seekTo(0, true); e.target.pauseVideo(); setPlaying(false); } // ascunde ecranul final YouTube
          },
          onError: fail
        }
      });
      tick = setInterval(() => {
        if (!player || !player.getDuration || dragging) return;
        const d = player.getDuration(), t = player.getCurrentTime();
        if (d > 0) { seek.value = Math.round(t / d * 1000); paint(t, d); }
      }, 250);
    }).catch(fail);
  }

  let page = 0;
  const pagesOf = item => (item.dataset.gallery ? item.dataset.gallery.split(',') : null);

  function render(index, startPage) {
    const items = visibleItems();
    if (!items.length) return;
    current = (index + items.length) % items.length;
    const item = items[current];
    const thumb = item.querySelector('img');
    const label = thumb ? thumb.alt : '';
    const pages = pagesOf(item);
    page = pages ? (startPage === 'last' ? pages.length - 1 : Math.min(startPage || 0, pages.length - 1)) : 0;
    destroyPlayer();
    body.replaceChildren();

    if (item.dataset.type === 'video') {
      buildVideo(item, label);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'lb-scroll' + (item.dataset.tall ? ' is-tall' : '');
    const big = document.createElement('img');
    big.className = 'lightbox-img';
    big.src = pages ? pages[page] : (item.dataset.full || thumb.currentSrc || thumb.src);
    big.alt = label + (pages ? ' (' + (page + 1) + '/' + pages.length + ')' : '');
    // imaginile mici se văd la mărimea lor reală, fără mărire
    if (item.dataset.w) (item.dataset.tall ? wrap : big).style.maxWidth = 'min(100%,' + item.dataset.w + 'px)';
    wrap.appendChild(big);
    body.appendChild(wrap);
    if (pages) {
      const pg = document.createElement('div');
      pg.className = 'lb-pager';
      pg.innerHTML = pages.map((_, i) => '<i class="lb-dot' + (i === page ? ' on' : '') + '"></i>').join('') +
        '<span>' + (page + 1) + ' / ' + pages.length + '</span>';
      body.appendChild(pg);
    }
  }

  // pași: întâi paginile unei galerii, apoi următoarea lucrare
  function step(dir) {
    const item = visibleItems()[current];
    const pages = item && pagesOf(item);
    if (pages) {
      const np = page + dir;
      if (np >= 0 && np < pages.length) { render(current, np); return; }
    }
    render(current + dir, dir < 0 ? 'last' : 0);
  }

  function open(item) {
    const index = visibleItems().indexOf(item);
    if (index === -1) return;
    lastFocus = document.activeElement;
    render(index, 0);
    lightbox.classList.add('active');
    document.body.classList.add('lightbox-open');
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('active');
    document.body.classList.remove('lightbox-open');
    destroyPlayer();
    body.replaceChildren(); // oprește video-ul
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  realItems.forEach(item => item.addEventListener('click', () => open(item)));
  nextBtn.addEventListener('click', e => { e.stopPropagation(); step(1); });
  prevBtn.addEventListener('click', e => { e.stopPropagation(); step(-1); });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (isOpen()) close();
      else if (header && header.classList.contains('nav-open')) { setMenu(false); menuBtn.focus(); }
      return;
    }
    if (!isOpen()) return;
    if (e.key === ' ' && !/^(BUTTON|INPUT)$/.test(document.activeElement.tagName)) {
      const pb = lightbox.querySelector('.vp-btn');
      if (pb) { e.preventDefault(); pb.click(); }
    }
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
    const sc = lightbox.querySelector('.lb-scroll');
    if (sc && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      const d = e.key.startsWith('Page') ? sc.clientHeight * 0.85 : 70;
      sc.scrollBy({ top: /Down/.test(e.key) ? d : -d, behavior: 'smooth' });
    }
    if (e.key === 'Tab') { // focus rămâne în lightbox
      const f = Array.from(lightbox.querySelectorAll('button, input')).filter(el => el.offsetParent !== null);
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  });

  /* swipe pe touch */
  let startX = 0, startY = 0;
  let startOnBar = false;
  content.addEventListener('touchstart', e => {
    startOnBar = !!e.target.closest('.vp-bar');
    startX = e.changedTouches[0].clientX;
    startY = e.changedTouches[0].clientY;
  }, { passive: true });
  content.addEventListener('touchend', e => {
    if (startOnBar) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  }, { passive: true });
  /* ---------- Grilă: buton „Vezi mai multe" ---------- */
  const gridEl = document.getElementById('sheetGrid');
  if (gridEl) {
    const step = () => (window.matchMedia('(max-width: 900px)').matches ? 8 : 20);
   let shown = step();
    const moreWrap = document.createElement('div');
    moreWrap.className = 'grid-more';
    const moreGrid = document.createElement('button');
    moreGrid.type = 'button';
    moreGrid.className = 'btn solid';
    moreWrap.appendChild(moreGrid);
    gridEl.after(moreWrap);
    const applyMore = () => {
      const vis = visibleItems();
      realItems.forEach(i => i.classList.remove('more-hidden'));
      vis.forEach((i, n) => { if (n >= shown) i.classList.add('more-hidden'); });
      const left = Math.max(0, vis.length - shown);
      moreWrap.hidden = left === 0;
      moreGrid.textContent = (RO ? 'Vezi mai multe' : 'See more') + ' (' + left + ')';
    };
    moreGrid.addEventListener('click', () => {
      shown += step();
      applyMore();
      document.dispatchEvent(new CustomEvent('portfolio:more'));
    });
    document.addEventListener('portfolio:filter', () => { shown = step(); applyMore(); });
    applyMore();
  }
  /* ---------- Planșa de lucru orizontală, ciclică ----------
     Lucrările din #sheetGrid (sursa) sunt așezate în 1–3 benzi care se rotesc la infinit.
     Fără JS rămâne grila; „Grilă" din comutator o arată oricând. */
  const port = document.getElementById('portfolio');
  const boardWrap = document.getElementById('boardWrap');
  const board = document.getElementById('board');
  const lanesEl = document.getElementById('boardLanes');
  if (port && boardWrap && board && lanesEl) {
    const vt = document.getElementById('viewToggle');
    const curEl = document.getElementById('boardCur');
    const totEl = document.getElementById('boardTot');
    const GAP = 14, RULER = 96;
    const mqMobile = window.matchMedia('(max-width: 900px)');
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePtr = window.matchMedia('(hover: hover) and (pointer: fine)');
    const pad = n => String(n).padStart(2, '0');
    const mod = (a, n) => ((a % n) + n) % n;

    let lanes = [], pos = -40, tgt = -40, raf = 0, lastT = 0, drag = null;
    let pinned = false, hovering = false, inView = false, lastInteract = 0, suppress = false;
    let built = { n: 0, H: 0, w: 0 };

    const arOf = el => parseFloat(el.style.getPropertyValue('--ar')) || 1.4;

    // pentru puține lucrări (filtre) folosim mai puține benzi, ca să nu se vadă aceleași cadre repetate
    const laneCount = (avail, count) => Math.max(1, Math.min(3, Math.round(avail / (mqMobile.matches ? 190 : 240)), Math.floor(count / 5)));
    const laneH = (avail, n) => Math.min(Math.floor((avail - (n - 1) * GAP) / n), 460);

    function build() {
      lanesEl.replaceChildren();
      lanes = [];
      const list = visibleItems();
      totEl.textContent = pad(realItems.length);
      if (!list.length || !boardWrap.offsetParent) return;
      const avail = lanesEl.clientHeight - 28;
      if (avail < 120) return;
      const n = laneCount(avail, list.length);
      const H = laneH(avail, n);
      const vw = board.clientWidth;
      built = { n, H, w: vw };
      board.style.setProperty('--lane-h', H + 'px');

      // fiecare lucrare merge în banda cea mai scurtă → ordinea se citește în zig-zag
      const groups = Array.from({ length: n }, () => ({ items: [], sum: 0 }));
      list.forEach(item => {
        const g = groups.reduce((m, x) => (x.sum < m.sum ? x : m), groups[0]);
        g.items.push(item);
        g.sum += arOf(item);
      });

      groups.forEach(g => {
        const lane = document.createElement('div');
        lane.className = 'lane';
        const track = document.createElement('div');
        track.className = 'lane-track';
        const set = document.createElement('div');
        set.className = 'lane-set';
        const frames = [], lefts = [];
        let x = 0;
        g.items.forEach(item => {
          const t = item.cloneNode(true);
          t.dataset.oi = realItems.indexOf(item);
         t.classList.remove('filtered-out', 'more-hidden');
          set.appendChild(t);
          lefts.push(x);
          frames.push(parseInt((item.querySelector('.frame-no') || {}).textContent, 10) || 0);
          x += H * arOf(item) + GAP;
        });
        track.appendChild(set);
        lane.appendChild(track);
        lanesEl.appendChild(lane);
        const W = Math.max(x, 1);
        const copies = Math.max(2, Math.ceil(vw / W) + 1);
        for (let c = 1; c < copies; c++) {
          const cl = set.cloneNode(true);
          cl.setAttribute('aria-hidden', 'true');
          cl.querySelectorAll('button').forEach(b => b.setAttribute('tabindex', '-1'));
          track.appendChild(cl);
        }
        lanes.push({ track, W, lefts, frames });
      });
      paint(true);
      board.classList.add('is-ready');
    }

    let lastFrame = -1, lastPaint = NaN;
    function paint(force) {
      if (!force && pos === lastPaint) return;
      lastPaint = pos;
      for (const L of lanes) L.track.style.transform = 'translate3d(' + (-mod(pos, L.W)).toFixed(2) + 'px,0,0)';
      board.style.setProperty('--rx', (-mod(pos, RULER)).toFixed(2) + 'px');
      const L0 = lanes[0];
      if (L0) {
        const x = mod(mod(pos, L0.W) + board.clientWidth / 2, L0.W);
        let i = 0;
        while (i + 1 < L0.lefts.length && L0.lefts[i + 1] <= x) i++;
        if (L0.frames[i] !== lastFrame) { lastFrame = L0.frames[i]; curEl.textContent = pad(lastFrame); }
      }
    }

    function tick(t) {
      raf = 0;
      const dt = Math.min(48, t - lastT || 16);
      lastT = t;
      const reduce = mqReduce.matches;
      if (!drag) {
        const auto = !reduce && !pinned && !hovering && !isOpen() && t - lastInteract > 2500;
        if (auto) tgt += 0.014 * dt; // deriva lentă: ~14 px/s
        pos += (tgt - pos) * Math.min(1, dt * 0.012);
        if (Math.abs(tgt - pos) < 0.05) pos = tgt;
      }
      paint();
      if (inView && !document.hidden && (!reduce || drag || pos !== tgt)) wake();
    }
    function wake() {
      if (raf || document.hidden) return;
      if (!inView && !drag && pos === tgt) return;
      raf = requestAnimationFrame(tick);
    }
    const touch = () => { lastInteract = performance.now(); wake(); };
    const pan = d => { tgt += d; touch(); };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) { lastT = performance.now(); wake(); } }, { threshold: 0.05 }).observe(boardWrap);
    } else { inView = true; }
    document.addEventListener('visibilitychange', wake);

    /* tragere cu mouse / deget (vertical = scroll normal al paginii) */
    board.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      drag = { id: e.pointerId, x0: e.clientX, pos0: pos, moved: false, s: [{ t: e.timeStamp, x: e.clientX }] };
    });
    board.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true;
        board.classList.add('is-drag');
        try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignorăm */ }
      }
      if (!drag.moved) return;
      pos = tgt = drag.pos0 - dx;
      drag.s.push({ t: e.timeStamp, x: e.clientX });
      if (drag.s.length > 8) drag.s.shift();
      touch();
    });
    const endDrag = (e, cancel) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      board.classList.remove('is-drag');
      if (!d.moved) return;
      suppress = true;
      setTimeout(() => { suppress = false; }, 0);
      if (!cancel) {
        const a = d.s[0], b = d.s[d.s.length - 1];
        const dtm = b.t - a.t;
        if (dtm > 0 && e.timeStamp - b.t < 80) tgt = pos - Math.max(-1400, Math.min(1400, ((b.x - a.x) / dtm) * 260)); // inerție
      }
      touch();
    };
    board.addEventListener('pointerup', e => endDrag(e, false));
    board.addEventListener('pointercancel', e => endDrag(e, true));
    board.addEventListener('click', e => {
      if (suppress) { e.preventDefault(); e.stopPropagation(); return; }
      const t = e.target.closest('.sheet-item');
      if (t && realItems[+t.dataset.oi]) open(realItems[+t.dataset.oi]);
    }, true);
    board.addEventListener('dragstart', e => e.preventDefault());

      /* Rotița cu mouse-ul deasupra planșei: planșa se mișcă „normal" (rapid), iar pagina e încetinită.
       Parcurgi planșa treptat și ieși natural din ea, deci nu poți rămâne blocat. */
    const BOARD_GAIN = 5;   // cât se mișcă planșa la fiecare pixel de rotiță (mai mare = mai repede, mai multe ture)
    const PAGE_SHARE = 0.3; // cât din rotiță merge în pagină (mai mic = pagina avansează mai încet)
    board.addEventListener('wheel', e => {
      if (e.ctrlKey || mqReduce.matches || !finePtr.matches) return;
      let dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= window.innerHeight; dy *= window.innerHeight; }
      e.preventDefault();
      if (Math.abs(dx) > Math.abs(dy)) { pan(Math.max(-260, Math.min(260, dx * 1.2))); return; }
      pan(Math.max(-900, Math.min(900, dy * BOARD_GAIN)));
      window.scrollBy({ top: dy * PAGE_SHARE, behavior: 'instant' });
      lastSY = window.scrollY; // scroll-ul făcut de noi nu mai împinge planșa a doua oară
    }, { passive: false });

    /* când pagina e derulată altfel (bară de scroll, tastatură, deget), planșa e împinsă discret lateral */
    let lastSY = window.scrollY;
    window.addEventListener('scroll', () => {
      const d = window.scrollY - lastSY;
      lastSY = window.scrollY;
      if (!d || !inView || port.dataset.view !== 'board' || mqReduce.matches || Math.abs(d) > 400) return;
      tgt += d * 0.6;
      wake();
    }, { passive: true });

    board.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); pan(320); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); pan(-320); }
    });
    // la navigarea cu Tab, cadrul focalizat e adus în ecran
    board.addEventListener('focusin', e => {
      const t = e.target.closest && e.target.closest('.sheet-item');
      if (!t) return;
      const r = t.getBoundingClientRect(), b = board.getBoundingClientRect();
      if (r.left < b.left + 40) pan(r.left - b.left - 40);
      else if (r.right > b.right - 40) pan(r.right - b.right + 40);
    });
    board.addEventListener('scroll', () => { board.scrollLeft = 0; board.scrollTop = 0; });
    document.getElementById('boardPrev').addEventListener('click', () => pan(-board.clientWidth * 0.8));
    document.getElementById('boardNext').addEventListener('click', () => pan(board.clientWidth * 0.8));
    board.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovering = true; });
    board.addEventListener('pointerleave', () => { hovering = false; touch(); });

    /* filtru nou → planșa se reface din lucrările rămase */
    onFilter = () => { pos = tgt = -40; build(); wake(); };

    /* comutator Planșă / Grilă */
    function setView(v) {
      const y0 = vt ? vt.getBoundingClientRect().top : 0;
      port.dataset.view = v;
      if (vt) vt.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      if (v === 'board') { build(); inView = true; wake(); }
      // comutatorul rămâne exact unde era pe ecran (fără salt de pagină)
      if (vt) {
        const dy = vt.getBoundingClientRect().top - y0;
        if (dy) window.scrollTo({ top: window.scrollY + dy, behavior: 'instant' });
         lastSY = window.scrollY;
      }
      document.dispatchEvent(new CustomEvent('portfolio:view', { detail: { view: v } }));
    }
    if (vt) vt.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

    let rz = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        if (port.dataset.view !== 'board') return;
        const avail = lanesEl.clientHeight - 28;
        const n = laneCount(avail, visibleItems().length);
        const H = laneH(avail, n);
        if (n !== built.n || Math.abs(H - built.H) > 12 || board.clientWidth > built.w * 1.15) build();
      }, 200);
    });

    // pornire
    port.classList.add('has-board');
    boardWrap.hidden = false;
    if (vt) vt.hidden = false;
    port.dataset.view = 'board';
    build();
    wake();

    // API pentru modulul de mișcare (fixarea secțiunii la scroll)
    window.portBoard = {
      nudge: d => pan(d),
      setPinned: v => { pinned = v; wake(); },
       isBoard: () => port.dataset.view === 'board',
      period: () => (lanes[0] ? lanes[0].W : 0)
    };
    document.dispatchEvent(new CustomEvent('portboard:ready'));
  }
});

/* ==========================================================
   MIȘCARE: GSAP + ScrollTrigger
   - dacă GSAP nu se încarcă sau utilizatorul preferă mișcare redusă,
     clasa .js se scoate și pagina rămâne statică, complet vizibilă
   ========================================================== */
(function () {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce || !window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => gsap.utils.toArray(s, c);

  /* ---------- Bară de progres la scroll ---------- */
  gsap.to('.progress', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.2 }
  });

  /* ---------- Elemente care se rotesc la scroll ---------- */
  gsap.to('.hero .s1 svg', {
    rotation: 200, ease: 'none', transformOrigin: '50% 50%',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.6 }
  });
  gsap.to('.logo .mark', {
    rotation: '+=360', ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.6 }
  });
  gsap.fromTo('.contact-reticle svg', { rotation: -40 }, {
    rotation: 140, ease: 'none', transformOrigin: '50% 50%',
    scrollTrigger: { trigger: '.contact-wrap', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 }
  });

  /* ---------- HERO ---------- */
  const h1 = $('.hero h1');
  if (h1) {
    // împărțim fiecare cuvânt în litere; literele urcă din spatele „măștii" cuvântului
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
    h1.querySelectorAll('.w').forEach(word => {
      const text = word.textContent;
      word.setAttribute('aria-hidden', 'true');
      word.textContent = '';
      Array.from(text).forEach(c => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        word.appendChild(s);
      });
    });
  }

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .set('.hero h1', { autoAlpha: 1 })
    .from('.hero h1 .ch', { yPercent: 115, duration: 0.9, stagger: 0.045 }, 0.1)
    .from('.hero-portrait .cm', { scale: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(2.2)' }, 0.1)
    .from('.hero-portrait .plate.p1', { x: 70, y: -60, rotate: -5, opacity: 0, duration: 1.2 }, 0.15)
    .from('.hero-portrait .plate.p2', { x: -70, y: 60, rotate: 5, opacity: 0, duration: 1.2 }, 0.25)
    .from('.portrait-img', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'power4.inOut' }, 0.2)
    .to('.hero [data-hero]', { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 0.5)
    .from('.hero-shapes span', { scale: 0, opacity: 0, duration: 1, stagger: 0.08 }, 0.3)
    .from('.stamp', { scale: 2.4, opacity: 0, rotate: -35, duration: 0.45, ease: 'power4.in' }, 1.15);

  // formele din fundal se mișcă mai lent decât pagina (parallax)
  $$('.hero-shapes span').forEach((el, i) => {
    gsap.to(el, {
      yPercent: (i % 2 ? -1 : 1) * (28 + i * 7),
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  });

  // plăcile de culoare reacționează discret la mouse, ca o decalare de tipar
  const hero = $('.hero');
  if (finePointer && hero) {
    const plates = [
      { sel: '.plate.p1', dir: 1 },
      { sel: '.plate.p2', dir: -1 }
    ].map(p => {
      const el = $(p.sel);
      return {
        dir: p.dir,
        x: gsap.quickTo(el, 'xPercent', { duration: 0.8, ease: 'power3' }),
        y: gsap.quickTo(el, 'yPercent', { duration: 0.8, ease: 'power3' })
      };
    });
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      plates.forEach(p => { p.x(nx * 6 * p.dir); p.y(ny * 6 * p.dir); });
    });
    hero.addEventListener('pointerleave', () => plates.forEach(p => { p.x(0); p.y(0); }));
  }

  /* ---------- Marquee: accelerează când derulezi repede ---------- */
  const track = $('.marquee-track');
  const mqAnim = track && track.getAnimations && track.getAnimations()[0];
  if (mqAnim) {
    const rate = { r: 1 };
    const apply = () => { mqAnim.playbackRate = rate.r; };
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: self => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 350, 6);
        if (boost < rate.r) return;
        gsap.to(rate, {
          r: boost, duration: 0.25, overwrite: true, onUpdate: apply,
          onComplete: () => gsap.to(rate, { r: 1, duration: 1.4, ease: 'power2.out', onUpdate: apply })
        });
      }
    });
  }

  /* ---------- Reveal generic (elementele cu data-reveal) ---------- */
  $$('[data-reveal]').forEach(el => {
    gsap.from(el, {
      y: 36, opacity: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

   /* ---------- Portofoliu: fără fixare; recalculăm pozițiile când se schimbă înălțimea secțiunii ---------- */
  ['portfolio:view', 'portfolio:filter', 'portfolio:more'].forEach(ev =>
    document.addEventListener(ev, () => ScrollTrigger.refresh()));

  /* ---------- Servicii: cardurile urcă, iconițele se desenează ---------- */
  const svcTrig = { trigger: '.services-flat-grid', start: 'top 85%', once: true };
  gsap.from('.service-flat-card', {
    yPercent: 14, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', scrollTrigger: svcTrig
  });
  gsap.from('.flat-svg *', {
    strokeDashoffset: 1, duration: 1.3, delay: 0.25, stagger: 0.08, ease: 'power2.inOut', scrollTrigger: svcTrig
  });

  /* ---------- Cum lucrez: foaia de probă se completează la scroll ---------- */
  const section = $('#process');
  const pin = $('.process-pin');
  const steps = $$('.proc-step');
  if (section && pin && steps.length) {
    const mm = gsap.matchMedia();

    // desktop: secțiunea rămâne fixată, fiecare pas completează foaia
    mm.add('(min-width: 901px)', () => {
      const N = steps.length;
      const setActive = idx => steps.forEach((s, i) => {
        s.classList.toggle('is-active', i === idx);
        s.classList.toggle('is-done', i < idx);
      });
      setActive(0);

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: pin, start: 'top top+=96', end: () => '+=' + Math.round(window.innerHeight * 2.6),
          pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
          onToggle: self => section.classList.toggle('is-pinned', self.isActive),
          onUpdate: self => setActive(Math.min(N - 1, Math.floor(self.progress * N)))
        }
      });
      tl.fromTo('.proc-progress', { scaleY: 0 }, { scaleY: 1, duration: N }, 0)
        .fromTo('.sheet-stage .guide', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, stagger: 0.1 }, 0)
        .fromTo('.plate-svg[data-plate="a"]', { opacity: 0, x: -34, y: -22 }, { opacity: 1, x: 0, y: 0, duration: 0.9 }, 1)
        .fromTo('.plate-svg[data-plate="b"]', { opacity: 0, x: 34, y: 22 }, { opacity: 1, x: 0, y: 0, duration: 0.9 }, 2)
        .fromTo('.plate-svg[data-plate="k"]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9 }, 3)
        .fromTo('.proc-stamp', { scale: 2.6, opacity: 0, rotation: -32 }, { scale: 1, opacity: 1, rotation: -8, duration: 0.45, ease: 'power4.in' }, 4.15);

      return () => { section.classList.remove('is-pinned'); steps.forEach(s => s.classList.remove('is-active', 'is-done')); };
    });

    // mobil: fără pin, elementele apar simplu când ajung în ecran
    mm.add('(max-width: 900px)', () => {
      steps.forEach(s => gsap.from(s, {
        y: 28, opacity: 0, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: s, start: 'top 90%', once: true }
      }));
      const st = { trigger: '.sheet-stage', start: 'top 80%', once: true };
      const tl = gsap.timeline({ scrollTrigger: st, defaults: { ease: 'power2.out' } });
      tl.from('.sheet-stage .guide', { strokeDashoffset: 1, duration: 0.8, stagger: 0.06 }, 0)
        .from('.plate-svg[data-plate="a"]', { opacity: 0, x: -24, duration: 0.6 }, 0.4)
        .from('.plate-svg[data-plate="b"]', { opacity: 0, x: 24, duration: 0.6 }, 0.7)
        .from('.plate-svg[data-plate="k"]', { opacity: 0, duration: 0.5 }, 1.0)
        .from('.proc-stamp', { scale: 2.6, opacity: 0, rotation: -32, duration: 0.4, ease: 'power4.in' }, 1.4);
    });
  }

  /* ---------- Despre: statement cuvânt cu cuvânt, poză, iconițe ---------- */
  const statement = $('#statement');
  if (statement) {
    statement.setAttribute('aria-label', statement.textContent.replace(/\s+/g, ' ').trim());
    const wrapWords = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'sw';
            w.setAttribute('aria-hidden', 'true');
            w.textContent = part;
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          wrapWords(n);
        }
      });
    };
    wrapWords(statement);
    gsap.fromTo($$('.sw', statement), { opacity: 0.15 }, {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 48%', scrub: true }
    });
  }

  const aboutClip = $('.about-img .clip');
  if (aboutClip) {
    gsap.from(aboutClip, {
      clipPath: 'inset(100% 0 0 0)', duration: 1.1, ease: 'power4.inOut',
      scrollTrigger: { trigger: aboutClip, start: 'top 85%', once: true }
    });
    gsap.from($('img', aboutClip), {
      scale: 1.2, duration: 1.4, ease: 'power3.out',
      scrollTrigger: { trigger: aboutClip, start: 'top 85%', once: true }
    });
  }

  const factsTrig = { trigger: '.facts', start: 'top 85%', once: true };
  gsap.from('.fact', { y: 30, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', scrollTrigger: factsTrig });
  gsap.from('.fact-icon *', { strokeDashoffset: 1, duration: 1.2, delay: 0.2, stagger: 0.05, ease: 'power2.inOut', scrollTrigger: factsTrig });

  /* ---------- Experiență: linia se desenează, joburile apar pe rând ---------- */
  const timeline = $('.timeline');
  if (timeline) {
    gsap.fromTo(timeline, { '--tl': 0 }, {
      '--tl': 1, ease: 'none',
      scrollTrigger: { trigger: timeline, start: 'top 70%', end: 'bottom 70%', scrub: 0.4 }
    });
  }
  $$('.job:not(.job-hidden)').forEach(job => {
    gsap.from(job, {
      y: 40, opacity: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: job, start: 'top 88%', once: true }
    });
  });

  document.addEventListener('history:toggle', e => {
    if (e.detail.expanded) {
      gsap.from('.job-hidden.show', { y: 30, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out', clearProps: 'all' });
    }
    ScrollTrigger.refresh();
  });

  /* ---------- Competențe: chip-uri + bare de „acoperire cerneală" ---------- */
  $$('.chip-list').forEach(list => {
    const st = { trigger: list, start: 'top 88%', once: true };
    gsap.from($$('.chip', list), {
      y: 16, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', scrollTrigger: st
    });
    gsap.from($$('.fill', list), {
      scaleX: 0, duration: 1, delay: 0.3, stagger: 0.05, ease: 'power3.out', scrollTrigger: st
    });
  });

  /* ---------- Cursor-reticul (doar cu mouse) ---------- */
  if (finePointer) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    gsap.set(cursor, { xPercent: -50, yPercent: -50, opacity: 0 });

    const moveX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const moveY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    let shown = false;

    window.addEventListener('pointermove', e => {
      moveX(e.clientX);
      moveY(e.clientY);
      if (!shown) { shown = true; gsap.to(cursor, { opacity: 1, duration: 0.25 }); }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { shown = false; gsap.to(cursor, { opacity: 0, duration: 0.2 }); });
    document.addEventListener('pointerover', e => {
      cursor.classList.toggle('is-active', !!e.target.closest('a, button, .sheet-item'));
    });
  }

  /* ---------- Recalculăm pozițiile după încărcarea imaginilor ---------- */
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
