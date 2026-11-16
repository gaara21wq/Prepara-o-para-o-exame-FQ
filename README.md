# Banco de Exames — Física e Química A (exame 715 — matéria do 10.º e 11.º ano)

## Formato
Inspirado no [mat.absolutamente.net](https://mat.absolutamente.net): índice por **tema** (Mecânica, Ondas e Sinais, Eletricidade, Química), com **categorias/capítulos** dentro de cada tema (ex: "Estrutura Atómica", "Gravitação Universal"). Temas e categorias aparecem **ordenados pela frequência** com que saem em exame — do mais comum para o menos comum.

Cada questão de **escolha múltipla** mostra as 4 opções (A-D) e é clicável: ao escolher uma letra, o site diz logo se está certa (verde) ou errada (vermelho, mostrando a certa). Há também um botão "não sei — ver resposta" (conta como errada). No topo aparece um placar com as respostas certas. Questões de cálculo, resposta aberta ou associação mostram um botão "ver resolução" com a resolução resumida (etapas e valores dos critérios do IAVE).

## Funcionalidades
- **Progresso guardado** — as respostas de escolha múltipla e as resoluções vistas ficam guardadas no browser (`localStorage`, chave `prepfq-progresso-v1`). Ao reabrir o site, as opções marcadas, o feedback e o placar voltam a aparecer. Cada categoria do índice mostra o progresso (ex: "3/5 certas"; nas categorias sem escolha múltipla, "2/4 vistas"). Se a chave de uma questão for corrigida no `questoes.json`, as respostas guardadas são reavaliadas automaticamente.
- **Recomeçar** — apaga todo o progresso, com confirmação na própria página.
- **Pesquisa** — ignora acentos ("equilibrio" encontra "equilíbrio") e procura também dentro das opções.
- **Filtros** (combinam entre si e com a pesquisa) — ano, fase, tipo (escolha múltipla / cálculo / resposta aberta / associação) e estado (todas / por responder / erradas). As opções de ano, fase e tipo são geradas a partir dos dados, por isso novos exames aparecem sozinhos. O botão **"rever as que errei"** é um atalho para o filtro "erradas".
- **Exame aleatório** — escolhe 10, 15 ou 20 questões e, opcionalmente, um tema. Só entram questões de escolha múltipla, baralhadas, uma de cada vez com barra de progresso. No fim mostra a nota (certas/total e em escala 0–20) e a lista das erradas, com a resposta certa, um link para a questão no banco e outro para o enunciado em PDF. As respostas do exame também contam para o progresso guardado (fica a tentativa mais recente).
- Funciona em telemóvel; os textos vindos do JSON são escapados antes de irem para a página (símbolos como ⇌, ², ⁻ aparecem normalmente).

## Estado atual
Cada **alínea** do exame é uma entrada própria (ex: "4.1", "4.2" e "4.3" são três questões separadas, cada uma com o seu tema e categoria).

Cobertura: **7 provas, 161 itens** — 2024 (1ª fase, 2ª fase, época especial), 2023 (1ª e 2ª fase) e 2022 (1ª e 2ª fase).
- As opções A-D e as chaves vêm dos enunciados e critérios de classificação oficiais do IAVE (Versão 1, salvo indicação em contrário).
- Nos itens de cálculo e resposta aberta, a resolução segue as etapas e os valores dos critérios.
- **Figuras e gráficos** (pasta `img/`, formato WebP, ~500 KB no total) recortados dos enunciados originais: 50 itens mostram a figura do enunciado e 11 itens de escolha múltipla mostram as opções (A)-(D) como imagem, tal como no exame. Clicar numa figura abre-a em tamanho real.
- Ainda sem figuras: a época especial de 2024 (o PDF não está disponível no espelho usado).

## Testar no PC
Abrir o `index.html` com duplo clique **não funciona** (o browser bloqueia o `fetch('questoes.json')` em `file://`). Usa um servidor local, por exemplo:
- VS Code → extensão **Live Server** → "Open with Live Server"; ou
- na pasta, `python -m http.server` e abrir `http://localhost:8000`.

## Como publicar
**GitHub Pages** (o repositório já existe): no GitHub, Settings → Pages → Source: branch `main`, pasta `/ (root)`. Fica em `https://gaara21wq.github.io/Prepara-o-para-o-exame-FQ/`.

**Netlify**: vai a [app.netlify.com/drop](https://app.netlify.com/drop) e arrasta a pasta `PrepFQ` (com o `index.html` e o `questoes.json`). Fica online num link tipo `nome-aleatorio.netlify.app`.

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
  "pdf_criterios": "https://iave.pt/.../criterios.pdf",
  "imagens": ["img/2023-f1-fig4.webp"],
  "opcoes_img": "img/2023-f1-7-2-opcoes.webp"
}
```

`imagens` (opcional) — figuras mostradas por baixo do contexto. `opcoes_img` (opcional) — imagem com as opções (A)-(D) quando estas são gráficos/desenhos; nesse caso o texto de cada opção é só "Opção (X) da figura". Só são aceites caminhos do tipo `img/nome.webp`.

Para itens que não são de escolha múltipla, usar `"tipo"` igual a `"calculo"`, `"resposta_aberta"` ou `"associacao"`, omitir `"opcoes"`, e em `"resposta_certa"` colocar um resumo da resolução/resposta esperada (texto livre, não uma letra).

Regras importantes:
- `tema` tem de ser um destes quatro valores: `"Mecânica"`, `"Ondas e Sinais"`, `"Eletricidade"`, `"Química"`.
- `categoria` é o "capítulo" mostrado no índice — reaproveitar as já existentes (lista abaixo) sempre que possível, para a ordenação por frequência fazer sentido.
- A ordenação por frequência é automática (calculada em JavaScript a partir da contagem de questões), não precisa de ser definida manualmente.
- O campo `id` deve ser único; sugestão de convenção: `ano-fase-numero` (ex: `2024-f1-3-2` para o item 3.2 da 1ª fase de 2024).

## Categorias atualmente em uso
- **Mecânica**: Cinemática e Movimento Circular · Forças e Leis de Newton · Gravitação Universal · Trabalho, Energia e Conservação
- **Ondas e Sinais**: Radiação e Espectro Eletromagnético · Reflexão e Refração da Luz · Som e Ondas Mecânicas
- **Eletricidade**: Campo Elétrico · Campo Magnético · Circuitos Elétricos e Corrente · Indução Eletromagnética
- **Química**: Ácido-Base e pH · Energia, Calor e Reações · Equilíbrio Químico · Estequiometria e Quantidade de Matéria · Estrutura Atómica · Ligação Química e Tabela Periódica · Oxidação-Redução · Química Orgânica e Síntese · Solubilidade · Trabalho Laboratorial e Erros

Nota: os itens de escolha múltipla da 2ª fase de 2024 3.1, 3.2 e 6.3 usam as opções e a chave da **Versão 2** do enunciado (o link aponta para essa versão). Nos restantes, a letra certa corresponde à versão indicada em `pdf_enunciado`.

## Próximos passos sugeridos
1. Juntar as épocas especiais de 2023 e 2022.
2. Continuar com os exames de 2021 e 2020 (e potencialmente 2015–2019). Os PDFs estão também em examesnacionais.com.pt (`/exames-nacionais/11ano/AAAA-Nfase/Fisica-Quimica-A.pdf` e `...-Criterios.pdf`), útil quando o site do IAVE não abre.
3. Rever os itens de 2024 (vieram de uma versão anterior, com texto e ordem das opções por vezes adaptados) contra os enunciados originais, como foi feito para 2022 e 2023.