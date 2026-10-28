// «Видео и креатив»: тизеры (без звука) играют только в кадре; клик — плеер со звуком в окне; радио — кнопка play
(() => {
  const root = document.getElementById('creative');
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Постеры грузим, только когда блок подходит к экрану (экономия трафика на первом экране)
  const teasers = root.querySelectorAll('.vcard__teaser');
  const setPoster = (v) => { if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster; };
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setPoster(e.target); near.unobserve(e.target); } }), { rootMargin: '800px 0px' });
    teasers.forEach((v) => near.observe(v));
  } else teasers.forEach(setPoster);

  // Тизеры: при reduced-motion — только постеры
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) {
        setPoster(v);
        if (!v.src) v.src = v.dataset.teaser;
        v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    }), { threshold: 0.35 });
    root.querySelectorAll('.vcard__teaser').forEach((v) => io.observe(v));
  }

  // Плеер со звуком
  const box = document.getElementById('vbox');
  const player = box.querySelector('.vbox__video');
  let opener = null;
  const close = () => { player.pause(); player.removeAttribute('src'); player.load(); if (box.open) box.close(); if (opener) opener.focus(); };
  root.querySelectorAll('.vcard').forEach((card) => card.addEventListener('click', () => {
    opener = card;
    player.src = card.dataset.src;
    box.setAttribute('aria-label', 'Видеоролик ' + card.dataset.title);
    box.showModal();
    player.play().catch(() => {});
  }));
  box.querySelector('.vbox__close').addEventListener('click', close);
  box.addEventListener('cancel', (e) => { e.preventDefault(); close(); }); // Esc
  box.addEventListener('click', (e) => { if (e.target === box) close(); }); // клик по фону

  // Радио: один трек за раз
  let audio = null, btnOn = null;
  const reset = () => { if (btnOn) { btnOn.classList.remove('is-on'); btnOn.firstElementChild.textContent = '▶'; } btnOn = null; };
  root.querySelectorAll('.radio__play').forEach((btn) => btn.addEventListener('click', () => {
    if (btnOn === btn) { audio.pause(); reset(); return; }
    if (audio) audio.pause();
    reset();
    audio = new Audio(btn.dataset.audio);
    audio.addEventListener('ended', reset);
    audio.play().catch(reset);
    btnOn = btn; btn.classList.add('is-on'); btn.firstElementChild.textContent = '❚❚';
  }));
})();
