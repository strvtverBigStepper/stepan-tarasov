// Бургер-меню
const burger = document.getElementById('burger');
const menu = document.getElementById('navMenu');

function toggleMenu(open) {
  burger.classList.toggle('is-open', open);
  menu.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  onScroll();
}

burger.addEventListener('click', () => toggleMenu(!menu.classList.contains('is-open')));
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => toggleMenu(false)));

// Бордер у навигации при скролле
const nav = document.getElementById('nav');
const hero = document.getElementById('hero');
const onScroll = () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 10);
  const overHero = hero && hero.getBoundingClientRect().bottom > nav.offsetHeight;
  nav.classList.toggle('is-over-hero', overHero && !menu.classList.contains('is-open'));
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Форма: бэкенда пока нет — копируем текст заявки и открываем Telegram
const form = document.getElementById('contactForm');
const status = document.getElementById('formStatus');

if (form) form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const text = `Привет! Меня зовут ${data.get('name')}` +
    (data.get('company') ? ` (${data.get('company')})` : '') +
    `.\nЗадача: ${data.get('task')}`;

  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Текст заявки скопирован — вставьте его в чат Telegram.';
  } catch {
    status.textContent = 'Откройте Telegram и опишите задачу — отвечу быстро.';
  }
  window.open('https://t.me/strv_1', '_blank', 'noopener');
  form.reset();
});

// Cookie banner
(function () {
  var banner = document.getElementById('cookieBanner');
  if (!banner) return;

  try {
    var answered = localStorage.getItem('cookie_consent');
    if (answered) return;
  } catch (e) { /* private mode */ }

  setTimeout(function () { banner.classList.add('is-visible'); }, 1200);

  document.getElementById('cookieAccept').addEventListener('click', function () {
    try { localStorage.setItem('cookie_consent', 'accepted'); } catch (e) {}
    banner.classList.remove('is-visible');
  });

  document.getElementById('cookieDecline').addEventListener('click', function () {
    try { localStorage.setItem('cookie_consent', 'declined'); } catch (e) {}
    banner.classList.remove('is-visible');
  });
})();

// Имя в hero растягиваем ровно на ширину экрана
const heroName = document.getElementById('heroName');
// На десктопе — одна строка во всю ширину; на телефоне (<=520px) — две строки, каждая во всю ширину
function fitHeroName() {
  if (!heroName) return;
  heroName.style.fontSize = '100px';
  heroName.style.width = '';
  const w = heroName.clientWidth;
  let need;
  if (getComputedStyle(heroName).whiteSpace === 'nowrap') {
    heroName.style.width = 'max-content';
    need = heroName.getBoundingClientRect().width;
    heroName.style.width = '';
  } else {
    const parts = heroName.querySelectorAll('span');
    // меряем ширину самого текста каждой строки (inline-block), а не ширину блока
    parts.forEach((s) => { s.style.display = 'inline-block'; });
    need = parts.length ? Math.max(...[...parts].map((s) => s.getBoundingClientRect().width)) : heroName.scrollWidth;
    parts.forEach((s) => { s.style.display = ''; });
  }
  if (need > 0) heroName.style.fontSize = `${Math.floor(100 * w / need * 0.98)}px`;
  window.dispatchEvent(new Event('heronamefit')); // вода перерисует нижнюю часть имени
}
(document.fonts ? document.fonts.ready : Promise.resolve()).then(fitHeroName);
window.addEventListener('resize', fitHeroName);

// Подсветка пункта меню текущего раздела (scroll-spy): только для ссылок вида #раздел на этой странице
(function () {
  var links = [].slice.call(document.querySelectorAll('.nav__menu a[href^="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var map = {};
  links.forEach(function (a) { var el = document.getElementById(a.getAttribute('href').slice(1)); if (el) map[el.id] = a; });
  // Блок «Масштаб и результаты» относится к профилю — подсвечиваем «Профиль»
  if (map.about && document.getElementById('metrics')) map.metrics = map.about;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('is-active', a === map[e.target.id]); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
})();

// Фото в «Кто я»: шторка-раскрытие при прокрутке (без анимаций при reduced-motion — фото видно сразу)
(function () {
  var ph = document.getElementById('aboutPhoto');
  if (!ph || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('js-reveal');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { ph.classList.add('in'); io.disconnect(); } });
  }, { threshold: 0.3 });
  io.observe(ph.parentElement); // наблюдаем родителя: элемент, скрытый clip-path, IntersectionObserver не видит
})();
