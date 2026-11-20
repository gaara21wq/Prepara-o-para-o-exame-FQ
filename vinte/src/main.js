import 'katex/dist/katex.min.css';
import './style.css';
import { DISCIPLINAS, carregar, limparCache } from './dados.js';
import { esc, rico, imgSegura, urlSegura } from './texto.js';
import * as progresso from './progresso.js';
import { supabase } from './supabase.js';

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
  const p = progresso.perfilAtual();
  const extra = p?.papel === 'explicador' ? `<a class="topo-link" href="#/centro">O meu centro</a>`
    : p?.papel === 'admin' ? `<a class="topo-link" href="#/admin">Administração</a>` : '';
  const conta = p ? `${extra}<a class="conta-link" href="#/conta" title="A minha conta">${esc(p.nome_utilizador || p.nome || 'conta')}</a>` : '';
  return `<header class="topo"><a class="marca" href="#/">Vinte</a>${trilho.length ? `<nav class="trilho">${migalhas}</nav>` : ''}<span class="topo-dir">${conta}</span></header>`;
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

// ---------- contas ----------
const dataPT = d => (d ? d.split('-').reverse().join('/') : '');

function gerarPalavraPasse() {
  const letras = 'abcdefghjkmnpqrstuvwxyz', nums = '23456789';
  const r = new Uint32Array(8); crypto.getRandomValues(r);
  let s = '';
  for (let i = 0; i < 5; i++) s += letras[r[i] % letras.length];
  for (let i = 5; i < 8; i++) s += nums[r[i] % nums.length];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mensagem(el, texto, ok) { el.className = 'feedback ' + (ok ? 'ok' : 'mal'); el.textContent = texto; }

function vistaEntrar() {
  app.innerHTML = cabecalho() + `<main class="conteudo estreito">
    <h1>Entrar</h1>
    <p class="sub">As contas são criadas pelo teu centro de explicações. Usa o nome de utilizador e a password que o teu explicador te deu.</p>
    <form id="f" class="form">
      <label for="u">Nome de utilizador</label>
      <input id="u" name="u" required autocomplete="username" autocapitalize="none" spellcheck="false">
      <label for="p">Password</label>
      <input id="p" name="p" type="password" required autocomplete="current-password">
      <button class="btn" type="submit">Entrar</button>
    </form>
    <p id="msg" role="status"></p>
    <p class="nota">Esqueceste-te da password? Pede ao teu explicador para te dar uma nova.</p>
  </main>`;
  const f = document.getElementById('f');
  f.onsubmit = async e => {
    e.preventDefault();
    const msg = document.getElementById('msg'), btn = f.querySelector('button');
    btn.disabled = true; msg.className = 'nota'; msg.textContent = 'A entrar…';
    try {
      await progresso.entrar(f.u.value, f.p.value);
    } catch (err) {
      mensagem(msg, /invalid login|credentials/i.test(err.message) ? 'Utilizador ou password errados.' : 'Não foi possível entrar: ' + err.message, false);
      btn.disabled = false;
    }
  };
}

function vistaMudarPass() {
  const p = progresso.perfilAtual();
  app.innerHTML = cabecalho() + `<main class="conteudo estreito">
    <h1>Escolhe a tua password</h1>
    <p class="sub">Olá${p?.nome ? ', ' + esc(p.nome.split(' ')[0]) : ''}! A password que recebeste é provisória. Escolhe uma nova, só tua.</p>
    <form id="f" class="form">
      <label for="p1">Nova password (mínimo 8 caracteres)</label>
      <input id="p1" type="password" minlength="8" maxlength="72" required autocomplete="new-password">
      <label for="p2">Repete a nova password</label>
      <input id="p2" type="password" minlength="8" maxlength="72" required autocomplete="new-password">
      <button class="btn" type="submit">Guardar</button>
    </form>
    <p id="msg" role="status"></p>
  </main>`;
  const f = document.getElementById('f');
  f.onsubmit = async e => {
    e.preventDefault();
    const msg = document.getElementById('msg'), btn = f.querySelector('button');
    if (f.p1.value !== f.p2.value) return mensagem(msg, 'As duas passwords não são iguais.', false);
    btn.disabled = true;
    try { await progresso.mudarPalavraPasse(f.p1.value); }
    catch (err) {
      mensagem(msg, /different from the old|same/i.test(err.message) ? 'Tem de ser diferente da password provisória.' : 'Não foi possível mudar: ' + err.message, false);
      btn.disabled = false;
    }
  };
}

function vistaSemAcesso() {
  const p = progresso.perfilAtual();
  const c = p?.centros;
  const motivo = !p ? 'Não encontrámos o perfil desta conta.'
    : !p.ativa ? 'A tua conta está desativada.'
    : !c ? 'A tua conta não está associada a nenhum centro.'
    : !c.ativo ? `O acesso do centro «${esc(c.nome)}» está suspenso.`
    : `A licença do centro «${esc(c.nome)}» terminou a ${dataPT(c.licenca_ate)}.`;
  app.innerHTML = cabecalho() + `<main class="conteudo estreito">
    <h1>Sem acesso</h1><p>${motivo}</p><p>Fala com o teu centro de explicações.</p>
    <div class="acoes"><button class="btn btn-sec" id="sair">Terminar sessão</button></div></main>`;
  document.getElementById('sair').onclick = () => progresso.sair();
}

function vistaConta() {
  const p = progresso.perfilAtual();
  app.innerHTML = cabecalho([['A minha conta']]) + `<main class="conteudo estreito">
    <h1>A minha conta</h1>
    <p><b>${esc(p.nome || '')}</b> · utilizador <b>${esc(p.nome_utilizador || '')}</b>${p.centros ? ` · ${esc(p.centros.nome)}` : ''}</p>
    ${p.centros && p.papel !== 'admin' ? `<p class="nota">Licença do centro válida até ${dataPT(p.centros.licenca_ate)}.</p>` : ''}
    <div class="acoes"><button class="btn btn-sec" data-acao="sair">Terminar sessão</button></div>
    <h2>Mudar a password</h2>
    <form id="f" class="form">
      <input id="p1" type="password" minlength="8" maxlength="72" required autocomplete="new-password" placeholder="Nova password (mínimo 8)">
      <button class="btn btn-sec" type="submit">Mudar password</button>
    </form>
    <h2>Apagar progresso</h2>
    <p class="nota">Apaga todas as tuas respostas. Não dá para desfazer.</p>
    <div class="acoes"><button class="btn btn-perigo" data-acao="apagar">Apagar o meu progresso</button></div>
    <p id="msg" role="status"></p>
  </main>`;
  const msg = document.getElementById('msg');
  document.getElementById('f').onsubmit = async e => {
    e.preventDefault();
    try { await progresso.mudarPalavraPasse(e.target.p1.value); mensagem(msg, 'Password mudada.', true); e.target.reset(); }
    catch (err) { mensagem(msg, 'Não foi possível mudar: ' + err.message, false); }
  };
  let confirmar = false;
  app.querySelector('main').onclick = async e => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'sair') { location.hash = '#/'; await progresso.sair(); }
    if (b.dataset.acao === 'apagar') {
      if (!confirmar) { confirmar = true; b.textContent = 'Clica outra vez para confirmar'; return; }
      b.disabled = true;
      try { await progresso.apagarTudo(); mensagem(msg, 'Progresso apagado.', true); }
      catch (err) { mensagem(msg, 'Não foi possível apagar: ' + err.message, false); b.disabled = false; }
    }
  };
}

// ---------- painel do explicador ----------
async function respostasDoCentro() {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from('respostas').select('user_id, ultima, atualizado_em').range(de, de + 999);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

async function vistaCentro() {
  const eu = progresso.perfilAtual();
  if (eu?.papel !== 'explicador') return vistaErro('Esta página é só para explicadores.');
  const c = eu.centros;
  app.innerHTML = cabecalho([['O meu centro']]) + `<main class="conteudo"><h1>${esc(c.nome)}</h1><p class="sub">A carregar…</p></main>`;
  const [{ data: alunos, error }, resp] = await Promise.all([
    supabase.from('perfis').select('id, nome, nome_utilizador, ativa, deve_mudar_palavra_passe, criado_em').eq('papel', 'aluno').order('nome'),
    respostasDoCentro().catch(() => []),
  ]);
  if (error) return vistaErro(error.message);
  const est = {};
  for (const r of resp) {
    const e = est[r.user_id] ||= { n: 0, certas: 0, ultima: '' };
    e.n++; if (r.ultima) e.certas++;
    if (r.atualizado_em > e.ultima) e.ultima = r.atualizado_em;
  }
  const ativos = alunos.filter(a => a.ativa).length;
  app.innerHTML = cabecalho([['O meu centro']]) + `<main class="conteudo">
    <h1>${esc(c.nome)}</h1>
    <p class="sub">${ativos} de ${c.max_alunos} alunos ativos · licença até ${dataPT(c.licenca_ate)}</p>
    <section class="painel">
      <h2>Criar conta de aluno</h2>
      <form id="novo" class="form form-linha">
        <input name="nome" required minlength="2" maxlength="80" placeholder="Nome do aluno">
        <input name="util" required pattern="[a-z0-9][a-z0-9._\\-]{2,39}" placeholder="Nome de utilizador (ex.: ana.silva)" autocapitalize="none" spellcheck="false">
        <input name="pass" required minlength="8" maxlength="72" placeholder="Password provisória">
        <button class="btn" type="submit">Criar</button>
      </form>
      <p id="msg" role="status"></p>
    </section>
    <h2>Alunos</h2>
    ${alunos.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Aluno</th><th>Utilizador</th><th>Respostas</th><th>Certas</th><th>Última atividade</th><th></th></tr></thead><tbody>
      ${alunos.map(a => {
        const e = est[a.id] || { n: 0, certas: 0, ultima: '' };
        return `<tr class="${a.ativa ? '' : 'inativo'}"><td>${esc(a.nome || '')}${a.deve_mudar_palavra_passe ? ' <span class="etiqueta">ainda não entrou</span>' : ''}${a.ativa ? '' : ' <span class="etiqueta">desativado</span>'}</td>
          <td>${esc(a.nome_utilizador)}</td><td>${e.n}</td><td>${e.n ? pct(e.certas, e.n) + '%' : '—'}</td>
          <td>${e.ultima ? dataPT(e.ultima.slice(0, 10)) : '—'}</td>
          <td class="acoes-linha"><button class="btn-mini" data-acao="pass" data-id="${a.id}" data-u="${esc(a.nome_utilizador)}">Nova password</button>
          <button class="btn-mini" data-acao="estado" data-id="${a.id}" data-ativa="${a.ativa ? 0 : 1}">${a.ativa ? 'Desativar' : 'Ativar'}</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="nota">Ainda não há alunos. Cria a primeira conta acima.</p>'}
  </main>`;
  const f = document.getElementById('novo'), msg = document.getElementById('msg');
  f.pass.value = gerarPalavraPasse();
  f.nome.oninput = () => {
    if (f.util.dataset.mexido) return;
    const partes = f.nome.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/);
    f.util.value = partes.length > 1 ? partes[0] + '.' + partes[partes.length - 1] : (partes[0] || '');
  };
  f.util.oninput = () => { f.util.dataset.mexido = '1'; };
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector('button'); btn.disabled = true;
    const dados = { nome: f.nome.value.trim(), util: f.util.value.trim().toLowerCase(), pass: f.pass.value };
    try {
      await progresso.gerirContas({ acao: 'criar_aluno', nome: dados.nome, nome_utilizador: dados.util, palavra_passe: dados.pass });
      await vistaCentro();
      mensagem(document.getElementById('msg'), `Conta criada. Dá ao aluno → utilizador: ${dados.util} · password provisória: ${dados.pass} (vai ter de a mudar ao entrar).`, true);
    } catch (err) { mensagem(msg, err.message, false); btn.disabled = false; }
  };
  app.querySelector('.tabela')?.addEventListener('click', async e => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.acao === 'estado') {
        await progresso.gerirContas({ acao: 'definir_estado', user_id: b.dataset.id, ativa: b.dataset.ativa === '1' });
        await vistaCentro();
      } else {
        const nova = gerarPalavraPasse();
        await progresso.gerirContas({ acao: 'redefinir_palavra_passe', user_id: b.dataset.id, palavra_passe: nova });
        mensagem(msg, `Nova password provisória de ${b.dataset.u}: ${nova}`, true);
        b.disabled = false;
        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) { mensagem(msg, err.message, false); b.disabled = false; msg.scrollIntoView({ block: 'center' }); }
  });
}

// ---------- administração (Gaara) ----------
async function vistaAdmin() {
  const eu = progresso.perfilAtual();
  if (eu?.papel !== 'admin') return vistaErro('Página reservada ao administrador.');
  const [{ data: centros, error }, { data: perfis }] = await Promise.all([
    supabase.from('centros').select('*').order('nome'),
    supabase.from('perfis').select('id, nome, nome_utilizador, papel, centro_id, ativa'),
  ]);
  if (error) return vistaErro(error.message);
  const por = id => (perfis || []).filter(p => p.centro_id === id);
  const umAno = new Date(); umAno.setMonth(6, 31);
  if (umAno < new Date()) umAno.setFullYear(umAno.getFullYear() + 1);
  app.innerHTML = cabecalho([['Administração']]) + `<main class="conteudo">
    <h1>Administração</h1>
    <section class="painel"><h2>Novo centro</h2>
      <form id="novo-centro" class="form form-linha">
        <input name="nome" required minlength="2" placeholder="Nome do centro">
        <input name="max" type="number" min="1" max="2000" required placeholder="Máx. alunos" value="15">
        <label class="mini">Licença até <input name="ate" type="date" required value="${umAno.toISOString().slice(0, 10)}"></label>
        <button class="btn" type="submit">Criar centro</button>
      </form></section>
    <p id="msg" role="status"></p>
    ${centros.map(c => {
      const ps = por(c.id), alunosAtivos = ps.filter(p => p.papel === 'aluno' && p.ativa).length;
      const expl = ps.filter(p => p.papel === 'explicador');
      const valida = c.ativo && c.licenca_ate >= new Date().toISOString().slice(0, 10);
      return `<section class="painel"><h2>${esc(c.nome)} <span class="etiqueta ${valida ? 'ok' : 'mal'}">${valida ? 'ativa' : 'sem acesso'}</span></h2>
        <p class="sub">${alunosAtivos}/${c.max_alunos} alunos ativos · licença até ${dataPT(c.licenca_ate)} · explicadores: ${expl.map(x => esc(x.nome_utilizador)).join(', ') || 'nenhum'}</p>
        <form class="form form-linha" data-centro="${c.id}" data-tipo="licenca">
          <input name="max" type="number" min="1" max="2000" value="${c.max_alunos}" title="Máx. alunos">
          <input name="ate" type="date" value="${c.licenca_ate}" title="Licença até">
          <button class="btn btn-sec" type="submit">Guardar licença</button>
          <button class="btn-mini" type="button" data-acao="ativo" data-ativo="${c.ativo ? 0 : 1}">${c.ativo ? 'Suspender' : 'Reativar'}</button>
        </form>
        <form class="form form-linha" data-centro="${c.id}" data-tipo="explicador">
          <input name="nome" required minlength="2" placeholder="Nome do explicador">
          <input name="util" required pattern="[a-z0-9][a-z0-9._\\-]{2,39}" placeholder="Utilizador" autocapitalize="none">
          <input name="pass" required minlength="8" value="${gerarPalavraPasse()}">
          <button class="btn btn-sec" type="submit">Criar explicador</button>
        </form></section>`;
    }).join('')}
  </main>`;
  const msg = document.getElementById('msg');
  const correr = async (corpo, ok) => {
    try { await progresso.gerirContas(corpo); await vistaAdmin(); mensagem(document.getElementById('msg'), ok, true); }
    catch (err) { mensagem(msg, err.message, false); msg.scrollIntoView({ block: 'center' }); }
  };
  app.querySelector('main').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, t = f.dataset.tipo;
    if (f.id === 'novo-centro') return correr({ acao: 'criar_centro', nome: f.nome.value, max_alunos: +f.max.value, licenca_ate: f.ate.value }, 'Centro criado.');
    if (t === 'licenca') return correr({ acao: 'atualizar_centro', centro_id: f.dataset.centro, max_alunos: +f.max.value, licenca_ate: f.ate.value }, 'Licença atualizada.');
    if (t === 'explicador') {
      const u = f.util.value.trim().toLowerCase(), pw = f.pass.value;
      return correr({ acao: 'criar_explicador', centro_id: f.dataset.centro, nome: f.nome.value, nome_utilizador: u, palavra_passe: pw },
        `Explicador criado → utilizador: ${u} · password provisória: ${pw}`);
    }
  });
  app.querySelector('main').addEventListener('click', e => {
    const b = e.target.closest('[data-acao="ativo"]');
    if (b) correr({ acao: 'atualizar_centro', centro_id: b.closest('form').dataset.centro, ativo: b.dataset.ativo === '1' }, 'Estado do centro atualizado.');
  });
}


function vistaErro(msg) {
  app.innerHTML = cabecalho() + `<main class="conteudo"><h1>Ups</h1><p>${esc(msg)}</p><p><a href="#/">Voltar ao início</a></p></main>`;
}

// ---------- router ----------
async function router() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  try {
    const eu = progresso.perfilAtual();
    if (!progresso.contaAtual()) vistaEntrar();
    else if (!eu || !progresso.licencaAtiva()) vistaSemAcesso();
    else if (eu.deve_mudar_palavra_passe) vistaMudarPass();
    else if (p[0] === 'd' && p[1] && p[2] === 's' && p[3]) await vistaPratica(p[1], p[3], p[4]);
    else if (p[0] === 'd' && p[1]) await vistaDisciplina(p[1]);
    else if (p[0] === 'teste' && p[1] && p[2]) await vistaTeste(p[1], p[2]);
    else if (p[0] === 'conta') vistaConta();
    else if (p[0] === 'centro') await vistaCentro();
    else if (p[0] === 'admin') await vistaAdmin();
    else await vistaInicio();
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    vistaErro(e.message || 'Algo correu mal.');
  }
}

window.addEventListener('hashchange', router);
// ao entrar/sair ou mudar a password: limpa a cache e redesenha
let ultimaConta = null;
progresso.aoMudar(() => {
  const id = progresso.contaAtual()?.id || null;
  if (id !== ultimaConta) { ultimaConta = id; limparCache(); teste = null; pratica.chave = ''; }
  router();
});
progresso.iniciar().finally(router);
