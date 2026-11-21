import 'katex/dist/katex.min.css';
import './style.css';
import { DISCIPLINAS, carregar, limparCache } from './dados.js';
import { esc, rico, imgSegura, urlSegura } from './texto.js';
import * as progresso from './progresso.js';
import { supabase } from './supabase.js';
import { vistaCentro, vistaLote, vistaTurma, vistaNovoTrabalho, vistaTrabalho, vistaRelatorioAluno } from './centro.js';

import { app, LETRAS, ROTULO_TIPO, TAMANHO_TESTE, plural, pct, baralhar, eEM, href, cabecalho, barra, htmlFiguras, htmlOpcoes, htmlLinks, htmlQuestao, dataPT, gerarPalavraPasse, mensagem, vistaErro } from './comum.js';

// ---------- vistas ----------
async function trabalhosDoAluno() {
  const p = progresso.perfilAtual();
  if (p?.papel !== 'aluno') return [];
  const { data, error } = await supabase.from('trabalhos')
    .select('id, titulo, disciplina, questoes, prazo, criado_em, entregas(certas, total, entregue_em)')
    .order('criado_em', { ascending: false }).limit(30);
  return error ? [] : data;
}

async function vistaInicio() {
  const p = progresso.perfilAtual();
  app.innerHTML = cabecalho() + `<main class="conteudo"><h1>${p?.nome ? 'Olá, ' + esc(p.nome.split(' ')[0]) + '!' : 'Treina para os exames nacionais'}</h1>
    <p class="sub">Perguntas dos exames oficiais do IAVE, organizadas por matéria, com resoluções.</p>
    <div id="tpc"></div>
    <div class="cartoes" id="cartoes">${Object.values(DISCIPLINAS).map(d =>
      `<a class="cartao disc-${d.cor}" href="${href('d', d.id)}"><h2>${esc(d.nome)}</h2><p class="meta">Prova ${d.prova}</p><p class="meta" data-n="${d.id}">a carregar…</p></a>`).join('')}
    </div>
    <div class="atalhos">
      <a class="atalho" href="#/estatisticas"><b>As minhas estatísticas</b><span>Evolução, temas fortes e fracos</span></a>
      ${Object.values(DISCIPLINAS).map(d => `<a class="atalho" href="${href('exame', d.id)}"><b>Simular exame — ${d.id === 'fq' ? 'FQ' : 'Matemática'}</b><span>Prova completa com tempo (${d.minutos} min)</span></a>`).join('')}
    </div></main>`;
  for (const id of Object.keys(DISCIPLINAS)) {
    carregar(id).then(dd => {
      const el = app.querySelector(`[data-n="${id}"]`);
      if (el) el.textContent = `${dd.total} perguntas · ${dd.subtemas.length} temas · exames ${dd.anos}`;
    }).catch(() => {});
  }
  const tpc = await trabalhosDoAluno();
  const el = document.getElementById('tpc');
  if (el && tpc.length) {
    const hojeS = new Date().toISOString().slice(0, 10);
    const porFazer = tpc.filter(w => !w.entregas.length);
    el.innerHTML = `<section class="prioridade"><h2>Trabalhos de casa${porFazer.length ? ` <span class="etiqueta mal">${porFazer.length} por fazer</span>` : ''}</h2><ul class="lista-tpc">
      ${tpc.slice(0, 6).map(w => { const e = w.entregas[0];
        return `<li><a href="${href('tpc', w.id)}">${esc(w.titulo)}</a> <span class="meta">${DISCIPLINAS[w.disciplina].nome} · ${plural(w.questoes.length, 'pergunta', 'perguntas')}${w.prazo ? ' · prazo ' + dataPT(w.prazo) : ''}</span>
          ${e ? `<span class="etiqueta ok">entregue · ${String(Math.round(200 * e.certas / e.total) / 10).replace('.', ',')} val.</span>` : (w.prazo && w.prazo < hojeS ? '<span class="etiqueta mal">prazo terminado</span>' : '<span class="etiqueta">por fazer</span>')}</li>`; }).join('')}
    </ul></section>`;
  }
}

// ---------- trabalho de casa (aluno) ----------
async function vistaTPC(id) {
  const { data: w, error } = await supabase.from('trabalhos').select('id, titulo, disciplina, questoes, prazo, entregas(certas, total, entregue_em)').eq('id', id).single();
  if (error || !w) return vistaErro('Trabalho não encontrado.');
  const dd = await carregar(w.disciplina);
  const qs = w.questoes.map(q => dd.porId.get(q)).filter(Boolean);
  if (!qs.length) return vistaErro('Este trabalho não tem perguntas disponíveis.');
  const chave = 'tpc/' + w.id;
  if (!teste || teste.chave !== chave) {
    const cfg = {
      chave, qs, titulo: w.titulo, textoRepetir: 'Fazer outra vez',
      trilho: [['Trabalho de casa'], [w.titulo]],
      voltar: ['Voltar ao início', '#/'],
      aoTerminar: async (certas, detalhe) => {
        const { error: e } = await supabase.from('entregas')
          .upsert({ trabalho_id: w.id, aluno_id: progresso.contaAtual().id, certas, total: qs.length, detalhe, entregue_em: new Date().toISOString() }, { onConflict: 'trabalho_id,aluno_id' });
        if (e) throw e;
      },
    };
    cfg.repetir = () => iniciarTeste(cfg);
    iniciarTeste(cfg);
  }
  const e = w.entregas?.[0];
  if (e && !teste.avisoEntrega && !teste.fim) {
    teste.avisoEntrega = true;
    app.innerHTML = cabecalho([['Trabalho de casa'], [w.titulo]]) + `<main class="conteudo estreito"><h1>${esc(w.titulo)}</h1>
      <p>Já entregaste este trabalho a ${dataPT(e.entregue_em.slice(0, 10))}, com ${e.certas} de ${e.total} certas.</p>
      <p class="nota">Podes fazê-lo outra vez: a nova entrega substitui a anterior.</p>
      <div class="acoes"><button class="btn" id="refazer">Fazer outra vez</button><a class="btn btn-sec" href="#/">Voltar</a></div></main>`;
    document.getElementById('refazer').onclick = () => desenharTeste();
    return;
  }
  desenharTeste();
}

// ---------- rever erros ----------
async function vistaErros(id) {
  const dd = await carregar(id);
  const erradas = dd.questoes.filter(q => progresso.resposta(q.id)?.ultima === false);
  if (!erradas.length) {
    app.innerHTML = cabecalho([[dd.disciplina.nome, href('d', id)], ['Rever erros']]) + `<main class="conteudo estreito"><h1>Rever erros</h1>
      <p>Não tens perguntas erradas em ${esc(dd.disciplina.nome)}. 👏</p><p><a href="${href('d', id)}">Voltar aos temas</a></p></main>`;
    return;
  }
  const chave = 'erros/' + id;
  if (!teste || teste.chave !== chave || teste.fim) {
    const montar = () => iniciarTeste({
      chave, qs: baralhar(dd.questoes.filter(q => progresso.resposta(q.id)?.ultima === false)).slice(0, 20),
      titulo: 'Rever erros — ' + dd.disciplina.nome,
      trilho: [[dd.disciplina.nome, href('d', id)], ['Rever erros']],
      voltar: ['Voltar aos temas', href('d', id)],
      repetir: () => montar(),
    });
    montar();
  }
  desenharTeste();
}

// ---------- simular exame ----------
async function vistaExames(id) {
  const dd = await carregar(id);
  app.innerHTML = cabecalho([[dd.disciplina.nome, href('d', id)], ['Simular exame']]) + `<main class="conteudo">
    <h1>Simular exame — ${esc(dd.disciplina.nome)}</h1>
    <p class="sub">Faz uma prova completa, com o tempo do exame (${dd.disciplina.minutos} minutos). No fim tens a nota e a correção.</p>
    <p class="nota"><a href="${dd.disciplina.formulario}" target="_blank" rel="noopener">Abrir o formulário oficial (PDF)</a> — tal como no exame.</p>
    <div class="cartoes-mini">${dd.provas.map(pr => {
      const r = progresso.resumo(pr.questoes);
      return `<a class="cartao-mini" href="${href('exame', id, pr.ano, pr.fase)}"><b>${pr.ano} · ${esc(pr.fase)}</b><span class="meta">${plural(pr.questoes.length, 'item', 'itens')}${r.respondidas ? ` · ${r.certas}/${r.respondidas} certas` : ''}</span></a>`;
    }).join('')}</div></main>`;
}

async function vistaExame(id, ano, fase) {
  const dd = await carregar(id);
  const pr = dd.provas.find(x => String(x.ano) === String(ano) && x.fase === fase);
  if (!pr) return vistaErro('Prova não encontrada.');
  const chave = `exame/${id}/${ano}/${fase}`;
  if (teste && teste.chave === chave) return desenharTeste();
  const trilho = [[dd.disciplina.nome, href('d', id)], ['Simular exame', href('exame', id)], [`${ano} · ${fase}`]];
  app.innerHTML = cabecalho(trilho) + `<main class="conteudo estreito">
    <h1>Exame ${ano} · ${esc(fase)}</h1>
    <p>${plural(pr.questoes.length, 'item', 'itens')} · ${dd.disciplina.minutos} minutos. O tempo começa quando carregares em «Começar». Quando acabar, a prova termina sozinha.</p>
    <p class="nota">Nos itens de resposta aberta, resolve no papel e depois compara com a resolução (autoavaliação). <a href="${dd.disciplina.formulario}" target="_blank" rel="noopener">Formulário (PDF)</a></p>
    <div class="acoes"><button class="btn" id="comecar">Começar</button><a class="btn btn-sec" href="${href('exame', id)}">Voltar</a></div></main>`;
  document.getElementById('comecar').onclick = () => {
    const cfg = { chave, qs: pr.questoes, titulo: `Exame ${ano} · ${fase}`, minutos: dd.disciplina.minutos, trilho,
      voltar: ['Outras provas', href('exame', id)], textoRepetir: 'Fazer outra vez' };
    cfg.repetir = () => iniciarTeste(cfg);
    iniciarTeste(cfg);
    desenharTeste();
  };
}

// ---------- estatísticas ----------
async function vistaEstatisticas() {
  const dds = await Promise.all(Object.keys(DISCIPLINAS).map(carregar));
  const todas = progresso.todasRespostas();
  const semanas = 8, agora = Date.now(), SEM = 7 * 86400000;
  const blocos = dds.map(dd => {
    const r = progresso.resumo(dd.questoes);
    const porSemana = Array(semanas).fill(0);
    for (const q of dd.questoes) {
      const x = todas[q.id];
      if (!x?.quando) continue;
      const k = Math.floor((agora - x.quando) / SEM);
      if (k < semanas) porSemana[semanas - 1 - k]++;
    }
    const temas = dd.subtemas.map(s => ({ s, r: progresso.resumo(s.questoes) })).filter(t => t.r.respondidas >= 3);
    const ord = temas.slice().sort((a, b) => a.r.certas / a.r.respondidas - b.r.certas / b.r.respondidas);
    const taxa = t => t.r.certas / t.r.respondidas;
    const fracos = ord.filter(t => taxa(t) < .75).slice(0, 3);
    const fortes = ord.filter(t => taxa(t) >= .6 && !fracos.includes(t)).reverse().slice(0, 3);
    const lista = (ts, ligar, vazio) => ts.length ? `<ol>${ts.map(t => `<li>${ligar ? `<a href="${href('d', dd.id, 's', t.s.cod)}">${esc(t.s.nome)}</a>` : esc(t.s.nome)} <span class="meta">${pct(t.r.certas, t.r.respondidas)}%</span></li>`).join('')}</ol>` : `<p class="meta">${vazio}</p>`;
    const max = Math.max(1, ...porSemana);
    const erradas = dd.questoes.filter(q => todas[q.id]?.ultima === false).length;
    return `<section class="painel"><h2>${esc(dd.disciplina.nome)}</h2>
      <div class="numeros"><div><b>${r.respondidas}</b><span>de ${dd.total} perguntas</span></div>
        <div><b>${r.respondidas ? pct(r.certas, r.respondidas) + '%' : '—'}</b><span>certas</span></div>
        <div><b>${r.respondidas ? String(Math.round(200 * r.certas / r.respondidas) / 10).replace('.', ',') : '—'}</b><span>nota estimada</span></div></div>
      <p class="meta">Perguntas respondidas por semana (últimas ${semanas})</p>
      <div class="grafico">${porSemana.map((n, i) => `<div class="col" title="${n}"><span style="height:${Math.round(100 * n / max)}%"></span><small>${i === semanas - 1 ? 'esta' : '-' + (semanas - 1 - i)}</small></div>`).join('')}</div>
      ${ord.length ? `<div class="duas-col"><div><h3>A reforçar</h3>${lista(fracos, true, 'Nenhum tema abaixo de 75%. Muito bem!')}</div>
        <div><h3>Pontos fortes</h3>${lista(fortes, false, 'Ainda nenhum tema acima de 60%.')}</div></div>`
        : '<p class="nota">Responde a pelo menos 3 perguntas de um tema para veres os teus pontos fortes e fracos.</p>'}
      ${erradas ? `<p><a class="btn btn-sec" href="${href('erros', dd.id)}">Rever as ${erradas} perguntas que erraste</a></p>` : ''}
    </section>`;
  });
  app.innerHTML = cabecalho([['As minhas estatísticas']]) + `<main class="conteudo"><h1>As minhas estatísticas</h1>
    <p class="nota">A nota estimada é a percentagem de respostas certas convertida para 0–20. Conta a última resposta a cada pergunta.</p>${blocos.join('')}</main>`;
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

// ---------- teste (motor comum: tema, trabalho de casa, rever erros, simulação de exame) ----------
let teste = null;
let relogio = null;

// cfg: { chave, qs, titulo, trilho, voltar: [texto, href], repetir?: () => void, aoTerminar?: async (certas, detalhe) => void, minutos?: n }
function iniciarTeste(cfg) {
  teste = { ...cfg, i: 0, estados: {}, fim: false, avisado: false,
            fimEm: cfg.minutos ? Date.now() + cfg.minutos * 60000 : null };
}

async function vistaTeste(id, cod) {
  const dd = await carregar(id);
  const s = dd.porCod.get(cod);
  if (!s) return vistaErro('Tema não encontrado.');
  const chave = 'tema/' + id + '/' + cod;
  if (!teste || teste.chave !== chave || teste.fim) novoTesteTema(dd, s);
  desenharTeste();
}

function novoTesteTema(dd, s) {
  // dá prioridade às perguntas ainda não respondidas ou erradas
  const porFazer = baralhar(s.questoes.filter(q => !progresso.resposta(q.id)?.ultima));
  const resto = baralhar(s.questoes.filter(q => progresso.resposta(q.id)?.ultima));
  iniciarTeste({
    chave: 'tema/' + dd.id + '/' + s.cod, qs: [...porFazer, ...resto].slice(0, TAMANHO_TESTE),
    titulo: 'Teste — ' + s.nome,
    trilho: [[dd.disciplina.nome, href('d', dd.id)], [s.nome, href('d', dd.id, 's', s.cod)], ['Teste']],
    voltar: ['Voltar aos temas', href('d', dd.id)],
    repetir: () => novoTesteTema(dd, s),
  });
}

function respondida(q, est) {
  return eEM(q) ? est.escolhida != null : est.autoavaliacao != null;
}
const certaNoTeste = (q, est) => (eEM(q) ? est.escolhida === q.resposta_certa : est.autoavaliacao === true);

function tempoRestante() {
  const ms = Math.max(0, teste.fimEm - Date.now());
  const m = Math.floor(ms / 60000), sgs = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(sgs).padStart(2, '0')}`;
}

function desenharTeste() {
  clearInterval(relogio);
  const topo = cabecalho(teste.trilho);
  if (teste.fim) return desenharResultado(topo);
  const q = teste.qs[teste.i];
  const est = teste.estados[q.id] || {};
  const n = teste.qs.length;
  const feitas = teste.qs.filter(x => respondida(x, teste.estados[x.id] || {})).length;
  app.innerHTML = topo + `<main class="conteudo">
    <div class="titulo-tema"><h1>${esc(teste.titulo)}</h1>${teste.fimEm ? `<span class="relogio${teste.fimEm - Date.now() < 600000 ? ' pouco' : ''}" id="relogio">${tempoRestante()}</span>` : ''}</div>
    <p class="sub">Pergunta ${teste.i + 1} de ${n} · ${feitas} respondidas</p>
    ${n > 12 ? `<div class="mapa-q">${teste.qs.map((x, k) => `<button class="mq ${k === teste.i ? 'atual' : ''} ${respondida(x, teste.estados[x.id] || {}) ? 'feita' : ''}" data-acao="ir" data-i="${k}">${esc(x.numero)}</button>`).join('')}</div>` : ''}
    <div id="q">${htmlQuestao(q, { escolhida: est.escolhida, mostrarResolucao: est.mostrarResolucao, autoavaliacao: est.autoavaliacao })}</div>
    <div class="navq">
      <button class="btn btn-sec" data-acao="ant" ${teste.i === 0 ? 'disabled' : ''}>← Anterior</button>
      ${teste.i < n - 1 ? '<button class="btn" data-acao="seg">Seguinte →</button>'
        : `<button class="btn" data-acao="terminar">Terminar</button>`}
    </div>
  </main>`;
  if (teste.fimEm) {
    relogio = setInterval(async () => {
      const el = document.getElementById('relogio');
      if (!el || !teste || teste.fim) return clearInterval(relogio);
      el.textContent = tempoRestante();
      el.classList.toggle('pouco', teste.fimEm - Date.now() < 600000);
      if (Date.now() >= teste.fimEm) { clearInterval(relogio); await terminarTeste(); desenharTeste(); }
    }, 1000);
  }
  app.querySelector('main').onclick = async e => {
    const b = e.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    const a = b.dataset.acao;
    if (a === 'ant') teste.i--;
    else if (a === 'seg') teste.i++;
    else if (a === 'ir') teste.i = +b.dataset.i;
    else if (a === 'escolher') teste.estados[q.id] = { escolhida: b.dataset.letra };
    else if (a === 'resolucao') teste.estados[q.id] = { ...est, mostrarResolucao: true };
    else if (a === 'auto') teste.estados[q.id] = { ...est, mostrarResolucao: true, autoavaliacao: b.dataset.certa === '1' };
    else if (a === 'terminar') {
      const faltam = n - feitas;
      if (faltam && !confirmarFim(faltam)) return;
      b.disabled = true;
      await terminarTeste();
    }
    desenharTeste();
    if (a === 'seg' || a === 'ant' || a === 'ir') window.scrollTo(0, 0);
  };
}

function confirmarFim(faltam) {
  // sem diálogos do browser: pede um segundo clique
  if (teste.avisado) return true;
  teste.avisado = true;
  const nav = app.querySelector('.navq');
  nav.insertAdjacentHTML('beforebegin', `<p class="aviso">Faltam ${plural(faltam, 'pergunta', 'perguntas')} por responder (contam como erradas). Clica outra vez em «Terminar» para confirmar.</p>`);
  return false;
}

async function terminarTeste() {
  if (teste.fim) return;
  let certas = 0;
  const detalhe = {};
  for (const q of teste.qs) {
    const est = teste.estados[q.id] || {};
    const certa = certaNoTeste(q, est);
    if (respondida(q, est)) progresso.registar(q.id, certa);
    detalhe[q.id] = certa;
    if (certa) certas++;
  }
  teste.certas = certas;
  teste.fim = true;
  if (teste.aoTerminar) {
    try { await teste.aoTerminar(certas, detalhe); teste.entregue = true; }
    catch (e) { teste.erroEntrega = e.message; }
  }
}

function desenharResultado(topo) {
  const n = teste.qs.length;
  const nota = Math.round((teste.certas / n) * 200) / 10;
  app.innerHTML = topo + `<main class="conteudo">
    <h1>Resultado</h1>
    <div class="nota-final ${nota >= 9.5 ? 'ok' : 'mal'}"><span>${String(nota).replace('.', ',')}</span><small>valores</small></div>
    <p class="sub">${teste.certas} de ${n} certas.</p>
    ${teste.entregue ? '<p class="feedback ok">Trabalho entregue ao teu explicador.</p>' : ''}
    ${teste.erroEntrega ? `<p class="feedback mal">Não foi possível entregar: ${esc(teste.erroEntrega)}</p>` : ''}
    <div class="acoes">${teste.repetir ? `<button class="btn" data-acao="repetir">${esc(teste.textoRepetir || 'Novo teste')}</button>` : ''}
      <a class="btn btn-sec" href="${teste.voltar[1]}">${esc(teste.voltar[0])}</a></div>
    <h2>Correção</h2>
    ${teste.qs.map((q, k) => {
      const est = teste.estados[q.id] || {};
      return `<details class="corr"><summary>${k + 1}. Exame ${q.ano} · ${esc(q.fase)} · item ${esc(q.numero)}
        ${certaNoTeste(q, est) ? '<b class="ok">✓</b>' : '<b class="mal">✗</b>'}</summary>
        ${htmlQuestao(q, eEM(q) ? { escolhida: est.escolhida, corrigir: true } : { mostrarResolucao: true, autoavaliacao: est.autoavaliacao ?? false })}</details>`;
    }).join('')}
  </main>`;
  app.querySelector('main').onclick = e => {
    const b = e.target.closest('[data-acao="repetir"]');
    if (!b) return;
    teste.repetir();
    desenharTeste();
  };
}

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
    else if (p[0] === 'centro' && p[1] === 'lote') await vistaLote();
    else if (p[0] === 'centro' && p[1] === 'turma' && p[2]) await vistaTurma(p[2]);
    else if (p[0] === 'centro' && p[1] === 'trabalho' && p[2] === 'novo' && p[3]) await vistaNovoTrabalho(p[3]);
    else if (p[0] === 'centro' && p[1] === 'trabalho' && p[2]) await vistaTrabalho(p[2]);
    else if (p[0] === 'centro' && p[1] === 'aluno' && p[2]) await vistaRelatorioAluno(p[2]);
    else if (p[0] === 'centro') await vistaCentro();
    else if (p[0] === 'tpc' && p[1]) await vistaTPC(p[1]);
    else if (p[0] === 'erros' && p[1]) await vistaErros(p[1]);
    else if (p[0] === 'exame' && p[1] && p[2] && p[3]) await vistaExame(p[1], p[2], p[3]);
    else if (p[0] === 'exame' && p[1]) await vistaExames(p[1]);
    else if (p[0] === 'estatisticas') await vistaEstatisticas();
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
