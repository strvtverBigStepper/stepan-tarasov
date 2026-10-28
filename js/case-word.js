// Объёмное слово на обложке кейса: чистый CSS (слои text-shadow), без WebGL.
// При прокрутке слово слегка поворачивается (GSAP ScrollTrigger, scrub) и смотрит прямо, когда стоит по центру экрана.
(() => {
  const box = document.querySelector('.case-word');
  if (!box) return;
  const word = box.dataset.word || '';
  const DEPTH = 24; // число слоёв «толщины»
  const shadows = [];
  for (let i = 1; i <= DEPTH; i++) {
    const t = i / DEPTH;
    // бока темнеют вглубь и уходят в маджента-оттенок
    const r = Math.round(150 - 110 * t), g = Math.round(40 - 30 * t), b = Math.round(80 - 50 * t);
    shadows.push(`${i * 0.6}px ${i * 0.6}px 0 rgb(${r},${g},${b})`);
  }
  shadows.push(`${DEPTH * 0.6 + 6}px ${DEPTH * 0.6 + 14}px 30px rgba(0,0,0,.45)`);
  box.innerHTML = `<span class="case-word__inner"><span class="case-word__back" style="text-shadow:${shadows.join(',')}">${word}</span><span class="case-word__face">${word}</span></span>`;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const inner = box.querySelector('.case-word__inner');
  gsap.timeline({ scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
    .fromTo(inner, { rotateY: -20, rotateX: 8 }, { rotateY: 0, rotateX: 0, ease: 'none' })
    .to(inner, { rotateY: 20, rotateX: -8, ease: 'none' });
})();
