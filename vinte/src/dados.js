// Carrega (do Supabase, só com licença ativa) e organiza o banco de questões de cada disciplina.
import { supabase } from './supabase.js';

export const DISCIPLINAS = {
  fq:  { id: 'fq',  nome: 'Física e Química A', prova: '715', cor: 'fq' },
  mat: { id: 'mat', nome: 'Matemática A',       prova: '635', cor: 'mat' },
};

let cache = {};
export function limparCache() { cache = {}; }

async function buscar(id) {
  const { data, error } = await supabase.from('questoes').select('dados').eq('disciplina', id).limit(5000);
  if (error) throw new Error('Não consegui carregar as perguntas: ' + error.message);
  return data.map(r => r.dados);
}

export function carregar(id) {
  if (!DISCIPLINAS[id]) return Promise.reject(new Error('Disciplina desconhecida: ' + id));
  if (!cache[id]) {
    cache[id] = buscar(id)
      .then(lista => preparar(id, lista))
      .catch(e => { delete cache[id]; throw e; });
  }
  return cache[id];
}

// "F10.1" -> ["F", 10, 1]; "M3.2" -> ["M", 3, 2]; "M5" -> ["M", 5]
function partesCod(c) {
  const m = /^([A-Z]+)(.*)$/.exec(c);
  return [m[1], ...m[2].split('.').map(Number)];
}
// ordem: Física antes de Química; depois numérica
const ORDEM_LETRA = { F: 0, Q: 1, M: 2 };
export function cmpCod(a, b) {
  const pa = partesCod(a), pb = partesCod(b);
  if (pa[0] !== pb[0]) return (ORDEM_LETRA[pa[0]] ?? 9) - (ORDEM_LETRA[pb[0]] ?? 9);
  for (let i = 1; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

const ORDEM_FASE = { '1ª Fase': 0, '2ª Fase': 1, 'Época Especial': 2 };
export function cmpQuestao(a, b) {
  return (b.ano - a.ano) || ((ORDEM_FASE[a.fase] ?? 9) - (ORDEM_FASE[b.fase] ?? 9)) ||
    String(a.numero).localeCompare(String(b.numero), 'pt', { numeric: true });
}

function tituloGrupo(id, q) {
  const [letra, n] = partesCod(q.subtema_cod);
  if (id === 'fq') return `${letra === 'F' ? 'Física' : 'Química'} ${n}.º ano — ${q.dominio}`;
  return `Unidade ${n}. ${q.dominio}`;
}

function preparar(id, lista) {
  const subtemas = new Map();
  for (const q of lista) {
    let s = subtemas.get(q.subtema_cod);
    if (!s) {
      s = { cod: q.subtema_cod, nome: q.subtema, dominio: q.dominio, grupo: tituloGrupo(id, q), questoes: [] };
      subtemas.set(q.subtema_cod, s);
    }
    s.questoes.push(q);
  }
  const ordenados = [...subtemas.values()].sort((a, b) => cmpCod(a.cod, b.cod));
  const total = lista.length;
  const grupos = [];
  for (const s of ordenados) {
    s.questoes.sort(cmpQuestao);
    s.peso = s.questoes.length / total;        // peso nos exames = fração dos itens
    let g = grupos[grupos.length - 1];
    if (!g || g.titulo !== s.grupo) grupos.push(g = { titulo: s.grupo, subtemas: [] });
    g.subtemas.push(s);
  }
  const anos = [...new Set(lista.map(q => q.ano))].sort();
  return {
    id, disciplina: DISCIPLINAS[id], questoes: lista, total, grupos,
    subtemas: ordenados, porCod: subtemas, porId: new Map(lista.map(q => [q.id, q])),
    anos: anos.length ? `${anos[0]}–${anos[anos.length - 1]}` : '',
  };
}
