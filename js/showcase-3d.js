// 3D Case Showcase: в центре крутится объёмный логотип STPN (Three.js), по бокам при прокрутке проявляются кейсы
(() => {
  const section = document.getElementById('showcase3d');
  const canvas = document.getElementById('showcase3dCanvas');
  const cards = document.querySelectorAll('.showcase3d__card');
  if (!section || !canvas || !cards.length || typeof THREE === 'undefined') return;

  const isMobile = () => window.innerWidth <= 768;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  // цвета букв берём из брендбука (CSS-переменные)
  const styles = getComputedStyle(document.documentElement);
  const brand = (name) => new THREE.Color(styles.getPropertyValue(name).trim());

  // ---------- Сцена ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0); // прозрачный — фон даёт CSS

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.5, 8);

  // процедурная карта отражений: тёмные полосы + светлый блик
  function makeEnvMap() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, styles.getPropertyValue('--slate-light').trim());
    g.addColorStop(0.3, styles.getPropertyValue('--slate').trim());
    g.addColorStop(0.5, styles.getPropertyValue('--slate-light').trim());
    g.addColorStop(0.7, 'rgb(10, 10, 12)');
    g.addColorStop(1, styles.getPropertyValue('--slate').trim());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const g2 = ctx.createLinearGradient(0, size * 0.35, 0, size * 0.5);
    g2.addColorStop(0, 'rgba(255,255,255,0)');
    g2.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, size * 0.35, size, size * 0.15);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }
  const envMap = makeEnvMap();
  scene.environment = envMap;

  const material = (color, metalness, roughness, envMapIntensity, clearcoat) =>
    new THREE.MeshPhysicalMaterial({ color, metalness, roughness, envMap, envMapIntensity, clearcoat, clearcoatRoughness: 0.1 });
  const goldMat = material(brand('--yellow'), 1.0, 0.2, 1.5, 0.5);
  const whiteMat = material(brand('--cool-white'), 0.6, 0.2, 1.3, 0.4);
  const magentaMat = material(brand('--magenta'), 0.8, 0.25, 1.2, 0.4);

  // ---------- Буквы ----------
  function letterS() {
    const s = new THREE.Shape();
    s.moveTo(0.8, 1.6);
    s.bezierCurveTo(0.8, 1.8, 0.6, 2.0, 0.2, 2.0);
    s.bezierCurveTo(-0.3, 2.0, -0.8, 1.8, -0.8, 1.3);
    s.bezierCurveTo(-0.8, 0.8, -0.2, 0.6, 0.2, 0.4);
    s.bezierCurveTo(0.6, 0.2, 0.8, 0.0, 0.8, -0.5);
    s.bezierCurveTo(0.8, -1.0, 0.3, -1.2, -0.1, -1.2);
    s.bezierCurveTo(-0.5, -1.2, -0.8, -1.0, -0.8, -0.8);
    s.lineTo(-0.8, -1.0);
    s.bezierCurveTo(-0.8, -1.6, -0.3, -2.0, 0.15, -2.0);
    s.bezierCurveTo(0.7, -2.0, 1.2, -1.6, 1.2, -0.8);
    s.bezierCurveTo(1.2, 0.0, 0.5, 0.4, 0.0, 0.6);
    s.bezierCurveTo(-0.5, 0.8, -0.8, 1.0, -0.4, 1.3);
    s.bezierCurveTo(-0.4, 1.5, -0.2, 1.6, 0.1, 1.6);
    s.bezierCurveTo(0.4, 1.6, 0.6, 1.5, 0.8, 1.3);
    s.lineTo(0.8, 1.6);
    return s;
  }

  const polygon = (points) => {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => s.lineTo(x, y));
    return s;
  };
  const letterT = () => polygon([[-1, 2], [1, 2], [1, 1.4], [0.3, 1.4], [0.3, -2], [-0.3, -2], [-0.3, 1.4], [-1, 1.4], [-1, 2]]);
  const letterN = () => polygon([[-0.5, -1.2], [-0.5, 1.2], [-0.15, 1.2], [0.5, -0.3], [0.5, 1.2], [0.85, 1.2], [0.85, -1.2], [0.5, -1.2], [-0.15, 0.3], [-0.15, -1.2], [-0.5, -1.2]]);

  function letterP() {
    const s = new THREE.Shape();
    s.moveTo(-0.5, -1.2);
    s.lineTo(-0.5, 1.2);
    s.lineTo(0.0, 1.2);
    s.bezierCurveTo(0.6, 1.2, 0.8, 0.9, 0.8, 0.4);
    s.bezierCurveTo(0.8, -0.1, 0.6, -0.3, 0.0, -0.3);
    s.lineTo(-0.1, -0.3);
    s.lineTo(-0.1, -1.2);
    s.lineTo(-0.5, -1.2);
    const hole = new THREE.Path();
    hole.moveTo(-0.1, 0.1);
    hole.lineTo(-0.1, 0.8);
    hole.lineTo(0.0, 0.8);
    hole.bezierCurveTo(0.3, 0.8, 0.4, 0.6, 0.4, 0.4);
    hole.bezierCurveTo(0.4, 0.2, 0.3, 0.1, 0.0, 0.1);
    hole.lineTo(-0.1, 0.1);
    s.holes.push(hole);
    return s;
  }

  const bevel = { bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4, curveSegments: 12 };
  const group = new THREE.Group();
  function addLetter(shape, depth, mat, x, y, scale) {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, ...bevel }), mat);
    mesh.position.set(x, y, 0);
    mesh.scale.setScalar(scale);
    group.add(mesh);
  }
  addLetter(letterS(), 0.8, goldMat, -3.2, 0, 1);      // S — жёлтая
  addLetter(letterT(), 0.8, whiteMat, -1.0, 0, 1);     // T — белый хром
  addLetter(letterP(), 0.5, magentaMat, 1.2, -0.8, 0.7); // P, N — маджента, меньше
  addLetter(letterN(), 0.5, magentaMat, 2.3, -0.8, 0.7);
  group.position.set(0.5, 0, -0.4);
  scene.add(group);

  // ---------- Свет ----------
  const light = (obj, x, y, z) => { obj.position.set(x, y, z); scene.add(obj); };
  light(new THREE.DirectionalLight(0xffffff, 1.2), 3, 5, 4);   // основной
  light(new THREE.DirectionalLight(0xcccccc, 0.4), -3, 2, -2); // заполняющий (нейтральный, без синевы)
  light(new THREE.DirectionalLight(0xffffff, 0.8), 0, 3, -5);  // контровой
  light(new THREE.SpotLight(0xffffff, 0.6, 20, Math.PI / 6, 0.5), 0, 8, 3);
  scene.add(new THREE.AmbientLight(0x222222, 0.5));

  // ---------- Прокрутка → карточки ----------
  let progress = 0, prevProgress = 0;

  function onScroll() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    progress = total > 0 ? clamp(-rect.top / total, 0, 1) : 0;

    const seg = 1 / cards.length;
    cards.forEach((card, i) => {
      const t = (progress - i * seg) / seg;
      const focus = t > 0 && t < 1 ? 1 - Math.pow(2 * t - 1, 2) : 0; // парабола 0→1→0
      const shift = (1 - focus) * 50;
      card.style.opacity = clamp(focus * 2.5, 0, 1).toFixed(3);
      // на телефоне карточка прижата к низу, без центрирования по вертикали
      card.style.transform = isMobile() ? `translateY(${shift.toFixed(1)}px)` : `translateY(calc(-50% + ${shift.toFixed(1)}px))`;
    });
  }

  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    // на узком экране отодвигаем камеру, чтобы логотип влез целиком
    camera.position.z = w / h < 1 ? 14 : 8;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    onScroll();
  }

  // ---------- Цикл: рисуем только когда секция на экране ----------
  let visible = false;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(section);

  function animate() {
    requestAnimationFrame(animate);
    if (!visible) return;
    // медленное вращение + ускорение от прокрутки + лёгкое покачивание
    const boost = Math.abs(progress - prevProgress) * 12;
    prevProgress = progress;
    group.rotation.y += 0.004 + boost;
    group.rotation.x = Math.sin(group.rotation.y * 0.3) * 0.12;
    group.position.y = Math.sin(Date.now() * 0.001) * 0.08;
    renderer.render(scene, camera);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  onResize();
  animate();
})();
