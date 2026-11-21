// Páginas do explicador: alunos, criação em lote, turmas, trabalhos de casa e relatórios.
import { DISCIPLINAS, carregar } from './dados.js';
import { esc } from './texto.js';
import * as progresso from './progresso.js';
import { supabase } from './supabase.js';
import { app, pct, plural, href, cabecalho, barra, baralhar, dataPT, gerarPalavraPasse, mensagem, vistaErro } from './comum.js';

const hoje = () => new Date().toISOString().slice(0, 10);

// ---------- dados ----------
async function todas(consulta) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().range(de, de + 999);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}
const respostasDoCentro = () => todas(() => supabase.from('respostas').select('user_id, questao_id, ultima, atualizado_em'));
async function alunosDoCentro() {
  const { data, error } = await supabase.from('perfis')
    .select('id, nome, nome_utilizador, ativa, deve_mudar_palavra_passe, criado_em').eq('papel', 'aluno').order('nome');
  if (error) throw error;
  return data;
}
async function turmasDoCentro() {
  const { data, error } = await supabase.from('turmas').select('id, nome, criado_em, turma_alunos(aluno_id)').order('nome');
  if (error) throw error;
  return data;
}

// questao_id -> { disciplina, subtema } (para relatórios por tema)
async function indicePerguntas() {
  const [fq, mat] = await Promise.all([carregar('fq'), carregar('mat')]);
  const idx = new Map();
  for (const dd of [fq, mat]) for (const s of dd.subtemas) for (const q of s.questoes) idx.set(q.id, { dd, s });
  return { idx, dds: [fq, mat] };
}

// estatística por tema: { cod -> { respondidas, certas } }
function porTema(linhas, idx) {
  const r = {};
  for (const l of linhas) {
    const m = idx.get(l.questao_id);
    if (!m) continue;
    const e = r[m.s.cod] ||= { respondidas: 0, certas: 0 };
    e.respondidas++; if (l.ultima) e.certas++;
  }
  return r;
}
const corPct = p => (p == null ? '' : p >= 75 ? 'c-bom' : p >= 50 ? 'c-medio' : 'c-mau');

function eu() { return progresso.perfilAtual(); }
function soExplicador() {
  if (eu()?.papel !== 'explicador') { vistaErro('Esta página é só para explicadores.'); return false; }
  return true;
}
const trilhoCentro = (...mais) => [['O meu centro', '#/centro'], ...mais];

// ---------- página principal ----------
export async function vistaCentro() {
  if (!soExplicador()) return;
  const c = eu().centros;
  app.innerHTML = cabecalho([['O meu centro']]) + `<main class="conteudo"><h1>${esc(c.nome)}</h1><p class="sub">A carregar…</p></main>`;
  const [alunos, turmas, resp] = await Promise.all([alunosDoCentro(), turmasDoCentro(), respostasDoCentro().catch(() => [])]);
  const est = {};
  for (const r of resp) {
    const e = est[r.user_id] ||= { n: 0, certas: 0, ultima: '' };
    e.n++; if (r.ultima) e.certas++;
    if (r.atualizado_em > e.ultima) e.ultima = r.atualizado_em;
  }
  const ativos = alunos.filter(a => a.ativa).length;
  const dias = Math.round((new Date(c.licenca_ate) - new Date(hoje())) / 86400000);
  app.innerHTML = cabecalho([['O meu centro']]) + `<main class="conteudo">
    <h1>${esc(c.nome)}</h1>
    <p class="sub">${ativos} de ${c.max_alunos} alunos ativos · licença até ${dataPT(c.licenca_ate)}</p>
    ${dias <= 30 ? `<p class="aviso">A licença termina dentro de ${plural(dias, 'dia', 'dias')}. Contacta o Vinte para renovar.</p>` : ''}

    <section class="painel">
      <h2>Turmas</h2>
      ${turmas.length ? `<div class="cartoes-mini">${turmas.map(t => `<a class="cartao-mini" href="${href('centro', 'turma', t.id)}"><b>${esc(t.nome)}</b><span class="meta">${plural(t.turma_alunos.length, 'aluno', 'alunos')}</span></a>`).join('')}</div>`
        : '<p class="nota">Ainda não há turmas. Cria uma para agrupar alunos e dar trabalhos de casa.</p>'}
      <form id="nova-turma" class="form form-linha"><input name="nome" required maxlength="60" placeholder="Nome da turma (ex.: 11.º FQ terça)"><button class="btn btn-sec" type="submit">Criar turma</button></form>
    </section>

    <section class="painel">
      <h2>Criar conta de aluno</h2>
      <form id="novo" class="form form-linha">
        <input name="nome" required minlength="2" maxlength="80" placeholder="Nome do aluno">
        <input name="util" required pattern="[a-z0-9][a-z0-9._\\-]{2,39}" placeholder="Nome de utilizador (ex.: ana.silva)" autocapitalize="none" spellcheck="false">
        <input name="pass" required minlength="8" maxlength="72" placeholder="Password provisória">
        <button class="btn" type="submit">Criar</button>
      </form>
      <p class="nota">Tens muitos alunos? <a href="#/centro/lote">Criar vários de uma vez e imprimir os acessos</a>.</p>
    </section>
    <p id="msg" role="status"></p>

    <h2>Alunos</h2>
    ${alunos.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Aluno</th><th>Utilizador</th><th>Respostas</th><th>Certas</th><th>Última atividade</th><th></th></tr></thead><tbody>
      ${alunos.map(a => {
        const e = est[a.id] || { n: 0, certas: 0, ultima: '' };
        return `<tr class="${a.ativa ? '' : 'inativo'}"><td><a href="${href('centro', 'aluno', a.id)}">${esc(a.nome || '')}</a>${a.deve_mudar_palavra_passe ? ' <span class="etiqueta">ainda não entrou</span>' : ''}${a.ativa ? '' : ' <span class="etiqueta">desativado</span>'}</td>
          <td>${esc(a.nome_utilizador)}</td><td>${e.n}</td><td class="${corPct(e.n ? pct(e.certas, e.n) : null)}">${e.n ? pct(e.certas, e.n) + '%' : '—'}</td>
          <td>${e.ultima ? dataPT(e.ultima.slice(0, 10)) : '—'}</td>
          <td class="acoes-linha"><button class="btn-mini" data-acao="pass" data-id="${a.id}" data-u="${esc(a.nome_utilizador)}">Nova password</button>
          <button class="btn-mini" data-acao="estado" data-id="${a.id}" data-ativa="${a.ativa ? 0 : 1}">${a.ativa ? 'Desativar' : 'Ativar'}</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="nota">Ainda não há alunos. Cria a primeira conta acima.</p>'}
  </main>`;

  const msg = document.getElementById('msg');
  const f = document.getElementById('novo');
  f.pass.value = gerarPalavraPasse();
  f.nome.oninput = () => { if (!f.util.dataset.mexido) f.util.value = sugerirUtilizador(f.nome.value); };
  f.util.oninput = () => { f.util.dataset.mexido = '1'; };
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector('button'); btn.disabled = true;
    const d = { nome: f.nome.value.trim(), util: f.util.value.trim().toLowerCase(), pass: f.pass.value };
    try {
      await progresso.gerirContas({ acao: 'criar_aluno', nome: d.nome, nome_utilizador: d.util, palavra_passe: d.pass });
      await vistaCentro();
      mensagem(document.getElementById('msg'), `Conta criada. Dá ao aluno → utilizador: ${d.util} · password provisória: ${d.pass} (vai ter de a mudar ao entrar).`, true);
    } catch (err) { mensagem(msg, err.message, false); btn.disabled = false; }
  };
  document.getElementById('nova-turma').onsubmit = async e => {
    e.preventDefault();
    const { data, error } = await supabase.from('turmas').insert({ nome: e.target.nome.value.trim() }).select('id').single();
    if (error) return mensagem(msg, 'Não foi possível criar a turma: ' + error.message, false);
    location.hash = href('centro', 'turma', data.id);
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

function sugerirUtilizador(nome) {
  const partes = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const u = partes.length > 1 ? partes[0] + '.' + partes[partes.length - 1] : partes[0];
  return u.length >= 3 ? u.slice(0, 40) : (u + '123').slice(0, 40);
}

// ---------- criar alunos em lote ----------
export async function vistaLote() {
  if (!soExplicador()) return;
  const c = eu().centros;
  const alunos = await alunosDoCentro();
  const livres = c.max_alunos - alunos.filter(a => a.ativa).length;
  const turmas = await turmasDoCentro();
  app.innerHTML = cabecalho(trilhoCentro(['Criar alunos em lote'])) + `<main class="conteudo">
    <h1>Criar alunos em lote</h1>
    <p class="sub">Ainda podes criar ${plural(livres, 'aluno', 'alunos')} (licença de ${c.max_alunos}).</p>
    <form id="f" class="form">
      <label for="nomes">Nomes dos alunos (um por linha)</label>
      <textarea id="nomes" rows="8" placeholder="Ana Silva&#10;Bruno Costa&#10;…"></textarea>
      ${turmas.length ? `<label for="turma">Juntar à turma (opcional)</label><select id="turma"><option value="">—</option>${turmas.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select>` : ''}
      <div class="acoes"><button class="btn btn-sec" type="button" id="prever">Pré-visualizar</button></div>
    </form>
    <div id="previa"></div>
  </main>`;
  const existentes = new Set(alunos.map(a => a.nome_utilizador));
  let lista = [];
  document.getElementById('prever').onclick = () => {
    const usados = new Set(existentes);
    lista = document.getElementById('nomes').value.split('\n').map(s => s.trim()).filter(s => s.length >= 2).map(nome => {
      let base = sugerirUtilizador(nome), u = base, k = 2;
      while (usados.has(u)) u = (base + k++).slice(0, 40);
      usados.add(u);
      return { nome, util: u, pass: gerarPalavraPasse(), estado: '' };
    });
    desenharPrevia();
  };
  function desenharPrevia(final = false) {
    const el = document.getElementById('previa');
    if (!lista.length) { el.innerHTML = '<p class="nota">Escreve pelo menos um nome.</p>'; return; }
    el.innerHTML = `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>Utilizador</th><th>Password provisória</th><th></th></tr></thead><tbody>
      ${lista.map((a, i) => `<tr><td>${esc(a.nome)}</td><td>${final ? esc(a.util) : `<input class="in-mini" data-i="${i}" value="${esc(a.util)}">`}</td><td><code>${esc(a.pass)}</code></td><td>${a.estado}</td></tr>`).join('')}
      </tbody></table></div>
      ${lista.length > livres ? `<p class="aviso">São ${lista.length} nomes mas só há ${livres} lugares livres na licença.</p>` : ''}
      <div class="acoes">${final ? '<button class="btn" id="imprimir">Imprimir acessos</button>' : `<button class="btn" id="criar">Criar ${plural(lista.length, 'conta', 'contas')}</button>`}</div>`;
    el.querySelectorAll('.in-mini').forEach(inp => { inp.oninput = () => { lista[+inp.dataset.i].util = inp.value.trim().toLowerCase(); }; });
    const criar = document.getElementById('criar');
    if (criar) criar.onclick = async () => {
      criar.disabled = true;
      const turma = document.getElementById('turma')?.value;
      for (const a of lista) {
        if (a.ok) continue;
        a.estado = 'a criar…'; desenharPrevia();
        try {
          const r = await progresso.gerirContas({ acao: 'criar_aluno', nome: a.nome, nome_utilizador: a.util, palavra_passe: a.pass });
          a.ok = true; a.id = r.id; a.estado = '<span class="ok">✓ criada</span>';
          if (turma) await supabase.from('turma_alunos').insert({ turma_id: turma, aluno_id: r.id });
        } catch (err) { a.estado = `<span class="mal">${esc(err.message)}</span>`; }
      }
      lista = lista.filter(a => a.ok).concat(lista.filter(a => !a.ok));
      desenharPrevia(lista.every(a => a.ok));
      if (!lista.every(a => a.ok)) {
        const p = document.createElement('p'); p.className = 'aviso';
        p.textContent = 'Algumas contas não foram criadas (ver a coluna da direita). Corrige o utilizador e carrega outra vez em Criar.';
        document.getElementById('previa').prepend(p);
      }
    };
    const imp = document.getElementById('imprimir');
    if (imp) imp.onclick = () => imprimirAcessos(lista.filter(a => a.ok));
  }
}

function imprimirAcessos(lista) {
  const c = eu().centros;
  const site = location.origin + location.pathname;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Acessos — ${esc(c.nome)}</title>
    <style>body{font-family:system-ui,sans-serif;margin:1cm}h1{font-size:16px}.g{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .c{border:1px dashed #999;border-radius:6px;padding:10px;page-break-inside:avoid}.c b{font-size:15px}.c p{margin:4px 0;font-size:13px}code{font-size:14px}</style></head>
    <body><h1>Vinte — acessos dos alunos · ${esc(c.nome)}</h1><div class="g">
    ${lista.map(a => `<div class="c"><b>${esc(a.nome)}</b><p>Site: ${esc(site)}</p><p>Utilizador: <code>${esc(a.util)}</code></p><p>Password provisória: <code>${esc(a.pass)}</code></p><p style="color:#666">No primeiro acesso vais escolher uma password tua.</p></div>`).join('')}
    </div><script>window.print()<\/script></body></html>`);
  w.document.close();
}

// ---------- turma ----------
export async function vistaTurma(id) {
  if (!soExplicador()) return;
  app.innerHTML = cabecalho(trilhoCentro(['Turma'])) + '<main class="conteudo"><p class="sub">A carregar…</p></main>';
  const [{ data: t, error }, alunos, { data: trabalhos }, resp, { idx, dds }] = await Promise.all([
    supabase.from('turmas').select('id, nome, turma_alunos(aluno_id)').eq('id', id).single(),
    alunosDoCentro(),
    supabase.from('trabalhos').select('id, titulo, disciplina, questoes, prazo, criado_em, entregas(aluno_id, certas, total, entregue_em)').eq('turma_id', id).order('criado_em', { ascending: false }),
    respostasDoCentro().catch(() => []),
    indicePerguntas(),
  ]);
  if (error || !t) return vistaErro('Turma não encontrada.');
  const membros = new Set(t.turma_alunos.map(x => x.aluno_id));
  const daTurma = alunos.filter(a => membros.has(a.id));
  const respPorAluno = {};
  for (const r of resp) if (membros.has(r.user_id)) (respPorAluno[r.user_id] ||= []).push(r);
  let disc = sessionStorage.getItem('vinte.mapa.disc') || 'fq';

  const desenhar = () => {
    const dd = dds.find(d => d.id === disc);
    const stats = Object.fromEntries(daTurma.map(a => [a.id, porTema(respPorAluno[a.id] || [], idx)]));
    const turmaTema = porTema(daTurma.flatMap(a => respPorAluno[a.id] || []), idx);
    app.innerHTML = cabecalho(trilhoCentro([t.nome])) + `<main class="conteudo">
      <div class="titulo-tema"><h1>${esc(t.nome)}</h1><a class="btn" href="${href('centro', 'trabalho', 'novo', t.id)}">Novo trabalho de casa</a></div>
      <p class="sub">${plural(daTurma.length, 'aluno', 'alunos')} · ${plural((trabalhos || []).length, 'trabalho', 'trabalhos')}</p>

      <h2>Trabalhos de casa</h2>
      ${(trabalhos || []).length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Trabalho</th><th>Prazo</th><th>Entregues</th><th>Média</th></tr></thead><tbody>
        ${trabalhos.map(w => {
          const ent = w.entregas.filter(x => membros.has(x.aluno_id));
          const media = ent.length ? Math.round(ent.reduce((s, x) => s + 20 * x.certas / x.total, 0) / ent.length * 10) / 10 : null;
          return `<tr><td><a href="${href('centro', 'trabalho', w.id)}">${esc(w.titulo)}</a> <span class="etiqueta">${DISCIPLINAS[w.disciplina].nome}</span></td>
            <td>${w.prazo ? dataPT(w.prazo) + (w.prazo < hoje() ? ' <span class="etiqueta mal">terminou</span>' : '') : '—'}</td>
            <td>${ent.length}/${daTurma.length}</td><td>${media == null ? '—' : String(media).replace('.', ',') + ' val.'}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<p class="nota">Ainda não deste trabalhos a esta turma.</p>'}

      <div class="titulo-tema"><h2>Mapa da turma</h2>
        <div class="seg">${Object.values(DISCIPLINAS).map(d => `<button class="${d.id === disc ? 'ativo' : ''}" data-disc="${d.id}">${d.id === 'fq' ? 'FQ' : 'Matemática'}</button>`).join('')}</div></div>
      <p class="nota">Percentagem de respostas certas em cada tema (verde ≥ 75%, amarelo ≥ 50%, vermelho &lt; 50%). Vazio = ainda não praticou.</p>
      ${daTurma.length ? `<div class="tabela-wrap"><table class="tabela mapa"><thead><tr><th>Tema</th><th>Turma</th>${daTurma.map(a => `<th title="${esc(a.nome)}"><a href="${href('centro', 'aluno', a.id)}">${esc((a.nome || a.nome_utilizador).split(' ')[0])}</a></th>`).join('')}</tr></thead><tbody>
        ${dd.subtemas.map(s => {
          const tt = turmaTema[s.cod];
          return `<tr><td>${esc(s.nome)}</td><td class="${corPct(tt ? pct(tt.certas, tt.respondidas) : null)}">${tt ? pct(tt.certas, tt.respondidas) + '%' : ''}</td>
            ${daTurma.map(a => { const e = stats[a.id][s.cod]; return `<td class="${corPct(e ? pct(e.certas, e.respondidas) : null)}" title="${e ? `${e.certas}/${e.respondidas}` : ''}">${e ? pct(e.certas, e.respondidas) + '%' : ''}</td>`; }).join('')}</tr>`;
        }).join('')}</tbody></table></div>` : ''}

      <h2>Alunos da turma</h2>
      <p class="nota">Marca quem faz parte desta turma.</p>
      <div class="lista-check">${alunos.filter(a => a.ativa || membros.has(a.id)).map(a => `<label><input type="checkbox" data-aluno="${a.id}" ${membros.has(a.id) ? 'checked' : ''}> ${esc(a.nome || a.nome_utilizador)}</label>`).join('') || '<p class="nota">Cria primeiro contas de alunos.</p>'}</div>
      <p id="msg" role="status"></p>
      <h2>Apagar turma</h2>
      <p class="nota">Apaga a turma e os seus trabalhos (as contas dos alunos ficam).</p>
      <button class="btn btn-perigo" id="apagar">Apagar turma</button>
    </main>`;
    app.querySelectorAll('[data-disc]').forEach(b => { b.onclick = () => { disc = b.dataset.disc; sessionStorage.setItem('vinte.mapa.disc', disc); desenhar(); }; });
    app.querySelectorAll('[data-aluno]').forEach(cb => {
      cb.onchange = async () => {
        const msg = document.getElementById('msg');
        const q = cb.checked
          ? supabase.from('turma_alunos').insert({ turma_id: t.id, aluno_id: cb.dataset.aluno })
          : supabase.from('turma_alunos').delete().eq('turma_id', t.id).eq('aluno_id', cb.dataset.aluno);
        const { error: e } = await q;
        if (e) { cb.checked = !cb.checked; return mensagem(msg, 'Não foi possível guardar: ' + e.message, false); }
        vistaTurma(id);
      };
    });
    let conf = false;
    document.getElementById('apagar').onclick = async ev => {
      if (!conf) { conf = true; ev.target.textContent = 'Clica outra vez para confirmar'; return; }
      const { error: e } = await supabase.from('turmas').delete().eq('id', t.id);
      if (e) return mensagem(document.getElementById('msg'), e.message, false);
      location.hash = '#/centro';
    };
  };
  desenhar();
}

// ---------- novo trabalho de casa ----------
export async function vistaNovoTrabalho(turmaId) {
  if (!soExplicador()) return;
  const { data: t } = await supabase.from('turmas').select('id, nome').eq('id', turmaId).single();
  if (!t) return vistaErro('Turma não encontrada.');
  const dds = await Promise.all([carregar('fq'), carregar('mat')]);
  const daqui7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  let disc = 'fq';
  const desenhar = () => {
    const dd = dds.find(d => d.id === disc);
    app.innerHTML = cabecalho(trilhoCentro([t.nome, href('centro', 'turma', t.id)], ['Novo trabalho'])) + `<main class="conteudo">
      <h1>Novo trabalho de casa — ${esc(t.nome)}</h1>
      <form id="f" class="form">
        <label>Disciplina</label>
        <div class="seg">${dds.map(d => `<button type="button" class="${d.id === disc ? 'ativo' : ''}" data-disc="${d.id}">${esc(d.disciplina.nome)}</button>`).join('')}</div>
        <label>Temas</label>
        <div class="lista-check">${dd.grupos.map(g => `<p class="meta grupo-check">${esc(g.titulo)}</p>${g.subtemas.map(s => `<label><input type="checkbox" name="tema" value="${s.cod}"> ${esc(s.nome)} <span class="meta">(${s.questoes.length})</span></label>`).join('')}`).join('')}</div>
        <div class="form-linha">
          <label class="mini">Nº de perguntas <input name="n" type="number" min="1" max="60" value="10"></label>
          <label class="mini">Prazo <input name="prazo" type="date" value="${daqui7}"></label>
          <label class="mini"><input name="recentes" type="checkbox" checked> Preferir exames mais recentes</label>
        </div>
        <label for="titulo">Título</label>
        <input id="titulo" name="titulo" maxlength="120" placeholder="(automático a partir dos temas)">
        <button class="btn" type="submit">Criar trabalho</button>
      </form>
      <p id="msg" role="status"></p>
    </main>`;
    app.querySelectorAll('[data-disc]').forEach(b => { b.onclick = () => { disc = b.dataset.disc; desenhar(); }; });
    const f = document.getElementById('f');
    f.onsubmit = async e => {
      e.preventDefault();
      const msg = document.getElementById('msg');
      const cods = [...f.querySelectorAll('[name=tema]:checked')].map(x => x.value);
      if (!cods.length) return mensagem(msg, 'Escolhe pelo menos um tema.', false);
      const n = Math.min(60, Math.max(1, +f.n.value || 10));
      let pool = cods.flatMap(c => dd.porCod.get(c).questoes);
      pool = f.recentes.checked ? pool.sort((a, b) => b.ano - a.ano || Math.random() - 0.5) : baralhar(pool);
      // distribui pelos temas escolhidos
      const escolhidas = [];
      const porTemaLista = cods.map(c => pool.filter(q => q.subtema_cod === c));
      for (let k = 0; escolhidas.length < Math.min(n, pool.length); k++) {
        for (const lst of porTemaLista) if (lst[k] && escolhidas.length < n) escolhidas.push(lst[k]);
      }
      const nomes = cods.map(c => dd.porCod.get(c).nome);
      const titulo = f.titulo.value.trim() || (nomes.length <= 2 ? nomes.join(' + ') : `${nomes[0]} e mais ${nomes.length - 1} temas`);
      const { data, error } = await supabase.from('trabalhos').insert({
        turma_id: t.id, titulo: titulo.slice(0, 120), disciplina: disc, questoes: escolhidas.map(q => q.id), prazo: f.prazo.value || null,
      }).select('id').single();
      if (error) return mensagem(msg, 'Não foi possível criar: ' + error.message, false);
      location.hash = href('centro', 'trabalho', data.id);
    };
  };
  desenhar();
}

// ---------- resultados de um trabalho ----------
export async function vistaTrabalho(id) {
  if (!soExplicador()) return;
  const { data: w, error } = await supabase.from('trabalhos')
    .select('id, titulo, disciplina, questoes, prazo, criado_em, turma_id, turmas(nome, turma_alunos(aluno_id)), entregas(aluno_id, certas, total, detalhe, entregue_em)').eq('id', id).single();
  if (error || !w) return vistaErro('Trabalho não encontrado.');
  const [alunos, dd] = await Promise.all([alunosDoCentro(), carregar(w.disciplina)]);
  const membros = new Set(w.turmas.turma_alunos.map(x => x.aluno_id));
  const daTurma = alunos.filter(a => membros.has(a.id));
  const ent = Object.fromEntries(w.entregas.map(x => [x.aluno_id, x]));
  const qs = w.questoes.map(q => dd.porId.get(q)).filter(Boolean);
  const porQ = q => { const v = w.entregas.map(x => x.detalhe?.[q.id]).filter(x => x != null); return v.length ? pct(v.filter(Boolean).length, v.length) : null; };
  app.innerHTML = cabecalho(trilhoCentro([w.turmas.nome, href('centro', 'turma', w.turma_id)], [w.titulo])) + `<main class="conteudo">
    <h1>${esc(w.titulo)}</h1>
    <p class="sub">${dd.disciplina.nome} · ${plural(qs.length, 'pergunta', 'perguntas')} · prazo ${w.prazo ? dataPT(w.prazo) : '—'} · ${Object.keys(ent).length}/${daTurma.length} entregues</p>
    <h2>Por aluno</h2>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Aluno</th><th>Estado</th><th>Nota</th><th>Entregue em</th></tr></thead><tbody>
      ${daTurma.map(a => { const e = ent[a.id]; const nota = e ? Math.round(200 * e.certas / e.total) / 10 : null;
        return `<tr><td><a href="${href('centro', 'aluno', a.id)}">${esc(a.nome || a.nome_utilizador)}</a></td>
          <td>${e ? '<span class="etiqueta ok">entregue</span>' : (w.prazo && w.prazo < hoje() ? '<span class="etiqueta mal">em falta</span>' : '<span class="etiqueta">por fazer</span>')}</td>
          <td class="${corPct(e ? pct(e.certas, e.total) : null)}">${e ? `${String(nota).replace('.', ',')} (${e.certas}/${e.total})` : '—'}</td>
          <td>${e ? dataPT(e.entregue_em.slice(0, 10)) : '—'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <h2>Por pergunta</h2>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Pergunta</th><th>Tema</th><th>Certas</th></tr></thead><tbody>
      ${qs.map(q => { const p = porQ(q); return `<tr><td>Exame ${q.ano} · ${esc(q.fase)} · item ${esc(q.numero)}</td><td>${esc(q.subtema)}</td><td class="${corPct(p)}">${p == null ? '—' : p + '%'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p id="msg"></p>
    <button class="btn btn-perigo" id="apagar">Apagar trabalho</button>
  </main>`;
  let conf = false;
  document.getElementById('apagar').onclick = async ev => {
    if (!conf) { conf = true; ev.target.textContent = 'Clica outra vez para confirmar'; return; }
    const { error: e } = await supabase.from('trabalhos').delete().eq('id', w.id);
    if (e) return mensagem(document.getElementById('msg'), e.message, false);
    location.hash = href('centro', 'turma', w.turma_id);
  };
}

// ---------- relatório de um aluno (para mostrar aos pais) ----------
export async function vistaRelatorioAluno(id) {
  if (!soExplicador()) return;
  const [alunos, linhas, { idx, dds }, { data: ents }] = await Promise.all([
    alunosDoCentro(),
    todas(() => supabase.from('respostas').select('questao_id, ultima, tentativas, atualizado_em').eq('user_id', id)),
    indicePerguntas(),
    supabase.from('entregas').select('certas, total, entregue_em, trabalhos(titulo, prazo)').eq('aluno_id', id).order('entregue_em', { ascending: false }),
  ]);
  const a = alunos.find(x => x.id === id);
  if (!a) return vistaErro('Aluno não encontrado.');
  const st = porTema(linhas, idx);
  const ult = linhas.reduce((m, l) => (l.atualizado_em > m ? l.atualizado_em : m), '');
  const semana = Date.now() - 7 * 86400000;
  const nSemana = linhas.filter(l => Date.parse(l.atualizado_em) >= semana).length;
  const secao = dd => {
    const temas = dd.subtemas.map(s => ({ s, e: st[s.cod] })).filter(x => x.e);
    if (!temas.length) return `<p class="nota">Ainda não praticou ${esc(dd.disciplina.nome)}.</p>`;
    const fracos = temas.filter(x => x.e.respondidas >= 3).sort((x, y) => x.e.certas / x.e.respondidas - y.e.certas / y.e.respondidas).slice(0, 3);
    return `${fracos.length ? `<p><b>A reforçar:</b> ${fracos.map(x => esc(x.s.nome)).join(', ')}</p>` : ''}
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Tema</th><th>Respondidas</th><th>Certas</th><th style="width:30%"></th></tr></thead><tbody>
      ${temas.map(({ s, e }) => `<tr><td>${esc(s.nome)}</td><td>${e.respondidas} de ${s.questoes.length}</td><td class="${corPct(pct(e.certas, e.respondidas))}">${pct(e.certas, e.respondidas)}%</td><td>${barra({ respondidas: e.respondidas, certas: e.certas, total: s.questoes.length })}</td></tr>`).join('')}
      </tbody></table></div>`;
  };
  app.innerHTML = cabecalho(trilhoCentro([a.nome || a.nome_utilizador])) + `<main class="conteudo relatorio">
    <div class="titulo-tema"><h1>Relatório — ${esc(a.nome || a.nome_utilizador)}</h1><button class="btn btn-sec nao-imprimir" onclick="window.print()">Imprimir / PDF</button></div>
    <p class="sub">${esc(eu().centros.nome)} · ${dataPT(hoje())} · ${linhas.length} perguntas respondidas · ${nSemana} nos últimos 7 dias · última atividade ${ult ? dataPT(ult.slice(0, 10)) : '—'}</p>
    ${dds.map(dd => `<h2>${esc(dd.disciplina.nome)}</h2>${secao(dd)}`).join('')}
    <h2>Trabalhos de casa</h2>
    ${(ents || []).length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Trabalho</th><th>Nota</th><th>Entregue</th></tr></thead><tbody>
      ${ents.map(e => `<tr><td>${esc(e.trabalhos?.titulo || '')}</td><td class="${corPct(pct(e.certas, e.total))}">${String(Math.round(200 * e.certas / e.total) / 10).replace('.', ',')} val.</td><td>${dataPT(e.entregue_em.slice(0, 10))}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="nota">Ainda não entregou trabalhos.</p>'}
  </main>`;
}
