(function () {
  var root = document.documentElement;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var themeBtn = document.querySelector('[data-theme-toggle]');

  function effectiveTheme() {
    var set = root.getAttribute('data-theme');
    return set || (darkQuery.matches ? 'dark' : 'light');
  }

  function syncThemeButton() {
    if (!themeBtn) return;
    var now = effectiveTheme();
    themeBtn.setAttribute('data-mode', now);
    themeBtn.setAttribute('aria-label', now === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function applyTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncThemeButton();
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      if (window.siteSound) window.siteSound('toggle');
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm || !document.startViewTransition) return applyTheme(next);
      var r = themeBtn.getBoundingClientRect();
      root.style.setProperty('--vt-x', (r.left + r.width / 2) + 'px');
      root.style.setProperty('--vt-y', (r.top + r.height / 2) + 'px');
      root.classList.add('theme-vt');
      var vt = document.startViewTransition(function () { applyTheme(next); });
      vt.finished.then(function () { root.classList.remove('theme-vt'); }, function () { root.classList.remove('theme-vt'); });
      if (vt.ready) vt.ready.catch(function () {});
      if (vt.updateCallbackDone) vt.updateCallbackDone.catch(function () {});
    });
  }
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', syncThemeButton);
  syncThemeButton();

  var clock = document.querySelector('[data-clock]');
  if (clock && window.Intl && Intl.DateTimeFormat) {
    var fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' });
    var tick = function () { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 20000);
  }

  var flow = document.querySelector('[data-flow]');
  if (flow) {
    var buttons = flow.querySelectorAll('[data-flow-set]');
    var touched = false;
    var setState = function (state) {
      flow.setAttribute('data-state', state);
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-flow-set') === state));
      });
    };
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        touched = true;
        setState(b.getAttribute('data-flow-set'));
      });
    });
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setState(reduce ? 'after' : 'before');
    if (!reduce) {
      setTimeout(function () { if (!touched) setState('after'); }, 1800);
    }
  }

  var navLinks = document.querySelectorAll('[data-spy]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    navLinks.forEach(function (a) { var k = a.getAttribute('data-spy'); (map[k] = map[k] || []).push(a); });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var current = null;
      Object.keys(map).forEach(function (id) { if (!current && visible[id]) current = id; });
      navLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (current) map[current].forEach(function (a) { a.setAttribute('aria-current', 'true'); });
    }, { rootMargin: '-20% 0px -60% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }
})();

(function () {
  var items = document.querySelectorAll('.cl-item[data-sound]');
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var ctx = null;
  var master = null;
  var enabled = true;
  try { enabled = localStorage.getItem('sound') !== 'off'; } catch (e) {}

  var soundBtn = document.querySelector('[data-sound-toggle]');
  function syncSoundButton() {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', String(enabled));
    soundBtn.setAttribute('aria-label', enabled ? 'Sound on, turn it off' : 'Sound off, turn it on');
  }

  function unlock() {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { passive: true });
  });

  function tone(o) {
    var t = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  function tick(o) {
    var t = ctx.currentTime + (o.delay || 0);
    var len = Math.floor(ctx.sampleRate * (o.dur || 0.03));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = o.freq || 2000;
    f.Q.value = 1.2;
    var g = ctx.createGain();
    g.gain.value = o.gain || 0.2;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  var sounds = {
    tick: function () { tone({ freq: 1900, dur: 0.022, gain: 0.03 }); },
    tap: function () { tone({ freq: 540, to: 390, dur: 0.06, type: 'triangle', gain: 0.07 }); },
    pop: function () { tone({ freq: 420, to: 660, dur: 0.07, gain: 0.08 }); },
    open: function () { tone({ freq: 420, to: 720, dur: 0.12, type: 'triangle', gain: 0.07 }); tone({ freq: 860, dur: 0.08, gain: 0.035, delay: 0.06 }); },
    close: function () { tone({ freq: 700, to: 380, dur: 0.12, type: 'triangle', gain: 0.06 }); },
    flip: function () { tone({ freq: 300, to: 560, dur: 0.08, type: 'triangle', gain: 0.08 }); tick({ freq: 2200, dur: 0.02, gain: 0.1, delay: 0.05 }); },
    shuffle: function () { for (var i = 0; i < 4; i++) tick({ freq: 1800 + i * 300, dur: 0.02, gain: 0.1, delay: i * 0.055 }); },
    toggle: function () { tone({ freq: 520, to: 820, dur: 0.07, type: 'triangle', gain: 0.12 }); tone({ freq: 1040, dur: 0.05, gain: 0.06, delay: 0.05 }); },
    portrait: function () { tone({ freq: 660, dur: 0.16, type: 'triangle', gain: 0.12 }); tone({ freq: 880, dur: 0.2, type: 'triangle', gain: 0.1, delay: 0.08 }); },
    flag: function () { tone({ freq: 1200, to: 1500, dur: 0.07, gain: 0.1 }); },
    anime: function () { tone({ freq: 380, to: 980, dur: 0.14, gain: 0.12 }); },
    ball: function () { tone({ freq: 200, to: 420, dur: 0.12, gain: 0.18 }); tone({ freq: 140, to: 300, dur: 0.1, gain: 0.1, delay: 0.12 }); },
    crest: function () { tone({ freq: 988, dur: 0.22, type: 'square', gain: 0.045 }); tone({ freq: 1319, dur: 0.28, type: 'square', gain: 0.04, delay: 0.07 }); },
    pad: function () { tick({ freq: 2400, dur: 0.025, gain: 0.2 }); tone({ freq: 700, to: 500, dur: 0.06, type: 'square', gain: 0.04, delay: 0.03 }); tick({ freq: 1800, dur: 0.025, gain: 0.18, delay: 0.09 }); },
    laptop: function () { for (var i = 0; i < 3; i++) tick({ freq: 3000 - i * 300, dur: 0.02, gain: 0.16, delay: i * 0.07 }); }
  };

  var last = 0;
  function play(name) {
    if (!enabled || !ctx || ctx.state !== 'running' || !sounds[name]) return;
    var now = performance.now();
    if (now - last < 120) return;
    last = now;
    sounds[name]();
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      enabled = !enabled;
      try { localStorage.setItem('sound', enabled ? 'on' : 'off'); } catch (e) {}
      syncSoundButton();
      if (enabled) { unlock(); setTimeout(function () { last = 0; play('toggle'); }, 60); }
    });
  }
  syncSoundButton();
  window.siteSound = play;

  // small sounds for the interface itself (quiet, and only for a mouse or a tap)
  var lastHover = null;
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var el = e.target.closest ? e.target.closest('.work, .arc__row, .tl__co, .cs-pager__link, .rail__nav a, .soc') : null;
    if (el && el !== lastHover) { lastHover = el; play('tick'); }
    else if (!el) lastHover = null;
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('.arc__row, .note, [data-shuffle], [data-flipall], .copy, .work, .cs-pager__link, .live-cta, .arc__link, .pill, .mnav a') : null;
    if (!t) return;
    if (t.classList.contains('arc__row')) play(t.getAttribute('aria-expanded') === 'true' ? 'open' : 'close');
    else if (t.classList.contains('note') || t.hasAttribute('data-flipall')) play('flip');
    else if (t.hasAttribute('data-shuffle')) play('shuffle');
    else if (t.classList.contains('copy')) play('pop');
    else play('tap');
  });

  items.forEach(function (el) {
    var name = el.getAttribute('data-sound');
    el.addEventListener('pointerenter', function () { play(name); });
    el.addEventListener('focus', function () { play(name); });
  });
})();

(function () {
  var box = document.querySelector('.collage');
  if (!box) return;
  var top = 40;
  box.querySelectorAll('.cl-item').forEach(function (el) {
    var sx, sy, ox, oy, moved;
    function place(x, y) {
      var r = box.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      x = Math.max(0, Math.min(x, r.width - w));
      y = Math.max(0, Math.min(y, r.height - h));
      el.style.setProperty('--x', (x / r.width * 100) + '%');
      el.style.setProperty('--y', (y / r.height * 100) + '%');
    }
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      var b = box.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY;
      ox = el.offsetLeft; oy = el.offsetTop;
      moved = false;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      el.style.zIndex = ++top;
    });
    el.addEventListener('pointermove', function (e) {
      if (!el.hasPointerCapture(e.pointerId)) return;
      moved = true;
      place(ox + e.clientX - sx, oy + e.clientY - sy);
    });
    function end(e) {
      el.classList.remove('is-dragging');
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      place(el.offsetLeft + d[0] * 16, el.offsetTop + d[1] * 16);
    });
  });
})();

(function () {
  var peek = document.querySelector('.work-peek');
  var rows = document.querySelectorAll('a.work[data-peek]');
  if (!peek || !rows.length || !window.matchMedia('(hover: hover)').matches) return;
  var decks = peek.querySelectorAll('.pk-deck');
  var urlEl = peek.querySelector('.pk-url');
  var timer = 0, cur = null, idx = 0, MS = 420;
  function show(i) {
    var slides = cur.querySelectorAll('.pk-slide');
    idx = i % slides.length;
    slides.forEach(function (s, n) { s.classList.toggle('is-on', n === idx); });
  }
  function play(k) {
    clearTimeout(timer);
    decks.forEach(function (d) { d.classList.toggle('is-on', d.getAttribute('data-peek-img') === k); });
    cur = peek.querySelector('.pk-deck.is-on'); if (!cur) return;
    urlEl.textContent = cur.getAttribute('data-url');
    show(0);
    if (cur.querySelectorAll('.pk-slide').length > 1 && !calm) (function tick() { timer = setTimeout(function () { show(idx + 1); tick(); }, MS); })();
  }
  var tx = 0, ty = 0, x = 0, y = 0, raf = 0, calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame() {
    x += (tx - x) * (calm ? 1 : 0.16); y += (ty - y) * (calm ? 1 : 0.16);
    peek.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + (calm ? 0 : Math.max(-4, Math.min(4, (tx - x) * 0.08))) + 'deg)';
    raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.3) ? requestAnimationFrame(frame) : 0;
  }
  function move(e) {
    tx = e.clientX + 24; ty = e.clientY - peek.offsetHeight / 2;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  rows.forEach(function (row) {
    row.addEventListener('pointerenter', function (e) {
      var k = row.getAttribute('data-peek');
      if (!peek.classList.contains('is-on') || (cur && cur.getAttribute('data-peek-img') !== k)) play(k);
      if (!peek.classList.contains('is-on')) { x = e.clientX + 24; y = e.clientY - peek.offsetHeight / 2; }
      move(e); peek.classList.add('is-on');
    });
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerleave', function () { peek.classList.remove('is-on'); clearTimeout(timer); });
  });
})();

(function () {
  var wrap = document.querySelector('[data-notes]');
  if (!wrap) return;
  var wall = wrap.querySelector('.notes__wall');
  var slots = Array.prototype.slice.call(wall.querySelectorAll('.note-slot'));
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setFlip(btn, on) {
    btn.setAttribute('aria-pressed', String(on));
    var back = btn.querySelector('.note__back'), front = btn.querySelector('.note__front');
    back.setAttribute('aria-hidden', String(!on));
    front.setAttribute('aria-hidden', String(on));
  }
  slots.forEach(function (s) {
    var b = s.querySelector('.note');
    b.addEventListener('click', function () { setFlip(b, b.getAttribute('aria-pressed') !== 'true'); });
  });

  var flipAll = wrap.querySelector('[data-flipall]');
  var flipped = false;
  flipAll.addEventListener('click', function () {
    flipped = !flipped;
    slots.forEach(function (s, i) {
      var b = s.querySelector('.note');
      setTimeout(function () { setFlip(b, flipped); }, calm ? 0 : i * 90);
    });
    flipAll.textContent = flipped ? 'Flip back' : 'Flip all';
  });

  var order = slots.slice();
  wrap.querySelector('[data-shuffle]').addEventListener('click', function () {
    var before = slots.map(function (s) { return s.getBoundingClientRect(); });
    var next;
    do {
      next = order.slice();
      for (var i = next.length - 1; i > 0; i--) { var k = Math.floor(Math.random() * (i + 1)); var t = next[i]; next[i] = next[k]; next[k] = t; }
    } while (next.every(function (s, i) { return s === order[i]; }));
    order = next;
    order.forEach(function (s, i) { s.style.order = i; });
    if (calm || !slots[0].animate) return;
    slots.forEach(function (s, i) {
      var a = before[i], b = s.getBoundingClientRect();
      var dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      s.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0 0' }], { duration: 700, easing: 'cubic-bezier(0.3, 1.25, 0.4, 1)' });
    });
  });
})();

(function () {
  var vids = Array.prototype.slice.call(document.querySelectorAll('video[data-autoplay]'));
  if (!vids.length) return;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Remove the plain background around a phone: flood-fill the near-white
  // area from the edges of the first frame, then reuse that shape as a mask.
  function makeMask(v, mode) {
    var w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return null;
    var t = document.createElement('canvas'); t.width = w; t.height = h;
    var tc = t.getContext('2d', { willReadFrequently: true });
    tc.drawImage(v, 0, 0, w, h);
    var d;
    try { d = tc.getImageData(0, 0, w, h); } catch (e) { return null; }
    var px = d.data, n = w * h, bg = new Uint8Array(n), stack = new Int32Array(n), sp = 0;
    var br = px[0], bgc = px[1], bb = px[2];
    function isBg(i) {
      var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      if (mode === 'navy') return Math.abs(r - br) <= 14 && Math.abs(g - bgc) <= 14 && Math.abs(b - bb) <= 14;
      var mn = Math.min(r, g, b), mx = Math.max(r, g, b);
      return mn >= 226 && mx - mn <= 16;
    }
    function push(i) { if (!bg[i] && isBg(i)) { bg[i] = 1; stack[sp++] = i; } }
    var x, y;
    for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (sp) {
      var i = stack[--sp], cx = i % w, cy = (i / w) | 0;
      if (cx > 0) push(i - 1);
      if (cx < w - 1) push(i + 1);
      if (cy > 0) push(i - w);
      if (cy < h - 1) push(i + w);
    }
    // trim the light fringe left by anti-aliasing
    for (var pass = 0; pass < 2; pass++) {
      var kill = [];
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        var k = y * w + x;
        if (bg[k]) continue;
        if (bg[k - 1] || bg[k + 1] || bg[k - w] || bg[k + w]) {
          var lum = (px[k * 4] + px[k * 4 + 1] + px[k * 4 + 2]) / 3;
          if (mode === 'navy') { var dd = Math.abs(px[k * 4] - br) + Math.abs(px[k * 4 + 1] - bgc) + Math.abs(px[k * 4 + 2] - bb); if (dd < 36) kill.push(k); }
          else if (lum > 170) kill.push(k);
        }
      }
      for (var q = 0; q < kill.length; q++) bg[kill[q]] = 1;
    }
    if (mode === 'navy') {
      // keep only the biggest shape (the phone); text beside it is dropped
      var lab = new Int32Array(n), best = 0, bestId = 0, id = 0, q2 = new Int32Array(n);
      for (var s0 = 0; s0 < n; s0++) {
        if (bg[s0] || lab[s0]) continue;
        id++; var qh = 0, qt = 0, cnt = 0; q2[qt++] = s0; lab[s0] = id;
        while (qh < qt) {
          var c0 = q2[qh++], ccx = c0 % w, ccy = (c0 / w) | 0; cnt++;
          if (ccx > 0 && !bg[c0 - 1] && !lab[c0 - 1]) { lab[c0 - 1] = id; q2[qt++] = c0 - 1; }
          if (ccx < w - 1 && !bg[c0 + 1] && !lab[c0 + 1]) { lab[c0 + 1] = id; q2[qt++] = c0 + 1; }
          if (ccy > 0 && !bg[c0 - w] && !lab[c0 - w]) { lab[c0 - w] = id; q2[qt++] = c0 - w; }
          if (ccy < h - 1 && !bg[c0 + w] && !lab[c0 + w]) { lab[c0 + w] = id; q2[qt++] = c0 + w; }
        }
        if (cnt > best) { best = cnt; bestId = id; }
      }
      for (var z = 0; z < n; z++) if (lab[z] !== bestId) bg[z] = 1;
    } else {
    // the phone is a solid shape: fill each row between its outermost pixels
    for (y = 0; y < h; y++) {
      var lo = -1, hi = -1;
      for (x = 0; x < w; x++) { if (!bg[y * w + x]) { lo = x; break; } }
      for (x = w - 1; x >= 0; x--) { if (!bg[y * w + x]) { hi = x; break; } }
      if (lo >= 0 && hi - lo > 6) for (x = lo; x <= hi; x++) bg[y * w + x] = 0;
    }
    // drop thin, much-wider-than-the-phone rows (a floor shadow or line)
    var spans = [];
    for (y = 0; y < h; y++) {
      var a0 = -1, a1 = -1;
      for (x = 0; x < w; x++) { if (!bg[y * w + x]) { a0 = x; break; } }
      for (x = w - 1; x >= 0; x--) { if (!bg[y * w + x]) { a1 = x; break; } }
      spans.push(a0 < 0 ? 0 : a1 - a0 + 1);
    }
    var sorted = spans.filter(function (s) { return s > 0; }).sort(function (p, q) { return p - q; });
    var med = sorted.length ? sorted[sorted.length >> 1] : 0;
    for (y = 0; y < h; y++) if (spans[y] > med * 1.4) for (x = 0; x < w; x++) bg[y * w + x] = 1;
    }
    var bx0 = w, by0 = h, bx1 = 0, by1 = 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (!bg[y * w + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (bx1 <= bx0 || by1 <= by0) return null;
    var m = document.createElement('canvas'); m.width = w; m.height = h;
    var mc = m.getContext('2d'), md = mc.createImageData(w, h);
    for (var p = 0; p < n; p++) md.data[p * 4 + 3] = bg[p] ? 0 : 255;
    mc.putImageData(md, 0, 0);
    return { canvas: m, x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 };
  }

  function setupCut(v) {
    var fig = v.closest('.cs-cutv'), cv = fig && fig.querySelector('canvas');
    if (!cv || cv.getContext === undefined) return;
    var ready = false, mask = null, ctx = cv.getContext('2d'), raf = 0;
    function draw() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(v, mask.x, mask.y, mask.w, mask.h, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask.canvas, mask.x, mask.y, mask.w, mask.h, 0, 0, cv.width, cv.height);
    }
    function loop() {
      draw();
      if (v.paused) { raf = 0; return; }
      raf = v.requestVideoFrameCallback ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    }
    function start() { if (ready && !raf) loop(); }
    function prepare() {
      if (ready) return;
      v.addEventListener('loadeddata', function once() {
        v.removeEventListener('loadeddata', once);
        mask = makeMask(v, v.getAttribute('data-cut'));
        if (!mask) return;
        cv.width = mask.w; cv.height = mask.h;
        ready = true; fig.classList.add('is-cut'); draw();
      });
      v.preload = 'auto'; v.load();
    }
    v.addEventListener('play', start);
    v.addEventListener('seeked', function () { if (ready) draw(); });
    cv.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
    v._prepare = prepare; v._cut = true;
  }

  vids.forEach(function (v) {
    if (v.hasAttribute('data-cut')) setupCut(v);
    else v.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
    if (calm) { if (!v._cut) v.setAttribute('controls', ''); v.preload = 'metadata'; }
  });
  if (!('IntersectionObserver' in window)) { vids.forEach(function (v) { if (v._prepare) v._prepare(); }); return; }
  var near = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting && en.target._video._prepare) { en.target._video._prepare(); near.unobserve(en.target); } });
  }, { rootMargin: '600px 0px' });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      var v = en.target._video;
      if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else v.pause();
    });
  }, { threshold: 0.4 });
  vids.forEach(function (v) {
    var host = v.closest('figure') || v;
    host._video = v;
    near.observe(host);
    if (!calm) io.observe(host);
  });
})();

/* Smooth scrolling, scroll reveals and the reading-progress line */
(function () {
  var root = document.documentElement;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lenis = null;

  if (window.Lenis && !calm) {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    window.siteLenis = lenis;
    var frame = function (t) { lenis.raf(t); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }

  // in-page links glide instead of jumping
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.pathname !== location.pathname || !u.hash) return;
    var id = decodeURIComponent(u.hash.slice(1));
    var el = id === 'top' ? null : document.getElementById(id);
    if (id !== 'top' && !el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el || 0, { offset: el ? -8 : 0, duration: 1.4 });
    else window.scrollTo({ top: el ? el.getBoundingClientRect().top + window.scrollY - 8 : 0, behavior: calm ? 'auto' : 'smooth' });
    try { history.pushState(null, '', u.hash); } catch (err) {}
  });

  // reading progress
  var bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  function progress() {
    var max = root.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(progress); } }, { passive: true });
  progress();

  // collage order for the entrance
  document.querySelectorAll('.cl-item').forEach(function (el, i) { el.style.setProperty('--n', i); });

  // scroll reveals
  if (calm || !('IntersectionObserver' in window) || !root.classList.contains('js-anim')) return;
  var targets = document.querySelectorAll([
    '.intro p', '.block__title', '.block__note', '.work', '.notes__layout', '.row', '.tl', '.archive', '.edu', '.contact__title', '.contact__email', '.contact__links',
    '.cs-hero > *', '.cs-section__label', '.cs-section__body > *'
  ].join(','));
  var groups = new Map();
  targets.forEach(function (el) {
    if (el.closest('.live-cta')) return;
    var p = el.parentElement;
    var n = groups.get(p) || 0;
    groups.set(p, n + 1);
    el.classList.add('rv');
    el.style.setProperty('--rv-d', Math.min(n * 0.07, 0.35) + 's');
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add('in');
      setTimeout(function () { el.classList.remove('rv', 'in'); el.style.removeProperty('--rv-d'); }, 1600);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  // never leave content hidden if the page is not being painted (background tab, print, capture)
  setTimeout(function () {
    if (document.visibilityState === 'visible') return;
    document.querySelectorAll('.rv').forEach(function (el) { el.classList.remove('rv', 'in'); el.style.removeProperty('--rv-d'); });
  }, 2500);
})();

/* The current: three slow lights follow set routes along the guides and box edges.
   Where two of them meet, they answer with a small glow. */
(function () {
  var root = document.documentElement;
  var shell = document.querySelector('.shell');
  var main = document.querySelector('.main');
  if (!shell || !main || !root.classList.contains('js-anim')) return;
  var cv = document.createElement('canvas');
  cv.className = 'current';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');
  var dpr = 1, W = 0, H = 0;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // a route is a list of points with running lengths
  function route(points) {
    var r = { pts: points, cum: [0], total: 0 };
    for (var i = 1; i < points.length; i++) {
      r.total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      r.cum.push(r.total);
    }
    return r;
  }
  // round the corners so a light turns smoothly instead of snapping
  function rounded(corners, radius) {
    var out = [corners[0]];
    for (var i = 1; i < corners.length - 1; i++) {
      var A = corners[i - 1], P = corners[i], B = corners[i + 1];
      var da = Math.hypot(A[0] - P[0], A[1] - P[1]), db = Math.hypot(B[0] - P[0], B[1] - P[1]);
      var r = Math.min(radius, da / 2, db / 2);
      if (r < 1) { out.push(P); continue; }
      var s = [P[0] + (A[0] - P[0]) / da * r, P[1] + (A[1] - P[1]) / da * r];
      var e = [P[0] + (B[0] - P[0]) / db * r, P[1] + (B[1] - P[1]) / db * r];
      out.push(s);
      for (var t = 1; t < 6; t++) {
        var u = t / 6, v = 1 - u;
        out.push([v * v * s[0] + 2 * v * u * P[0] + u * u * e[0], v * v * s[1] + 2 * v * u * P[1] + u * u * e[1]]);
      }
      out.push(e);
    }
    out.push(corners[corners.length - 1]);
    return out;
  }

  var tracks = [null, null], shellTop = 0, shellLeft = 0;
  function build() {
    if (window.innerWidth < 900) { tracks = [null, null]; return; }
    var s = shell.getBoundingClientRect();
    var m = main.getBoundingClientRect();
    var cs = getComputedStyle(shell);
    var gap = parseFloat(cs.columnGap) || 0;
    var xL = m.left - s.left - gap / 2 + 0.5;
    var xR = s.width - parseFloat(cs.paddingRight) - 0.5;
    var ys = [];
    main.querySelectorAll(':scope > section, :scope > footer').forEach(function (el) { ys.push(el.getBoundingClientRect().top - s.top + 0.5); });
    ys.push(s.height - 0.5);
    shellTop = s.top + window.scrollY; shellLeft = s.left + window.scrollX;
    var corners = [[xL, 0]], x = xL;
    for (var i = 0; i < ys.length; i++) {
      corners.push([x, ys[i]]);
      if (i < ys.length - 1) { x = x === xL ? xR : xL; corners.push([x, ys[i]]); }
    }
    tracks[0] = route(corners);                      // the box edges, snaking down the page
    tracks[1] = route([[xR, 0], [xR, s.height]]);     // the right-hand guide
  }

  var tmp = [0, 0];
  function pointAt(r, s) {
    var pts = r.pts, cum = r.cum;
    if (s <= 0) { tmp[0] = pts[0][0]; tmp[1] = pts[0][1]; return tmp; }
    if (s >= r.total) { var l = pts[pts.length - 1]; tmp[0] = l[0]; tmp[1] = l[1]; return tmp; }
    var lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    var t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    tmp[0] = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t;
    tmp[1] = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t;
    return tmp;
  }
  // distance along a route at which the page reaches a given height
  function sForY(r, yy) {
    var pts = r.pts;
    for (var i = 0; i < pts.length; i++) if (pts[i][1] >= yy) return r.cum[i];
    return r.total;
  }

  var rgb = [95, 200, 160], frameN = 0;
  function readAccent() {
    var v = getComputedStyle(root).getPropertyValue('--accent').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) rgb = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  }
  function col(a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')'; }

  // route 0 down, route 0 back up, and the right guide on its own: they cross now and then, never pile up
  var lights = [
    { tr: 0, dir: 1, speed: 150, tail: 460, wait: 0.4 },
    { tr: 0, dir: -1, speed: 125, tail: 420, wait: 3 },
    { tr: 1, dir: 1, speed: 105, tail: 380, wait: 1.5 }
  ].map(function (l, i) { l.s = null; l.life = 0; l.seed = i * 2.3; l.travelled = 0; l.x = 0; l.y = 0; l.on = false; return l; });

  var cooldown = 0;
  var lastT = 0;

  function frame(t) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (t - (lastT || t)) / 1000);
    lastT = t;
    if (!tracks[0]) return;
    if ((frameN++ % 40) === 0) readAccent();
    ctx.clearRect(0, 0, W, H);
    var vTop = window.scrollY - shellTop, vBot = vTop + H;
    var offX = shellLeft - window.scrollX, offY = shellTop - window.scrollY;
    if (cooldown > 0) cooldown -= dt;

    lights.forEach(function (l) {
      l.on = false;
      var r = tracks[l.tr];
      if (l.wait > 0) { l.wait -= dt; return; }
      var a = sForY(r, vTop - 80), b = sForY(r, vBot + 80);
      if (b - a < 800) b = Math.min(r.total, a + 800);
      if (l.s === null || l.s < a - l.tail - 120 || l.s > b + l.tail + 120) {
        l.s = l.dir > 0 ? a - 60 : b + 60;
        l.travelled = 0;
      }
      l.life += dt;
      var v = l.speed * (1 + 0.1 * Math.sin(l.life * 0.6 + l.seed));
      l.s += l.dir * v * dt;
      l.travelled += v * dt;
      var remaining = l.dir > 0 ? (b + 60 - l.s) : (l.s - (a - 60));
      if (remaining <= 0) { l.s = null; l.wait = 1.2 + Math.random() * 2.5; return; }
      var f = Math.min(1, l.travelled / 260, remaining / 300);
      l.fade = f * f * (3 - 2 * f);
      var p = pointAt(r, l.s);
      l.x = p[0] + offX; l.y = p[1] + offY; l.on = true;
    });

    // two lights meeting answer with a soft glow
    if (cooldown <= 0) {
      for (var i = 0; i < lights.length && cooldown <= 0; i++) for (var k = i + 1; k < lights.length; k++) {
        var A = lights[i], B = lights[k];
        if (A.on && B.on && A.fade > 0.5 && B.fade > 0.5 && Math.hypot(A.x - B.x, A.y - B.y) < 22) {
          spark((A.x + B.x) / 2, (A.y + B.y) / 2);
          cooldown = 2.5; break;
        }
      }
    }

    lights.forEach(function (l) { if (l.on) draw(l, offX, offY); });
    drawSparks(dt);
  }

  // the light: one smooth stroke that fades from a bright head to nothing, with a soft halo under it
  function draw(l, offX, offY) {
    var r = tracks[l.tr], step = 3, n = Math.round(l.tail / step);
    var p0 = pointAt(r, l.s), px = p0[0], py = p0[1];
    var hx = px + offX, hy = py + offY;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    // sample every few px, and always at the exact corners so turns stay sharp
    var ds = [];
    for (var k = 1; k <= n; k++) ds.push(k * step);
    for (var c = 1; c < r.cum.length - 1; c++) {
      var dc = (l.s - r.cum[c]) * l.dir;
      if (dc > 0 && dc < n * step) ds.push(dc);
    }
    ds.sort(function (a, b) { return a - b; });
    var pts = [[px, py]];
    for (var q = 0; q < ds.length; q++) { var p = pointAt(r, l.s - l.dir * ds[q]); pts.push([p[0], p[1]]); }
    n = ds.length; var dist = [0].concat(ds);
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 1; i < pts.length; i++) {
        var f = Math.max(0, 1 - dist[i] / l.tail);
        var alpha = Math.pow(f, 1.6) * l.fade;
        if (alpha < 0.004) break;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0] + offX, pts[i - 1][1] + offY);
        ctx.lineTo(pts[i][0] + offX, pts[i][1] + offY);
        if (pass === 0) { ctx.strokeStyle = col(alpha * 0.07); ctx.lineWidth = 2 + 4 * f; }
        else { ctx.strokeStyle = col(Math.min(1, alpha * 0.85)); ctx.lineWidth = 0.7 + 1.1 * f; }
        ctx.stroke();
      }
    }
    // a small bright core at the head
    var g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 6);
    g.addColorStop(0, col(0.7 * l.fade)); g.addColorStop(0.35, col(0.22 * l.fade)); g.addColorStop(1, col(0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();
  }

  // where two lights meet: a tiny jolt, a flash, a few bolts and some sparks
  var sparks = [], bolts = [], flashes = [];
  function spark(x, y) {
    flashes.push({ x: x, y: y, age: 0 });
    var i, ang, sp;
    for (i = 0; i < 11; i++) {
      ang = Math.random() * Math.PI * 2; sp = 70 + Math.random() * 130;
      sparks.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, age: 0, life: 0.35 + Math.random() * 0.35 });
    }
    for (i = 0; i < 4; i++) {
      ang = Math.random() * Math.PI * 2;
      var len = 14 + Math.random() * 16, pts = [[0, 0]], steps = 4;
      for (var s = 1; s <= steps; s++) {
        var d = len * s / steps, jit = (Math.random() - 0.5) * 9;
        pts.push([Math.cos(ang) * d - Math.sin(ang) * jit, Math.sin(ang) * d + Math.cos(ang) * jit]);
      }
      bolts.push({ x: x, y: y, pts: pts, age: 0, life: 0.28 });
    }
  }
  function drawSparks(dt) {
    var hot = 'rgba(' + Math.min(255, rgb[0] + 120) + ',' + Math.min(255, rgb[1] + 55) + ',' + Math.min(255, rgb[2] + 80) + ',';
    var i;
    ctx.lineCap = 'round';
    for (i = flashes.length - 1; i >= 0; i--) {
      var fl = flashes[i]; fl.age += dt;
      var fl_t = fl.age / 0.3;
      if (fl_t >= 1) { flashes.splice(i, 1); continue; }
      var fr = 5 + 14 * fl_t, fa = 0.7 * (1 - fl_t);
      var gg = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fr);
      gg.addColorStop(0, hot + fa.toFixed(3) + ')'); gg.addColorStop(1, col(0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(fl.x, fl.y, fr, 0, Math.PI * 2); ctx.fill();
    }
    for (i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i]; b.age += dt;
      if (b.age >= b.life) { bolts.splice(i, 1); continue; }
      var ba = (1 - b.age / b.life) * (0.55 + Math.random() * 0.45);
      ctx.beginPath(); ctx.moveTo(b.x + b.pts[0][0], b.y + b.pts[0][1]);
      for (var q = 1; q < b.pts.length; q++) ctx.lineTo(b.x + b.pts[q][0], b.y + b.pts[q][1]);
      ctx.strokeStyle = hot + ba.toFixed(3) + ')'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    for (i = sparks.length - 1; i >= 0; i--) {
      var sp = sparks[i]; sp.age += dt;
      if (sp.age >= sp.life) { sparks.splice(i, 1); continue; }
      var damp = Math.pow(0.04, dt);
      sp.vx *= damp; sp.vy *= damp;
      sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      var sa = Math.pow(1 - sp.age / sp.life, 1.5);
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x - sp.vx * 0.035, sp.y - sp.vy * 0.035);
      ctx.strokeStyle = hot + sa.toFixed(3) + ')'; ctx.lineWidth = 1.3; ctx.stroke();
    }
  }

  size(); build(); readAccent();
  window.addEventListener('resize', function () { size(); build(); });
  window.addEventListener('load', build);
  if ('ResizeObserver' in window) new ResizeObserver(build).observe(main);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  requestAnimationFrame(frame);
})();

/* Archive: one row open at a time */
(function () {
  var wrap = document.querySelector('[data-archive]');
  if (!wrap) return;
  var rows = Array.prototype.slice.call(wrap.querySelectorAll('.arc'));
  function set(arc, open) {
    arc.classList.toggle('is-open', open);
    arc.querySelector('.arc__row').setAttribute('aria-expanded', String(open));
    var p = arc.querySelector('.arc__panel');
    if (open) p.removeAttribute('inert'); else p.setAttribute('inert', '');
  }
  rows.forEach(function (arc) {
    arc.querySelector('.arc__row').addEventListener('click', function () {
      var open = !arc.classList.contains('is-open');
      rows.forEach(function (o) { if (o !== arc) set(o, false); });
      set(arc, open);
    });
  });
})();

/* Mobile section bar and copy-to-clipboard */
(function () {
  var mnav = document.querySelector('.mnav');
  if (mnav) {
    var chk = function () { mnav.classList.toggle('is-on', window.scrollY > 380); };
    window.addEventListener('scroll', chk, { passive: true });
    chk();
    mnav.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a) a.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.querySelector('.copy__t');
    var status = document.querySelector('[data-copy-status]');
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      function done() {
        btn.classList.add('is-done');
        if (label) label.textContent = 'Copied';
        if (status) status.textContent = 'Email address copied';
        setTimeout(function () { btn.classList.remove('is-done'); if (label) label.textContent = 'Copy'; if (status) status.textContent = ''; }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { window.location.href = 'mailto:' + text; });
      } else {
        var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { window.location.href = 'mailto:' + text; }
        document.body.removeChild(ta);
      }
    });
  });
})();

(function () {
  var fab = document.querySelector('[data-ask-open]');
  var panel = document.getElementById('ask-panel');
  if (!fab || !panel) return;
  var frame = panel.querySelector('[data-ask-frame]');
  var closeBtn = panel.querySelector('[data-ask-close]');
  var mascot = fab.querySelector('[data-mascot]');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mascot: a blob with eyes that follow the pointer and blink.
  var eyeL, eyeR, eyes, body, px = 0, py = 0, ex = 0, ey = 0, blinkAt = 0, blinkT = -1, wakeT = -1000;
  if (mascot) {
    mascot.innerHTML = '<svg viewBox="0 0 48 48"><g data-b style="transform-origin:24px 40px"><path d="M24 4c11.6 0 19 7.2 19 18.4C43 35 36 43 24 43S5 35 5 22.4C5 11.2 12.4 4 24 4z" fill="var(--accent)"/><path d="M13 12c3-3.2 7-4.5 11-4.5" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" stroke-linecap="round" fill="none"/><g data-e><ellipse cx="17" cy="22" rx="3.1" ry="4.6" fill="var(--bg)"/><ellipse cx="31" cy="22" rx="3.1" ry="4.6" fill="var(--bg)"/></g></g></svg>';
    body = mascot.querySelector('[data-b]'); eyes = mascot.querySelector('[data-e]');
    eyeL = eyes.children[0]; eyeR = eyes.children[1];
    window.addEventListener('pointermove', function (e) {
      var r = mascot.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220);
      px = dx / d * k; py = dy / d * k;
    }, { passive: true });
    blinkAt = performance.now() + 2200;
    (function tick(now) {
      ex += (px - ex) * 0.14; ey += (py - ey) * 0.14;
      if (now > blinkAt) { blinkT = now; blinkAt = now + 2600 + Math.random() * 3400; }
      var sy = 1;
      if (blinkT > 0) { var t = (now - blinkT) / 140; if (t >= 1) blinkT = -1; else sy = 1 - 0.92 * Math.sin(t * Math.PI); }
      if (fab.matches(':hover')) sy = Math.min(sy, 0.45);
      eyes.setAttribute('transform', 'translate(' + (ex * 3.2).toFixed(2) + ' ' + (ey * 2.6).toFixed(2) + ')');
      [eyeL, eyeR].forEach(function (el, i) { var cx = i ? 31 : 17; el.setAttribute('transform', 'translate(' + cx + ' 22) scale(1 ' + sy.toFixed(3) + ') translate(' + -cx + ' -22)'); });
      body.style.transform = 'translateY(' + (calm ? 0 : Math.sin(now / 625) * 0.9).toFixed(2) + 'px)';
      requestAnimationFrame(tick);
    })(performance.now());
  }

  function theme() {
    var t = document.documentElement.getAttribute('data-theme');
    return t || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function load() {
    var src = 'assistant/?embed=1&theme=' + theme();
    if (frame.getAttribute('src') !== src) { frame.classList.remove('is-ready'); frame.setAttribute('src', src); }
  }
  frame.addEventListener('load', function () { frame.classList.add('is-ready'); });
  // Warm the frame so opening is instant.
  fab.addEventListener('pointerenter', load, { once: true });
  fab.addEventListener('focus', load, { once: true });
  window.addEventListener('load', function () { setTimeout(load, 2500); });

  function post(m) { try { frame.contentWindow.postMessage(m, '*'); } catch (e) {} }
  var pend = 0;
  window.addEventListener('pointermove', function (e) {
    if (panel.hidden || pend) return;
    pend = requestAnimationFrame(function () {
      pend = 0;
      var r = frame.getBoundingClientRect();
      post({ t: 'ptr', x: e.clientX - r.left, y: e.clientY - r.top });
    });
  }, { passive: true });

  var EASE_OPEN = 'cubic-bezier(0.22, 1, 0.36, 1)', EASE_CLOSE = 'cubic-bezier(0.6, 0, 0.2, 1)';
  var main = document.getElementById('main');
  var busy = false, isOpen = false, isSheet = false, pill = panel.querySelector('[data-ask-pill]');
  var scrim = document.createElement('div'); scrim.className = 'ask-scrim'; scrim.hidden = true; document.body.appendChild(scrim);
  function veil(on) { if (!isSheet && on) return; if (on) { scrim.hidden = false; requestAnimationFrame(function () { scrim.classList.add('is-on'); }); } else { scrim.classList.remove('is-on'); setTimeout(function () { scrim.hidden = true; }, 420); } }
  // Centre the button and the panel on the main column, not the whole window.
  function place() {
    var r = main ? main.getBoundingClientRect() : { left: 0, width: innerWidth };
    var vw = document.documentElement.clientWidth;
    var left = Math.max(r.left, 0), width = Math.min(r.width, vw - left);
    var cx = left + width / 2;
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var w = Math.min(42 * rem, width - 2 * rem), h = Math.min(32 * rem, innerHeight - 2.5 * rem);
    var sheet = vw < 640;                       // phones: a bottom sheet that fills the width
    if (sheet) { w = vw; h = Math.round(innerHeight * 0.9); cx = vw / 2; }
    var st = document.documentElement.style;
    st.setProperty('--ask-cx', cx + 'px'); st.setProperty('--ask-left', (sheet ? 0 : cx - w / 2) + 'px');
    st.setProperty('--ask-w', w + 'px'); st.setProperty('--ask-h', h + 'px');
    st.setProperty('--ask-r', sheet ? '24px 24px 0 0' : '24px');
    isSheet = sheet;
  }
  place();
  window.addEventListener('resize', place);
  var BOX = { width: 'var(--ask-w)', height: 'var(--ask-h)', left: 'var(--ask-left)', borderRadius: 'var(--ask-r)' };
  function fabBox() {
    var f = fab.getBoundingClientRect();
    return { width: f.width + 'px', height: f.height + 'px', left: f.left + 'px', borderRadius: (f.height / 2) + 'px' };
  }
  function clean() { [panel, frame, closeBtn, pill].forEach(function (el) { el.getAnimations().forEach(function (x) { x.cancel(); }); }); }
  function fade(el, x, y, d, delay, ease) { return el.animate([{ opacity: x }, { opacity: y }], { duration: d, delay: delay, easing: ease || 'ease-out', fill: 'both' }); }
  // The panel is one box that grows out of the pill, so its border and corners stay true all the way.
  function open() {
    if (busy || isOpen) return;
    place(); load(); busy = true; isOpen = true; veil(true);
    pill.innerHTML = fab.innerHTML;
    var from = fabBox();
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    if (window.siteSound) window.siteSound('open');
    if (calm || !panel.animate) { fab.classList.add('is-away'); busy = false; post({ t: 'open' }); return; }
    fab.classList.add('is-away');
    var a = panel.animate([from, BOX], { duration: 760, easing: EASE_OPEN, fill: 'both' });
    fade(pill, 1, 0, 200, 0, 'ease-in');
    fade(frame, 0, 1, 360, 260);
    fade(closeBtn, 0, 1, 240, 420);
    setTimeout(function () { post({ t: 'open' }); }, 420);
    a.onfinish = function () { clean(); busy = false; };
  }
  function close() {
    if (busy || !isOpen) return;
    busy = true; isOpen = false; veil(false);
    fab.setAttribute('aria-expanded', 'false');
    if (window.siteSound) window.siteSound('close');
    var done = function () { clean(); panel.hidden = true; busy = false; fab.focus({ preventScroll: true }); };
    if (calm || !panel.animate) { fab.classList.remove('is-away'); done(); return; }
    var to = fabBox();
    pill.innerHTML = fab.innerHTML;
    fade(frame, 1, 0, 220, 0, 'ease-in');
    fade(closeBtn, 1, 0, 140, 0);
    fade(pill, 0, 1, 240, 300, 'ease-out');
    var a = panel.animate([BOX, to], { duration: 680, delay: 60, easing: EASE_CLOSE, fill: 'both' });
    a.onfinish = function () { fab.classList.remove('is-away'); setTimeout(done, 30); };
  }
  fab.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
})();

(function () {
  // The glow in each section's band follows the cursor, eased.
  var secs = document.querySelectorAll('section.block');
  if (!secs.length || !window.matchMedia('(hover: hover)').matches) return;
  secs.forEach(function (s) {
    var tx = 0, x = 0, raf = 0, inited = false;
    function step() {
      x += (tx - x) * 0.12;
      s.style.setProperty('--mx', x.toFixed(1) + 'px');
      raf = Math.abs(tx - x) > 0.5 ? requestAnimationFrame(step) : 0;
    }
    s.addEventListener('pointermove', function (e) {
      tx = e.clientX - s.getBoundingClientRect().left;
      if (!inited) { x = tx; inited = true; }
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
  });
})();


// About: poke the portrait and it melts into a different expression, with a line
(function () {
  var fig = document.querySelector('.about__fig');
  if (!fig) return;
  var bubble = document.querySelector('.about__bubble');
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var disp = document.querySelector('#about-morph feDisplacementMap');
  var faces = {};
  fig.querySelectorAll('img').forEach(function (im) { faces[im.dataset.face] = im; });
  var first = [
    ['smirk', 'Hi!'], ['bigsmile', 'Welcome.'], ['thinking', 'How you doing? Genuinely asking.'], ['admiration', 'Nice to meet you.']
  ];
  var rest = [
    ['surprised', 'You poked me!'], ['excited', 'I think you like me.'], ['confused', 'Why do you keep poking me?'],
    ['focused', 'Sorry, I was working. Hi.'], ['frustrated', 'Okay, that\u2019s a lot of pokes.'],
    ['laugh', 'Pokes don\u2019t pay rent. Hiring does.'], ['relieved', 'Phew. A visitor, finally.'],
    ['smirk', 'Have you seen the work yet? It\u2019s above.'], ['bigsmile', 'Keep scrolling. There\u2019s more.']
  ];
  var queue = first.slice(), hideT = 0, current = 'neutral', raf = 0;

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // one figure melts into the next: the old fades out as the new fades in while the whole drawing ripples
  function morph(to) {
    var from = current; if (from === to) return;
    var A = faces[from], B = faces[to]; current = to;
    cancelAnimationFrame(raf);
    Object.keys(faces).forEach(function (k) { if (k !== from && k !== to) { faces[k].classList.remove('is-on'); faces[k].style.opacity = ''; } });
    if (calm) { A.classList.remove('is-on'); A.style.opacity = ''; B.classList.add('is-on'); B.style.opacity = ''; return; }
    fig.classList.add('is-morphing');
    B.classList.add('is-on'); B.style.opacity = '0'; A.style.opacity = '1';
    var t0 = performance.now(), D = 620, w = fig.getBoundingClientRect().width / 1000;
    fig.animate([{ scale: '1' }, { scale: '1.04 0.96', offset: 0.16 }, { scale: '0.98 1.03', offset: 0.55 }, { scale: '1' }], { duration: D, easing: 'ease-out' });
    (function step(now) {
      var t = clamp01((now - t0) / D);
      A.style.opacity = (1 - ease(clamp01((t - 0.12) / 0.6))).toFixed(3);
      B.style.opacity = ease(clamp01((t - 0.28) / 0.6)).toFixed(3);
      disp.setAttribute('scale', (Math.sin(Math.PI * t) * 90 * w).toFixed(2));
      if (t < 1) { raf = requestAnimationFrame(step); return; }
      A.classList.remove('is-on'); A.style.opacity = ''; B.style.opacity = '';
      disp.setAttribute('scale', '0'); fig.classList.remove('is-morphing');
    })(t0);
  }
  function reset() { bubble.classList.remove('is-on'); morph('neutral'); }
  function poke() {
    if (!queue.length) queue = rest.slice().sort(function () { return Math.random() - 0.5; });
    var pick = queue.shift();
    morph(pick[0]);
    bubble.textContent = pick[1]; bubble.classList.add('is-on');
    clearTimeout(hideT); hideT = setTimeout(reset, 3200);
  }
  fig.addEventListener('click', poke);
  fig.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });
  document.addEventListener('click', function (e) { if (!fig.contains(e.target) && current !== 'neutral') { clearTimeout(hideT); reset(); } });

  if (calm) return;
  var tgt = 0, cur = 0;
  window.addEventListener('pointermove', function (e) {
    var r = fig.getBoundingClientRect();
    tgt = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5))) * 3;
  }, { passive: true });
  (function loop() {
    requestAnimationFrame(loop);
    var r = fig.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    cur += (tgt - cur) * 0.07;
    fig.style.setProperty('--lean', cur.toFixed(2) + 'deg');
  })();
})();

// About: the underlines on key phrases draw in once the text is on screen
(function () {
  var box = document.querySelector('.block--about .ruled');
  if (!box) return;
  if (!('IntersectionObserver' in window)) { box.classList.add('is-lit'); return; }
  new IntersectionObserver(function (es, io) {
    if (es[0].isIntersecting) { box.classList.add('is-lit'); io.disconnect(); }
  }, { threshold: 0.2 }).observe(box);
})();
