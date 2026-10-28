// Пакет анимаций: плавный скролл (Lenis), появление заголовков по строкам (SplitText),
// счётчики метрик (pin), раскрытие карточек кейсов + параллакс, курсор «Смотреть».
// Всё выключено при prefers-reduced-motion. Остальные скрипты слушают обычный scroll окна — Lenis его сохраняет.
(() => {
  if (!window.gsap || !window.ScrollTrigger) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  // Счётчики: при reduced-motion просто показываем итоговые числа
  const nums = document.querySelectorAll('.metrics__num');
  if (reduce) return;
  document.documentElement.classList.add('motion-on');

  // ---------- 1. Плавный скролл: только мышь/тачпад, на тач-устройствах — нативный ----------
  if (window.Lenis && !touch) {
    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -70 } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('lenis-on');
  }

  // ---------- 2. Заголовки разделов: строки выезжают снизу из-под маски ----------
  const headings = [...document.querySelectorAll('main .section__title, main .metrics__title')]
    .filter((h) => !h.closest('.hero, .no-water'));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    if (window.SplitText) {
      headings.forEach((h) => {
        SplitText.create(h, {
          type: 'lines', mask: 'lines', autoSplit: true,
          onSplit: (self) => gsap.from(self.lines, {
            yPercent: 110, duration: 0.9, ease: 'power3.out', stagger: 0.08,
            scrollTrigger: { trigger: h, start: 'top 88%', once: true },
          }),
        });
      });
    }
    ScrollTrigger.refresh();
  });

  // ---------- 3. Метрики: секция закрепляется, числа считают от нуля ----------
  const metrics = document.getElementById('metrics');
  if (metrics && nums.length) {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: metrics, start: 'top top', end: '+=90%', pin: true, scrub: 0.6, anticipatePin: 1 },
    });
    nums.forEach((el, i) => {
      const to = parseFloat(el.dataset.to.replace(',', '.'));
      const dec = (el.dataset.to.split(',')[1] || '').length;
      const o = { v: 0 };
      el.textContent = (el.dataset.pre || '') + (0).toFixed(dec).replace('.', ',') + (el.dataset.suf || '');
      tl.to(o, {
        v: to, duration: 1, ease: 'power2.out',
        onUpdate: () => { el.textContent = (el.dataset.pre || '') + o.v.toFixed(dec).replace('.', ',') + (el.dataset.suf || ''); },
      }, i * 0.15);
      tl.from(el.closest('.metrics__item'), { opacity: 0.25, y: 30, duration: 0.6 }, i * 0.15);
    });
  }

  // ---------- 4. Карточки кейсов: раскрытие маской + лёгкий параллакс фона ----------
  document.querySelectorAll('.case-card').forEach((card, i) => {
    gsap.fromTo(card, { clipPath: 'inset(18% 8% 18% 8% round 22px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: 1.1, ease: 'power3.out', delay: i * 0.08,
      scrollTrigger: { trigger: card, start: 'top 85%', once: true },
      clearProps: 'clipPath',
    });
    gsap.fromTo(card, { '--py': '-6%' }, {
      '--py': '6%', ease: 'none',
      scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // ---------- 5. Курсор «Смотреть»: только над карточками кейсов и портфолио, не на тач-экранах ----------
  if (!touch) {
    const cur = document.createElement('div');
    cur.className = 'view-cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.textContent = 'Смотреть';
    document.body.appendChild(cur);
    const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
    const portfolio = document.getElementById('cardScrollCanvas');
    let on = false;
    const set = (v) => { if (v !== on) { on = v; cur.classList.toggle('is-on', v); document.documentElement.classList.toggle('view-cursor-on', v); } };
    window.addEventListener('mousemove', (e) => {
      xTo(e.clientX); yTo(e.clientY);
      const t = e.target;
      const overCase = t.closest && t.closest('.case-card, .cert__img--photo, .vcard');
      const overPortfolio = t === portfolio && portfolio.style.cursor === 'pointer';
      set(!!(overCase || overPortfolio));
    }, { passive: true });
    document.addEventListener('mouseleave', () => set(false));
    window.addEventListener('scroll', () => { if (on && portfolio && portfolio.style.cursor !== 'pointer' && !document.querySelector('.case-card:hover, .cert__img--photo:hover, .vcard:hover')) set(false); }, { passive: true });
  }


  // ---------- 6. «Карьерный путь» — лестница: линия заполняется, строки проявляются по словам, годы переворачиваются ----------
  const tl = document.querySelector('.timeline');
  if (tl) {
    // Линия-заливка — элемент списка без смысла для экранных дикторов (в <ol> допустимы только <li>)
    const fill = document.createElement('li');
    fill.className = 'timeline__fill';
    fill.setAttribute('aria-hidden', 'true');
    fill.setAttribute('role', 'presentation');
    tl.appendChild(fill);
    gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: tl, start: 'top 60%', end: 'bottom 50%', scrub: true } });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      tl.querySelectorAll('.timeline__item').forEach((row) => {
        const words = [];
        row.querySelectorAll('h3, p').forEach((el) => words.push(...SplitText.create(el, { type: 'words', aria: 'none' }).words));
        gsap.fromTo(words, { color: 'rgba(247,247,248,.2)' }, {
          color: (i, el) => (getComputedStyle(el.parentElement).getPropertyValue("--row-ink").trim() || "#F7F7F8"),
          stagger: 0.1, ease: 'none',
          scrollTrigger: { trigger: row, start: 'top 75%', end: 'top 45%', scrub: true },
        });
        const year = row.querySelector('.timeline__year');
        if (year) {
          const chars = SplitText.create(year, { type: 'chars', aria: 'none' }).chars;
          gsap.from(chars, { rotateX: 105, yPercent: -40, opacity: 0, transformOrigin: '50% 50% -0.5em', transformPerspective: 400,
            duration: 0.6, ease: 'back.out(1.6)', stagger: 0.1,
            scrollTrigger: { trigger: row, start: 'top 80%', once: true } });
        }
      });
      ScrollTrigger.refresh();
    });
  }

  // ---------- 7. Портрет в hero: лёгкий параллакс при прокрутке ----------
  const portrait = document.querySelector('.hero__portrait');
  if (portrait) gsap.to(portrait, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
