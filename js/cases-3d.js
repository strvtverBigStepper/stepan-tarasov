// Кейсы 3D: слева карточка кейса, справа крутится объёмное жёлтое слово (Three.js + шрифт Anton).
// При прокрутке кейсы сменяются: старое слово сжимается и уходит, новое вырастает.
(() => {
  const CASES = [
    {
      number: '01',
      title: 'Рост трафика и заявок «Спартакмеб»',
      tag: 'Мебельный ритейл · 2025',
      word: 'TRAFFIC',
      task: 'Увеличить поисковый трафик и количество заявок с сайта.',
      metrics: [
        { value: '×2', label: 'спрос на бренд' },
        { value: '+286%', label: 'трафик сайта' },
        { value: '8.82%', label: 'конверсия' },
      ],
      description: 'Комплексное SEO-продвижение, контент-маркетинг, лендинги под сегменты, AI-чат на сайте.',
    },
    {
      number: '02',
      title: 'CRM-маркетинг для B2B с нуля',
      tag: 'CRM · 2025',
      word: 'CRM',
      task: 'Построить CRM-воронку и автоматизировать лидогенерацию.',
      metrics: [
        { value: '1 511', label: 'лидов в месяц' },
        { value: '19.1 млн ₽', label: 'выручка / мес' },
        { value: '×5.6', label: 'рост охвата VK' },
      ],
      description: 'Внедрение Битрикс24, настройка воронок, автоматические рассылки, интеграция с сайтом.',
    },
    {
      number: '03',
      title: 'AI-автоматизация контроля качества',
      tag: 'Автоматизация · 2025',
      word: 'AI',
      task: 'Автоматизировать прослушку и оценку звонков менеджеров по 34 сотрудникам.',
      metrics: [
        { value: '+12 п.п.', label: 'конверсия из лида в договор' },
        { value: '100%', label: 'автоматизация аудита звонков' },
        { value: '6', label: 'чат-ботов создано' },
      ],
      description: 'Написал на Python программу, которая транскрибирует звонки из Битрикс24 и проводит аудит через ИИ по разработанному чек-листу. Создал 6 чат-ботов для мессенджеров.',
    },
    {
      number: '04',
      title: 'Репутация и клиентский сервис',
      tag: 'Репутация · 2025',
      word: 'REPUTATION',
      task: 'Выстроить систему управления репутацией и клиентским сервисом.',
      metrics: [
        { value: '4.8', label: 'рейтинг на картах' },
        { value: '200+', label: 'отзывов в месяц' },
        { value: '< 2ч', label: 'время ответа' },
      ],
      description: 'Мониторинг отзывов на всех площадках, система быстрого реагирования, обучение менеджеров работе с негативом.',
    },
  ];
  const FONT_URL = 'https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm0K0.ttf';

  const section = document.getElementById('cases3d-section');
  const sticky = document.getElementById('cases3d-sticky');
  const canvas = document.getElementById('cases3dCanvas');
  if (!section || !sticky || !canvas) return;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // ---------- Карточки кейсов ----------
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const cards = CASES.map((c) => {
    const card = el('article', 'case3d-card');
    const metrics = el('div', 'case3d-metrics');
    c.metrics.forEach((m) => {
      const box = el('div', 'case3d-metric');
      box.append(el('div', 'case3d-metric-value', m.value), el('div', 'case3d-metric-label', m.label));
      metrics.appendChild(box);
    });
    card.append(
      el('div', 'case3d-number', c.number),
      el('h3', 'case3d-title', c.title),
      el('p', 'case3d-tag', c.tag),
      el('p', 'case3d-task', `Задача: ${c.task}`),
      metrics,
      el('p', 'case3d-description', c.description),
    );
    sticky.appendChild(card);
    return card;
  });

  // ---------- Прокрутка → активный кейс ----------
  let vh, step;
  let shownIndex = -1;
  const currentIndex = () => clamp(Math.floor((window.scrollY - section.offsetTop) / step), 0, CASES.length - 1);

  function onScroll() {
    const i = currentIndex();
    if (i !== shownIndex) {
      cards.forEach((card, k) => card.classList.toggle('is-active', k === i));
      shownIndex = i;
    }
    switchWord(i);
  }

  // ---------- 3D ----------
  const has3d = typeof THREE !== 'undefined' && typeof opentype !== 'undefined';
  let renderer, scene, camera;
  const words = []; // { pivot, fitScale }
  let activeIndex = 0;
  let transitioning = false;

  if (has3d) {
    // цвета из брендбука: тёмный фон, жёлтые буквы
    const styles = getComputedStyle(document.documentElement);
    const brand = (name) => new THREE.Color(styles.getPropertyValue(name).trim());
    const yellow = brand('--yellow');
    const yellowDark = yellow.clone().multiplyScalar(0.89); // бока букв чуть темнее лица

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(brand('--slate'), 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0.5, 0.3, 16); // лёгкое смещение вправо-вверх — слово видно чуть в перспективе
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dir1.position.set(5, 8, 6);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-4, -2, 8);
    scene.add(dir2);
    const dir3 = new THREE.DirectionalLight(0xffffff, 0.15); // контровой, подчёркивает края
    dir3.position.set(0, 3, -5);
    scene.add(dir3);

    const frontMat = new THREE.MeshStandardMaterial({ color: yellow, roughness: 0.75, metalness: 0, emissive: yellow, emissiveIntensity: 0.18 });
    const sideMat = new THREE.MeshStandardMaterial({ color: yellowDark, roughness: 0.85, metalness: 0, emissive: yellowDark, emissiveIntensity: 0.1 });
    const extrude = { depth: 0.35, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8 };

    // буквы шрифта → плоские контуры Three.js (с небольшой разрядкой между буквами)
    function textToShapes(font, text, fontSize, scale, letterSpacing) {
      const shapes = [];
      let x = 0;
      for (const char of text) {
        font.forEachGlyph(char, x, 0, fontSize, {}, (glyph, gx, gy, gSize) => {
          const path = glyph.getPath(gx, gy, gSize);
          if (path.commands.length) {
            const sp = new THREE.ShapePath();
            for (const c of path.commands) {
              if (c.type === 'M') sp.moveTo(c.x * scale, -c.y * scale);
              else if (c.type === 'L') sp.lineTo(c.x * scale, -c.y * scale);
              else if (c.type === 'Q') sp.quadraticCurveTo(c.x1 * scale, -c.y1 * scale, c.x * scale, -c.y * scale);
              else if (c.type === 'C') sp.bezierCurveTo(c.x1 * scale, -c.y1 * scale, c.x2 * scale, -c.y2 * scale, c.x * scale, -c.y * scale);
            }
            shapes.push(...sp.toShapes(false));
          }
          x = gx + glyph.advanceWidth * (gSize / font.unitsPerEm) + letterSpacing;
        });
      }
      return shapes;
    }

    function buildWord(font, word) {
      const textGroup = new THREE.Group();
      textToShapes(font, word, 72, 0.01, 8).forEach((shape) => {
        textGroup.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrude), [frontMat, sideMat]));
      });
      // ось вращения — ровно через центр слова
      const box = new THREE.Box3().setFromObject(textGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      textGroup.position.set(-center.x, -center.y, -center.z);
      const pivot = new THREE.Group();
      pivot.add(textGroup);
      pivot.visible = false;
      scene.add(pivot);
      return { pivot, width: size.x, height: size.y, fitScale: 1 };
    }

    opentype.load(FONT_URL, (err, font) => {
      if (err) { console.warn('cases-3d: шрифт не загрузился', err); return; }
      CASES.forEach((c) => words.push(buildWord(font, c.word)));
      fitWords();
      activeIndex = currentIndex();
      words[activeIndex].pivot.visible = true;
      words[activeIndex].pivot.scale.setScalar(words[activeIndex].fitScale);
    });
  }

  // все слова одной высоты; длинные ужимаем, чтобы влезали по ширине (и в 14 единиц, и в холст)
  const TARGET_HEIGHT = 4.5;
  const MAX_WIDTH = 14;
  function fitWords() {
    if (!camera) return;
    const viewH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const maxWidth = Math.min(MAX_WIDTH, viewH * camera.aspect * 0.85);
    words.forEach((w, i) => {
      const byHeight = TARGET_HEIGHT / w.height;
      w.fitScale = Math.min(byHeight, maxWidth / w.width);
      if (!transitioning && i === activeIndex) w.pivot.scale.setScalar(w.fitScale);
    });
  }

  // смена слова: старое сжимается с ускоренным вращением, короткая пауза, новое вырастает
  function switchWord(newIndex) {
    if (!words.length || newIndex === activeIndex || transitioning) return;
    transitioning = true;
    const from = words[activeIndex];
    const to = words[newIndex];
    let t = 0;
    function tick() {
      t += 0.04;
      if (t < 0.45) {
        from.pivot.scale.setScalar(from.fitScale * (1 - t / 0.45));
        from.pivot.rotation.y += 0.025;
      } else if (t < 0.55) {
        from.pivot.visible = false;
      } else {
        to.pivot.visible = true;
        to.pivot.scale.setScalar(to.fitScale * Math.min((t - 0.55) / 0.45, 1));
      }
      if (t >= 1) {
        to.pivot.scale.setScalar(to.fitScale);
        activeIndex = newIndex;
        transitioning = false;
        switchWord(currentIndex()); // если за время перехода успели прокрутить дальше
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  function resize() {
    vh = window.innerHeight;
    step = vh * 0.8;
    section.style.height = `${CASES.length * step + vh}px`;
    if (renderer) {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      camera.aspect = canvas.clientWidth / canvas.clientHeight || 1;
      camera.updateProjectionMatrix();
      fitWords();
    }
    onScroll();
  }

  // ---------- Цикл: рисуем только когда секция на экране ----------
  let visible = false;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(section);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 16.67, 3); // скорость вращения не зависит от частоты экрана
    last = now;
    if (!visible || !renderer) return;
    words.forEach((w) => { if (w.pivot.visible) w.pivot.rotation.y += 0.006 * dt; });
    renderer.render(scene, camera);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
