// Водная рябь на слайде (версия редизайна; прежняя — js/water-ripple.original.js) «Работа без воды»: симуляция волнового уравнения на WebGL + преломление текстуры со словами-проблемами
(() => {
  const canvas = document.getElementById('water-ripple');
  const section = document.getElementById('no-water');
  if (!canvas || !section) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) { canvas.remove(); return; }

  const SIM_SIZE = 512;
  // ===== НАСТРОЙКИ ИНТЕНСИВНОСТИ ВОДЫ (крутить здесь) =====
  const WAVE_AMP = 0.0005;        // сила фоновой зыби (было 0.00022)
  const WAVE_SPEED = 1.4;         // скорость фоновых волн, множитель
  const REFRACTION_CAP = 0.022;   // макс. сдвиг картинки — не даёт тексту «развалиться»
  const CAUSTIC_STRENGTH = 0.11;  // мерцание бликов на дне (было 0.07)
  const CAUSTIC_SPEED = 1.4;      // скорость мерцания и сноса ветром
  const DROP_RATE = 0.5;          // капель в секунду (~раз в 2 с)
  const DROP_STRENGTH = [0.4, 0.65]; // сила капли относительно мыши, мин–макс
  const MOUSE_STRENGTH = 1.5;     // сила ряби от мыши (было 1)
  // =========================================================
  const PARAMS = {
    radius: 40 / 1000,
    intensity: 85 / 28,
    viscosity: 98 / 100,
    refraction: 75 / 100,
    specular: 45 / 33,
  };

  const WORDS = [
    ['СОМНЕНИЯ', 0.18, 0.18, 65],
    ['ПРОВАЛ', 0.75, 0.15, 70],
    ['ХАОС', 0.82, 0.78, 68],
    ['РИСКИ', 0.2, 0.82, 66],
    ['СТРАХ', 0.15, 0.35, 60],
    ['ВОДА', 0.8, 0.35, 72],
  ];

  const TITLE = ['РАБОТА', 'БЕЗ ВОДЫ'];

  // ---------- Текстуры симуляции (half-float, с запасным float) ----------
  function pickSimType() {
    const half = gl.getExtension('OES_texture_half_float');
    gl.getExtension('EXT_color_buffer_half_float');
    if (half && fboWorks(half.HALF_FLOAT_OES)) return half.HALF_FLOAT_OES;
    const full = gl.getExtension('OES_texture_float');
    gl.getExtension('WEBGL_color_buffer_float');
    if (full && fboWorks(gl.FLOAT)) return gl.FLOAT;
    return null;
  }

  function createSimTarget(type) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM_SIZE, SIM_SIZE, 0, gl.RGBA, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { tex, fbo } : null;
  }

  function fboWorks(type) {
    const t = createSimTarget(type);
    if (!t) return false;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
    return true;
  }

  const simType = pickSimType();
  if (!simType) { canvas.remove(); return; }

  // ---------- Шейдеры ----------
  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  // r — текущая высота, g — предыдущая
  const SIM_FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uState;
    uniform vec2 uTexel;
    uniform vec2 uMouse;
    uniform float uAspect;
    uniform float uRadius;
    uniform float uStrength;
    uniform float uViscosity;
    void main() {
      vec4 s = texture2D(uState, vUv);
      float top    = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;
      float bottom = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
      float left   = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
      float right  = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;

      float next = (top + bottom + left + right) * 0.5 - s.g;
      next *= uViscosity;

      vec2 d = (vUv - uMouse) * vec2(uAspect, 1.0);
      next += uStrength * smoothstep(uRadius, 0.0, length(d));

      gl_FragColor = vec4(next, s.r, 0.0, 1.0);
    }`;

  const RENDER_FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uState;
    uniform sampler2D uImage;
    uniform float uSimSize;
    uniform float uRefraction;
    uniform float uSpecular;
    uniform float uTime;
    uniform float uAsp;
    uniform float uWaveAmp;
    uniform float uWaveSpeed;
    uniform float uRefrCap;
    uniform float uCausticStr;
    uniform float uCausticSpd;
    uniform float uLine;   // линия воды под именем (uv, 2.0 = нет)
    uniform float uPx;     // 1 css-пиксель в uv по вертикали
    // ветровая зыбь: несколько волновых цепочек вокруг одного направления ветра
    vec2 windGrad(vec2 p, float t){
      p += 0.06 * vec2(sin(t * 0.071 + p.y * 1.3), cos(t * 0.053 + p.x * 1.1)); // медленный дрейф — без явной периодичности
      vec2 g = vec2(0.0);
      // dir angle, wavelength k, speed (циклы/с), amp
      vec4 W[7];
      W[0] = vec4(0.35, 7.0, 0.23, 1.00);
      W[1] = vec4(0.10, 11.0, 0.31, 0.55);
      W[2] = vec4(0.62, 15.0, 0.41, 0.35);
      W[3] = vec4(-0.05, 23.0, 0.53, 0.20);
      W[4] = vec4(0.48, 31.0, 0.59, 0.12);
      W[5] = vec4(0.85, 47.0, 0.82, 0.07);   // короткая рябь
      W[6] = vec4(-0.30, 63.0, 0.97, 0.045);
      for (int i = 0; i < 7; i++){
        vec2 d = vec2(cos(W[i].x), sin(W[i].x));
        float ph = W[i].y * dot(d, p) - 6.2831853 * W[i].z * t + float(i) * 1.7;
        g += W[i].w * W[i].y * d * cos(ph);
      }
      return g;
    }
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      float uTexelSim = 1.0 / uSimSize;
      float h  = texture2D(uState, vUv).r;
      float hL = texture2D(uState, vUv - vec2(uTexelSim, 0.0)).r;
      float hR = texture2D(uState, vUv + vec2(uTexelSim, 0.0)).r;
      float hB = texture2D(uState, vUv - vec2(0.0, uTexelSim)).r;
      float hT = texture2D(uState, vUv + vec2(0.0, uTexelSim)).r;
      vec2 wg = windGrad(vUv * vec2(uAsp, 1.0), uTime * uWaveSpeed) * uWaveAmp;
      vec3 n = normalize(vec3(hL - hR - wg.x, hB - hT - wg.y, 0.06));

      // Преломление
      vec2 uv = vUv + clamp(n.xy * uRefraction * 0.04, vec2(-uRefrCap), vec2(uRefrCap));
      vec3 color = texture2D(uImage, uv).rgb;

      // Затопление
      float waveAmp = abs(h);
      float surfaceDisturbance = length(n.xy);
      float coverage = clamp(waveAmp * 8.0 + surfaceDisturbance * 2.5, 0.0, 0.92);
      vec3 water = vec3(0.80, 0.95, 0.97);
      color = mix(color, water, coverage);

      // Блики
      vec3 L = normalize(vec3(-0.4, 0.6, 1.0));
      float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
      float rim = pow(1.0 - n.z, 3.0) * 0.12;
      color += vec3(0.969, 0.969, 0.973) * (spec * 0.35 + rim) * uSpecular;

      // мерцание каустик в светлых местах фото (слабое)
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      vec2 cp = vUv * vec2(9.0, 6.0) + n.xy * 2.0 - vec2(0.94, 0.34) * uTime * 0.25 * uCausticSpd;
      float ct = uTime * uCausticSpd;
      float sh = sin(cp.x + ct * 0.9 + sin(cp.y * 1.3 + ct * 0.6)) * sin(cp.y * 1.1 - ct * 0.7 + sin(cp.x * 0.8 + ct * 0.5));
      color *= 1.0 + uCausticStr * sh * smoothstep(0.45, 0.85, lum);
      // тёплый оттенок в бликах
      color = mix(color, color * vec3(1.06, 1.02, 0.88), smoothstep(0.65, 1.0, lum) * 0.45);
      // плёночное зерно
      color += (hsh(gl_FragCoord.xy + fract(uTime * 3.7) * 251.0) - 0.5) * 0.03;
      // ===== Имя тонет: выше волнистой линии воды — сухо и чётко, ниже — под водой =====
      float wx = vUv.x * uAsp;
      float yw = uLine + uPx * (3.0 * sin(wx * 7.0 + uTime * 1.1) + 1.6 * sin(wx * 19.0 - uTime * 1.9) + 0.8 * sin(wx * 41.0 + uTime * 2.7) + (h * 900.0));
      float dpx = (vUv.y - yw) / uPx;          // > 0 — выше воды (в css-пикселях)
      if (dpx > -1.5) {
        vec3 dry = texture2D(uImage, vUv).rgb;
        // свет от воды чуть подсвечивает воздух над линией
        float glow = exp(-max(dpx, 0.0) / 46.0) * (0.75 + 0.25 * sin(wx * 13.0 + uTime * 1.7));
        dry += vec3(0.25, 0.75, 0.85) * 0.16 * glow;
        color = mix(color * vec3(0.78, 0.96, 1.0), dry, smoothstep(-1.5, 1.5, dpx));
      } else {
        color *= mix(vec3(0.78, 0.96, 1.0), vec3(1.0), smoothstep(-6.0, -90.0, dpx)); // бирюзовый оттенок у поверхности
      }
      // мениск — тонкий блик по линии воды
      color += vec3(0.85, 1.0, 1.0) * 0.55 * exp(-abs(dpx + 0.5) / 1.1) * step(uLine, 1.5);
      gl_FragColor = vec4(color, 1.0);
    }`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  function program(fragSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  let simProg, renderProg;
  try {
    simProg = program(SIM_FRAG);
    renderProg = program(RENDER_FRAG);
  } catch (err) {
    console.warn('water-ripple:', err);
    canvas.remove();
    return;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let targets = [createSimTarget(simType), createSimTarget(simType)];

  // ---------- Текстура со словами ----------
  const imageTex = gl.createTexture();
  const textCanvas = document.createElement('canvas');

  // Фото бассейна — обычный файл (assets/pool-1.jpg), фото: Wesley Tingey / Unsplash
  // Фото бассейна. С сервера — обычный файл assets/pool-1.jpg.
  // При открытии с диска (file://) WebGL блокирует такую картинку, поэтому берём base64-копию из js/pool-1.data.js.
  const loadPoolSrc = () => new Promise((res) => {
    if (location.protocol !== 'file:') return res('assets/pool-1.jpg');
    if (window.STPN_POOL_DATA) return res(window.STPN_POOL_DATA);
    const sc = document.createElement('script');
    sc.src = 'js/pool-1.data.js';
    sc.onload = () => res(window.STPN_POOL_DATA || null);
    sc.onerror = () => res(null);
    document.head.appendChild(sc);
  });
  const POOL_IMGS = [new Image()];
  const poolIdx = 0;
  const imgsReady = loadPoolSrc().then((src) => {
    if (!src) return;
    const im = POOL_IMGS[0];
    im.src = src;
    return im.decode ? im.decode().catch(() => {}) : null;
  });
  function drawImage() {
    const w = canvas.width, h = canvas.height;
    textCanvas.width = w;
    textCanvas.height = h;
    const ctx = textCanvas.getContext('2d');

    // фон — фото бассейна (cover)
    const img = POOL_IMGS[poolIdx];
    if (img && img.complete && img.naturalWidth) {
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    } else { ctx.fillStyle = '#3FC6D0'; ctx.fillRect(0, 0, w, h); }

    // WebGL читает строки снизу вверх — переворачиваем перед текстом
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.shadowColor = 'rgba(90, 10, 50, 0.35)'; ctx.shadowBlur = 24 * Math.max(0.45, Math.min(w / 1440, h / 900)); ctx.shadowOffsetY = -4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = Math.max(0.45, Math.min(w / 1440, h / 900));
    WORDS.forEach(([word, x, y, size]) => {
      ctx.font = `800 ${Math.round(size * scale)}px Unbounded, sans-serif`;
      ctx.fillText(word, x * w, y * h);
    });

    // Переход от тёмного hero к воде + нижняя часть имени STEPAN TARASOV (верх — в hero, низ — тонет здесь)
    drawSinkingName(ctx, w, h);

    // Главный заголовок — тоже в текстуре, чтобы тонул вместе со словами
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(90, 10, 50, 0.45)'; ctx.shadowBlur = 40 * scale; ctx.shadowOffsetY = -6 * scale;
    ctx.font = '800 100px Unbounded, sans-serif';
    const titleSize = Math.min(125 * scale, (w * 0.8) / (ctx.measureText(TITLE[1]).width / 100));
    ctx.font = `800 ${Math.round(titleSize)}px Unbounded, sans-serif`;
    ctx.fillText(TITLE[0], w / 2, h / 2 - titleSize * 0.55);
    ctx.fillText(TITLE[1], w / 2, h / 2 + titleSize * 0.55);
    ctx.restore();

    gl.bindTexture(gl.TEXTURE_2D, imageTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, textCanvas);
  }

  // ---------- Размер ----------
  // ---------- Тонущее имя ----------
  const heroName = document.getElementById('heroName');
  const SINK_FADE = 180;   // высота мягкого перехода от hero к воде, css px
  let lineUv = 2.0;        // линия воды в uv (2.0 — имени нет)
  function drawSinkingName(ctx, w, h) {
    const dpr = w / section.clientWidth;
    const fade = Math.min(SINK_FADE, section.clientHeight * 0.3) * dpr;
    const g = ctx.createLinearGradient(0, 0, 0, fade);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0B0A10';
    g.addColorStop(0, bg); g.addColorStop(0.35, bg + 'D9'); g.addColorStop(1, bg + '00');
    ctx.save(); ctx.shadowColor = 'transparent'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, fade); ctx.restore();
    lineUv = 2.0;
    if (!heroName || !document.documentElement.classList.contains('name-sinks')) return;
    const cs = getComputedStyle(heroName);
    const top = section.getBoundingClientRect().top, left = section.getBoundingClientRect().left;
    const parts = [...heroName.querySelectorAll('span')];
    const fs = parseFloat(cs.fontSize);
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = cs.color;
    ctx.font = `800 ${fs * dpr}px Unbounded, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${parseFloat(cs.letterSpacing) * dpr || 0}px`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // строки имени и их положение относительно слайда
    const rows = parts.map((sp) => {
      sp.style.display = 'inline-block';
      const r = sp.getBoundingClientRect();
      sp.style.display = '';
      return { t: sp.textContent.toUpperCase(), r };
    }).filter((o) => o.r.bottom > top);
    const last = rows.reduce((m, o) => (!m || o.r.bottom > m.r.bottom ? o : m), null);
    // линия воды проходит через нижнюю строку имени, чуть ниже края hero
    const yCss = last ? Math.max(6, last.r.top + last.r.height * 0.88 - top) : -1;
    const drawRows = (alpha, y0, y1) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y0, w, y1 - y0); ctx.clip();
      ctx.globalAlpha = alpha;
      rows.forEach((o) => ctx.fillText(o.t, (o.r.left - left) * dpr, (o.r.top + o.r.height / 2 - top) * dpr));
      ctx.restore();
    };
    drawRows(1, 0, yCss * dpr);            // над водой — чётко
    drawRows(0.55, yCss * dpr, h);         // под водой — полупрозрачно, сквозь воду видно дно
    ctx.restore();
    if (last) lineUv = 1 - yCss / section.clientHeight;
  }
  window.addEventListener('heronamefit', () => { if (canvas.width) drawImage(); });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(section.clientWidth * dpr);
    const h = Math.round(section.clientHeight * dpr);
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
    drawImage();
  }

  // ---------- Мышь / тач ----------
  const pointer = { x: 0.5, y: 0.5, strength: 0 };

  function onMove(clientX, clientY) {
    const r = section.getBoundingClientRect();
    pointer.x = (clientX - r.left) / r.width;
    pointer.y = 1 - (clientY - r.top) / r.height;
    pointer.strength = PARAMS.intensity * 0.02 * MOUSE_STRENGTH;
  }

  section.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));
  section.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: true });

  // ---------- Цикл ----------
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(section);
  // стоп и при свёрнутой вкладке
  document.addEventListener('visibilitychange', () => { lastT = performance.now(); });

  function step() {
    const [src, dst] = targets;
    gl.useProgram(simProg.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(simProg.u.uState, 0);
    gl.uniform2f(simProg.u.uTexel, 1 / SIM_SIZE, 1 / SIM_SIZE);
    gl.uniform2f(simProg.u.uMouse, pointer.x, pointer.y);
    gl.uniform1f(simProg.u.uAspect, canvas.width / canvas.height);
    gl.uniform1f(simProg.u.uRadius, PARAMS.radius);
    gl.uniform1f(simProg.u.uStrength, pointer.strength);
    gl.uniform1f(simProg.u.uViscosity, PARAMS.viscosity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    targets = [dst, src];
    pointer.strength = 0;
  }

  function render() {
    gl.useProgram(renderProg.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].tex);
    gl.uniform1i(renderProg.u.uState, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, imageTex);
    gl.uniform1i(renderProg.u.uImage, 1);
    gl.uniform1f(renderProg.u.uSimSize, SIM_SIZE); // по SIM_SIZE, не по canvas.width
    gl.uniform1f(renderProg.u.uRefraction, PARAMS.refraction);
    gl.uniform1f(renderProg.u.uSpecular, PARAMS.specular);
    gl.uniform1f(renderProg.u.uTime, performance.now() / 1000);
    gl.uniform1f(renderProg.u.uAsp, canvas.width / canvas.height);
    gl.uniform1f(renderProg.u.uWaveAmp, WAVE_AMP);
    gl.uniform1f(renderProg.u.uWaveSpeed, WAVE_SPEED);
    gl.uniform1f(renderProg.u.uRefrCap, REFRACTION_CAP);
    gl.uniform1f(renderProg.u.uCausticStr, CAUSTIC_STRENGTH);
    gl.uniform1f(renderProg.u.uCausticSpd, CAUSTIC_SPEED);
    gl.uniform1f(renderProg.u.uLine, lineUv);
    gl.uniform1f(renderProg.u.uPx, 1 / section.clientHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // редкие мягкие капли/порывы — зависят от реального времени, не от FPS
  let lastT = performance.now();
  function ambientDrop() {
    const now = performance.now(); const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    if (pointer.strength === 0 && Math.random() < 1 - Math.exp(-DROP_RATE * dt)) {
      pointer.x = 0.05 + Math.random() * 0.9; pointer.y = 0.05 + Math.random() * 0.9;
      pointer.strength = PARAMS.intensity * 0.02 * (DROP_STRENGTH[0] + Math.random() * (DROP_STRENGTH[1] - DROP_STRENGTH[0]));
    }
  }
  function frame() {
    if (visible && !document.hidden) {
      ambientDrop();
      resize();
      step();
      render();
    }
    requestAnimationFrame(frame);
  }

  // Ждём Unbounded и фото, иначе слова запекутся системным шрифтом
  const fontsReady = Promise.all([document.fonts ? document.fonts.load('800 72px Unbounded').catch(() => {}) : null, imgsReady]);
  fontsReady.then(() => {
    document.documentElement.classList.add('name-sinks'); // имя опускается в воду (CSS)
    window.dispatchEvent(new Event('resize'));
    canvas.width = canvas.height = 0;
    resize();
    requestAnimationFrame(frame);
  });
  window.addEventListener('resize', resize);
})();
