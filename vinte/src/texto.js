import katex from 'katex';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formula(tex) {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: false, strict: 'ignore' });
  } catch {
    return '<code>' + esc(tex) + '</code>';
  }
}

// Texto com fórmulas LaTeX entre $...$ -> HTML seguro.
export function rico(s) {
  if (!s) return '';
  return String(s).split('$')
    .map((parte, i) => (i % 2 ? formula(parte) : esc(parte).replace(/\n/g, '<br>')))
    .join('');
}

// Só aceita caminhos relativos de imagens do próprio site e ligações https.
export function imgSegura(u) {
  return /^img\/[\w.\-]+\.(webp|png|jpe?g|svg)$/i.test(u || '') ? u : '';
}
export function urlSegura(u) {
  return /^https:\/\/[^\s"'<>]+$/i.test(u || '') ? u : '';
}
