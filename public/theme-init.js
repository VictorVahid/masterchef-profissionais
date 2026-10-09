// Aplica o tema salvo (ou o do sistema) antes da primeira pintura, evitando flash.
try {
  var t = localStorage.getItem('theme')
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
} catch (e) {}
