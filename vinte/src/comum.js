// Utilitários partilhados pelas páginas.
import { esc, rico, imgSegura, urlSegura } from './texto.js';
import * as progresso from './progresso.js';

export const app = document.getElementById('app');
export const LETRAS = ['A', 'B', 'C', 'D'];
export const ROTULO_TIPO = {
  escolha_multipla: 'Escolha múltipla', calculo: 'Cálculo',
  resposta_aberta: 'Resposta aberta', associacao: 'Associação',
};
export const TAMANHO_TESTE = 10;

// ---------- utilitários ----------
export const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
export function baralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const eEM = q => q.tipo === 'escolha_multipla' && q.opcoes;
export const href = (...p) => '#/' + p.map(encodeURIComponent).join('/');

export function cabecalho(trilho = []) {
  const migalhas = trilho.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`)).join('<span class="sep">›</span>');
  const p = progresso.perfilAtual();
  const extra = p?.papel === 'explicador' ? `<a class="topo-link" href="#/centro">O meu centro</a>`
    : p?.papel === 'admin' ? `<a class="topo-link" href="#/admin">Administração</a>` : '';
  const conta = p ? `${extra}<a class="conta-link" href="#/conta" title="A minha conta">${esc(p.nome_utilizador || p.nome || 'conta')}</a>` : '';
  return `<header class="topo"><a class="marca" href="#/">Vinte</a>${trilho.length ? `<nav class="trilho">${migalhas}</nav>` : ''}<span class="topo-dir">${conta}</span></header>`;
}

export function barra(r) {
  const feitas = pct(r.respondidas, r.total), certas = pct(r.certas, r.total);
  return `<div class="barra" title="${r.certas} certas · ${r.respondidas} respondidas de ${r.total}">
    <span class="b-feitas" style="width:${feitas}%"></span><span class="b-certas" style="width:${certas}%"></span></div>`;
}

// ---------- questão ----------
export function htmlFiguras(q) {
  return (q.imagens || []).map(imgSegura).filter(Boolean)
    .map(u => `<img class="fig" src="${u}" alt="Figura da questão ${esc(q.numero)}" loading="lazy">`).join('');
}

export function htmlOpcoes(q, escolhida, corrigir) {
  const fig = q.opcoes_img && imgSegura(q.opcoes_img) ? `<img class="fig" src="${imgSegura(q.opcoes_img)}" alt="Opções (A) a (D)" loading="lazy">` : '';
  return fig + `<div class="opcoes">${LETRAS.filter(l => q.opcoes[l] != null).map(l => {
    let cls = 'opcao';
    if (escolhida === l) cls += ' escolhida';
    if (corrigir && l === q.resposta_certa) cls += ' certa';
    if (corrigir && escolhida === l && l !== q.resposta_certa) cls += ' errada';
    return `<button class="${cls}" data-acao="escolher" data-letra="${l}" ${corrigir ? 'disabled' : ''}>
      <span class="letra">${l}</span><span>${rico(q.opcoes[l])}</span></button>`;
  }).join('')}</div>`;
}

export function htmlLinks(q) {
  const e = urlSegura(q.pdf_enunciado), c = urlSegura(q.pdf_criterios);
  return `<p class="links">${e ? `<a href="${e}" target="_blank" rel="noopener">Enunciado (PDF)</a>` : ''}
    ${c ? `<a href="${c}" target="_blank" rel="noopener">Critérios (PDF)</a>` : ''}</p>`;
}

// estado: { escolhida, corrigir, mostrarResolucao, autoavaliacao }
export function htmlQuestao(q, estado = {}) {
  const resol = eEM(q)
    ? (estado.corrigir ? `<div class="feedback ${estado.escolhida === q.resposta_certa ? 'ok' : 'mal'}">
        ${estado.escolhida === q.resposta_certa ? '✓ Certo!' : `✗ A resposta certa é a ${esc(q.resposta_certa)}.`}</div>
        ${q.explicacao ? `<div class="resolucao"><h3>Porquê?</h3><div>${rico(q.explicacao)}</div></div>` : ''}` : '')
    : (estado.mostrarResolucao
        ? `<div class="resolucao"><h3>Resolução</h3><div>${rico(q.resposta_certa)}</div></div>
           ${estado.autoavaliacao == null
              ? `<div class="auto"><span>Como correu?</span>
                 <button class="btn" data-acao="auto" data-certa="1">Acertei</button>
                 <button class="btn btn-sec" data-acao="auto" data-certa="0">Errei</button></div>`
              : `<div class="feedback ${estado.autoavaliacao ? 'ok' : 'mal'}">${estado.autoavaliacao ? '✓ Marcaste como certa.' : '✗ Marcaste como errada.'}</div>`}`
        : `<button class="btn" data-acao="resolucao">Ver resolução</button>`);
  return `<article class="questao">
    <p class="ref">Exame ${q.ano} · ${esc(q.fase)} · item ${esc(q.numero)} · ${ROTULO_TIPO[q.tipo] || esc(q.tipo)}${q.cotacao ? ` · ${q.cotacao} pontos${q.opcional_contam ? ' (opcional)' : ''}` : ''}</p>
    ${q.contexto ? `<div class="contexto">${rico(q.contexto)}</div>` : ''}
    ${htmlFiguras(q)}
    <div class="enunciado">${rico(q.enunciado)}</div>
    ${eEM(q) ? htmlOpcoes(q, estado.escolhida, estado.corrigir) : '<p class="nota">Resolve no papel e depois compara com a resolução.</p>'}
    ${resol}
    ${estado.semLinks ? '' : htmlLinks(q)}
  </article>`;
}

export const dataPT = d => (d ? d.split('-').reverse().join('/') : '');

export function gerarPalavraPasse() {
  const letras = 'abcdefghjkmnpqrstuvwxyz', nums = '23456789';
  const r = new Uint32Array(8); crypto.getRandomValues(r);
  let s = '';
  for (let i = 0; i < 5; i++) s += letras[r[i] % letras.length];
  for (let i = 5; i < 8; i++) s += nums[r[i] % nums.length];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function mensagem(el, texto, ok) { el.className = 'feedback ' + (ok ? 'ok' : 'mal'); el.textContent = texto; }


export function vistaErro(msg) {
  app.innerHTML = cabecalho() + `<main class="conteudo"><h1>Ups</h1><p>${esc(msg)}</p><p><a href="#/">Voltar ao início</a></p></main>`;
}

