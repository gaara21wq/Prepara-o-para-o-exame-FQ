# Banco de Exames — Física e Química A (11º ano)

Site simples e funcional para pesquisar questões de exames nacionais de FQA por tema (Mecânica, Ondas e Sinais, Eletricidade), ano e fase.

## Estado atual
- **66 questões** catalogadas, dos exames de **2022, 2023 e 2024** (1ª fase, 2ª fase e época especial de 2024; 1ª e 2ª fase de 2023 e 2022).
- Cobre os 4 grandes temas: **Mecânica** (17), **Ondas e Sinais** (10), **Eletricidade** (8) e **Química** (31).
- Ainda falta: 2022 época especial, 2021, 2020 (e potencialmente 2015–2019, conforme combinado).
- Cada questão tem: tema, subtema, enunciado resumido, tipo de item, e links diretos para o PDF do enunciado completo e dos critérios de correção (hospedados no IAVE).

## Como publicar no Netlify
1. Vai a [app.netlify.com/drop](https://app.netlify.com/drop)
2. Arrasta a pasta `fqa-banco-questoes` (com o `index.html` e o `questoes.json` lá dentro) para a área de upload
3. Pronto — fica online num link tipo `nome-aleatorio.netlify.app`. Podes depois mudar o nome em "Site settings".

Alternativa via linha de comandos (se tiveres a Netlify CLI instalada):
```
npm install -g netlify-cli
cd fqa-banco-questoes
netlify deploy --prod
```

## Como adicionar mais questões
Todas as questões estão no ficheiro `questoes.json`, que é uma lista de objetos com esta forma:

```json
{
  "id": "2022-f1-1",
  "ano": 2022,
  "fase": "1ª Fase",
  "numero": "1",
  "tema": "Mecânica",
  "subtema": "Cinemática / Trabalho da força gravítica",
  "enunciado": "Resumo do contexto e das perguntas do item...",
  "tipo": "Escolha múltipla",
  "pdf_enunciado": "https://iave.pt/.../enunciado.pdf",
  "pdf_criterios": "https://iave.pt/.../criterios.pdf"
}
```

Regras importantes:
- `tema` tem de ser exatamente um destes quatro valores (para as cores funcionarem): `"Mecânica"`, `"Ondas e Sinais"`, `"Eletricidade"`, `"Química"`. Se quiserem subdividir mais (ex: separar "Eletromagnetismo" de "Eletricidade"), têm de adicionar esse valor também no HTML (na secção de filtros e no CSS `.tema-tag[data-tema="..."]`, `.card[data-tema="..."]` e `.chip.active[data-tema="..."]`).
- `ano` é número, não string.
- Basta adicionar novos objetos à lista (separados por vírgula) — o site atualiza-se sozinho, não precisa de mexer no HTML.

## Próximos passos sugeridos
1. Continuar a processar exames de 2020–2021 (e 2015–2019 se quiserem recuar mais).
2. Adicionar resoluções passo-a-passo das questões de cálculo (atualmente só há link para os critérios oficiais do IAVE, que são sucintos).
3. Considerar subdividir "Química" em subtemas maiores se a lista crescer muito (ex: "Estrutura Atómica e Ligação Química" vs "Reações Químicas e Equilíbrio" vs "Soluções e Ácido-Base") — o campo `subtema` já tem essa informação, só falta agrupá-la visualmente se fizer sentido.
