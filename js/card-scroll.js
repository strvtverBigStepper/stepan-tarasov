// Портфолио: карточки-скриншоты едут вверх вместе с прокруткой страницы (Canvas 2D)
(() => {
  const CARDS = [
    { image: 'assets/cases/1-b2b-hero.jpg', title: 'Лендинг B2B-направления (макет)', description: 'Мебель для бизнеса, СпартакМеб · макет, не опубликован.' },
    { image: 'assets/cases/2-service.jpg', title: 'Лендинг · Мебельный сервис', description: 'Лендинг доставки и сборки мебели, СпартакМеб.' },
    { image: 'assets/cases/3-meridian.jpg', title: 'Лендинг · Конструктор «Меридиан»', description: 'Интерактивный конструктор модульного дивана, СпартакМеб.' },
    { image: 'assets/cases/4-glamping.jpg', title: 'Лендинг · beard.travel', description: 'Лендинг beard.travel: программа тура на 3 дня.' },
    { image: 'assets/cases/5-company.jpg', title: 'Лендинг · О компании СпартакМеб', description: 'Раздел «О компании» для сайта СпартакМеб.' },
    { image: 'assets/cases/7-glamping-features.jpg', title: 'Лендинг · Всё включено, beard.travel', description: 'Блок «Всё включено» для beard.travel: шатры, баня, каяки, гид.' },
  ];

  const CONFIG = {
    gap: 20,
    jitter: 4, // градусы
    radius: 16,
    hoverScale: 1.08,
  };

  const section = document.getElementById('portfolio');
  const canvas = document.getElementById('cardScrollCanvas');
  if (!section || !canvas) return;

  const wrap = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const metaTitle = section.querySelector('.card-scroll-meta__title');
  const metaDesc = section.querySelector('.card-scroll-meta__desc');
  const metaCount = section.querySelector('.card-scroll-meta__count');
  const styles = getComputedStyle(document.documentElement);
  const color = (name) => styles.getPropertyValue(name).trim();

  // Картинки грузим, когда секция подходит к экрану (раньше — сразу при открытии страницы)
  const images = CARDS.map(() => new Image());
  const loadImages = () => images.forEach((img, i) => { if (!img.src) img.src = CARDS[i].image; });
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { loadImages(); near.disconnect(); } }, { rootMargin: '150% 0px' });
    near.observe(section);
  } else loadImages();
  const ready = (img) => img.complete && img.naturalWidth > 0;

  const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  // ---------- Размер ----------
  let W = 0, H = 0;
  function resize() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- Прогресс прокрутки → время ----------
  const N = CARDS.length;
  function targetTime() {
    const r = section.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const progress = total > 0 ? Math.min(Math.max(-r.top / total, 0), 1) : 0;
    // при progress 0 в центре первая карточка, при 1 — последняя
    return 0.5 - progress * (N - 1) / N;
  }
  let time = targetTime();

  // ---------- Геометрия ----------
  function cardWidth() {
    return W < 700 ? Math.min(W * 0.85, 510) : Math.min(W * 0.42, 630);
  }

  function layout() {
    const cardW = cardWidth();
    return CARDS.map((_, i) => {
      const img = images[i];
      const cardH = cardW * (ready(img) ? img.naturalHeight / img.naturalWidth : 1.4);
      const p = (((time + i / N) % 1) + 1) % 1;
      const e = easeInOutCubic(p);
      const startY = H + cardH, endY = -cardH, centerY = H / 2;
      let y = e < 0.5 ? startY + (centerY - startY) * e * 2 : centerY + (endY - centerY) * (e - 0.5) * 2;
      y += (i - N / 2) * CONFIG.gap * 0.3;
      return {
        i, p, cardW, cardH,
        x: W / 2 - cardW / 2,
        y: y - cardH / 2,
        rotation: Math.sin(i * 1.5) * CONFIG.jitter * Math.PI / 180,
      };
    });
  }

  // ---------- Рисование ----------
  function roundedRect(w, h, r) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
  }

  function drawPlaceholder(w, h, i) {
    const pairs = [['--slate', '--magenta'], ['--slate', '--slate-light'], ['--magenta', '--slate']];
    const [a, b] = pairs[i % pairs.length];
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, color(a));
    grad.addColorStop(1, color(b));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color('--cool-white');
    ctx.font = '500 20px Onest, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CARDS[i].title, w / 2, h / 2);
  }

  function drawCard(c, scale) {
    const { cardW: w, cardH: h } = c;
    const img = images[c.i];
    ctx.save();
    ctx.translate(c.x + w / 2, c.y + h / 2);
    ctx.rotate(c.rotation);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    // тень рисуем отдельной заливкой, т.к. clip её обрезает
    roundedRect(w, h, CONFIG.radius);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = color('--bg-card');
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.save();
    ctx.clip();
    if (ready(img)) {
      // cover-fit
      const ir = img.naturalWidth / img.naturalHeight, cr = w / h;
      let sw, sh, sx, sy;
      if (ir > cr) { sh = img.naturalHeight; sw = sh * cr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
      else { sw = img.naturalWidth; sh = sw / cr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      drawPlaceholder(w, h, c.i);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Наведение ----------
  let hovered = -1;
  let cards = [];
  const scales = CARDS.map(() => 1);

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    // верхняя карточка — с наибольшим p, проверяем её первой
    const hit = [...cards].sort((a, b) => b.p - a.p)
      .find((c) => mx >= c.x - 10 && mx <= c.x + c.cardW + 10 && my >= c.y - 10 && my <= c.y + c.cardH + 10);
    hovered = hit ? hit.i : -1;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });
  canvas.addEventListener('mouseleave', () => { hovered = -1; });

  // ---------- Подпись ----------
  let shownIndex = -1;
  function updateMeta() {
    // без наведения показываем карточку, ближайшую к центру
    const active = hovered !== -1 ? hovered
      : cards.reduce((best, c) => (Math.abs(c.p - 0.5) < Math.abs(best.p - 0.5) ? c : best), cards[0]).i;
    if (active === shownIndex) return;
    shownIndex = active;
    metaTitle.textContent = CARDS[active].title;
    metaDesc.textContent = CARDS[active].description;
    metaCount.textContent = `${String(active + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  }

  // ---------- Цикл ----------
  // prefers-reduced-motion: без инерции и без увеличения при наведении
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) CONFIG.hoverScale = 1;
  let visible = false;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(section);

  function frame() {
    if (visible) {
      time = reduceMotion ? targetTime() : time + (targetTime() - time) * 0.12;
      ctx.clearRect(0, 0, W, H);
      cards = layout();
      scales.forEach((s, i) => {
        const target = i === hovered ? CONFIG.hoverScale : 1;
        scales[i] = s + (target - s) * 0.18;
      });
      [...cards].sort((a, b) => a.p - b.p).forEach((c) => drawCard(c, scales[c.i]));
      updateMeta();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
