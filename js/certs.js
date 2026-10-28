// Сертификаты: клик по миниатюре открывает полную картинку в <dialog>.
// Esc, крестик или клик по фону — закрыть; фокус возвращается на миниатюру.
(() => {
  const box = document.getElementById('certLightbox');
  if (!box || typeof box.showModal !== 'function') return;
  const img = box.querySelector('.lightbox__img');
  let opener = null;
  document.querySelectorAll('.cert__img--photo').forEach((btn) => btn.addEventListener('click', () => {
    opener = btn;
    img.src = btn.dataset.full;
    img.alt = btn.dataset.alt || '';
    box.showModal();
    box.querySelector('.lightbox__close').focus();
  }));
  const close = () => box.close();
  box.querySelector('.lightbox__close').addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); }); // клик мимо картинки
  box.addEventListener('close', () => { if (opener) opener.focus(); });
})();
