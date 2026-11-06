// DiveHQ case study: switch every phone screen between light and dark.
(function () {
  var imgs = document.querySelectorAll('.dv-phone img'), btns = document.querySelectorAll('[data-dv-mode]');
  if (!imgs.length) return;
  var set = function (m) {
    imgs.forEach(function (i) { var u = i.getAttribute('data-' + m); if (u && i.getAttribute('src') !== u) i.src = u; });
    btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-dv-mode') === m ? 'true' : 'false'); });
  };
  btns.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-dv-mode')); }); });
  var t = document.documentElement.getAttribute('data-theme');
  var light = t ? t === 'light' : !matchMedia('(prefers-color-scheme: dark)').matches;
  set(light ? 'light' : 'dark');
})();

// Success flow: let the routes ease in as the diagram scrolls into view.
(function () {
  var f = document.querySelector('.dvf-svg');
  if (!f) return;
  if (!('IntersectionObserver' in window)) { f.classList.add('is-in'); return; }
  var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { f.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.2 });
  io.observe(f);
})();
