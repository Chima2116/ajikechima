/*
 * ROCKFALL: a small survival game that lives in the footer.
 * A canvas, requestAnimationFrame, delta-time movement and no dependencies.
 *
 * To swap the artwork later, replace ART.player and ART.rock (they only draw).
 * To tune difficulty, edit CONFIG.levels.
 *
 * Leaderboard: scores go to /api/rockfall (see api/ and supabase/README.md). It stays hidden until that backend is
 * configured, so the game works on its own. The server issues a signed run token and checks every score; the browser
 * never decides a score by itself.
 */
(function () {
  'use strict';

  var CONFIG = {
    referenceHeight: 380,                    // speeds are tuned for an arena this tall
    player: { hit: 12, size: 21, follow: 15 },   // hit radius, drawn size, easing (per second)
    types: {
      pebble:  { r: [9, 13],  v: [250, 320] },
      boulder: { r: [19, 26], v: [170, 225] },
      mega:    { r: [35, 43], v: [120, 155] }
    },
    // difficulty by seconds survived. gap = seconds between spawns, speed = multiplier
    levels: [
      { from: 0,  name: 'Easy',       gap: 1.05, speed: 1.00, mix: { pebble: 1 } },
      { from: 10, name: 'Warming up', gap: 0.80, speed: 1.05, mix: { pebble: 1 } },
      { from: 20, name: 'Rocky',      gap: 0.68, speed: 1.20, mix: { pebble: 0.6, boulder: 0.4 } },
      { from: 35, name: 'Heavy',      gap: 0.60, speed: 1.35, mix: { pebble: 0.45, boulder: 0.4, mega: 0.15 } },
      { from: 50, name: 'Chaos',      gap: 0.50, speed: 1.50, mix: { pebble: 0.4, boulder: 0.38, mega: 0.22 } },
      { from: 70, name: 'Legend',     gap: 0.42, speed: 1.70, mix: { pebble: 0.38, boulder: 0.37, mega: 0.25 },
        ramp: { every: 10, gapStep: 0.03, gapMin: 0.3, speedStep: 0.08, speedMax: 2.3 } }
    ],
    bonuses: { 15: 5, 30: 10, 60: 25, 90: 50 },   // seconds -> extra points
    minGap: 46,                                    // smallest escape route (px) we always leave open
    storageKey: 'rockfall.best.v1'
  };

  var API = '/api/rockfall';
  function jfetch(url, opt) {
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || 'http'); e.code = d.error || ('http' + r.status); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  var Leaderboard = {
    enabled: false, ready: null,
    // asks the server once, retrying a couple of times so a slow cold start does not switch the board off for the whole visit
    probe: function (force) {
      if (this.ready && !force) return this.ready;
      var n = 0;
      function once() {
        return jfetch(API + '/top?range=all').then(function () { Leaderboard.enabled = true; return true; }, function () {
          if (++n < 3) return new Promise(function (r) { setTimeout(r, 700 * n); }).then(once);
          Leaderboard.enabled = false; return false;
        });
      }
      this.ready = once(); return this.ready;
    },
    start: function () { return jfetch(API + '/start', { method: 'POST' }); },
    submit: function (run) { return jfetch(API + '/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) }); },
    top: function (range, score) { return jfetch(API + '/top?range=' + (range || 'all') + (score ? '&score=' + score : '')); }
  };

  // ---------- small helpers ----------
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function parse(c) {
    c = (c || '').trim();
    var m = /^#([0-9a-f]{3,8})$/i.exec(c);
    if (m) { var h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    m = /rgba?\(([^)]+)\)/.exec(c); if (m) { var p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2]]; }
    return [128, 128, 128];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, al) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (al == null ? 1 : al) + ')'; }
  function fmt(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
  function store(get, val) {
    try { if (get) return JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null'); localStorage.setItem(CONFIG.storageKey, JSON.stringify(val)); } catch (e) {}
    return null;
  }

  // ---------- the art: replace ART.player, ART.rock or ART.world to change how it looks ----------
  // They only draw. ART.player(ctx, pose, palette, size). pose = { x, y (body centre), gy (ground top, for the shadow),
  //   t (seconds), vx, step (run cycle), look (-1..1, towards the nearest rock), fear (0..1, a rock is close),
  //   hit (1..0, just hit), joy (0..1, new record), jump (px) }
  var WARM = [196, 168, 132], DARK = [21, 21, 21], HAT = [247, 190, 55], HAT2 = [222, 152, 26];
  function rockPath(ctx, r) {
    ctx.beginPath();
    r.pts.forEach(function (p, i) { var x = Math.cos(p[0]) * p[1] * r.r, y = Math.sin(p[0]) * p[1] * r.r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
  }
  var ART = {
    player: function (ctx, p, pal, s) {
      var move = clamp(Math.abs(p.vx) / 700, 0, 1), bob = Math.sin(p.t * 3.2) * 0.06 * (1 - p.fear) * s;
      var sx = 1 + move * 0.1 - p.fear * 0.06 + p.joy * 0.05, sy = 1 - move * 0.08 - p.fear * 0.09 - p.joy * 0.03 + p.hit * 0.1;
      var flash = p.hit > 0 && Math.floor(p.t * 20) % 2, body = flash ? mix(pal.accent, pal.bg, 0.5) : pal.accent;
      var dark = mix(pal.accent, [0, 0, 0], 0.38), belly = mix(pal.accent, [255, 255, 255], 0.5);
      // soft shadow on the ground, smaller the higher the character is
      var up = clamp((p.gy - p.y) / (s * 9), 0, 1);
      ctx.save(); ctx.translate(p.x, p.gy);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.24 * (1 - up * 0.7)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(0, 1, s * (1 - up * 0.4), s * 0.2 * (1 - up * 0.4), 0, 0, 6.3); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(p.x, p.y + bob - (p.jump || 0));
      ctx.rotate(clamp(p.vx / 2400, -0.26, 0.26) + p.hit * Math.sin(p.t * 40) * 0.12);
      ctx.scale(sx, sy);
      // feet: they take turns lifting when running
      var lift = move > 0.08 ? Math.sin(p.step) : 0, fl = Math.max(0, lift) * 0.2 * s, fr = Math.max(0, -lift) * 0.2 * s;
      ctx.fillStyle = css(dark);
      ctx.beginPath(); ctx.ellipse(-0.4 * s, 0.9 * s - fl, 0.3 * s, 0.17 * s, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0.4 * s, 0.9 * s - fr, 0.3 * s, 0.17 * s, 0, 0, 6.3); ctx.fill();
      // arms: down at rest, up when a rock is close, waving when celebrating, flung out when hit
      var aL = p.joy > 0.2 ? 4.2 + Math.sin(p.t * 14) * 0.25 : p.hit > 0 ? 3.4 + Math.sin(p.t * 30) * 0.15 : 2.55 + p.fear * 1.5 + Math.sin(p.t * 3.2) * 0.05;
      ctx.strokeStyle = css(body); ctx.lineWidth = 0.26 * s; ctx.lineCap = 'round';
      [[-1, aL], [1, Math.PI - aL]].forEach(function (a) { var bx = a[0] * 0.9 * s, by = 0.12 * s; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a[1]) * 0.42 * s, by + Math.sin(a[1]) * 0.42 * s); ctx.stroke(); });
      // body and belly
      ctx.fillStyle = css(body); ctx.beginPath(); ctx.ellipse(0, 0, 0.98 * s, 0.92 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = css(belly, 0.5); ctx.beginPath(); ctx.ellipse(0, 0.32 * s, 0.56 * s, 0.46 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(-0.6 * s, -0.05 * s, 0.14 * s, 0.3 * s, 0.3, 0, 6.3); ctx.fill();
      ctx.fillStyle = css(mix(pal.accent, [255, 120, 140], 0.55), 0.35);
      [-1, 1].forEach(function (d) { ctx.beginPath(); ctx.ellipse(d * 0.64 * s, 0.22 * s, 0.14 * s, 0.09 * s, 0, 0, 6.3); ctx.fill(); });
      // the hard hat (it is a rockfall, after all). It pops off when the character is hit.
      var pop = p.hit > 0 ? Math.sin(clamp((1 - p.hit) * 3, 0, 1) * Math.PI) : 0, hy = -0.62 * s - pop * 0.9 * s - p.joy * Math.abs(Math.sin(p.t * 9)) * 0.1 * s;
      ctx.save(); ctx.translate(0, hy); ctx.rotate(pop * 0.5);
      ctx.fillStyle = css(HAT); ctx.beginPath(); ctx.moveTo(-0.78 * s, 0); ctx.bezierCurveTo(-0.78 * s, -0.95 * s, 0.78 * s, -0.95 * s, 0.78 * s, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = css(HAT2); ctx.fillRect(-0.09 * s, -0.72 * s, 0.18 * s, 0.5 * s);
      ctx.beginPath(); ctx.ellipse(0, 0.04 * s, 0.98 * s, 0.1 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(-0.36 * s, -0.4 * s, 0.14 * s, 0.07 * s, -0.6, 0, 6.3); ctx.fill();
      ctx.restore();
      // eyes: wide when a rock is close, tiny pupils when hit, a blink every few seconds
      var wide = 1 + p.fear * 0.25 + (p.hit > 0 ? 0.3 : 0), ex = 0.34 * s, ey = -0.08 * s, er = 0.27 * s * wide, eh = 0.33 * s * wide;
      var blink = p.hit <= 0 && p.fear < 0.3 && ((p.t * 1000 + 400) % 3800) < 130;
      [-1, 1].forEach(function (d) {
        var cx = d * ex;
        if (blink) { ctx.strokeStyle = css(DARK); ctx.lineWidth = 0.09 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, ey, er * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); return; }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, ey, er, eh, 0, 0, 6.3); ctx.fill();
        var pr = p.hit > 0 ? 0.07 * s : (0.15 - p.fear * 0.05) * s, px = cx + p.look * er * 0.4, py = ey + 0.03 * s;
        ctx.fillStyle = css(DARK); ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + pr * 0.35, py - pr * 0.3, pr * 0.3, 0, 6.3); ctx.fill();
      });
      // mouth: a smile, a small o when a rock is close, a big O when hit, a grin when celebrating
      var my = 0.32 * s; ctx.strokeStyle = css(DARK); ctx.lineWidth = 0.09 * s; ctx.lineCap = 'round'; ctx.fillStyle = css(DARK);
      if (p.hit > 0) { ctx.beginPath(); ctx.ellipse(0, my + 0.05 * s, 0.14 * s, 0.2 * s, 0, 0, 6.3); ctx.fill(); }
      else if (p.joy > 0.2) { ctx.beginPath(); ctx.arc(0, my - 0.05 * s, 0.3 * s, 0.05 * Math.PI, 0.95 * Math.PI); ctx.closePath(); ctx.fill(); }
      else if (p.fear > 0.35) { ctx.beginPath(); ctx.ellipse(0, my + 0.03 * s, 0.09 * s, 0.12 * s, 0, 0, 6.3); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, my - 0.1 * s, 0.2 * s, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
      // a sweat drop when things get tense
      if (p.fear > 0.5 && p.hit <= 0) { var sw = (p.t * 2) % 1; ctx.fillStyle = 'rgba(170,220,255,0.9)'; ctx.beginPath(); ctx.ellipse(0.86 * s, -0.5 * s + sw * 0.25 * s, 0.07 * s, 0.1 * s, 0, 0, 6.3); ctx.fill(); }
      ctx.restore();
    },
    rock: function (ctx, r, pal, a) {
      a = a == null ? 1 : a;
      var tone = r.type === 'mega' ? 0.34 : r.type === 'boulder' ? 0.46 : 0.56, body = mix(mix(pal.ink, pal.bg, tone), WARM, 0.16), i;
      var tr = r.tr;
      if (tr && tr.length > 1 && r.v > 210) {   // motion trail on the faster rocks
        ctx.save(); ctx.lineCap = 'round';
        for (i = 1; i < tr.length; i++) { var f = i / tr.length; ctx.strokeStyle = css(body, 0.2 * f * a); ctx.lineWidth = Math.max(1, r.r * 1.5 * f); ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke(); }
        ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = a; ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      rockPath(ctx, r); ctx.fillStyle = css(body); ctx.fill();
      ctx.save(); ctx.clip(); ctx.rotate(-r.rot);       // the light stays top left while the rock tumbles
      var gr = ctx.createLinearGradient(-r.r, -r.r, r.r, r.r); gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = gr; ctx.fillRect(-r.r * 1.3, -r.r * 1.3, r.r * 2.6, r.r * 2.6);
      ctx.restore();
      if (r.type !== 'pebble') { ctx.strokeStyle = css(pal.bg, 0.4); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(r.r * 0.1, -r.r * 0.1); ctx.lineTo(r.r * 0.35, r.r * 0.25); ctx.lineTo(r.r * 0.2, r.r * 0.5); if (r.type === 'mega') { ctx.moveTo(r.r * 0.35, r.r * 0.25); ctx.lineTo(r.r * 0.62, r.r * 0.2); ctx.moveTo(-r.r * 0.3, r.r * 0.1); ctx.lineTo(-r.r * 0.1, r.r * 0.4); } ctx.stroke(); }
      rockPath(ctx, r); ctx.strokeStyle = r.type === 'mega' ? css(pal.accent, 0.9) : css(pal.ink, 0.4); ctx.lineWidth = r.type === 'mega' ? 2.2 : 1.3; ctx.stroke();
      ctx.restore();
    },
    // distant rock stacks, a stone ground with sprouts, drifting dust. lvF (0..1) rises with the level.
    world: function (ctx, w, pal, W, H, t, lvF, px, calm) {
      var gy = H - w.gh, off = px - W / 2;
      var gl = ctx.createLinearGradient(0, gy - H * 0.55, 0, gy); gl.addColorStop(0, css(pal.accent, 0)); gl.addColorStop(1, css(pal.accent, 0.05 + 0.1 * lvF));
      ctx.fillStyle = gl; ctx.fillRect(0, gy - H * 0.55, W, H * 0.55);
      [[w.far, 0.93, -0.02], [w.mid, 0.87, -0.05]].forEach(function (L) {
        ctx.fillStyle = css(mix(pal.ink, pal.bg, L[1])); var dx = off * L[2];
        L[0].forEach(function (m) { ctx.beginPath(); ctx.moveTo(m.x + dx, gy); m.pts.forEach(function (q) { ctx.lineTo(m.x + dx + q[0] * m.w, gy - q[1] * m.h); }); ctx.lineTo(m.x + dx + m.w, gy); ctx.closePath(); ctx.fill(); });
      });
      ctx.fillStyle = css(mix(pal.ink, pal.bg, 0.92)); ctx.fillRect(0, gy, W, w.gh);
      ctx.strokeStyle = css(pal.ink, 0.06); ctx.lineWidth = 1;
      [0.4, 0.72].forEach(function (f) { ctx.beginPath(); ctx.moveTo(0, gy + w.gh * f + 0.5); ctx.lineTo(W, gy + w.gh * f + 0.5); ctx.stroke(); });
      ctx.fillStyle = css(pal.ink, 0.07); w.stones.forEach(function (s) { ctx.beginPath(); ctx.ellipse(s.x, gy + s.y * w.gh, s.r * 1.5, s.r, 0, 0, 6.3); ctx.fill(); });
      var eg = ctx.createLinearGradient(0, gy, 0, gy + 16); eg.addColorStop(0, css(pal.accent, 0.16 + 0.1 * lvF)); eg.addColorStop(1, css(pal.accent, 0)); ctx.fillStyle = eg; ctx.fillRect(0, gy, W, 16);
      ctx.fillStyle = css(mix(pal.accent, pal.bg, 0.3), 0.9); ctx.fillRect(0, gy, W, 2);
      ctx.strokeStyle = css(pal.accent, 0.6); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      w.tufts.forEach(function (f) { var sw = calm ? 0 : Math.sin(t * 1.6 + f.ph) * 1.2; ctx.beginPath(); ctx.moveTo(f.x, gy + 1); ctx.lineTo(f.x + sw - 2, gy - f.h); ctx.moveTo(f.x, gy + 1); ctx.lineTo(f.x + sw + 2.5, gy - f.h * 0.8); ctx.stroke(); });
      if (!calm) {   // dust sifting down, faster as the level rises
        ctx.fillStyle = css(pal.ink, 0.13);
        w.motes.forEach(function (m) { var y = gy * (((m.fy + t * m.v * (0.012 + 0.03 * lvF)) % 1 + 1) % 1), x = m.fx * W + Math.sin(t * 0.5 + m.ph) * 8; ctx.beginPath(); ctx.arc(x, y, m.s, 0, 6.3); ctx.fill(); });
      }
    }
  };

  function init(root) {
    var cta = root.querySelector('[data-rf-open]'), stage = root.querySelector('[data-rf-stage]'), arena = root.querySelector('[data-rf-arena]');
    var canvas = root.querySelector('[data-rf-canvas]'), overlay = root.querySelector('[data-rf-overlay]');
    var elScore = root.querySelector('[data-rf-score]'), elTime = root.querySelector('[data-rf-time]'), elLevel = root.querySelector('[data-rf-level]');
    var elBest = root.querySelector('[data-rf-best]'), pips = root.querySelector('[data-rf-pips]'), live = root.querySelector('[data-rf-live]');
    var elBestHint = root.querySelector('[data-rf-besthint]'), soundBtn = root.querySelector('[data-rf-sound]');
    var ctx = canvas.getContext('2d');
    var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 0, H = 0, dpr = 1, scale = 1;
    var state = 'idle';              // idle (closed) | ready | playing | hit | over | paused
    var pal = null, palN = 0;
    var best = store(true) || { score: 0, time: 0 };
    var g;                           // the current run
    var raf = 0, last = 0, visible = false, open = false, sound = false, actx = null, resumeGrace = 0;
    var pointer = { x: 0, y: 0, has: false, touch: false };
    var fx = [];                     // particles
    var world = null, T = 0, lvlBanner = 0;
    var coarse = matchMedia('(pointer: coarse)').matches;
    function GH() { return world ? world.gh : 40; }
    function psz() { return CONFIG.player.size * clamp(scale, 0.9, 1.2); }          // drawn size of the character
    function hitR() { return CONFIG.player.hit * (psz() / CONFIG.player.size); }    // hit radius grows with it
    function floorY() { return H - GH() - psz() * 0.98; }                           // where the feet touch the ground
    function addFx(o) { fx.push(Object.assign({ vx: 0, vy: 0, rot: 0, vr: 0, life: 0.6, max: 0.6, s: 3, c: [255, 255, 255] }, o)); }

    // ---------- layout ----------
    function resize() {
      var r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(200, r.width); H = Math.max(200, r.height); scale = H / CONFIG.referenceHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildWorld();
      if (g) { g.p.x = clamp(g.p.x, 20, W - 20); g.p.y = state === 'playing' ? clamp(g.p.y, 20, floorY()) : floorY(); g.p.ty = clamp(g.p.ty, 18, floorY()); }
      draw(0);
    }
    function buildWorld() {   // seeded, so the scenery is the same every time
      var r = rng(90210), gh = Math.round(clamp(H * 0.12, 34, 56)), k = clamp(scale, 0.85, 1.2), far = [], mid = [], x, i;
      function range(list, wMin, wMax, hMin, hMax) {
        x = -60;
        while (x < W + 60) {
          var wd = (wMin + r() * (wMax - wMin)) * k, n = 5 + Math.floor(r() * 3), pts = [], prev = 0.5, j;
          for (j = 0; j < n; j++) { prev = j && r() < 0.3 ? prev : 0.35 + r() * 0.65; pts.push([j / (n - 1), prev]); }
          list.push({ x: x, w: wd, h: (hMin + r() * (hMax - hMin)) * k, pts: pts }); x += wd * (0.55 + r() * 0.4);
        }
      }
      range(far, 120, 240, 70, 130); range(mid, 80, 170, 34, 74);
      var st = [], tf = [], mo = [];
      for (i = 0; i < Math.round(W / 55); i++) st.push({ x: r() * W, y: 0.25 + r() * 0.65, r: 1.5 + r() * 3 });
      for (i = 0; i < Math.round(W / 70); i++) tf.push({ x: 12 + r() * (W - 24), h: 5 + r() * 6, ph: r() * 6 });
      for (i = 0; i < 16; i++) mo.push({ fx: r(), fy: r(), v: 0.4 + r() * 0.9, ph: r() * 6, s: 0.8 + r() * 1.4 });
      world = { gh: gh, far: far, mid: mid, stones: st, tufts: tf, motes: mo };
    }
    function colours() {
      var s = getComputedStyle(document.documentElement);
      pal = { bg: parse(s.getPropertyValue('--bg')), ink: parse(s.getPropertyValue('--ink')), accent: parse(s.getPropertyValue('--accent')), onAccent: parse(s.getPropertyValue('--on-accent')), muted: parse(s.getPropertyValue('--muted')), guide: parse(s.getPropertyValue('--guide')), panel: parse(s.getPropertyValue('--panel')), mono: (s.getPropertyValue('--font-mono') || 'monospace').trim() };
    }

    // ---------- a run ----------
    function newRun() {
      var seed = (Math.random() * 4294967295) >>> 0;
      g = { seed: seed, rand: rng(seed), t: 0, score: 0, rocks: [], spawnIn: 0.9, recent: [], bonus: {}, inputs: [], inT: 0, shake: 0, flash: 0, hitT: 0, joy: 0, lastSec: -1, lastLevel: -1, newRecord: false, lvF: 0, near: 0, lastNear: -9,
        p: { x: W / 2, y: floorY(), vx: 0, tx: W / 2, ty: floorY(), t: 0, step: 0, look: 0, fear: 0, hit: 0, joy: 0, gy: H - GH() } };
      pointer.has = false; fx.length = 0;
    }
    function levelAt(t) {
      var L = CONFIG.levels, i = 0; for (var k = 0; k < L.length; k++) if (t >= L[k].from) i = k;
      var lv = L[i], gap = lv.gap, speed = lv.speed;
      if (lv.ramp) { var n = Math.floor((t - lv.from) / lv.ramp.every); gap = Math.max(lv.ramp.gapMin, gap - n * lv.ramp.gapStep); speed = Math.min(lv.ramp.speedMax, speed + n * lv.ramp.speedStep); }
      return { i: i, name: lv.name, gap: gap, speed: speed, mix: lv.mix };
    }
    function pickType(mix, rand) { var x = rand(), a = 0, k; for (k in mix) { a += mix[k]; if (x <= a) return k; } return 'pebble'; }
    function makeRock(type, x, lv) {
      var T = CONFIG.types[type], rand = g.rand, r = (T.r[0] + rand() * (T.r[1] - T.r[0])) * Math.min(1.15, Math.max(0.85, scale));
      var n = type === 'pebble' ? 7 : 9, pts = [], k;
      for (k = 0; k < n; k++) pts.push([(k / n) * 6.2832 + (rand() - 0.5) * 0.3, 0.82 + rand() * 0.26]);
      return { type: type, x: x, y: -r - 4, r: r, v: (T.v[0] + rand() * (T.v[1] - T.v[0])) * lv.speed * scale, rot: rand() * 6.28, vr: (rand() - 0.5) * (type === 'mega' ? 0.9 : 2.4), pts: pts, near: false, tr: [], nm: 0, minD: 1e9 };
    }
    // keep a way through: the free horizontal gaps among rocks that are still near the top, plus the new one
    function fair(x, r) {
      var ivs = [], pr = hitR() + 6, k, zone = H * 0.45;
      g.rocks.forEach(function (o) { if (o.y < zone) ivs.push([o.x - o.r - pr, o.x + o.r + pr]); });
      ivs.push([x - r - pr, x + r + pr]); ivs.sort(function (a, b) { return a[0] - b[0]; });
      var cur = 0, big = 0;
      for (k = 0; k < ivs.length; k++) { big = Math.max(big, ivs[k][0] - cur); cur = Math.max(cur, ivs[k][1]); }
      big = Math.max(big, W - cur);
      return big >= CONFIG.minGap + pr * 0;
    }
    function spawn(lv) {
      var type = pickType(lv.mix, g.rand), tries = 0, rock, x, T = CONFIG.types[type];
      while (tries++ < 7) {
        var aim = lv.i >= 3 && g.rand() < 0.22 + lv.i * 0.03;
        x = aim ? clamp(g.p.tx + (g.rand() - 0.5) * 120, 12, W - 12) : 12 + g.rand() * (W - 24);
        rock = makeRock(type, x, lv); rock.x = clamp(rock.x, rock.r, W - rock.r);
        if (fair(rock.x, rock.r)) { g.rocks.push(rock); return true; }
      }
      return false;
    }

    // ---------- update ----------
    function update(dt) {
      var p = g.p, lv = levelAt(g.t), k;
      if (state === 'playing') {
        g.t += dt;
        var sec = Math.floor(g.t);
        if (sec !== g.lastSec) {
          g.lastSec = sec; g.score = sec;
          var b; for (b in CONFIG.bonuses) if (sec >= +b && !g.bonus[b]) { g.bonus[b] = 1; g.bonusTotal = (g.bonusTotal || 0) + CONFIG.bonuses[b]; toast('+' + CONFIG.bonuses[b] + ' bonus at ' + b + 's'); tone('up'); }
          g.score = sec + (g.bonusTotal || 0); hud();
        }
        if (lv.i !== g.lastLevel) { var firstLv = g.lastLevel < 0; g.lastLevel = lv.i; hud(); if (!firstLv) levelUp(lv); }
        g.spawnIn -= dt;
        if (g.spawnIn <= 0) { var ok = spawn(lv); g.spawnIn = ok ? lv.gap * (0.8 + g.rand() * 0.45) : 0.12; }
        g.inT += dt; if (g.inT >= 0.1) { g.inT = 0; if (g.inputs.length < 6000) g.inputs.push([Math.round(p.tx), Math.round(p.ty)]); }
      }
      // player eases toward the pointer
      if (state === 'playing' || state === 'ready' || state === 'over') {
        var kf = 1 - Math.exp(-CONFIG.player.follow * dt), ox = p.x;
        if (state === 'playing') { p.x += (p.tx - p.x) * kf; p.y += (p.ty - p.y) * kf; }
        else if (state === 'ready' && !calm) { demo(dt, kf); }
        else { p.tx = p.x; p.ty = p.y; }
        p.x = clamp(p.x, 18, W - 18); p.y = clamp(p.y, 18, floorY());
        p.vx = dt ? (p.x - ox) / dt : 0; p.step += Math.abs(p.vx) * dt * 0.025;
      }
      p.t += dt; g.lvF += (lv.i / (CONFIG.levels.length - 1) - g.lvF) * Math.min(1, dt * 1.5);
      // rocks
      var nearest = null, nd = 1e9, fear = 0;
      var gyT = H - GH(), hr = hitR();
      for (k = g.rocks.length - 1; k >= 0; k--) {
        var o = g.rocks[k];
        if (state !== 'paused') { o.y += o.v * dt; o.rot += o.vr * dt; o.tr.push([o.x, o.y]); if (o.tr.length > 7) o.tr.shift(); }
        if (o.y + o.r * 0.6 >= gyT) { landed(o, gyT); g.rocks.splice(k, 1); continue; }
        var dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
        if (state === 'playing') {
          if (d < o.r * 0.86 + hr) { crash(o); break; }
          if (d < nd && o.y < p.y + 10) { nd = d; nearest = o; }
          if (d < o.minD) o.minD = d;
          if (!o.nm && o.y > p.y + 6) { o.nm = 1; if (o.minD < o.r * 0.86 + hr + 20 * (psz() / CONFIG.player.size)) nearMiss(); }
        }
      }
      if (nearest) { fear = clamp(1 - (nd - nearest.r - 20) / 110, 0, 1); p.look = clamp((nearest.x - p.x) / 60, -1, 1); } else p.look *= 0.9;
      p.fear += (fear - p.fear) * Math.min(1, dt * 10);
      p.hit = state === 'hit' ? Math.max(0, p.hit - dt * 0.9) : 0;
      p.joy = state === 'over' && g.newRecord ? 1 : 0; p.jump = p.joy && !calm ? Math.abs(Math.sin(p.t * 5)) * 16 : 0;
      if (state === 'hit') { g.hitT -= dt; if (g.hitT <= 0) finish(); }
      g.shake = Math.max(0, g.shake - dt * 2.8); g.flash = Math.max(0, g.flash - dt * 3);
      for (k = fx.length - 1; k >= 0; k--) { var f = fx[k]; f.life -= dt; if (f.life <= 0) { fx.splice(k, 1); continue; } f.vy += (f.g == null ? 520 : f.g) * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
    }
    // title screen: a few slow rocks fall at the edges and the character dodges them by itself,
    // so it reads as a game before anyone clicks. The middle stays calm for the title.
    function demo(dt, kf) {
      var p = g.p, k, push = 0, want = W * (0.5 + Math.sin(p.t * 0.35) * 0.3);
      g.spawnIn -= dt;
      if (g.spawnIn <= 0) {
        var type = g.rand() < 0.75 ? 'pebble' : 'boulder', x = g.rand() < 0.5 ? W * (0.04 + g.rand() * 0.24) : W * (0.72 + g.rand() * 0.24), ro = makeRock(type, x, levelAt(6));
        ro.v *= 0.55; ro.x = clamp(x, ro.r, W - ro.r); g.rocks.push(ro); g.spawnIn = 1.2 + g.rand() * 1.0;
      }
      for (k = 0; k < g.rocks.length; k++) {
        var o = g.rocks[k], dx = p.x - o.x;
        if (o.y < p.y && o.y > p.y - H * 0.7 && Math.abs(dx) < o.r + 48) push += (dx >= 0 ? 1 : -1) * (o.r + 60 - Math.abs(dx));
      }
      p.tx = clamp(want + push * 3, 30, W - 30); p.ty = floorY();
      p.x += (p.tx - p.x) * Math.min(1, kf * 0.5); p.y = floorY();
    }
    // a rock reaches the ground: a puff of dust and a few chips
    function landed(o, gy) {
      var n = o.type === 'mega' ? 9 : o.type === 'boulder' ? 6 : 3, i, c = mix(pal ? pal.ink : [200, 200, 200], pal ? pal.bg : [10, 10, 10], 0.45);
      if (calm) n = Math.min(n, 2);
      for (i = 0; i < n; i++) addFx({ kind: 'dust', x: o.x + (Math.random() - 0.5) * o.r * 1.6, y: gy - 2, vx: (Math.random() - 0.5) * 70, vy: -14 - Math.random() * 40, g: -6, r: o.r * (0.22 + Math.random() * 0.2), life: 0.55 + Math.random() * 0.4, max: 0.95, c: c });
      for (i = 0; i < Math.min(4, n); i++) addFx({ x: o.x, y: gy - 3, vx: (Math.random() - 0.5) * 160, vy: -80 - Math.random() * 90, life: 0.5, max: 0.5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, s: 2 + Math.random() * 2, c: c });
      if (state === 'playing' && o.type === 'mega' && !calm) g.shake = Math.max(g.shake, 0.22);
    }
    // a rock went past closer than comfortable
    function nearMiss() {
      var p = g.p; g.near++; p.fear = Math.max(p.fear, 0.9);
      addFx({ kind: 'ring', x: p.x, y: p.y, r: psz() * 0.9, life: 0.45, max: 0.45, c: pal.accent, g: 0 });
      if (g.t - g.lastNear > 0.7) addFx({ kind: 'txt', t: 'Close!', x: p.x, y: p.y - psz() * 1.5, vy: -34, g: 0, life: 0.8, max: 0.8, c: pal.accent });
      g.lastNear = g.t; tone('near');
    }
    function levelUp(lv) {
      if (lvlBanner) { lvlBanner.remove(); }
      var b = document.createElement('div'); b.className = 'rf__lvl'; b.innerHTML = '<small>Level up</small><b></b>'; b.lastChild.textContent = lv.name; arena.appendChild(b); lvlBanner = b;
      setTimeout(function () { b.remove(); if (lvlBanner === b) lvlBanner = 0; }, 1700);
      g.shake = Math.max(g.shake, 0.18); tone('up'); announce('Level up. ' + lv.name + '.');
    }
    function burst(x, y, n, spread, cols) {
      if (calm) n = Math.min(n, 4);
      for (var k = 0; k < n; k++) { var a = Math.random() * 6.28, s = 60 + Math.random() * spread; fx.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, life: 0.7 + Math.random() * 0.7, max: 1.4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, c: cols[k % cols.length], s: 2 + Math.random() * 3 }); }
    }
    function crash(o) {
      state = 'hit'; g.hitT = 0.85; g.p.hit = 1; g.shake = calm ? 0 : 1; g.flash = 1;
      burst(g.p.x, g.p.y, 14, 190, [mix(pal.ink, pal.bg, 0.5), pal.accent]); tone('hit');
      root.setAttribute('data-rf-state', 'hit'); canvas.style.touchAction = ''; arena.classList.remove('is-playing');
    }
    function finish() {
      state = 'over'; var t = g.t, score = g.score;
      g.newRecord = score > best.score && score > 0;
      if (g.newRecord) { best = { score: score, time: t }; store(false, best); burst(W / 2, H * 0.4, 46, 280, [pal.accent, pal.ink, mix(pal.accent, pal.bg, 0.5)]); tone('win'); }
      hud(); overlayOver(t, score); root.setAttribute('data-rf-state', 'over');
      announce('Game over. You survived for ' + fmt(t) + ' and scored ' + score + (g.newRecord ? '. New personal best.' : '.'));
    }

    // ---------- drawing ----------
    function draw() {
      if (!pal) colours();
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (g && g.shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * 9 * g.shake, (Math.random() - 0.5) * 7 * g.shake);
      ART.world(ctx, world, pal, W, H, T, g ? g.lvF : 0, g ? g.p.x : W / 2, calm);
      if (!g) { ctx.restore(); return; }
      var ra = state === 'ready' ? 0.6 : 1;
      g.rocks.forEach(function (o) { ART.rock(ctx, o, pal, ra); });
      g.p.gy = H - GH(); ART.player(ctx, g.p, pal, psz());
      fx.forEach(function (f) {
        var a = clamp(f.life / f.max, 0, 1);
        ctx.save();
        if (f.kind === 'dust') { ctx.fillStyle = css(f.c, 0.3 * a); ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.7 - a * 0.7), 0, 6.3); ctx.fill(); }
        else if (f.kind === 'ring') { ctx.strokeStyle = css(f.c, a * 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + (1 - a) * 1.2), 0, 6.3); ctx.stroke(); }
        else if (f.kind === 'txt') { ctx.fillStyle = css(f.c, a); ctx.font = '600 11px ' + pal.mono; ctx.textAlign = 'center'; ctx.fillText(f.t, f.x, f.y); }
        else { ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = css(f.c, a); ctx.fillRect(-f.s / 2, -f.s / 2, f.s, f.s * 1.4); }
        ctx.restore();
      });
      ctx.restore();
      if (g.flash > 0 && !calm) { ctx.fillStyle = css(pal.accent, g.flash * 0.12); ctx.fillRect(0, 0, W, H); }
    }

    // ---------- the loop ----------
    function frame(now) {
      raf = 0; if (!open || !visible || document.hidden) { last = 0; return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      if (resumeGrace > 0) { resumeGrace -= dt; dt = 0; }
      T += dt;
      if (g) update(dt);
      palN++; if (palN % 45 === 0) colours();
      draw();
      raf = requestAnimationFrame(frame);
    }
    function loop() { if (!raf && open && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

    // ---------- HUD and overlays ----------
    function hud() {
      var lv = levelAt(g ? g.t : 0), sc = g ? g.score : 0, prev = +elScore.textContent || 0;
      elScore.textContent = sc;
      if (sc - prev > 1) { elScore.classList.remove('is-bump'); void elScore.offsetWidth; elScore.classList.add('is-bump'); }   // a bonus lands
      elTime.textContent = fmt(g ? g.t : 0); elLevel.textContent = lv.name; elBest.textContent = best.score;
      var s = '', k; for (k = 0; k < CONFIG.levels.length; k++) s += '<span' + (k <= lv.i ? ' class="is-on"' : '') + '></span>'; pips.innerHTML = s;
      if (elBestHint) elBestHint.textContent = best.score ? 'Your best: ' + best.score : '';
    }
    function announce(t) { if (live) live.textContent = t; }
    function toast(t) { var el = document.createElement('div'); el.className = 'rf__toast'; el.textContent = t; arena.appendChild(el); setTimeout(function () { el.remove(); }, 1400); }
    // ---------- screens ----------
    var tokenP = null, lastScore = null, name = '';
    try { name = localStorage.getItem('rockfall.name') || ''; } catch (e) {}
    function thin(a) { var step = Math.max(5, Math.ceil(a.length / 1200)); return a.filter(function (x, i) { return i % step === 0; }); }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function setBoardMode(on) { arena.classList.toggle('is-board', on); }
    function overlayReady() {
      setBoardMode(false); overlay.hidden = false; overlay.className = 'rf__overlay is-title';
      var letters = 'ROCKFALL'.split('').map(function (c, i) { return '<span style="--i:' + i + ';--r:' + ((i % 2 ? 1 : -1) * (6 + i * 2)) + '" aria-hidden="true">' + c + '</span>'; }).join('');
      overlay.innerHTML = '<div class="rf__titlescreen"><p class="rf__logo" aria-label="ROCKFALL">' + letters + '</p>' +
        '<p class="rf__headline">One character. Endless falling rocks. How long can you survive?</p>' +
        '<button type="button" class="rf__play" data-rf-start><span>Let\'s play</span><i aria-hidden="true">&rarr;</i></button>' +
        '<p class="rf__controls">' + (coarse ? 'Drag your finger' : 'Move with your cursor') + ' &middot; Dodge everything</p>' +
        (Leaderboard.enabled ? '<div class="rf__lbrow"><button type="button" class="rf__lbbtn" data-rf-board><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5h8v4.2a4 4 0 0 1-8 0zM6 5H3.5c0 2 1 3.4 2.6 3.8M14 5h2.5c0 2-1 3.4-2.6 3.8M10 11.7V15M7 16.5h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Leaderboard</button><ol class="rf__podium" data-rf-podium aria-label="Top players"></ol></div>' : '') + '</div>';
      overlay.querySelector('[data-rf-start]').addEventListener('click', start);
      var bb = overlay.querySelector('[data-rf-board]'); if (bb) bb.addEventListener('click', function () { showBoard({ range: 'all', back: overlayReady }); });
      if (Leaderboard.enabled) Leaderboard.top('all').then(function (d) {
        var ol = overlay.querySelector('[data-rf-podium]'); if (!ol || state !== 'ready') return;
        (d.top || []).slice(0, 3).forEach(function (r, i) { var li = el('li', ''); li.appendChild(el('b', '', String(i + 1))); li.appendChild(el('span', '', r.name)); li.appendChild(el('em', '', String(r.score))); ol.appendChild(li); });
      }, function () {});
    }
    function overlayOver(t, score) {
      setBoardMode(false); overlay.hidden = false; overlay.className = 'rf__overlay is-over' + (g.newRecord ? ' is-record' : '');
      var can = Leaderboard.enabled && tokenP && score >= 1, run = g;
      if (!can && tokenP && score >= 1) Promise.resolve(tokenP).then(function (tk) { if (tk && tk.token && state === 'over' && !overlay.querySelector('[data-rf-form]')) overlayOver(t, score); });
      overlay.innerHTML = '<div class="rf__result">' + (g.newRecord ? '<p class="rf__rbadge"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z" fill="currentColor"/></svg>New record</p>' : '') +
        '<h3 class="rf__rtitle">That was close.</h3><p class="rf__rsub">You survived for <b>' + fmt(t) + '</b>. Think you can beat it?</p>' +
        '<dl class="rf__sum"><div><dt>Score</dt><dd>' + score + '</dd></div><div><dt>Time</dt><dd>' + fmt(t) + '</dd></div><div><dt>Best</dt><dd>' + best.score + '</dd></div></dl>' +
        (can ? '<form class="rf__form" data-rf-form novalidate><label class="rf__label" for="rf-name">Put your score on the leaderboard</label><div class="rf__field"><input id="rf-name" name="name" type="text" maxlength="16" autocomplete="nickname" autocapitalize="words" spellcheck="false" placeholder="Your name" aria-describedby="rf-err"><button type="submit" class="rf__btn">Submit score</button></div><p class="rf__err" id="rf-err" data-rf-err role="alert" hidden></p></form><div class="rf__row2"><button type="button" class="rf__play rf__play--sm" data-rf-start><span>One more round</span><i aria-hidden="true">&rarr;</i></button><button type="button" class="rf__ghost" data-rf-skip>View leaderboard</button></div>'
          : '<div class="rf__row2"><button type="button" class="rf__play" data-rf-start><span>One more round</span><i aria-hidden="true">&rarr;</i></button>' + (Leaderboard.enabled ? '<button type="button" class="rf__ghost" data-rf-lbview>Leaderboard</button>' : '') + '</div>') + '</div>';
      overlay.querySelector('[data-rf-start]').addEventListener('click', start);
      var lv = overlay.querySelector('[data-rf-lbview]'); if (lv) lv.addEventListener('click', function () { showBoard({ range: 'all', hypo: score, back: function () { overlayOver(t, score); } }); });
      if (!can) return;
      var form = overlay.querySelector('[data-rf-form]'), input = form.elements.name, err = overlay.querySelector('[data-rf-err]'), btn = form.querySelector('button');
      input.value = name;
      var ERR = { name: 'Pick a name with letters or numbers.', already_submitted: 'That run is already on the board.', slow_down: 'Easy there. Try again in a minute.', time: 'That run did not check out.', stale: 'That run took too long to submit.', score: 'That score did not check out.', path: 'That run did not check out.' };
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var n = input.value.replace(/\s+/g, ' ').trim();
        if (!n) { err.textContent = ERR.name; err.hidden = false; input.focus(); return; }
        err.hidden = true; btn.disabled = true; btn.textContent = 'Submitting';
        Promise.resolve(tokenP).then(function (tk) {
          if (!tk || !tk.token) throw new Error('token');
          return Leaderboard.submit({ token: tk.token, name: n, score: score, duration: Math.round(t * 10) / 10, inputs: thin(run.inputs) });
        }).then(function (res) {
          name = res.name || n; try { localStorage.setItem('rockfall.name', name); } catch (x) {}
          showBoard({ range: 'all', mine: { name: name, score: score, rank: res.rank }, back: function () { overlayOver(t, score); } });
        }).catch(function (x) {
          btn.disabled = false; btn.textContent = 'Submit score';
          err.textContent = ERR[x.code] || 'Could not submit right now. Try again.'; err.hidden = false;
        });
      });
      overlay.querySelector('[data-rf-skip]').addEventListener('click', function () { showBoard({ range: 'all', hypo: score, back: function () { overlayOver(t, score); } }); });
      if (!calm) setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (x) {} }, 700);
    }
    function showBoard(o) {
      setBoardMode(true); overlay.hidden = false; overlay.className = 'rf__overlay is-board';
      var wrap = el('div', 'rf__board'), head = el('div', 'rf__bhead'), ttl = el('h3', 'rf__btitle', 'Leaderboard'), total = el('span', 'rf__total', '');
      head.appendChild(ttl); head.appendChild(total);
      var tabs = el('div', 'rf__tabs'); tabs.setAttribute('role', 'radiogroup'); tabs.setAttribute('aria-label', 'Time range');
      var list = el('ol', 'rf__rows'), note = el('p', 'rf__note'), acts = el('div', 'rf__bact');
      [['all', 'All time'], ['week', 'This week']].forEach(function (r) {
        var b = el('button', '', r[1]); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', r[0] === o.range ? 'true' : 'false');
        b.addEventListener('click', function () { o.range = r[0]; [].forEach.call(tabs.children, function (x, i) { x.setAttribute('aria-checked', ['all', 'week'][i] === o.range ? 'true' : 'false'); }); load(); });
        tabs.appendChild(b);
      });
      var again = el('button', 'rf__btn', 'One more round'); again.type = 'button'; again.addEventListener('click', start);
      var back = el('button', 'rf__ghost', 'Back'); back.type = 'button'; back.addEventListener('click', function () { (o.back || overlayReady)(); });
      acts.appendChild(back); acts.appendChild(again);
      wrap.appendChild(head); wrap.appendChild(tabs); wrap.appendChild(list); wrap.appendChild(note); wrap.appendChild(acts);
      overlay.innerHTML = ''; overlay.appendChild(wrap);
      var token = 0;
      function load() {
        var my = ++token; list.className = 'rf__rows is-loading'; list.innerHTML = ''; note.textContent = '';
        for (var k = 0; k < 6; k++) { var li = el('li', 'rf__row rf__row--sk'); li.innerHTML = '<span></span><span></span><span></span>'; list.appendChild(li); }
        Leaderboard.top(o.range, o.hypo).then(function (d) {
          if (my !== token) return;
          list.className = 'rf__rows'; list.innerHTML = '';
          total.textContent = d.total ? d.total + (d.total === 1 ? ' run' : ' runs') : '';
          var rows = d.top || [], hit = -1;
          if (o.mine) { var want = o.mine.rank && o.mine.rank <= 10 && o.range === 'all' ? o.mine.rank - 1 : -1; hit = want >= 0 ? want : rows.findIndex(function (r) { return r.name === o.mine.name && r.score === o.mine.score; }); }
          if (!rows.length) { list.appendChild(el('li', 'rf__empty', o.range === 'week' ? 'Nothing this week yet. Be the first.' : 'No scores yet. Be the first.')); }
          rows.forEach(function (r, i) { list.appendChild(rowEl(i + 1, r.name, r.duration, r.score, i === hit, i)); });
          if (o.mine && hit < 0 && o.range === 'all' && o.mine.rank) {
            list.appendChild(el('li', 'rf__gap', '···'));
            list.appendChild(rowEl(o.mine.rank, o.mine.name, null, o.mine.score, true, rows.length + 1));
          }
          if (o.mine && o.mine.rank && o.range === 'all') note.textContent = o.mine.rank === 1 ? 'You are number one. For now.' : 'You are #' + o.mine.rank + (d.total ? ' of ' + d.total : '') + '. Think you can climb?';
          else if (o.hypo && d.rank) note.textContent = 'Your score of ' + o.hypo + ' would sit at #' + d.rank + '.';
        }).catch(function () {
          if (my !== token) return;
          list.className = 'rf__rows'; list.innerHTML = '';
          var li = el('li', 'rf__empty', 'Could not load the leaderboard. '); var rb = el('button', 'rf__retry', 'Try again'); rb.type = 'button'; rb.addEventListener('click', load); li.appendChild(rb); list.appendChild(li);
        });
      }
      function rowEl(rank, nm, dur, sc, me, i) {
        var li = el('li', 'rf__row' + (me ? ' is-me' : '') + (rank <= 3 ? ' is-top' + rank : '')); li.style.setProperty('--i', i);
        var rk = el('span', 'rf__rank', String(rank)), n = el('span', 'rf__name', nm);
        if (me) { var you = el('em', 'rf__you', 'You'); n.appendChild(you); }
        li.appendChild(rk); li.appendChild(n); li.appendChild(el('span', 'rf__time', dur ? fmt(dur) : '')); li.appendChild(el('b', 'rf__sc', String(sc)));
        return li;
      }
      load();
      var first = wrap.querySelector('button'); if (first && !calm) { try { first.focus({ preventScroll: true }); } catch (x) {} }
    }
    function pause() {
      if (state !== 'playing') return;
      state = 'paused'; root.setAttribute('data-rf-state', 'paused'); arena.classList.remove('is-playing'); canvas.style.touchAction = '';
      overlay.hidden = false; overlay.className = 'rf__overlay is-pause';
      overlay.innerHTML = '<div class="rf__result"><h3 class="rf__rtitle">Paused</h3><button type="button" class="rf__play" data-rf-resume><span>Resume</span><i aria-hidden="true">&rarr;</i></button></div>';
      overlay.querySelector('[data-rf-resume]').addEventListener('click', resume); announce('Paused.');
    }
    function resume() {
      if (state !== 'paused') return;
      state = 'playing'; overlay.hidden = true; root.setAttribute('data-rf-state', 'playing'); arena.classList.add('is-playing'); canvas.style.touchAction = 'none'; resumeGrace = 0.6;
      announce('Resumed.');
    }
    function start() {
      newRun(); state = 'playing'; overlay.hidden = true; setBoardMode(false); hud(); announce('Game started.');
      arena.classList.add('is-playing'); canvas.style.touchAction = 'none'; root.setAttribute('data-rf-state', 'playing');
      tokenP = Leaderboard.start().then(function (tk) { Leaderboard.enabled = true; return tk; }, function () { return null; });
      resumeGrace = 0.3; ensureAudio(); loop();
    }

    // ---------- input ----------
    function toLocal(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function aim(e) {
      if (!g || state !== 'playing') return;
      var l = toLocal(e), touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      g.p.tx = clamp(l.x, 18, W - 18); g.p.ty = clamp(l.y - (touch ? 40 : 0), 18, floorY());
    }
    canvas.addEventListener('pointermove', function (e) { if (state === 'playing') { aim(e); if (e.pointerType === 'touch') e.preventDefault(); } });
    canvas.addEventListener('pointerdown', function (e) { if (state === 'playing') { aim(e); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} } });
    canvas.addEventListener('touchmove', function (e) { if (state === 'playing') e.preventDefault(); }, { passive: false });

    // ---------- sound: optional, muted until asked for ----------
    function ensureAudio() { if (!sound || actx) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    function tone(kind) {
      if (!sound) return; ensureAudio(); if (!actx) return;
      var seq = { hit: [[150, 0.18, 'square', 0.05]], up: [[660, 0.08, 'sine', 0.05], [880, 0.12, 'sine', 0.05]], near: [[1175, 0.05, 'sine', 0.03]], win: [[523, 0.1, 'sine', 0.06], [659, 0.1, 'sine', 0.06], [784, 0.18, 'sine', 0.06]] }[kind] || [], t0 = actx.currentTime;
      seq.forEach(function (n, i) { var o = actx.createOscillator(), gn = actx.createGain(); o.type = n[2]; o.frequency.value = n[0]; gn.gain.setValueAtTime(n[3], t0 + i * 0.1); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.1 + n[1]); o.connect(gn); gn.connect(actx.destination); o.start(t0 + i * 0.1); o.stop(t0 + i * 0.1 + n[1] + 0.02); });
    }
    var pauseBtn = root.querySelector('[data-rf-pause]');
    if (pauseBtn) pauseBtn.addEventListener('click', function () { if (state === 'playing') pause(); else if (state === 'paused') resume(); });
    document.addEventListener('keydown', function (e) {
      if (!visible || e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || ''; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'p' || e.key === 'P' || (e.key === 'Escape' && state === 'playing')) { if (state === 'playing') pause(); else if (state === 'paused') resume(); }
    });
    soundBtn.addEventListener('click', function () {
      sound = !sound; soundBtn.setAttribute('aria-pressed', sound ? 'true' : 'false'); soundBtn.setAttribute('aria-label', sound ? 'Sound on, turn it off' : 'Sound off, turn it on');
      if (sound) { ensureAudio(); if (actx && actx.resume) actx.resume(); tone('up'); }
    });

    // ---------- open, close, pause, resize ----------
    // The arena is always there: it simply wakes up when the footer scrolls into view.
    function setOpen(v) {
      open = v; root.classList.toggle('is-open', v);
      if (v) {
        state = state === 'idle' ? 'ready' : state;
        resize(); if (!g) newRun(); if (state === 'ready') overlayReady(); hud(); loop();
      }
    }
    if (cta) cta.addEventListener('click', function () { setOpen(!open); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { last = 0; pause(); } else { resumeGrace = 0.8; loop(); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { var was = visible; visible = es[0].isIntersecting; if (visible && !was) { resumeGrace = state === 'playing' ? 0.8 : 0; loop(); } }, { threshold: 0.15 }).observe(arena); else visible = true;
    var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (open) resize(); }, 100); });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-theme-toggle]')) setTimeout(colours, 50); });
    window.addEventListener('pagehide', function () { cancelAnimationFrame(raf); });

    hud(); setOpen(true); window.addEventListener('load', function () { resize(); });
    Leaderboard.probe().then(function (ok) { if (ok && state === 'ready') overlayReady(); });
    if ('ResizeObserver' in window) { var rzT; new ResizeObserver(function () { clearTimeout(rzT); rzT = setTimeout(function () { if (open && Math.abs(arena.clientHeight - H) > 2 || Math.abs(arena.clientWidth - W) > 2) resize(); }, 60); }).observe(arena); }
    return { destroy: function () { cancelAnimationFrame(raf); } };
  }

  window.Rockfall = { config: CONFIG, art: ART, leaderboard: Leaderboard };
  function boot() { var root = document.querySelector('[data-rockfall]'); if (root) window.Rockfall.instance = init(root); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
