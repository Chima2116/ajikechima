/*
 * ROCKFALL: a small survival game that lives in the footer.
 * A canvas, requestAnimationFrame, delta-time movement and no dependencies.
 *
 * To swap the artwork later, replace ART.player and ART.rock (they only draw).
 * To tune difficulty, edit CONFIG.levels.
 *
 * Global leaderboard (not built yet, on purpose): every run is seeded, so a
 * server can replay the same rocks. Send { seed, duration, inputs } to your
 * own endpoint (Supabase edge function, say), re-simulate it there, and
 * store the score the SERVER computes. Never store a score the client claims.
 * No sign-in is needed: use an anonymous id. Nothing here fakes a leaderboard.
 */
(function () {
  'use strict';

  var CONFIG = {
    referenceHeight: 380,                    // speeds are tuned for an arena this tall
    player: { hit: 11, size: 15, follow: 15 },   // hit radius, drawn size, easing (per second)
    types: {
      pebble:  { r: [7, 11],  v: [250, 320] },
      boulder: { r: [16, 23], v: [170, 225] },
      mega:    { r: [33, 41], v: [120, 155] }
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

  var Leaderboard = {
    enabled: false,
    submit: function (run) { return Promise.resolve(null); },   // see the note at the top
    top: function () { return Promise.resolve(null); }
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

  // ---------- the art: replace these two to change how it looks ----------
  var ART = {
    // pose: { x, y, t (seconds), vx, look (-1..1), fear (0..1), hit (0..1), joy (0..1) }
    player: function (ctx, p, pal) {
      var s = CONFIG.player.size, bob = Math.sin(p.t * 3.2) * 1.2 * (1 - p.fear), squash = clamp(Math.abs(p.vx) / 900, 0, 0.22);
      var sx = 1 + squash - p.fear * 0.08 + p.joy * 0.06, sy = 1 - squash * 0.9 - p.fear * 0.12 - p.joy * 0.04 + p.hit * 0.12;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = css(pal.ink, 0.12); ctx.beginPath(); ctx.ellipse(0, s * 1.05, s * 0.9, s * 0.26, 0, 0, 6.3); ctx.fill();   // ground shadow
      ctx.translate(0, bob - (p.jump || 0)); ctx.rotate(clamp(p.vx / 2600, -0.28, 0.28) + p.hit * Math.sin(p.t * 40) * 0.12);
      ctx.scale(sx, sy);
      // body
      ctx.fillStyle = p.hit > 0 && Math.floor(p.t * 20) % 2 ? css(mix(pal.accent, pal.bg, 0.55)) : css(pal.accent);
      ctx.beginPath(); ctx.moveTo(-s * 0.95, s * 0.55);
      ctx.bezierCurveTo(-s * 1.05, -s * 0.95, s * 1.05, -s * 0.95, s * 0.95, s * 0.55);
      ctx.quadraticCurveTo(0, s * 1.15, -s * 0.95, s * 0.55); ctx.closePath(); ctx.fill();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-s * 0.35, -s * 0.5, s * 0.3, s * 0.16, -0.5, 0, 6.3); ctx.fill();
      // eyes
      var ex = s * 0.36, ey = -s * 0.08, er = s * (0.24 + p.fear * 0.08);
      if (p.hit > 0) {
        ctx.strokeStyle = css(pal.onAccent); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
        [-1, 1].forEach(function (d) { var cx = d * ex; ctx.moveTo(cx - 3, ey - 3); ctx.lineTo(cx + 3, ey + 3); ctx.moveTo(cx + 3, ey - 3); ctx.lineTo(cx - 3, ey + 3); }); ctx.stroke();
      } else {
        [-1, 1].forEach(function (d) {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(d * ex, ey, er, er * 1.25, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(d * ex + p.look * er * 0.45, ey + p.fear * -0.6 + er * 0.15, er * 0.5, 0, 6.3); ctx.fill();
        });
        if (p.joy > 0.2) { ctx.strokeStyle = css(pal.onAccent); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, s * 0.34, s * 0.28, 0.15, 3); ctx.stroke(); }
      }
      ctx.restore();
    },
    rock: function (ctx, r, pal) {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      var body = r.type === 'mega' ? mix(pal.ink, pal.bg, 0.2) : r.type === 'boulder' ? mix(pal.ink, pal.bg, 0.62) : mix(pal.ink, pal.bg, 0.74);
      ctx.fillStyle = css(body); ctx.beginPath();
      r.pts.forEach(function (p, i) { var x = Math.cos(p[0]) * p[1] * r.r, y = Math.sin(p[0]) * p[1] * r.r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = css(r.type === 'mega' ? pal.accent : pal.ink, r.type === 'mega' ? 0.9 : 0.35); ctx.lineWidth = r.type === 'mega' ? 2.2 : 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(-r.r * 0.3, -r.r * 0.35, r.r * 0.28, r.r * 0.16, -0.6, 0, 6.3); ctx.fill();
      if (r.type !== 'pebble') { ctx.strokeStyle = css(pal.bg, 0.35); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r.r * 0.1, -r.r * 0.1); ctx.lineTo(r.r * 0.35, r.r * 0.25); ctx.lineTo(r.r * 0.2, r.r * 0.5); if (r.type === 'mega') { ctx.moveTo(r.r * 0.35, r.r * 0.25); ctx.lineTo(r.r * 0.62, r.r * 0.2); ctx.moveTo(-r.r * 0.3, r.r * 0.1); ctx.lineTo(-r.r * 0.1, r.r * 0.4); } ctx.stroke(); }
      ctx.restore();
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

    // ---------- layout ----------
    function resize() {
      var r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(200, r.width); H = Math.max(200, r.height); scale = H / CONFIG.referenceHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (g) { g.p.x = clamp(g.p.x, 20, W - 20); g.p.y = clamp(g.p.y, 20, H - 28); }
      draw(0);
    }
    function colours() {
      var s = getComputedStyle(document.documentElement);
      pal = { bg: parse(s.getPropertyValue('--bg')), ink: parse(s.getPropertyValue('--ink')), accent: parse(s.getPropertyValue('--accent')), onAccent: parse(s.getPropertyValue('--on-accent')), muted: parse(s.getPropertyValue('--muted')), guide: parse(s.getPropertyValue('--guide')), panel: parse(s.getPropertyValue('--panel')) };
    }

    // ---------- a run ----------
    function newRun() {
      var seed = (Math.random() * 4294967295) >>> 0;
      g = { seed: seed, rand: rng(seed), t: 0, score: 0, rocks: [], spawnIn: 0.9, recent: [], bonus: {}, inputs: [], inT: 0, shake: 0, flash: 0, hitT: 0, joy: 0, lastSec: -1, lastLevel: -1, newRecord: false,
        p: { x: W / 2, y: H - 34, vx: 0, tx: W / 2, ty: H - 34, t: 0, look: 0, fear: 0, hit: 0, joy: 0 } };
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
      return { type: type, x: x, y: -r - 4, r: r, v: (T.v[0] + rand() * (T.v[1] - T.v[0])) * lv.speed * scale, rot: rand() * 6.28, vr: (rand() - 0.5) * (type === 'mega' ? 0.9 : 2.4), pts: pts, near: false };
    }
    // keep a way through: the free horizontal gaps among rocks that are still near the top, plus the new one
    function fair(x, r) {
      var ivs = [], pr = CONFIG.player.hit + 6, k, zone = H * 0.45;
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
        if (lv.i !== g.lastLevel) { g.lastLevel = lv.i; hud(); }
        g.spawnIn -= dt;
        if (g.spawnIn <= 0) { var ok = spawn(lv); g.spawnIn = ok ? lv.gap * (0.8 + g.rand() * 0.45) : 0.12; }
        g.inT += dt; if (g.inT >= 0.1) { g.inT = 0; if (g.inputs.length < 1500) g.inputs.push([Math.round(p.tx), Math.round(p.ty)]); }
      }
      // player eases toward the pointer
      if (state === 'playing' || state === 'ready' || state === 'over') {
        var kf = 1 - Math.exp(-CONFIG.player.follow * dt), ox = p.x;
        if (state === 'playing') { p.x += (p.tx - p.x) * kf; p.y += (p.ty - p.y) * kf; } else { p.tx = p.x; p.ty = p.y; }
        p.x = clamp(p.x, 18, W - 18); p.y = clamp(p.y, 18, H - 26);
        p.vx = dt ? (p.x - ox) / dt : 0;
      }
      p.t += dt;
      // rocks
      var nearest = null, nd = 1e9, fear = 0;
      for (k = g.rocks.length - 1; k >= 0; k--) {
        var o = g.rocks[k];
        if (state !== 'paused') { o.y += o.v * dt; o.rot += o.vr * dt; }
        if (o.y - o.r > H + 10) { g.rocks.splice(k, 1); continue; }
        var dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
        if (state === 'playing') {
          if (d < o.r * 0.86 + CONFIG.player.hit) { crash(o); break; }
          if (d < nd && o.y < p.y + 10) { nd = d; nearest = o; }
        }
      }
      if (nearest) { fear = clamp(1 - (nd - nearest.r - 20) / 110, 0, 1); p.look = clamp((nearest.x - p.x) / 60, -1, 1); } else p.look *= 0.9;
      p.fear += (fear - p.fear) * Math.min(1, dt * 10);
      p.hit = state === 'hit' ? Math.max(0, p.hit - dt * 0.9) : 0;
      p.joy = state === 'over' && g.newRecord ? 1 : 0; p.jump = p.joy && !calm ? Math.abs(Math.sin(p.t * 5)) * 16 : 0;
      if (state === 'hit') { g.hitT -= dt; if (g.hitT <= 0) finish(); }
      g.shake = Math.max(0, g.shake - dt * 2.8); g.flash = Math.max(0, g.flash - dt * 3);
      for (k = fx.length - 1; k >= 0; k--) { var f = fx[k]; f.life -= dt; if (f.life <= 0) { fx.splice(k, 1); continue; } f.vy += 520 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
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
      if (Leaderboard.enabled) Leaderboard.submit({ seed: g.seed, duration: t, inputs: g.inputs });
    }

    // ---------- drawing ----------
    function draw() {
      if (!pal) colours();
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (g && g.shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * 9 * g.shake, (Math.random() - 0.5) * 7 * g.shake);
      // floor line and faint columns
      ctx.strokeStyle = css(pal.guide, 0.9); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, H - 8.5); ctx.lineTo(W, H - 8.5); ctx.stroke();
      if (!g) { ctx.restore(); return; }
      g.rocks.forEach(function (o) { ART.rock(ctx, o, pal); });
      ART.player(ctx, g.p, pal);
      fx.forEach(function (f) { var a = clamp(f.life / f.max, 0, 1); ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = css(f.c, a); ctx.fillRect(-f.s / 2, -f.s / 2, f.s, f.s * 1.4); ctx.restore(); });
      ctx.restore();
      if (g.flash > 0 && !calm) { ctx.fillStyle = css(pal.accent, g.flash * 0.12); ctx.fillRect(0, 0, W, H); }
    }

    // ---------- the loop ----------
    function frame(now) {
      raf = 0; if (!open || !visible || document.hidden) { last = 0; return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      if (resumeGrace > 0) { resumeGrace -= dt; dt = 0; }
      if (g) update(dt);
      palN++; if (palN % 45 === 0) colours();
      draw();
      raf = requestAnimationFrame(frame);
    }
    function loop() { if (!raf && open && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

    // ---------- HUD and overlays ----------
    function hud() {
      var lv = levelAt(g ? g.t : 0);
      elScore.textContent = g ? g.score : 0; elTime.textContent = fmt(g ? g.t : 0); elLevel.textContent = lv.name; elBest.textContent = best.score;
      var s = '', k; for (k = 0; k < CONFIG.levels.length; k++) s += '<span' + (k <= lv.i ? ' class="is-on"' : '') + '></span>'; pips.innerHTML = s;
      if (elBestHint) elBestHint.textContent = best.score ? 'Your best: ' + best.score : '';
    }
    function announce(t) { if (live) live.textContent = t; }
    function toast(t) { var el = document.createElement('div'); el.className = 'rf__toast'; el.textContent = t; arena.appendChild(el); setTimeout(function () { el.remove(); }, 1400); }
    function overlayReady() {
      overlay.hidden = false; overlay.className = 'rf__overlay';
      overlay.innerHTML = '<div class="rf__card"><p class="rf__kicker">Mini game</p><h3 class="rf__title">ROCKFALL</h3><p class="rf__tag">How long can you survive?</p><p class="rf__how">Move your cursor, or drag your finger, to dodge the rocks.</p><button type="button" class="rf__btn" data-rf-start>Start Game</button>' + (best.score ? '<p class="rf__best">Your best: ' + best.score + '</p>' : '') + '</div>';
      overlay.querySelector('[data-rf-start]').addEventListener('click', start);
    }
    function overlayOver(t, score) {
      overlay.hidden = false; overlay.className = 'rf__overlay is-over' + (g.newRecord ? ' is-record' : '');
      overlay.innerHTML = '<div class="rf__card">' + (g.newRecord ? '<p class="rf__badge">New record</p>' : '') + '<h3 class="rf__title rf__title--sm">Well, that didn\'t go as planned.</h3><p class="rf__tag">You survived for <b>' + fmt(t) + '</b>.</p><dl class="rf__sum"><div><dt>Score</dt><dd>' + score + '</dd></div><div><dt>Best</dt><dd>' + best.score + '</dd></div></dl><p class="rf__how">Think you can do better?</p><button type="button" class="rf__btn" data-rf-start>Try Again</button></div>';
      overlay.querySelector('[data-rf-start]').addEventListener('click', start);
    }
    function start() {
      newRun(); state = 'playing'; overlay.hidden = true; hud(); announce('Game started.');
      arena.classList.add('is-playing'); canvas.style.touchAction = 'none'; root.setAttribute('data-rf-state', 'playing');
      resumeGrace = 0.3; ensureAudio(); loop();
    }

    // ---------- input ----------
    function toLocal(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function aim(e) {
      if (!g || state !== 'playing') return;
      var l = toLocal(e), touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      g.p.tx = clamp(l.x, 18, W - 18); g.p.ty = clamp(l.y - (touch ? 40 : 0), 18, H - 26);
    }
    canvas.addEventListener('pointermove', function (e) { if (state === 'playing') { aim(e); if (e.pointerType === 'touch') e.preventDefault(); } });
    canvas.addEventListener('pointerdown', function (e) { if (state === 'playing') { aim(e); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} } });
    canvas.addEventListener('touchmove', function (e) { if (state === 'playing') e.preventDefault(); }, { passive: false });

    // ---------- sound: optional, muted until asked for ----------
    function ensureAudio() { if (!sound || actx) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    function tone(kind) {
      if (!sound) return; ensureAudio(); if (!actx) return;
      var seq = { hit: [[150, 0.18, 'square', 0.05]], up: [[660, 0.08, 'sine', 0.05], [880, 0.12, 'sine', 0.05]], win: [[523, 0.1, 'sine', 0.06], [659, 0.1, 'sine', 0.06], [784, 0.18, 'sine', 0.06]] }[kind] || [], t0 = actx.currentTime;
      seq.forEach(function (n, i) { var o = actx.createOscillator(), gn = actx.createGain(); o.type = n[2]; o.frequency.value = n[0]; gn.gain.setValueAtTime(n[3], t0 + i * 0.1); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.1 + n[1]); o.connect(gn); gn.connect(actx.destination); o.start(t0 + i * 0.1); o.stop(t0 + i * 0.1 + n[1] + 0.02); });
    }
    soundBtn.addEventListener('click', function () {
      sound = !sound; soundBtn.setAttribute('aria-pressed', sound ? 'true' : 'false'); soundBtn.setAttribute('aria-label', sound ? 'Sound on, turn it off' : 'Sound off, turn it on');
      if (sound) { ensureAudio(); if (actx && actx.resume) actx.resume(); tone('up'); }
    });

    // ---------- open, close, pause, resize ----------
    function setOpen(v) {
      open = v; cta.setAttribute('aria-expanded', v ? 'true' : 'false'); root.classList.toggle('is-open', v);
      stage.inert = !v; stage.setAttribute('aria-hidden', v ? 'false' : 'true');
      if (v) {
        state = state === 'idle' ? 'ready' : state;
        setTimeout(function () { resize(); if (!g) newRun(); if (state === 'ready') overlayReady(); hud(); loop(); var f = overlay.querySelector('[data-rf-start]'); if (f && !calm) { try { f.focus({ preventScroll: true }); } catch (e) {} } }, calm ? 0 : 520);
        stage.scrollIntoView && setTimeout(function () { var r = arena.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) window.scrollBy({ top: r.top - 90, behavior: calm ? 'auto' : 'smooth' }); }, calm ? 0 : 560);
      }
    }
    cta.addEventListener('click', function () { setOpen(!open); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { last = 0; } else { resumeGrace = 0.8; loop(); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { var was = visible; visible = es[0].isIntersecting; if (visible && !was) { resumeGrace = state === 'playing' ? 0.8 : 0; loop(); } }, { threshold: 0.15 }).observe(arena); else visible = true;
    var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (open) resize(); }, 100); });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-theme-toggle]')) setTimeout(colours, 50); });
    window.addEventListener('pagehide', function () { cancelAnimationFrame(raf); });

    hud(); stage.inert = true;
    return { destroy: function () { cancelAnimationFrame(raf); } };
  }

  window.Rockfall = { config: CONFIG, art: ART, leaderboard: Leaderboard };
  function boot() { var root = document.querySelector('[data-rockfall]'); if (root) window.Rockfall.instance = init(root); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
