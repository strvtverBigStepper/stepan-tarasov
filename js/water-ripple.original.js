// Водная рябь на слайде «Работа без воды»: симуляция волнового уравнения на WebGL + преломление текстуры со словами-проблемами
(() => {
  const canvas = document.getElementById('water-ripple');
  const section = document.getElementById('no-water');
  if (!canvas || !section) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) { canvas.remove(); return; }

  const SIM_SIZE = 512;
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
    void main() {
      float uTexelSim = 1.0 / uSimSize;
      float h  = texture2D(uState, vUv).r;
      float hL = texture2D(uState, vUv - vec2(uTexelSim, 0.0)).r;
      float hR = texture2D(uState, vUv + vec2(uTexelSim, 0.0)).r;
      float hB = texture2D(uState, vUv - vec2(0.0, uTexelSim)).r;
      float hT = texture2D(uState, vUv + vec2(0.0, uTexelSim)).r;
      vec3 n = normalize(vec3(hL - hR, hB - hT, 0.06));

      // Преломление
      vec2 uv = vUv + n.xy * uRefraction * 0.04;
      vec3 color = texture2D(uImage, uv).rgb;

      // Затопление
      float waveAmp = abs(h);
      float surfaceDisturbance = length(n.xy);
      float coverage = clamp(waveAmp * 8.0 + surfaceDisturbance * 2.5, 0.0, 0.92);
      vec3 water = vec3(0.078, 0.078, 0.094);
      color = mix(color, water, coverage);

      // Блики
      vec3 L = normalize(vec3(-0.4, 0.6, 1.0));
      float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
      float rim = pow(1.0 - n.z, 3.0) * 0.12;
      color += vec3(0.969, 0.969, 0.973) * (spec * 0.35 + rim) * uSpecular;

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

  function drawImage() {
    const w = canvas.width, h = canvas.height;
    textCanvas.width = w;
    textCanvas.height = h;
    const ctx = textCanvas.getContext('2d');

    const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    grad.addColorStop(0, '#26262e');
    grad.addColorStop(1, '#1E1E24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // WebGL читает строки снизу вверх — переворачиваем перед текстом
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.fillStyle = 'rgba(247, 247, 248, 0.35)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = Math.max(0.45, Math.min(w / 1440, h / 900));
    WORDS.forEach(([word, x, y, size]) => {
      ctx.font = `900 ${Math.round(size * scale)}px Inter, sans-serif`;
      ctx.fillText(word, x * w, y * h);
    });

    // Главный заголовок — тоже в текстуре, чтобы тонул вместе со словами
    ctx.fillStyle = 'rgba(247, 247, 248, 0.95)';
    ctx.font = '900 100px Inter, sans-serif';
    const titleSize = Math.min(160 * scale, (w * 0.88) / (ctx.measureText(TITLE[1]).width / 100));
    ctx.font = `900 ${Math.round(titleSize)}px Inter, sans-serif`;
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
    pointer.strength = PARAMS.intensity * 0.02;
  }

  section.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));
  section.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: true });

  // ---------- Цикл ----------
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(section);

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
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame() {
    if (visible) {
      resize();
      step();
      render();
    }
    requestAnimationFrame(frame);
  }

  // Ждём Inter, иначе слова запекутся системным шрифтом
  const fontsReady = document.fonts ? document.fonts.load('900 72px Inter').catch(() => {}) : Promise.resolve();
  fontsReady.then(() => {
    canvas.width = canvas.height = 0;
    resize();
    requestAnimationFrame(frame);
  });
  window.addEventListener('resize', resize);
})();
