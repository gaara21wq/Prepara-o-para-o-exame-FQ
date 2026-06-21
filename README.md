# Banco de Exames — Física e Química A (11º ano)

## Formato
Inspirado no [mat.absolutamente.net](https://mat.absolutamente.net): índice por **tema** (Mecânica, Ondas e Sinais, Eletricidade, Química), com **categorias/capítulos** dentro de cada tema (ex: "Estrutura Atómica", "Gravitação Universal"). Temas e categorias aparecem **ordenados pela frequência** com que saem em exame — do mais comum para o menos comum.

Cada questão de **escolha múltipla** mostra as 4 opções (A-D); a resposta certa fica escondida até se clicar em "ver resposta certa", para se poder resolver primeiro. Questões de cálculo, resposta aberta ou associação mostram um botão "ver resolução" com a resolução resumida.

## Estado atual — mudança importante
Esta versão reestruturou a base de dados: em vez de uma entrada por **questão completa** do exame (que tinha várias alíneas misturadas), agora cada **alínea é uma entrada própria** (ex: "4.1", "4.2", "4.3" são três questões separadas, cada uma com o seu tema e categoria).

Por causa deste trabalho de granularidade ser mais demorado, **esta versão cobre apenas os 3 exames de 2024** (1ª fase, 2ª fase, época especial) — **65 itens no total**, dos quais a maioria são escolha múltipla com opções reais extraídas dos PDFs originais e respostas confirmadas nos critérios de correção do IAVE.

Os exames de 2023 e 2022 (que estavam na versão anterior, agrupados por questão completa) ainda **não foram convertidos** para este novo formato granular — isso é o próximo passo.

## Como publicar no Netlify
1. Vai a [app.netlify.com/drop](https://app.netlify.com/drop)
2. Arrasta a pasta `fqa-banco-questoes` (com o `index.html` e o `questoes.json` lá dentro) para a área de upload
3. Pronto — fica online num link tipo `nome-aleatorio.netlify.app`. Podes depois mudar o nome em "Site settings".

## Estrutura de cada questão no `questoes.json`

```json
{
  "id": "2024-f1-1-2",
  "ano": 2024,
  "fase": "1ª Fase",
  "numero": "1.2",
  "tema": "Química",
  "categoria": "Ligação Química e Tabela Periódica",
  "contexto": "Texto de enquadramento da situação/problema (dados, figura descrita em texto, etc.)",
  "enunciado": "A pergunta em si.",
  "tipo": "escolha_multipla",
  "opcoes": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "resposta_certa": "D",
  "pdf_enunciado": "https://iave.pt/.../enunciado.pdf",
  "pdf_criterios": "https://iave.pt/.../criterios.pdf"
}
```

Para itens que não são de escolha múltipla, usar `"tipo"` igual a `"calculo"`, `"resposta_aberta"` ou `"associacao"`, omitir `"opcoes"`, e em `"resposta_certa"` colocar um resumo da resolução/resposta esperada (texto livre, não uma letra).

Regras importantes:
- `tema` tem de ser um destes quatro valores: `"Mecânica"`, `"Ondas e Sinais"`, `"Eletricidade"`, `"Química"`.
- `categoria` é o "capítulo" mostrado no índice — reaproveitar as já existentes (lista abaixo) sempre que possível, para a ordenação por frequência fazer sentido.
- A ordenação por frequência é automática (calculada em JavaScript a partir da contagem de questões), não precisa de ser definida manualmente.
- O campo `id` deve ser único; sugestão de convenção: `ano-fase-numero` (ex: `2024-f1-3-2` para o item 3.2 da 1ª fase de 2024).

## Categorias atualmente em uso
- **Mecânica**: Cinemática e Movimento Circular · Forças e Leis de Newton · Gravitação Universal · Trabalho, Energia e Conservação
- **Ondas e Sinais**: Radiação e Espectro Eletromagnético · Reflexão e Refração da Luz · Som e Ondas Mecânicas
- **Eletricidade**: Campo Elétrico · Circuitos Elétricos e Corrente · Indução Eletromagnética
- **Química**: Ácido-Base e pH · Energia, Calor e Reações · Equilíbrio Químico · Estequiometria e Quantidade de Matéria · Estrutura Atómica · Ligação Química e Tabela Periódica · Química Orgânica e Síntese · Solubilidade · Trabalho Laboratorial e Erros

## Próximos passos sugeridos
1. Converter os exames de 2023 e 2022 (já processados numa versão anterior, mas em formato agrupado) para o novo formato granular com opções A-D.
2. Continuar a processar exames de 2021 e 2020 (e potencialmente 2015–2019).
3. Para os itens de "esboço de gráfico" ou "diagrama" como opções (que no PDF original são imagens, não texto), as opções foram descritas em palavras — vale a pena, no futuro, considerar gerar pequenos SVGs para essas opções específicas, já que a descrição em texto perde alguma fidelidade.