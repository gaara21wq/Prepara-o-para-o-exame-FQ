// Configuração pública do Supabase (projeto Vinte).
// A chave publishable foi feita para estar no site: só dá acesso ao que as regras (RLS) permitem.
// NUNCA ponhas aqui a chave secret/service_role.
export const SUPABASE_URL = 'https://sfypvbxeltbjdieyrksf.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6o-hpRbSsvBEMkgaBMSIXA_ZpgypoaI';

// ---------- Venda (página de apresentação) ----------
// Muda aqui os preços e o contacto: a página e a calculadora atualizam-se sozinhas.
export const CONTACTO = 'pedro.r.lacerda21@gmail.com';
export const PRECOS = {
  // preço por aluno ativo por mês, conforme o total de alunos ativos do centro
  escaloes: [
    { ate: 10, mes: 3.0 },
    { ate: 30, mes: 2.5 },
    { ate: 60, mes: 2.0 },
    { ate: Infinity, mes: 1.5 },
  ],
  mesesAnoLetivo: 9,    // setembro a maio/junho (até aos exames)
  descontoAnual: 0.2,   // pagar o ano letivo inteiro: 20% mais barato
  minimoMes: 15,        // valor mínimo por mês
  diasGratis: 14,
};
// Conta de demonstração (só de leitura). A password é pública de propósito.
export const DEMO = { explicador: 'demo', aluno: 'demo-aluno', palavraPasse: 'vinte-demo' };
