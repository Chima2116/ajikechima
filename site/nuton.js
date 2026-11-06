/* Nuton case study: the interactive pieces. Plain JS, no dependencies. */
(function () {
  var page = document.querySelector('.nu-page');
  if (!page) return;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NURI = '../assets/nuton/cs/nuri/';
  function sfx(name) { if (window.siteSound) window.siteSound(name); }
  function pop(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function onView(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (es) { cb(es[0].isIntersecting); }, { threshold: 0.25 }).observe(el);
  }

  // Short version: hides the longer paragraphs and keeps the headline lines
  var tl = page.querySelector('[data-nu-tldr]');
  if (tl) {
    var setT = function (on) { page.classList.toggle('is-tldr', on); tl.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    try { setT(localStorage.getItem('nu.tldr') === '1'); } catch (e) {}
    tl.addEventListener('click', function () {
      var on = tl.getAttribute('aria-pressed') !== 'true'; setT(on); sfx('toggle');
      try { localStorage.setItem('nu.tldr', on ? '1' : '0'); } catch (e) {}
    });
  }

  // Hero reel: steps through the real screens; pauses off screen and with reduced motion
  var reel = page.querySelector('[data-nu-reel]');
  if (reel) {
    var shots = reel.querySelectorAll('.nu-reel__stage img'), steps = reel.querySelectorAll('.nu-reel__steps button');
    var cur = 0, t0 = 0, raf = 0, seen = false, held = false, DUR = 3600;
    var show = function (i) {
      cur = (i + shots.length) % shots.length; t0 = performance.now();
      shots.forEach(function (s, k) { s.classList.toggle('is-on', k === cur); });
      steps.forEach(function (b, k) { b.setAttribute('aria-pressed', k === cur ? 'true' : 'false'); b.style.setProperty('--p', calm ? '100%' : '0%'); });
      var bar = steps[0].parentNode; // on phones the steps scroll sideways: keep the current one in view
      if (bar.scrollWidth > bar.clientWidth + 2) bar.scrollTo({ left: Math.max(0, steps[cur].offsetLeft - 12), behavior: calm ? 'auto' : 'smooth' });
    };
    var tick = function (now) {
      raf = 0; if (!seen || held || calm) return;
      var p = Math.min(1, (now - t0) / DUR);
      steps[cur].style.setProperty('--p', (p * 100).toFixed(1) + '%');
      if (p >= 1) show(cur + 1);
      raf = requestAnimationFrame(tick);
    };
    var run = function () { if (!raf && seen && !held && !calm) { t0 = performance.now() - (parseFloat(steps[cur].style.getPropertyValue('--p')) || 0) / 100 * DUR; raf = requestAnimationFrame(tick); } };
    steps.forEach(function (b, k) { b.addEventListener('click', function () { show(k); sfx('tap'); run(); }); });
    reel.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') held = true; });
    reel.addEventListener('pointerleave', function () { held = false; run(); });
    onView(reel, function (v) { seen = v; if (v) run(); });
    show(0);
  }

  // Before and after: drag the handle, or snap to either end; pick a screen
  page.querySelectorAll('[data-nu-cmp]').forEach(function (c) {
    var stack = c.querySelector('.nu-cmp__stack'), range = c.querySelector('.nu-cmp__range');
    var oldI = c.querySelector('.nu-cmp__old'), newI = c.querySelector('.nu-cmp__new');
    var screens = c.querySelectorAll('[role="tab"]'), snaps = c.querySelectorAll('[data-ver]'), anim = 0;
    var setX = function (v) {
      range.value = v; stack.style.setProperty('--x', v + '%');
      snaps.forEach(function (x) { x.setAttribute('aria-pressed', +x.getAttribute('data-ver') === Math.round(v) ? 'true' : 'false'); });
    };
    var glide = function (to) {
      cancelAnimationFrame(anim); var from = +range.value;
      if (calm) { setX(to); return; }
      var t0 = performance.now();
      (function step(now) { var p = Math.min(1, (now - t0) / 500), e = 1 - Math.pow(1 - p, 3); setX(from + (to - from) * e); if (p < 1) anim = requestAnimationFrame(step); })(t0);
    };
    var touched = false;
    stack.addEventListener('pointerdown', function () { touched = true; });
    range.addEventListener('input', function () { touched = true; cancelAnimationFrame(anim); setX(+range.value); });
    snaps.forEach(function (x) { x.addEventListener('click', function () { touched = true; glide(+x.getAttribute('data-ver')); sfx('tap'); }); });
    screens.forEach(function (b, k) {
      b.tabIndex = k ? -1 : 0;
      b.addEventListener('click', function () {
        screens.forEach(function (x) { var on = x === b; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; });
        oldI.src = b.getAttribute('data-before'); newI.src = b.getAttribute('data-after'); sfx('tap');
      });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); var n = screens[(k + d + screens.length) % screens.length]; n.focus(); n.click(); }
      });
    });
    // a small nudge the first time it scrolls into view, so it reads as draggable
    if (!calm) {
      var nudged = false;
      onView(stack, function (v) {
        if (!v || nudged) return; nudged = true; var t0 = performance.now();
        (function step(now) {
          var t = (now - t0) / 1400; if (t > 1 || touched) { if (!touched) setX(+range.value); return; }
          stack.style.setProperty('--x', (50 + Math.sin(t * Math.PI * 2) * 14 * (1 - t)).toFixed(2) + '%'); requestAnimationFrame(step);
        })(t0);
      });
    }
  });

  // The learning loop: a ring with Nuri in the middle. It steps by itself while on screen and
  // not touched; any click takes over. Each step swaps Nuri's face, the text and the real screen.
  var lp = page.querySelector('[data-nu-loop]');
  if (lp) {
    var nodes = lp.querySelectorAll('.nu-ring__node'), panes = lp.querySelectorAll('.nu-loop__pane'), shots2 = lp.querySelectorAll('.nu-win__stack img');
    var arc = lp.querySelector('[data-nu-arc]'), lnuri = lp.querySelector('[data-nu-loopnuri]'), lurl = lp.querySelector('[data-nu-loopurl]');
    var C = 2 * Math.PI * 128, at = 0, tm = 0, inView = false, taken = false, hover = false;
    var go = function (i, user) {
      var wrapped = i >= nodes.length; at = (i + nodes.length) % nodes.length;
      nodes.forEach(function (n, k) { n.setAttribute('aria-pressed', k === at ? 'true' : 'false'); });
      panes.forEach(function (p, k) { p.classList.toggle('is-on', k === at); if (k === at) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true'); });
      shots2.forEach(function (s, k) { s.classList.toggle('is-on', k === at); });
      lurl.textContent = shots2[at].getAttribute('data-url');
      lnuri.src = NURI + nodes[at].getAttribute('data-e') + '.svg'; pop(lnuri, 'is-in');
      if (wrapped) { arc.style.transition = 'none'; arc.style.strokeDashoffset = C; void arc.getBoundingClientRect(); arc.style.transition = ''; }
      arc.style.strokeDashoffset = C * (1 - (at + 1) / nodes.length);
      if (user) sfx('portrait');
    };
    var tick2 = function () { if (inView && !taken && !hover && !calm) go(at + 1); };
    var run2 = function () { clearInterval(tm); if (!calm && !taken) tm = setInterval(tick2, 3800); };
    nodes.forEach(function (n, k) {
      n.addEventListener('click', function () { taken = true; clearInterval(tm); go(k, true); });
      n.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (d) { e.preventDefault(); taken = true; clearInterval(tm); var t = (k + d + nodes.length) % nodes.length; go(t, true); nodes[t].focus(); }
      });
    });
    lp.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
    lp.addEventListener('pointerleave', function () { hover = false; });
    onView(lp, function (v) { inView = v; if (v) run2(); else clearInterval(tm); });
    go(0);
  }

  // Learning style picker
  var st = page.querySelector('[data-nu-style]');
  if (st) {
    var stText = st.querySelector('[data-nu-styletext]'), stName = st.querySelector('[data-nu-stylename]');
    var opts = st.querySelectorAll('[role="radio"]');
    var pick = function (b, focus) {
      opts.forEach(function (o) { var on = o === b; o.setAttribute('aria-checked', on ? 'true' : 'false'); o.tabIndex = on ? 0 : -1; });
      stText.textContent = b.getAttribute('data-text'); stName.textContent = b.querySelector('b').textContent;
      pop(stText, 'is-in'); if (focus) b.focus();
    };
    opts.forEach(function (b, k) {
      b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
      b.addEventListener('click', function () { pick(b); sfx('tap'); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (d) { e.preventDefault(); pick(opts[(k + d + opts.length) % opts.length], true); }
      });
    });
  }

  // Screen tabs (ways to start, study tools)
  page.querySelectorAll('[data-nu-tabs]').forEach(function (w) {
    var img = w.querySelector('[data-nu-img]'), cap = w.querySelector('[data-nu-cap]'), tabs = w.querySelectorAll('[role="tab"]');
    var sel = function (b, focus) {
      tabs.forEach(function (x) { var on = x === b; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; });
      cap.textContent = b.getAttribute('data-cap'); img.alt = b.getAttribute('data-cap');
      var u = w.querySelector('[data-nu-url]'); if (u && b.getAttribute('data-url')) u.textContent = b.getAttribute('data-url');
      var src = b.getAttribute('data-src');
      if (img.getAttribute('src') !== src) {
        img.classList.add('is-swap');
        var n = new Image(); n.onload = n.onerror = function () { img.src = src; img.classList.remove('is-swap'); }; n.src = src;
      }
      if (focus) { b.focus(); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    };
    img.alt = tabs[0].getAttribute('data-cap');
    tabs.forEach(function (b, k) {
      b.tabIndex = k ? -1 : 0;
      b.addEventListener('click', function () { sel(b); sfx('tap'); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); sel(tabs[(k + d + tabs.length) % tabs.length], true); }
      });
    });
  });

  // Nuri's expressions
  var nu = page.querySelector('[data-nu-nuri]');
  if (nu) {
    var stage = nu.querySelector('.nu-nuri__stage'), art = nu.querySelector('[data-nu-nuriimg]');
    var nm = nu.querySelector('[data-nu-nuriname]'), wh = nu.querySelector('[data-nu-nuriwhen]');
    var ex = nu.querySelectorAll('[role="radio"]');
    var setE = function (b, focus) {
      ex.forEach(function (x) { var on = x === b; x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; });
      var name = b.querySelector('span').textContent;
      art.src = NURI + b.getAttribute('data-e') + '.svg'; art.alt = 'Nuri, ' + name.toLowerCase();
      nm.textContent = name; wh.textContent = b.getAttribute('data-when');
      pop(stage, 'is-in'); if (focus) b.focus();
    };
    ex.forEach(function (b, k) {
      b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
      b.addEventListener('click', function () { setE(b); sfx('portrait'); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (d) { e.preventDefault(); setE(ex[(k + d + ex.length) % ex.length], true); }
      });
    });
  }

  // Nuri's loop has a light and a dark video: after a theme switch, start the one now showing
  document.addEventListener('click', function (e) {
    if (calm || !e.target.closest || !e.target.closest('[data-theme-toggle]')) return;
    setTimeout(function () {
      page.querySelectorAll('.nu-vid').forEach(function (v) {
        if (v.offsetParent) { v.preload = 'auto'; var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
      });
    }, 80);
  });

  // Quiz: every answer explains itself
  var qz = page.querySelector('[data-nu-quiz]');
  if (qz) {
    var fb = qz.querySelector('[data-nu-fb]'), fbImg = qz.querySelector('[data-nu-fbimg]');
    var verdict = qz.querySelector('[data-nu-verdict]'), whyLab = qz.querySelector('[data-nu-whylab]');
    var ans = qz.querySelectorAll('.nu-quiz__opts button'), right = qz.querySelector('[data-right]');
    ans.forEach(function (b) {
      b.addEventListener('click', function () {
        if (qz.classList.contains('is-done')) return;
        var ok = b === right;
        qz.classList.add('is-done'); right.classList.add('is-right'); if (!ok) b.classList.add('is-wrong');
        fbImg.src = NURI + (ok ? 'happy' : 'encouraging') + '.svg';
        verdict.textContent = ok ? 'Correct!' : 'Not quite. The answer is B.';
        whyLab.textContent = ok ? 'Why this is right' : 'Why B is right';
        fb.hidden = false; sfx(ok ? 'portrait' : 'tap');
      });
    });
    qz.querySelector('[data-nu-again]').addEventListener('click', function () {
      qz.classList.remove('is-done'); fb.hidden = true;
      ans.forEach(function (b) { b.classList.remove('is-right', 'is-wrong'); }); ans[0].focus();
    });
  }

  // Streak: study days add up, milestones light, Nuri reacts, a missed day resets it
  var sk = page.querySelector('[data-nu-streak]');
  if (sk) {
    var n = 0, MS = [3, 7, 14, 30, 100];
    var elN = sk.querySelector('[data-nu-sn]'), msg = sk.querySelector('[data-nu-smsg]'), snuri = sk.querySelector('[data-nu-snuri]');
    var days = sk.querySelectorAll('.nu-streak__week li'), mls = sk.querySelectorAll('.nu-streak__ms li'), fill = sk.querySelector('[data-nu-sfill]');
    var face = function (e) { if (snuri.getAttribute('src') !== NURI + e + '.svg') { snuri.src = NURI + e + '.svg'; pop(snuri, 'is-in'); } };
    var fillAt = function (v) { // milestones sit at 0, 25, 50, 75 and 100% of the track
      if (v <= MS[0]) return 0;
      for (var i = 1; i < MS.length; i++) if (v <= MS[i]) return 25 * (i - 1) + 25 * (v - MS[i - 1]) / (MS[i] - MS[i - 1]);
      return 100;
    };
    var draw = function (lost) {
      elN.textContent = n;
      var inWeek = n === 0 ? 0 : ((n - 1) % 7) + 1;
      days.forEach(function (d, k) { d.classList.toggle('is-done', k < inWeek); });
      mls.forEach(function (m) { m.classList.toggle('is-hit', n >= +m.getAttribute('data-d')); });
      fill.style.setProperty('--f', fillAt(n) + '%');
      var next = MS.filter(function (m) { return m > n; })[0];
      if (lost) { face('sad'); msg.textContent = 'Streak lost. Study today to start again.'; return; }
      if (n === 0) { face('idle'); msg.textContent = 'Study today to start a streak.'; return; }
      if (n >= 100) { face('celebrating'); msg.textContent = '100 days. Every milestone reached.'; return; }
      if (MS.indexOf(n) > -1) { face('proud'); msg.textContent = n + '-day milestone reached.' + (next ? ' Next: ' + next + ' days.' : ''); return; }
      face(n === 1 ? 'excited' : 'happy');
      msg.textContent = n === 1 ? 'Today counts. Come back tomorrow to keep it going.' : (next - n) + ' more ' + (next - n === 1 ? 'day' : 'days') + ' to ' + next + ' days.';
    };
    sk.querySelector('[data-nu-study]').addEventListener('click', function () { if (n < 100) n++; draw(false); sfx(MS.indexOf(n) > -1 ? 'portrait' : 'tap'); });
    sk.querySelector('[data-nu-reset]').addEventListener('click', function () { var had = n > 0; n = 0; draw(had); sfx('close'); });
    draw(false);
  }
})();
