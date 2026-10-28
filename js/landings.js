// Галерея лендингов: клик по карточке — окно со скриншотом страницы целиком (десктоп / телефон)
(() => {
  const box = document.getElementById('lbox');
  if (!box) return;
  const img = box.querySelector('.lbox__img');
  const title = box.querySelector('.lbox__title');
  const scroller = box.querySelector('.lbox__scroll');
  const modes = box.querySelectorAll('.lbox__mode');
  const base = 'assets/cases/spartakmeb/landings/';
  let slug = '', opener = null;
  const toggle = box.querySelector('.lbox__toggle');
  let single = '';
  const show = (mode) => {
    img.src = single || base + slug + '/' + mode + '-full.webp';
    img.alt = title.textContent + ': страница целиком, ' + (mode === 'desktop' ? 'десктоп' : 'телефон');
    box.classList.toggle('is-mobile', mode === 'mobile');
    modes.forEach((b) => { const on = b.dataset.mode === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    scroller.scrollTop = 0;
  };
  document.querySelectorAll('.lcard').forEach((card) => card.addEventListener('click', () => {
    opener = card; slug = card.dataset.slug || ''; single = card.dataset.desktop || ''; title.textContent = card.dataset.title;
    toggle.hidden = !!single; // у раздела «О компании» есть только десктопный скриншот
    show(matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop');
    box.showModal();
  }));
  modes.forEach((b) => b.addEventListener('click', () => show(b.dataset.mode)));
  const close = () => { box.close(); if (opener) opener.focus(); };
  box.querySelector('.lbox__close').addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
})();
