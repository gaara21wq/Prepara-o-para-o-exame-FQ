// Páginas públicas: apresentação (para centros), privacidade e termos.
import { esc } from './texto.js';
import { app, cabecalho, MARCA } from './comum.js';
import * as progresso from './progresso.js';
import { CONTACTO, PRECOS, DEMO } from './config.js';

const eur = v => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: v % 1 ? 2 : 0 });

export function precoPara(n) {
  n = Math.max(0, Math.floor(n));
  const e = PRECOS.escaloes.find(x => n <= x.ate) || PRECOS.escaloes.at(-1);
  const mes = Math.max(PRECOS.minimoMes, n * e.mes);
  const ano = mes * PRECOS.mesesAnoLetivo * (1 - PRECOS.descontoAnual);
  return { porAluno: e.mes, mes, ano, porAlunoAno: n ? ano / n : 0 };
}

function linhasPrecos() {
  let de = 1;
  return PRECOS.escaloes.map(e => {
    const faixa = e.ate === Infinity ? `mais de ${de - 1}` : `${de} a ${e.ate}`;
    const anual = e.mes * PRECOS.mesesAnoLetivo * (1 - PRECOS.descontoAnual);
    de = e.ate + 1;
    return `<tr><td>${faixa}</td><td><b>${eur(e.mes)}</b> / aluno / mês</td><td><b>${eur(anual)}</b> / aluno / ano letivo <span class="meta">(${eur(anual / PRECOS.mesesAnoLetivo)}/mês)</span></td></tr>`;
  }).join('');
}

async function entrarDemo(papel, btn) {
  btn.disabled = true; const t = btn.textContent; btn.textContent = 'A abrir a demonstração…';
  try {
    await progresso.entrar(papel === 'aluno' ? DEMO.aluno : DEMO.explicador, DEMO.palavraPasse);
    location.hash = papel === 'aluno' ? '#/' : '#/centro';
  } catch (e) {
    btn.disabled = false; btn.textContent = t;
    alert('Não foi possível abrir a demonstração: ' + e.message);
  }
}

function rodape() {
  return `<footer class="rodape"><span>© ${new Date().getFullYear()} Vinte</span>
    <a href="#/privacidade">Privacidade</a><a href="#/termos">Termos</a><a href="mailto:${CONTACTO}">Contacto</a>
    <span class="meta">As perguntas são dos exames nacionais publicados pelo IAVE.</span></footer>`;
}

export function vistaApresentacao() {
  const sessao = !!progresso.contaAtual();
  app.innerHTML = (sessao ? cabecalho([['Apresentação']]) : `<header class="topo">${MARCA}<span class="topo-dir"><a class="btn btn-sec btn-mini" href="#/entrar">Entrar</a></span></header>`) + `
  <main class="lp">
    <section class="lp-heroi">
      <div>
        <p class="lp-etiqueta">Para centros de explicações</p>
        <h1>Os teus alunos treinam com os exames nacionais. Tu vês quem precisa de ajuda.</h1>
        <p class="lp-sub">O Vinte reúne as perguntas dos exames oficiais de <b>Física e Química A</b> e <b>Matemática A</b>, organizadas por tema, com resoluções passo a passo. O explicador cria turmas, manda trabalhos de casa e acompanha cada aluno.</p>
        <div class="acoes">
          <button class="btn" data-demo="explicador">Ver a demonstração (explicador)</button>
          <button class="btn btn-sec" data-demo="aluno">Ver como aluno</button>
        </div>
        <p class="meta">A demonstração abre logo, sem registo. ${PRECOS.diasGratis} dias grátis para o teu centro experimentar.</p>
      </div>
      <img class="lp-logo" src="logo.svg" alt="" width="160" height="160">
    </section>

    <section class="lp-numeros">
      <div><b>600+</b><span>perguntas de exames oficiais</span></div>
      <div><b>2019–2026</b><span>exames de 1.ª e 2.ª fase</span></div>
      <div><b>2</b><span>disciplinas: FQ e Matemática A</span></div>
      <div><b>0–20</b><span>nota com as cotações oficiais</span></div>
    </section>

    <section class="lp-duas">
      <div class="painel"><h2>Para o aluno</h2><ul>
        <li>Treino por tema, com as perguntas dos exames nacionais.</li>
        <li>Correção na hora, com a explicação de cada resposta.</li>
        <li><b>Simular exame</b>: prova completa, com tempo, formulário e nota com as cotações oficiais.</li>
        <li>Rever os erros e ver a evolução por semana.</li>
      </ul></div>
      <div class="painel"><h2>Para o explicador</h2><ul>
        <li>Turmas e contas de alunos criadas em minutos (até em lote, com folha de acessos para imprimir).</li>
        <li>Trabalhos de casa por tema, com prazo e correção automática.</li>
        <li>Mapa da turma: vês num relance que temas cada aluno domina.</li>
        <li>Relatório do aluno para mostrar aos pais.</li>
      </ul></div>
    </section>

    <section>
      <h2>Como funciona</h2>
      <ol class="lp-passos">
        <li><b>O centro subscreve</b> e recebe a conta de explicador.</li>
        <li><b>O explicador cria as contas</b> dos alunos — não há registos abertos, só entra quem o centro autoriza.</li>
        <li><b>Os alunos treinam</b> no computador ou no telemóvel; o explicador acompanha tudo no painel.</li>
      </ol>
    </section>

    <section id="precos">
      <h2>Preços</h2>
      <p class="sub">Paga-se por aluno ativo. Quanto mais alunos, mais barato fica cada um — e o ano letivo inteiro sai ${Math.round(PRECOS.descontoAnual * 100)}% mais barato.</p>
      <div class="tabela-wrap"><table class="tabela lp-precos"><thead><tr><th>Alunos ativos no centro</th><th>Mensal</th><th>Ano letivo (${PRECOS.mesesAnoLetivo} meses)</th></tr></thead><tbody>${linhasPrecos()}</tbody></table></div>
      <div class="painel lp-calc">
        <label for="nAlunos"><b>Quantos alunos tem o teu centro?</b></label>
        <input id="nAlunos" type="number" min="1" max="2000" value="20" inputmode="numeric">
        <div id="calc"></div>
      </div>
      <p class="meta">Valor mínimo: ${eur(PRECOS.minimoMes)} por mês. ${PRECOS.diasGratis} dias grátis, sem compromisso. Alunos desativados não contam.</p>
    </section>

    <section class="lp-contacto painel">
      <h2>Queres experimentar no teu centro?</h2>
      <p>Escreve-nos e criamos o teu centro com ${PRECOS.diasGratis} dias grátis.</p>
      <p><a class="btn" href="mailto:${CONTACTO}?subject=${encodeURIComponent('Vinte — quero experimentar no meu centro')}">Pedir acesso por email</a> <span class="meta">${esc(CONTACTO)}</span></p>
    </section>
  </main>${rodape()}`;

  for (const b of app.querySelectorAll('[data-demo]')) b.onclick = () => entrarDemo(b.dataset.demo, b);
  const inp = document.getElementById('nAlunos'), out = document.getElementById('calc');
  const calc = () => {
    const n = Number(inp.value) || 0, p = precoPara(n);
    out.innerHTML = n < 1 ? '' : `<div class="numeros">
      <div><b>${eur(p.mes)}</b><span>por mês (${eur(p.porAluno)} por aluno)</span></div>
      <div><b>${eur(p.ano)}</b><span>por ano letivo (${eur(p.porAlunoAno)} por aluno)</span></div>
      <div><b>${eur(p.mes * PRECOS.mesesAnoLetivo - p.ano)}</b><span>poupança pagando o ano</span></div></div>`;
  };
  inp.oninput = calc; calc();
}

function pagina(titulo, corpo) {
  const sessao = !!progresso.contaAtual();
  app.innerHTML = (sessao ? cabecalho([[titulo]]) : `<header class="topo">${MARCA}<span class="topo-dir"><a class="btn btn-sec btn-mini" href="#/entrar">Entrar</a></span></header>`)
    + `<main class="conteudo legal"><h1>${titulo}</h1><p class="meta">Última atualização: 21 de novembro de 2026</p>${corpo}</main>${rodape()}`;
}

export function vistaPrivacidade() {
  pagina('Política de privacidade', `
  <p>Esta política explica que dados o Vinte trata, para quê e quais são os teus direitos, de acordo com o Regulamento Geral sobre a Proteção de Dados (RGPD).</p>
  <h2>Quem é responsável</h2>
  <p>Cada <b>centro de explicações</b> que usa o Vinte decide que alunos têm conta e é o <b>responsável pelo tratamento</b> dos dados dos seus alunos. O Vinte trata esses dados <b>por conta do centro</b> (subcontratante), só para prestar o serviço. Contacto do Vinte: <a href="mailto:${CONTACTO}">${esc(CONTACTO)}</a>.</p>
  <h2>Que dados guardamos</h2>
  <ul>
    <li><b>Conta:</b> nome, nome de utilizador e password (guardada cifrada — ninguém a consegue ler, nem nós).</li>
    <li><b>Treino:</b> as respostas a cada pergunta (certa/errada, número de tentativas e data), as entregas dos trabalhos de casa e a turma a que o aluno pertence.</li>
    <li><b>Explicador:</b> nome, nome de utilizador e o centro a que pertence.</li>
  </ul>
  <p>Não pedimos email, telefone, morada, data de nascimento nem fotografias dos alunos. Não usamos publicidade nem ferramentas de rastreio.</p>
  <h2>Para que servem</h2>
  <p>Só para o serviço funcionar: o aluno ver o seu progresso e o explicador do seu centro acompanhar os seus alunos. Os dados não são vendidos nem partilhados com terceiros para outros fins.</p>
  <h2>Quem vê os dados</h2>
  <p>O aluno vê os seus dados. O explicador vê os dados dos alunos do seu centro (e só desse centro). O acesso é controlado na própria base de dados.</p>
  <h2>Onde ficam guardados</h2>
  <p>Na plataforma Supabase, em servidores na União Europeia (Irlanda), com ligações cifradas (HTTPS). O browser guarda também uma cópia do progresso e a sessão iniciada (armazenamento local), apagada quando a pessoa sai da conta.</p>
  <h2>Durante quanto tempo</h2>
  <p>Enquanto o centro usar o Vinte. Quando o centro deixa de usar o serviço ou pede, os dados dos seus alunos são apagados no prazo de 30 dias. O próprio aluno pode apagar o seu progresso em «A minha conta».</p>
  <h2>Menores de idade</h2>
  <p>Muitos alunos têm menos de 18 anos. Cabe ao centro informar os alunos e os encarregados de educação e, quando a lei o exige (em Portugal, para menores de 13 anos), obter o consentimento dos encarregados de educação antes de criar a conta.</p>
  <h2>Os teus direitos</h2>
  <p>Podes pedir acesso, correção, apagamento ou portabilidade dos teus dados, ou opor-te ao tratamento, através do teu centro ou diretamente para <a href="mailto:${CONTACTO}">${esc(CONTACTO)}</a>. Tens também o direito de apresentar queixa à Comissão Nacional de Proteção de Dados (<a href="https://www.cnpd.pt" target="_blank" rel="noopener">cnpd.pt</a>).</p>`);
}

export function vistaTermos() {
  pagina('Termos de utilização', `
  <h2>1. O serviço</h2>
  <p>O Vinte é uma plataforma de treino para os exames nacionais (Física e Química A e Matemática A) destinada a centros de explicações e aos seus alunos. As contas são criadas pelo centro; não há registo aberto ao público.</p>
  <h2>2. Contas</h2>
  <p>O centro é responsável pelas contas que cria e por informar os alunos e encarregados de educação. Cada pessoa deve usar só a sua conta e não partilhar a password. O centro pode desativar contas a qualquer momento.</p>
  <h2>3. Utilização aceitável</h2>
  <p>Não é permitido copiar em massa o conteúdo da plataforma, tentar aceder a dados de outros centros ou perturbar o funcionamento do serviço.</p>
  <h2>4. Conteúdos</h2>
  <p>As perguntas reproduzem os enunciados dos exames nacionais publicados pelo IAVE, com indicação da prova de origem. As resoluções e explicações são preparadas pelo Vinte com base nos critérios oficiais; fazemos o possível para estarem corretas, mas podem ter erros — se encontrares algum, avisa-nos. O Vinte é um complemento ao estudo e não garante resultados nos exames.</p>
  <h2>5. Preços e pagamento</h2>
  <p>Os preços são os indicados na página de apresentação, por aluno ativo, ao mês ou por ano letivo. O centro tem ${PRECOS.diasGratis} dias grátis para experimentar. A licença é paga antecipadamente; se não for renovada, o acesso dos alunos e do explicador é suspenso, e os dados são apagados 30 dias depois.</p>
  <h2>6. Disponibilidade</h2>
  <p>Fazemos o possível para o serviço estar sempre disponível, mas podem existir interrupções para manutenção ou por falhas de terceiros.</p>
  <h2>7. Responsabilidade</h2>
  <p>Na medida permitida por lei, a responsabilidade do Vinte limita-se ao valor pago pelo centro nos últimos 12 meses.</p>
  <h2>8. Alterações e lei aplicável</h2>
  <p>Estes termos podem ser atualizados; os centros são avisados das alterações importantes. Aplica-se a lei portuguesa.</p>
  <p>Dúvidas: <a href="mailto:${CONTACTO}">${esc(CONTACTO)}</a>.</p>`);
}
