// Case-study chrome: a top bar (back, project name, Let's talk) and a table of contents in the rail that follows the scroll.
(function () {
  var main = document.querySelector('.main'), rail = document.querySelector('.rail'), nav = rail && rail.querySelector('.rail__nav');
  if (!main || !nav || !main.querySelector('.cs-hero')) return;
  document.body.classList.add('cs-page');

  var name = (document.title.split(',')[0] || '').replace(/\s+case study$/i, '').trim() || 'Case study';
  var mail = 'mailto:ajike2116@gmail.com';

  // top bar
  var bar = document.createElement('header');
  bar.className = 'cs-bar';
  bar.innerHTML = '<a class="cs-bar__back" href="../index.html#work"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4.5M9.5 4.5 4 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Back<span class="cs-bar__long"> to work</span></span></a>' +
    '<span class="cs-bar__title"></span>' +
    '<a class="cs-bar__talk" href="' + mail + '"><span>Let’s talk</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M7.5 6H14v6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
  bar.querySelector('.cs-bar__title').textContent = name;
  document.body.insertBefore(bar, document.body.firstChild);

  // what the contents list points at
  var items = [], n = 0;
  var add = function (el, label) {
    if (!el || !label) return;
    if (!el.id) el.id = 'cs-' + (++n);
    items.push({ el: el, label: label });
  };
  add(main.querySelector('.cs-hero'), 'Overview');
  main.querySelectorAll('.cs-section').forEach(function (sec) {
    var lab = sec.querySelector('h2.cs-section__label');
    if (lab) { add(sec, lab.textContent.trim()); return; }
    sec.querySelectorAll('.pj-h').forEach(function (h) { add(h.closest('.pj-block') || h, h.textContent.trim()); });
  });
  if (items.length < 2) return;

  var hint = document.createElement('p');
  hint.className = 'cs-toc__h';
  hint.textContent = 'In this case study';
  nav.setAttribute('aria-label', 'In this case study');
  nav.classList.add('cs-toc');
  nav.textContent = '';
  nav.appendChild(hint);
  var links = items.map(function (it, i) {
    var a = document.createElement('a');
    a.href = '#' + it.el.id;
    a.innerHTML = '<i>' + (i < 9 ? '0' : '') + (i + 1) + '</i><span></span>';
    a.lastChild.textContent = it.label;
    nav.appendChild(a);
    return a;
  });
  var tail = document.createElement('a');
  tail.className = 'cs-toc__end'; tail.href = mail;
  tail.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M7.5 6H14v6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Get in touch</span>';
  nav.appendChild(tail);

  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  nav.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    var dist = Math.abs(el.getBoundingClientRect().top);
    if (window.siteLenis && !calm) window.siteLenis.scrollTo(el, { offset: -72, duration: Math.min(2.2, Math.max(0.8, 0.6 + dist / 5200)), easing: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } });
    else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 72, behavior: calm ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + el.id);
  });

  // scroll spy: the last item whose top has passed the reading line
  var cur = -1, spy = function () {
    var line = innerHeight * 0.32, k = 0;
    for (var i = 0; i < items.length; i++) if (items[i].el.getBoundingClientRect().top <= line) k = i;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) k = items.length - 1;
    if (k === cur) return; cur = k;
    links.forEach(function (a, i) { if (i === k) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  };
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; spy(); }); } }, { passive: true });
  addEventListener('resize', spy);
  spy();
})();
