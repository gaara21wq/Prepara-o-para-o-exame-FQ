# Vinte — site novo (Vite)

Versão nova do site, organizada por disciplina → unidade/domínio → tema, com testes e fórmulas (KaTeX).
O site antigo (`../index.html`) continua a funcionar até fazermos a troca.

## Correr no PC
Precisa do Node.js (confirma com `node -v`). Dentro desta pasta:

```
npm install      # só da primeira vez
npm run dev      # abre o site em http://localhost:5173
```

`npm run build` cria a versão final em `dist/` (é essa que vai para o Netlify).

## Como está feito
- `src/dados.js` — carrega as perguntas da tabela `questoes` do Supabase e agrupa por `subtema_cod`.
- `src/main.js` — páginas: entrar, mudar password, início, disciplina (com «Estuda isto primeiro»), praticar por tema, teste de 10 perguntas com nota de 0 a 20, painel do centro e administração.
- `src/progresso.js` — sessão, perfil e respostas (cópia local + tabela `respostas` do Supabase).
- `src/supabase.js` + `src/config.js` — ligação ao projeto Supabase **Vinte**. O `config.js` só tem a chave *publishable* (pública por natureza); a chave secret nunca entra no projeto.
- `src/texto.js` — converte o texto com `$...$` em fórmulas KaTeX.
- `scripts/copiar-dados.mjs` — antes de `dev`/`build`, copia `../img/` para `public/img` (as perguntas já não vão no site).

## Contas (Supabase) — modelo fechado, como na PAP
- **Não há registo público.** As contas são criadas assim:
  - **admin** (Gaara), na página `#/admin`: cria centros (nome, máx. de alunos, licença até) e os explicadores de cada centro;
  - **explicador**, na página `#/centro`: cria os alunos do seu centro (até ao limite), desativa/ativa e dá passwords novas; vê as respostas da turma.
- Login com **nome de utilizador + password**. Internamente o email é `<utilizador>@contas.vinte.invalid` (não recebe emails). O admin pode entrar com o email real.
- No primeiro login (ou depois de uma password nova) o utilizador é obrigado a escolher uma password sua.
- **As perguntas estão na tabela `questoes`** e só são entregues a quem tem conta ativa num centro com licença válida. Sem sessão ou com a licença expirada não se vê nada (corte automático).
- A criação de contas corre na Edge Function `supabase/functions/contas` (usa a chave secret, que só existe no servidor do Supabase).
- SQL aplicado: `supabase/migrations/`. Para atualizar as perguntas depois de mudar os JSON: correr `20261120_importar_questoes.sql` (depois do `git push`).
- No painel do Supabase: **Authentication → Sign In / Providers → desligar "Allow new users to sign up"** (mesmo ligado, uma conta criada fora do Vinte fica inativa e sem acesso).
