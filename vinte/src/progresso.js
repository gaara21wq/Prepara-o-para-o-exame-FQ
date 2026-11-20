// Progresso do aluno. Por agora fica no browser (localStorage);
// mais tarde esta mesma interface passa a guardar no Supabase.
const CHAVE = 'vinte.progresso.v1';

function ler() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return d && typeof d.respostas === 'object' ? d : { respostas: {} };
  } catch { return { respostas: {} }; }
}
let estado = ler();

function gravar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* modo privado, etc. */ }
}

export function registar(id, certa) {
  const r = estado.respostas[id] || { tentativas: 0, certas: 0 };
  r.tentativas += 1;
  if (certa) r.certas += 1;
  r.ultima = certa;
  r.quando = Date.now();
  estado.respostas[id] = r;
  gravar();
}

export function resposta(id) { return estado.respostas[id] || null; }

// conta a última resposta de cada questão
export function resumo(questoes) {
  let respondidas = 0, certas = 0;
  for (const q of questoes) {
    const r = estado.respostas[q.id];
    if (r) { respondidas++; if (r.ultima) certas++; }
  }
  return { respondidas, certas, total: questoes.length };
}

// Prioridade = peso do subtema nos exames × taxa de erro.
// Com menos de 3 respostas ainda não há dados: usa-se metade do peso.
export function prioridades(dados) {
  return dados.subtemas.map(s => {
    const r = resumo(s.questoes);
    const comDados = r.respondidas >= 3;
    const erro = comDados ? (r.respondidas - r.certas) / r.respondidas : null;
    const valor = comDados ? s.peso * (erro + 0.05) : s.peso * 0.5;
    return { s, r, comDados, erro, valor };
  }).sort((a, b) => b.valor - a.valor);
}

export function apagarTudo() {
  estado = { respostas: {} };
  gravar();
}
