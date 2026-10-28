// Метрики роста: при прокрутке справа проявляются названия, слева по дуге всплывают скриншоты аналитики
(() => {
  const PROJECTS = [
    { number: '001', title: 'Бренд ×2', image: 'assets/metrics/metric-01-brand.jpg', description: 'Яндекс.Вордстат', metric: '×2 спрос на бренд' },
    { number: '002', title: 'Трафик', image: 'assets/metrics/metric-02-traffic.jpg', description: 'Яндекс.Метрика', metric: '+286% посетителей' },
    { number: '003', title: 'Источники', image: 'assets/metrics/metric-03-sources.jpg', description: 'Источники трафика', metric: '428 тыс прямых' },
    { number: '004', title: 'VK ×5,6', image: 'assets/metrics/metric-04-vk.jpg', description: 'Сообщество VK', metric: '+463% охват' },
    { number: '005', title: 'Конверсия', image: 'assets/metrics/metric-05-conversion.jpg', description: 'ИИ-чат на сайте', metric: '8,82% конверсия' },
    { number: '006', title: 'Воронка', image: 'assets/metrics/metric-06-funnel.jpg', description: 'Лиды → Сделки → Договоры', metric: '1 511 лидов в авг' },
    { number: '007', title: 'Выручка', image: 'assets/metrics/metric-07-revenue.jpg', description: 'Данные CRM', metric: '19,1 млн ₽ / авг' },
  ];

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const map = (v, inMin, inMax, outMin, outMax) => outMin + (v - inMin) / (inMax - inMin) * (outMax - outMin);

  const section = document.getElementById('scroll-reveal-section');
  const sticky = document.getElementById('scroll-reveal-sticky');
  if (!section || !sticky) return;

  // ---------- Разметка ----------
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const items = PROJECTS.map((proj, i) => {
    const item = el('div', 'sr-item');
    const num = el('span', 'sr-number', proj.number);
    const titleWrap = el('div', 'sr-title');
    const titleInner = el('div', 'sr-title-inner', proj.title);
    titleWrap.appendChild(titleInner);
    item.append(num, titleWrap);

    const imgWrap = el('figure', 'sr-image');
    const img = document.createElement('img');
    img.loading = 'lazy'; // до src, иначе браузер начнёт загрузку сразу
    img.decoding = 'async';
    img.alt = `${proj.description}: ${proj.metric}`;
    img.src = proj.image;
    const meta = el('figcaption', 'sr-meta');
    meta.append(el('span', 'sr-metric', proj.description), el('span', 'sr-metric', proj.metric));
    imgWrap.append(img, meta);

    sticky.append(item, imgWrap);
    return { el: item, num, titleWrap, titleInner, imgWrap, meta };
  });

  // ---------- Размеры ----------
  let vh, vw, step, isMobile;
  function resize() {
    vh = window.innerHeight;
    vw = window.innerWidth;
    isMobile = vw <= 768;
    step = vh * 0.65;
    section.style.height = `${PROJECTS.length * step + vh}px`;
    update();
  }

  // prefers-reduced-motion: скриншоты не вращаются, только плавно проявляются
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Кадр ----------
  function update() {
    const sectionScroll = window.scrollY - section.offsetTop;

    items.forEach((item, i) => {
      const center = i * step + step * 0.5;
      const range = step * 1.2;
      // 0 — появляется, 0.5 — в центре, 1 — уходит
      const p = clamp(map(sectionScroll - center, -range, range, 0, 1), 0, 1);
      const focus = 1 - Math.pow(2 * p - 1, 2);
      const direction = map(p, 0, 1, -1, 1);

      // Название
      item.el.style.transform = `translate3d(0, ${map(p, 0, 1, 120, -120)}%, 0)`;
      const slide = map(p, 0, 1, 105, -105);
      item.titleInner.style.transform = `translateY(${slide}%)`;
      const visibility = 1 - Math.abs(slide / 105);
      item.el.style.opacity = visibility.toFixed(3);
      item.num.style.opacity = (visibility * 0.6).toFixed(3);
      item.titleWrap.style.color = `color-mix(in srgb, var(--magenta) ${(focus * 100).toFixed(1)}%, var(--text-secondary))`;

      // Скриншот — переворачивается вокруг вертикальной оси: -180° → 0° в центре → +180°
      if (reduceMotion) {
        item.imgWrap.style.left = isMobile ? '' : `${vw * 0.38}px`;
        item.imgWrap.style.top = isMobile ? '' : `${vh * 0.48}px`;
        item.imgWrap.style.transform = isMobile ? 'none' : 'translate(-50%, -50%)';
        item.imgWrap.style.opacity = clamp(focus * 2 - 0.4, 0, 1).toFixed(3);
      } else if (isMobile) {
        item.imgWrap.style.left = '';
        item.imgWrap.style.top = '';
        const flip = (1 - focus) * 180 * (direction < 0 ? 1 : -1);
        item.imgWrap.style.transform = `perspective(1000px) translateY(${(direction * 30).toFixed(1)}px) rotateY(${flip.toFixed(1)}deg)`;
        item.imgWrap.style.opacity = clamp(focus * 2 - 0.2, 0, 1).toFixed(3);
      } else {
        item.imgWrap.style.left = `${vw * 0.38}px`;
        item.imgWrap.style.top = `${vh * 0.48}px`;
        item.imgWrap.style.transform =
          `translate(-50%, calc(-50% + ${(direction * 60).toFixed(1)}px)) perspective(1200px) rotateY(${(direction * 180).toFixed(1)}deg) rotateZ(${(-direction * 3).toFixed(1)}deg) scale(${(0.6 + focus * 0.4).toFixed(3)})`;
        item.imgWrap.style.opacity = clamp(focus * 3 - 1, 0, 1).toFixed(3);
      }
      item.meta.style.opacity = clamp(focus * 3 - 1.2, 0, 1).toFixed(3);
    });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', resize);
  resize();
})();
