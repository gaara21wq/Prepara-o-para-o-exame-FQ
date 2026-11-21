// Edge Function "contas": gestão de contas (como na PAP, só quem gere cria contas).
// - admin: cria/atualiza centros e cria explicadores
// - explicador: cria alunos do seu centro (até ao limite da licença), ativa/desativa, redefine passwords
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DOMINIO = "contas.vinte.invalid"; // email interno: <nome_utilizador>@contas.vinte.invalid
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default as string);
const admin = createClient(URL_SB, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });

class Erro extends Error { constructor(public estado: number, msg: string) { super(msg); } }
const resposta = (corpo: unknown, estado = 200) =>
  new Response(JSON.stringify(corpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });

const RE_UTIL = /^[a-z0-9][a-z0-9._-]{2,39}$/;
function utilizadorValido(u: unknown): string {
  const s = String(u ?? "").trim().toLowerCase();
  if (!RE_UTIL.test(s)) throw new Erro(400, "Nome de utilizador inválido: 3 a 40 caracteres, só letras minúsculas, números, ponto, hífen ou _.");
  return s;
}
function passValida(p: unknown): string {
  const s = String(p ?? "");
  if (s.length < 8 || s.length > 72) throw new Erro(400, "A password provisória tem de ter entre 8 e 72 caracteres.");
  return s;
}
function nomeValido(n: unknown): string {
  const s = String(n ?? "").trim();
  if (s.length < 2 || s.length > 80) throw new Erro(400, "Nome inválido (2 a 80 caracteres).");
  return s;
}

async function quemChama(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Erro(401, "Sem sessão.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Erro(401, "Sessão inválida.");
  const { data: p, error: e2 } = await admin.from("perfis")
    .select("id, papel, centro_id, ativa")
    .eq("id", data.user.id).maybeSingle();
  if (e2) { console.error("perfil:", e2); throw new Erro(500, "Não foi possível ler o perfil."); }
  if (!p || !p.ativa) throw new Erro(403, "Conta inativa.");
  if (p.centro_id) {
    const { data: c } = await admin.from("centros").select("demo").eq("id", p.centro_id).maybeSingle();
    if (c?.demo) throw new Erro(403, "Esta é uma conta de demonstração: pode ver tudo, mas não pode criar nem alterar contas.");
  }
  return p as { id: string; papel: string; centro_id: string | null; ativa: boolean };
}

function licencaValida(c: { ativo: boolean; licenca_ate: string } | null) {
  return !!c && c.ativo && c.licenca_ate >= new Date().toISOString().slice(0, 10);
}

async function criarConta(o: { nome: string; util: string; pass: string; papel: string; centro: string | null; por: string }) {
  const { data: existe } = await admin.from("perfis").select("id").eq("nome_utilizador", o.util).maybeSingle();
  if (existe) throw new Erro(409, `O nome de utilizador «${o.util}» já existe. Escolhe outro.`);
  const { data, error } = await admin.auth.admin.createUser({
    email: `${o.util}@${DOMINIO}`, password: o.pass, email_confirm: true,
    user_metadata: { nome: o.nome, nome_utilizador: o.util },
  });
  if (error || !data.user) throw new Erro(400, "Não foi possível criar a conta: " + (error?.message ?? "erro"));
  const { error: e2 } = await admin.from("perfis").upsert({
    id: data.user.id, nome: o.nome, nome_utilizador: o.util, papel: o.papel, centro_id: o.centro,
    ativa: true, deve_mudar_palavra_passe: true, criado_por: o.por,
  });
  if (e2) { await admin.auth.admin.deleteUser(data.user.id); throw new Erro(400, "Não foi possível criar o perfil: " + e2.message); }
  return { id: data.user.id, nome_utilizador: o.util };
}

async function alunosAtivos(centro: string) {
  const { count } = await admin.from("perfis").select("id", { count: "exact", head: true })
    .eq("centro_id", centro).eq("papel", "aluno").eq("ativa", true);
  return count ?? 0;
}

// alvo tem de ser aluno do centro do explicador (ou qualquer conta, se for admin)
async function alvoPermitido(eu: Awaited<ReturnType<typeof quemChama>>, alvoId: string) {
  const { data: alvo } = await admin.from("perfis").select("id, papel, centro_id, ativa").eq("id", alvoId).single();
  if (!alvo) throw new Erro(404, "Conta não encontrada.");
  if (eu.papel === "admin") return alvo;
  if (eu.papel === "explicador" && alvo.papel === "aluno" && alvo.centro_id === eu.centro_id) return alvo;
  throw new Erro(403, "Sem permissão para esta conta.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);
  try {
    const eu = await quemChama(req);
    const b = await req.json().catch(() => ({}));
    const acao = String(b.acao ?? "");

    if (acao === "criar_aluno") {
      if (eu.papel !== "explicador" && eu.papel !== "admin") throw new Erro(403, "Só o explicador pode criar contas de alunos.");
      const centro = eu.papel === "admin" ? String(b.centro_id ?? "") : eu.centro_id;
      if (!centro) throw new Erro(400, "Falta o centro.");
      const { data: c } = await admin.from("centros").select("id, ativo, licenca_ate, max_alunos").eq("id", centro).single();
      if (!licencaValida(c)) throw new Erro(403, "A licença do centro não está ativa.");
      if (await alunosAtivos(centro) >= c!.max_alunos) throw new Erro(403, `Limite de ${c!.max_alunos} alunos ativos atingido. Desativa um aluno ou aumenta a licença.`);
      return resposta(await criarConta({ nome: nomeValido(b.nome), util: utilizadorValido(b.nome_utilizador), pass: passValida(b.palavra_passe), papel: "aluno", centro, por: eu.id }));
    }

    if (acao === "definir_estado") {
      const alvo = await alvoPermitido(eu, String(b.user_id ?? ""));
      const ativa = !!b.ativa;
      if (ativa && !alvo.ativa && alvo.papel === "aluno" && alvo.centro_id) {
        const { data: c } = await admin.from("centros").select("max_alunos").eq("id", alvo.centro_id).single();
        if (await alunosAtivos(alvo.centro_id) >= (c?.max_alunos ?? 0)) throw new Erro(403, "Limite de alunos ativos atingido.");
      }
      const { error } = await admin.from("perfis").update({ ativa }).eq("id", alvo.id);
      if (error) throw new Erro(400, error.message);
      return resposta({ ok: true });
    }

    if (acao === "redefinir_palavra_passe") {
      const alvo = await alvoPermitido(eu, String(b.user_id ?? ""));
      const { error } = await admin.auth.admin.updateUserById(alvo.id, { password: passValida(b.palavra_passe) });
      if (error) throw new Erro(400, error.message);
      await admin.from("perfis").update({ deve_mudar_palavra_passe: true }).eq("id", alvo.id);
      return resposta({ ok: true });
    }

    // ---------- só admin ----------
    if (eu.papel !== "admin") throw new Erro(403, "Ação reservada ao administrador.");

    if (acao === "criar_centro" || acao === "atualizar_centro") {
      const dados: Record<string, unknown> = {};
      if (b.nome != null) dados.nome = String(b.nome).trim();
      if (b.max_alunos != null) dados.max_alunos = Number(b.max_alunos);
      if (b.licenca_ate != null) dados.licenca_ate = String(b.licenca_ate);
      if (b.ativo != null) dados.ativo = !!b.ativo;
      const q = acao === "criar_centro"
        ? admin.from("centros").insert(dados).select().single()
        : admin.from("centros").update(dados).eq("id", String(b.centro_id ?? "")).select().single();
      const { data, error } = await q;
      if (error) throw new Erro(400, error.message);
      return resposta(data);
    }

    if (acao === "criar_explicador") {
      const centro = String(b.centro_id ?? "");
      const { data: c } = await admin.from("centros").select("id").eq("id", centro).single();
      if (!c) throw new Erro(404, "Centro não encontrado.");
      return resposta(await criarConta({ nome: nomeValido(b.nome), util: utilizadorValido(b.nome_utilizador), pass: passValida(b.palavra_passe), papel: "explicador", centro, por: eu.id }));
    }

    throw new Erro(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof Erro) return resposta({ erro: e.message }, e.estado);
    console.error(e);
    return resposta({ erro: "Erro interno." }, 500);
  }
});
