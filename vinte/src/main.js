import 'katex/dist/katex.min.css';
import './style.css';
import { DISCIPLINAS, carregar } from './dados.js';
import { esc, rico, imgSegura, urlSegura } from './texto.js';
import * as progresso from './progresso.js';

const app = document.getElementById('app');
const LETRAS = ['A', 'B', 'C', 'D'];
const ROTULO_TIPO = {
  escolha_multipla: 'Escolha múltipla', calculo: 'Cálculo',
  resposta_aberta: 'Resposta aberta', associacao: 'Associação',
};
const TAMANHO_TESTE = 10;

// ---------- utilitários ----------
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
function baralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const eEM = q => q.tipo === 'escolha_multipla' && q.opcoes;
const href = (...p) => '#/' + p.map(encodeURIComponent).join('/');

function cabecalho(trilho = []) {
  const migalhas = trilho.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`)).join('<span class="sep">›</span>');
  return `<header class="topo"><a class="marca" href="#/">Vinte</a>${trilho.length ? `<nav class="trilho">${migalhas}</nav>` : ''}</header>`;
}

function barra(r) {
  const feitas = pct(r.respondidas, r.total), certas = pct(r.certas, r.total);
  return `<div class="barra" title="${r.certas} certas · ${r.respondidas} respondidas de ${r.total}">
    <span class="b-feitas" style="width:${feitas}%"></span><span class="b-certas" style="width:${certas}%"></span></div>`;
}

// ---------- vistas ----------
async function vistaInicio() {
  app.innerHTML = cabecalho() + `<main class="conteudo"><h1>Treina para os exames nacionais</h1>
    <p class="sub">Perguntas dos exames oficiais do IAVE, organizadas por matéria, com resoluções.</p>
    <div class="cartoes" id="cartoes">${Object.values(DISCIPLINAS).map(d =>
      `<a class="cartao disc-${d.cor}" href="${href('d', d.id)}"><h2>${esc(d.nome)}</h2><p class="meta">Prova ${d.prova}</p><p class="meta" data-n="${d.id}">a carregar…</p></a>`).join('')}
    </div></main>`;
  for (const id of Object.keys(DISCIPLINAS)) {
    carregar(id).then(dd => {
      const el = app.querySelector(`[data-n="${id}"]`);
      if (el) el.textContent = `${dd.total} perguntas · ${dd.subtemas.length} temas · exames ${dd.anos}`;
    }).catch(() => {});
  }
}

async function vistaDisciplina(id) {
  const dd = await carregar(id);
  const d = dd.disciplina;
  const prios = progresso.prioridades(dd).slice(0, 3);
  const geral = progresso.resumo(dd.questoes);

  app.innerHTML = cabecalho([[d.nome]]) + `<main class="conteudo">
    <h1>${esc(d.nome)}</h1>
    <p class="sub">${dd.total} perguntas dos exames ${dd.anos} · ${geral.respondidas} respondidas · ${geral.certas} certas</p>
    <section class="prioridade">
      <h2>Estuda isto primeiro</h2>
      <p class="nota">${geral.respondidas ? 'Junta o peso de cada tema no exame com os teus erros. Os temas que ainda não praticaste também entram.'
        : 'Ainda não respondeste a nenhuma pergunta. Começa pelos temas que mais saem no exame.'}</p>
      <ol>${prios.map(p => `<li><a href="${href('d', id, 's', p.s.cod)}">${esc(p.s.nome)}</a>
        <span class="meta">${p.comDados ? `${pct(p.r.respondidas - p.r.certas, p.r.respondidas)}% de erro` : `${pct(p.s.questoes.length, dd.total)}% das perguntas`}</span></li>`).join('')}</ol>
    </section>
    ${dd.grupos.map(g => `<section class="grupo"><h2>${esc(g.titulo)}</h2>
      ${g.subtemas.map(s => {
        const r = progresso.resumo(s.questoes);
        return `<div class="tema">
          <a class="tema-nome" href="${href('d', id, 's', s.cod)}">${esc(s.nome)}</a>
          <span class="meta">${plural(s.questoes.length, 'pergunta', 'perguntas')}${r.respondidas ? ` · ${r.certas}/${r.respondidas} certas` : ''}</span>
          ${barra(r)}
          <div class="acoes"><a class="btn" href="${href('d', id, 's', s.cod)}">Praticar</a>
          <a class="btn btn-sec" href="${href('teste', id, s.cod)}">Teste</a></div>
        </div>`;
      }).join('')}</section>`).join('')}
  </main>`;
}

// ---------- questão ----------
function htmlFiguras(q) {
  return (q.imagens || []).map(imgSegura).filter(Boolean)
    .map(u => `<img class="fig" src="${u}" alt="Figura da questão ${esc(q.numero)}" loading="lazy">`).join('');
}

function htmlOpcoes(q, escolhida, corrigir) {
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

function htmlLinks(q) {
  const e = urlSegura(q.pdf_enunciado), c = urlSegura(q.pdf_criterios);
  return `<p class="links">${e ? `<a href="${e}" target="_blank" rel="noopener">Enunciado (PDF)</a>` : ''}
    ${c ? `<a href="${c}" target="_blank" rel="noopener">Critérios (PDF)</a>` : ''}</p>`;
}

// estado: { escolhida, corrigir, mostrarResolucao, autoavaliacao }
function htmlQuestao(q, estado = {}) {
  const resol = eEM(q)
    ? (estado.corrigir ? `<div class="feedback ${estado.escolhida === q.resposta_certa ? 'ok' : 'mal'}">
        ${estado.escolhida === q.resposta_certa ? '✓ Certo!' : `✗ A resposta certa é a ${esc(q.resposta_certa)}.`}</div>` : '')
    : (estado.mostrarResolucao
        ? `<div class="resolucao"><h3>Resolução</h3><div>${rico(q.resposta_certa)}</div></div>
           ${estado.autoavaliacao == null
              ? `<div class="auto"><span>Como correu?</span>
                 <button class="btn" data-acao="auto" data-certa="1">Acertei</button>
                 <button class="btn btn-sec" data-acao="auto" data-certa="0">Errei</button></div>`
              : `<div class="feedback ${estado.autoavaliacao ? 'ok' : 'mal'}">${estado.autoavaliacao ? '✓ Marcaste como certa.' : '✗ Marcaste como errada.'}</div>`}`
        : `<button class="btn" data-acao="resolucao">Ver resolução</button>`);
  return `<article class="questao">
    <p class="ref">Exame ${q.ano} · ${esc(q.fase)} · item ${esc(q.numero)} · ${ROTULO_TIPO[q.tipo] || esc(q.tipo)}</p>
    ${q.contexto ? `<div class="contexto">${rico(q.contexto)}</div>` : ''}
    ${htmlFiguras(q)}
    <div class="enunciado">${rico(q.enunciado)}</div>
    ${eEM(q) ? htmlOpcoes(q, estado.escolhida, estado.corrigir) : '<p class="nota">Resolve no papel e depois compara com a resolução.</p>'}
    ${resol}
    ${htmlLinks(q)}
  </article>`;
}

// ---------- prática ----------
const pratica = { chave: '', i: 0, estados: {} };

async function vistaPratica(id, cod, iStr) {
  const dd = await carregar(id);
  const s = dd.porCod.get(cod);
  if (!s) return vistaErro('Tema não encontrado.');
  const chave = id + '/' + cod;
  if (pratica.chave !== chave) Object.assign(pratica, { chave, i: 0, estados: {} });
  if (iStr != null) pratica.i = Math.min(Math.max(0, (parseInt(iStr, 10) || 1) - 1), s.questoes.length - 1);
  desenharPratica(dd, s);
}

function desenharPratica(dd, s) {
  const q = s.questoes[pratica.i];
  const est = pratica.estados[q.id] || {};
  const r = progresso.resumo(s.questoes);
  const n = s.questoes.length;
  app.innerHTML = cabecalho([[dd.disciplina.nome, href('d', dd.id)], [s.nome]]) + `<main class="conteudo">
    <div class="titulo-tema"><h1>${esc(s.nome)}</h1>
      <a class="btn btn-sec" href="${href('teste', dd.id, s.cod)}">Fazer teste</a></div>
    <p class="sub">${n} perguntas · ${r.respondidas ? `${r.certas} de ${r.respondidas} certas` : 'ainda sem respostas'}</p>${barra(r)}
    <div class="navq">
      <button class="btn btn-sec" data-acao="ant" ${pratica.i === 0 ? 'disabled' : ''}>← Anterior</button>
      <span>${pratica.i + 1} / ${n}</span>
      <button class="btn btn-sec" data-acao="seg" ${pratica.i === n - 1 ? 'disabled' : ''}>Seguinte →</button>
    </div>
    <div id="q">${htmlQuestao(q, est)}</div>
  </main>`;
  app.querySelector('main').onclick = e => {
    const b = e.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    const a = b.dataset.acao;
    if (a === 'ant' || a === 'seg') {
      pratica.i += a === 'seg' ? 1 : -1;
      history.replaceState(null, '', href('d', dd.id, 's', s.cod, pratica.i + 1));
      return desenharPratica(dd, s);
    }
    if (a === 'escolher') {
      const certa = b.dataset.letra === q.resposta_certa;
      pratica.estados[q.id] = { escolhida: b.dataset.letra, corrigir: true };
      progresso.registar(q.id, certa);
    } else if (a === 'resolucao') {
      pratica.estados[q.id] = { ...est, mostrarResolucao: true };
    } else if (a === 'auto') {
      const certa = b.dataset.certa === '1';
      pratica.estados[q.id] = { ...est, mostrarResolucao: true, autoavaliacao: certa };
      progresso.registar(q.id, certa);
    }
    desenharPratica(dd, s);
  };
}

// ---------- teste ----------
let teste = null;

async function vistaTeste(id, cod) {
  const dd = await carregar(id);
  const s = dd.porCod.get(cod);
  if (!s) return vistaErro('Tema não encontrado.');
  if (!teste || teste.chave !== id + '/' + cod || teste.fim) novoTeste(dd, s);
  desenharTeste(dd, s);
}

function novoTeste(dd, s) {
  // dá prioridade às perguntas ainda não respondidas ou erradas
  const porFazer = baralhar(s.questoes.filter(q => !progresso.resposta(q.id)?.ultima));
  const resto = baralhar(s.questoes.filter(q => progresso.resposta(q.id)?.ultima));
  const qs = [...porFazer, ...resto].slice(0, TAMANHO_TESTE);
  teste = { chave: dd.id + '/' + s.cod, qs, i: 0, estados: {}, fim: false };
}

function respondida(q, est) {
  return eEM(q) ? est.escolhida != null : est.autoavaliacao != null;
}

function desenharTeste(dd, s) {
  const trilho = cabecalho([[dd.disciplina.nome, href('d', dd.id)], [s.nome, href('d', dd.id, 's', s.cod)], ['Teste']]);
  if (teste.fim) return desenharResultado(dd, s, trilho);
  const q = teste.qs[teste.i];
  const est = teste.estados[q.id] || {};
  const n = teste.qs.length;
  const feitas = teste.qs.filter(x => respondida(x, teste.estados[x.id] || {})).length;
  app.innerHTML = trilho + `<main class="conteudo">
    <h1>Teste — ${esc(s.nome)}</h1>
    <p class="sub">Pergunta ${teste.i + 1} de ${n} · ${feitas} respondidas</p>
    <div id="q">${htmlQuestao(q, { escolhida: est.escolhida, mostrarResolucao: est.mostrarResolucao, autoavaliacao: est.autoavaliacao })}</div>
    <div class="navq">
      <button class="btn btn-sec" data-acao="ant" ${teste.i === 0 ? 'disabled' : ''}>← Anterior</button>
      ${teste.i < n - 1 ? '<button class="btn" data-acao="seg">Seguinte →</button>'
        : `<button class="btn" data-acao="terminar">Terminar teste</button>`}
    </div>
  </main>`;
  app.querySelector('main').onclick = e => {
    const b = e.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    const a = b.dataset.acao;
    if (a === 'ant') teste.i--;
    else if (a === 'seg') teste.i++;
    else if (a === 'escolher') teste.estados[q.id] = { escolhida: b.dataset.letra };
    else if (a === 'resolucao') teste.estados[q.id] = { ...est, mostrarResolucao: true };
    else if (a === 'auto') teste.estados[q.id] = { ...est, mostrarResolucao: true, autoavaliacao: b.dataset.certa === '1' };
    else if (a === 'terminar') {
      const faltam = n - feitas;
      if (faltam && !confirmarFim(faltam)) return;
      terminarTeste();
    }
    desenharTeste(dd, s);
  };
}

function confirmarFim(faltam) {
  // sem diálogos do browser: pede um segundo clique
  if (teste.avisado) return true;
  teste.avisado = true;
  const nav = app.querySelector('.navq');
  nav.insertAdjacentHTML('beforebegin', `<p class="aviso">Faltam ${plural(faltam, 'pergunta', 'perguntas')} por responder (contam como erradas). Clica outra vez em «Terminar teste» para confirmar.</p>`);
  return false;
}

function terminarTeste() {
  let certas = 0;
  for (const q of teste.qs) {
    const est = teste.estados[q.id] || {};
    const certa = eEM(q) ? est.escolhida === q.resposta_certa : est.autoavaliacao === true;
    if (respondida(q, est)) progresso.registar(q.id, certa);
    if (certa) certas++;
  }
  teste.certas = certas;
  teste.fim = true;
}

function desenharResultado(dd, s, trilho) {
  const n = teste.qs.length;
  const nota = Math.round((teste.certas / n) * 200) / 10;
  app.innerHTML = trilho + `<main class="conteudo">
    <h1>Resultado</h1>
    <div class="nota-final ${nota >= 9.5 ? 'ok' : 'mal'}"><span>${String(nota).replace('.', ',')}</span><small>valores</small></div>
    <p class="sub">${teste.certas} de ${n} certas.</p>
    <div class="acoes"><button class="btn" data-acao="repetir">Novo teste</button>
      <a class="btn btn-sec" href="${href('d', dd.id)}">Voltar aos temas</a></div>
    <h2>Correção</h2>
    ${teste.qs.map((q, k) => {
      const est = teste.estados[q.id] || {};
      return `<details class="corr"><summary>${k + 1}. Exame ${q.ano} · ${esc(q.fase)} · item ${esc(q.numero)}
        ${(eEM(q) ? est.escolhida === q.resposta_certa : est.autoavaliacao) ? '<b class="ok">✓</b>' : '<b class="mal">✗</b>'}</summary>
        ${htmlQuestao(q, eEM(q) ? { escolhida: est.escolhida, corrigir: true } : { mostrarResolucao: true, autoavaliacao: est.autoavaliacao ?? false })}</details>`;
    }).join('')}
  </main>`;
  app.querySelector('main').onclick = e => {
    const b = e.target.closest('[data-acao="repetir"]');
    if (!b) return;
    novoTeste(dd, s);
    desenharTeste(dd, s);
  };
}

function vistaErro(msg) {
  app.innerHTML = cabecalho() + `<main class="conteudo"><h1>Ups</h1><p>${esc(msg)}</p><p><a href="#/">Voltar ao início</a></p></main>`;
}

// ---------- router ----------
async function router() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (p[0] === 'd' && p[1] && p[2] === 's' && p[3]) await vistaPratica(p[1], p[3], p[4]);
    else if (p[0] === 'd' && p[1]) await vistaDisciplina(p[1]);
    else if (p[0] === 'teste' && p[1] && p[2]) await vistaTeste(p[1], p[2]);
    else await vistaInicio();
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    vistaErro(e.message || 'Algo correu mal.');
  }
}
window.addEventListener('hashchange', router);
router();
