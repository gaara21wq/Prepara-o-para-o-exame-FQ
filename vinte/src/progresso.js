// Sessão, perfil e progresso do aluno.
// As contas são criadas pelo explicador (Edge Function "contas"); aqui só se entra, muda a password e guarda respostas.
// As respostas ficam numa cópia local (por conta) e na tabela public.respostas do Supabase.
import { supabase } from './supabase.js';

export const DOMINIO_CONTAS = 'contas.vinte.invalid';
const PREFIXO = 'vinte.progresso.v2';

let utilizador = null;   // { id }
let perfil = null;       // linha de public.perfis (+ centro)
let estado = { respostas: {} };
const ouvintes = new Set();

function chave(id) { return `${PREFIXO}.${id}`; }
function lerLocal(id) {
  try {
    const d = JSON.parse(localStorage.getItem(chave(id)) || 'null');
    return d && typeof d.respostas === 'object' ? d : { respostas: {} };
  } catch { return { respostas: {} }; }
}
function gravar() {
  if (!utilizador) return;
  try { localStorage.setItem(chave(utilizador.id), JSON.stringify(estado)); } catch { /* sem espaço */ }
}
function avisar() { for (const f of ouvintes) f(); }

export function aoMudar(f) { ouvintes.add(f); return () => ouvintes.delete(f); }
export function temContas() { return !!supabase; }
export function contaAtual() { return utilizador; }
export function perfilAtual() { return perfil; }

const hoje = () => new Date().toISOString().slice(0, 10);
export function licencaAtiva(p = perfil) {
  if (!p || !p.ativa) return false;
  if (p.papel === 'admin') return true;
  const c = p.centros;
  return !!c && c.ativo && c.licenca_ate >= hoje();
}

// ---------- sessão ----------
async function carregarPerfil() {
  const { data, error } = await supabase.from('perfis')
    .select('id, nome, nome_utilizador, papel, centro_id, ativa, deve_mudar_palavra_passe, centros(id, nome, licenca_ate, ativo, max_alunos)')
    .eq('id', utilizador.id).single();
  if (error) throw error;
  perfil = data;
}

async function definirSessao(sessao) {
  const id = sessao?.user?.id || null;
  if (id === (utilizador?.id || null)) return;
  utilizador = id ? { id, email: sessao.user.email } : null;
  perfil = null;
  estado = id ? lerLocal(id) : { respostas: {} };
  if (id) {
    try { await carregarPerfil(); } catch (e) { console.warn('Perfil:', e.message); }
    if (licencaAtiva()) await sincronizar();
  }
  avisar();
}

// Chamado uma vez no arranque: espera pela sessão guardada antes de desenhar.
export async function iniciar() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  await definirSessao(data.session);
  supabase.auth.onAuthStateChange((_e, sessao) => { setTimeout(() => definirSessao(sessao), 0); });
}

export function emailDe(utilizadorOuEmail) {
  const s = utilizadorOuEmail.trim().toLowerCase();
  return s.includes('@') ? s : `${s}@${DOMINIO_CONTAS}`;
}

export async function entrar(utilizadorOuEmail, palavraPasse) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailDe(utilizadorOuEmail), password: palavraPasse });
  if (error) throw error;
  await definirSessao(data.session);
}

export async function mudarPalavraPasse(nova) {
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) throw error;
  const { error: e2 } = await supabase.rpc('marcar_palavra_passe_mudada');
  if (e2) throw e2;
  await carregarPerfil();
  avisar();
}

export async function sair() {
  // num computador partilhado (centro) não deixa respostas guardadas no browser
  if (utilizador) { try { localStorage.removeItem(chave(utilizador.id)); } catch { /* */ } }
  await supabase.auth.signOut();
  await definirSessao(null);
}

// Chama a Edge Function "contas" (criar alunos, centros, etc.).
export async function gerirContas(corpo) {
  const { data, error } = await supabase.functions.invoke('contas', { body: corpo });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).erro || msg; } catch { /* */ }
    throw new Error(msg);
  }
  return data;
}

// ---------- respostas ----------
export function registar(id, certa) {
  if (!utilizador) return;
  const r = estado.respostas[id] || { tentativas: 0, certas: 0 };
  r.tentativas += 1;
  if (certa) r.certas += 1;
  r.ultima = certa;
  r.quando = Date.now();
  r.pendente = true;
  estado.respostas[id] = r;
  gravar();
  enviar([id]);
}

export function resposta(id) { return estado.respostas[id] || null; }
export function todasRespostas() { return estado.respostas; }

export function resumo(questoes) {
  let respondidas = 0, certas = 0;
  for (const q of questoes) {
    const r = estado.respostas[q.id];
    if (r) { respondidas++; if (r.ultima) certas++; }
  }
  return { respondidas, certas, total: questoes.length };
}

// Prioridade = peso do tema nos exames × taxa de erro (menos de 3 respostas: metade do peso).
export function prioridades(dados) {
  return dados.subtemas.map(s => {
    const r = resumo(s.questoes);
    const comDados = r.respondidas >= 3;
    const erro = comDados ? (r.respondidas - r.certas) / r.respondidas : null;
    const valor = comDados ? s.peso * (erro + 0.05) : s.peso * 0.5;
    return { s, r, comDados, erro, valor };
  }).sort((a, b) => b.valor - a.valor);
}

export async function apagarTudo() {
  estado = { respostas: {} };
  gravar();
  if (utilizador) {
    const { error } = await supabase.from('respostas').delete().eq('user_id', utilizador.id);
    if (error) throw error;
  }
  avisar();
}

function linha(id, r) {
  return {
    user_id: utilizador.id, questao_id: id, tentativas: r.tentativas,
    certas: Math.min(r.certas, r.tentativas), ultima: !!r.ultima,
    atualizado_em: new Date(r.quando || Date.now()).toISOString(),
  };
}

async function enviar(ids) {
  if (!utilizador || !ids.length) return;
  const dono = utilizador.id;
  for (let i = 0; i < ids.length; i += 500) {
    const lote = ids.slice(i, i + 500).filter(id => estado.respostas[id]);
    const { error } = await supabase.from('respostas')
      .upsert(lote.map(id => linha(id, estado.respostas[id])), { onConflict: 'user_id,questao_id' });
    if (error) { console.warn('Não consegui guardar no servidor:', error.message); return; }
    if (utilizador?.id !== dono) return;
    for (const id of lote) if (estado.respostas[id]) estado.respostas[id].pendente = false;
    gravar();
  }
}

async function sincronizar() {
  const dono = utilizador.id;
  const { data, error } = await supabase.from('respostas')
    .select('questao_id,tentativas,certas,ultima,atualizado_em').eq('user_id', dono).limit(10000);
  if (error) { console.warn('Não consegui ler o progresso da conta:', error.message); return; }
  if (utilizador?.id !== dono) return;
  const final = {};
  for (const l of data) {
    final[l.questao_id] = { tentativas: l.tentativas, certas: l.certas, ultima: l.ultima, quando: Date.parse(l.atualizado_em), pendente: false };
  }
  const subir = [];
  for (const [id, r] of Object.entries(estado.respostas)) {
    const s = final[id];
    if (r.pendente || !s || (r.quando || 0) > (s.quando || 0)) { final[id] = { ...r, pendente: true }; subir.push(id); }
  }
  estado = { respostas: final };
  gravar();
  await enviar(subir);
}
