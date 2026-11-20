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
- `src/dados.js` — carrega `data/fq.json` e `data/mat.json` e agrupa por `subtema_cod`.
- `src/main.js` — páginas: início, disciplina (com «Estuda isto primeiro»), praticar por tema, teste de 10 perguntas com nota de 0 a 20.
- `src/progresso.js` — guarda as respostas no browser (localStorage). Mais tarde passa a guardar no Supabase com a mesma interface.
- `src/texto.js` — converte o texto com `$...$` em fórmulas KaTeX.
- `scripts/copiar-dados.mjs` — antes de `dev`/`build`, copia `../questoes.json`, `../questoes-mat.json` e `../img/` para `public/` (não vão para o git; a fonte é sempre a raiz do projeto).
