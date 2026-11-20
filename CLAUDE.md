# CLAUDE.md — regras do projeto PrepFQ / Vinte

Site para treinar exames nacionais (Física e Química A e Matemática A), a vender a centros de estudos com licença por ano letivo. Dono: Gaara. Escreve sempre em **português de Portugal**, respostas curtas.

## Ficheiros
- `vinte/` — o site novo (Vite + KaTeX + Supabase). Correr: `cd vinte`, `npm install`, `npm run dev`. Ver `vinte/README.md`.
- `index.html` — o site antigo (página única, sem build). Para testar: extensão **Live Server** (abrir com duplo clique não funciona, o `fetch` dos JSON falha).
- `questoes.json` — FQ A, 317 itens. `questoes-mat.json` — Matemática A, 180 itens (ainda não ligado ao site).
- `img/` — figuras em WebP, nomes `ANO-FASE-figN.webp` (FQ) e `mat-ANO-FASE-figN.webp` (Matemática).
- `README.md` — esquema dos dados e cobertura das provas.

## Dados (não partir)
- Os `id` são estáveis: nunca os mudes (vão ser usados para guardar o progresso dos alunos).
- Campos de classificação: `subtema_cod`, `dominio`, `subtema`. FQ: F10.1 … Q11.5 (19 subdomínios). Matemática: M1 … M8.2 (Unidades/Temas do livro de preparação); `ae_cod` guarda o código antigo por ano.
- Matemática usa LaTeX entre `$...$` para ser mostrado com KaTeX. Depois de editar, confirma que todas as fórmulas renderizam.
- Escolha múltipla: `opcoes` com chaves A–D e `resposta_certa` uma dessas letras. Outros tipos: `calculo`, `resposta_aberta`, `associacao` (I–IV).
- Ao gravar JSON: UTF-8, `ensure_ascii=False`, indentação de 1 espaço.
- Os JSON da raiz são a fonte; o site lê as perguntas da tabela `questoes` do Supabase. Depois de mudar os JSON e fazer push, é preciso voltar a importar (`vinte/supabase/migrations/20261120_importar_questoes.sql`).

## Regras de trabalho
- Não apagues ficheiros nem pastas sem perguntar.
- Não faças `git push` nem `git commit` sem o Gaara pedir.
- Nunca abras nem envies ficheiros de credenciais (`.credentials`, `.env`, chaves).
- Supabase: o projeto do site é **Vinte** (`sfypvbxeltbjdieyrksf`); o SQL aplicado está em `vinte/supabase/migrations/`. O projeto **EBSFLG+** é a PAP do Gaara — não lhe toques. A chave `service_role`/secret nunca vai para o código do site; no frontend só a chave publishable/anon.
- Antes de mudanças grandes (migração para Vite, base de dados), apresenta o plano e espera pelo OK.

## Próximos passos (resumo do roadmap)
1. Feito: site em Vite; contas fechadas (admin → centros/explicadores, explicador → alunos), licenças e perguntas protegidas no Supabase. Falta trocar o site antigo pelo novo e publicar no Netlify.
2. Fichas por tema em PDF.
3. Centros: contas de explicador, turmas, licença com data de fim.
4. Lançamento: repositório privado, Netlify, domínio, política de privacidade (RGPD, alunos menores).
