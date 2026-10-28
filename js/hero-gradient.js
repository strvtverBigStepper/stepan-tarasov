// Жидкий градиент за hero: WebGL-шейдер, цвета берутся из CSS-переменных палитры «Бренд» (--c0…--c4, --bg).
// Если WebGL нет — на <body> вешается класс no-gl и включаются CSS-пятна (.hero__blobs).
// Рисуем только пока hero на экране (IntersectionObserver) и вкладка активна.
(() => {
  const cv = document.getElementById('heroFluid');
  if (!cv) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { document.body.classList.add('no-gl'); return; }

  const styles = getComputedStyle(document.documentElement);
  const hex = (name) => {
    const h = styles.getPropertyValue(name).trim();
    return [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);
  };
  const PAL = {};
  ['c0', 'c1', 'c2', 'c3', 'c4', 'bg'].forEach((k) => { PAL[k] = hex('--' + k); });

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;
  uniform vec2 r;uniform float t;uniform vec3 c0,c1,c2,c3,c4,bg;
  vec2 h(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(dot(h(i),f),dot(h(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(h(i+vec2(0,1)),f-vec2(0,1)),dot(h(i+1.),f-1.),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+7.1;a*=.5;}return v;}
  void main(){
    vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);
    float T=t*.06;
    vec2 q=vec2(fbm(p*1.3+T),fbm(p*1.3-T+3.7));
    vec2 w=vec2(fbm(p*1.1+2.2*q+vec2(1.7,9.2)+T*1.3),fbm(p*1.1+2.2*q+vec2(8.3,2.8)-T));
    float f=fbm(p*.9+2.6*w);
    vec3 col=mix(c4,c3,smoothstep(-.35,.25,f));
    col=mix(col,c2,smoothstep(.05,.45,w.x+f*.4));
    float y=smoothstep(-.05,.35,q.y+w.y*.7+f*.2);
    col=mix(col,c1,y);
    col=mix(col,c0,smoothstep(.3,.6,q.y+w.y*.7+f*.2)*.9);
    float dark=smoothstep(-.05,-.5,f+w.y*.5)*(1.-y);
    col=mix(col,bg,dark*.85);
    col*=1.-.35*length(uv-.5);
    gl_FragColor=vec4(col,1.);
  }`;

  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { document.body.classList.add('no-gl'); return; }
  gl.useProgram(pr);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['r', 't', 'c0', 'c1', 'c2', 'c3', 'c4', 'bg'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
  for (const k in PAL) gl.uniform3fv(U[k], PAL[k]);

  const SCALE = 0.5; // рендер в половинном разрешении: картинка размытая сама по себе, экономим видеокарту
  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2) * SCALE;
    cv.width = cv.clientWidth * d | 0;
    cv.height = cv.clientHeight * d | 0;
    gl.viewport(0, 0, cv.width, cv.height);
  }
  window.addEventListener('resize', resize);
  resize();

  const t0 = performance.now();
  function draw(ts) {
    gl.uniform2f(U.r, cv.width, cv.height);
    gl.uniform1f(U.t, reduce ? 12 : (ts - t0) / 1000 + 12);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (reduce) { draw(0); window.addEventListener('resize', () => draw(0)); return; }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
  (function loop(ts) {
    if (visible && !document.hidden) draw(ts);
    requestAnimationFrame(loop);
  })(t0);
})();
