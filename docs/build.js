// Monta o relatório técnico (.docx) do Projeto Integrado.
// Uso: NODE_PATH=$(npm root -g) node docs/build.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, HeadingLevel, BorderStyle, Header,
  PageNumber, PageBreak, Tab, TabStopType, LeaderType, VerticalAlign,
} = require("docx");

const RAIZ = path.resolve(__dirname, "..");
const BUILD = path.join(RAIZ, "docs", "build");
const sizes = JSON.parse(fs.readFileSync(path.join(BUILD, "sizes.json")));
const snippets = JSON.parse(fs.readFileSync(path.join(BUILD, "snippets.json")));
const resultados = JSON.parse(
  fs.readFileSync(path.join(RAIZ, "tests", "resultados.json")));
const tocPath = path.join(BUILD, "toc.json");
const tocPages = fs.existsSync(tocPath) ? JSON.parse(fs.readFileSync(tocPath)) : {};

const FONTE = "Arial";
const LARGURA = 9071; // largura útil em DXA (A4, margens ABNT)
const headings = [];
let nFig = 0;
let nTab = 0;

// ------------------------------------------------------------- helpers
function run(t, o = {}) {
  return new TextRun({ text: t, font: FONTE, size: o.size || 24, bold: o.bold,
    italics: o.italics, color: o.color });
}

// texto com **negrito** simples
function runs(texto, o = {}) {
  return texto.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((parte) =>
    parte.startsWith("**")
      ? run(parte.slice(2, -2), { ...o, bold: true })
      : run(parte, o));
}

function corpo(texto) {
  return new Paragraph({
    children: runs(texto),
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 360, after: 120 },
    indent: { firstLine: 709 },
  });
}

function h1(texto) {
  headings.push({ texto, nivel: 1 });
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    children: [run(texto, { bold: true })],
    spacing: { line: 360, after: 240 },
  });
}

function h2(texto) {
  headings.push({ texto, nivel: 2 });
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    children: [run(texto, { bold: true })],
    spacing: { line: 360, before: 200, after: 120 },
  });
}

function legenda(prefixo, n, texto) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: false,
    spacing: { before: 60, after: 200 },
    children: [run(`${prefixo} ${n}: ${texto}`, { size: 20, bold: true }),
      run(" (elaborado pelo autor)", { size: 20 })],
  });
}

function figura(arquivo, larguraPx, texto, opcoes = {}) {
  nFig += 1;
  const [w, h] = sizes[arquivo];
  const alt = Math.round(larguraPx * h / w);
  const img = new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 120, after: 0 },
    children: [new ImageRun({
      type: "png",
      data: fs.readFileSync(path.join(RAIZ, arquivo)),
      transformation: { width: larguraPx, height: alt },
      altText: { title: texto, description: texto, name: `figura${nFig}` },
    })],
  });
  return [img, legenda("Figura", nFig, texto)];
}

const BORDA = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };

function celula(conteudo, largura, o = {}) {
  const paragrafos = (Array.isArray(conteudo) ? conteudo : [conteudo]).map((t) =>
    new Paragraph({
      spacing: { after: 40, line: 260 },
      keepNext: o.keepNext,
      alignment: o.centro ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: runs(t, { size: 20, bold: o.negrito }),
    }));
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: BORDAS,
    verticalAlign: VerticalAlign.CENTER,
    shading: o.fundo ? { type: ShadingType.CLEAR, fill: o.fundo, color: "auto" }
      : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: paragrafos,
  });
}

function tabela(titulo, larguras, cabecalho, linhas) {
  nTab += 1;
  const total = larguras.reduce((a, b) => a + b, 0);
  const tituloP = new Paragraph({
    keepNext: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80 },
    children: [run(`Tabela ${nTab}: ${titulo}`, { size: 20, bold: true })],
  });
  const t = new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: larguras,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: cabecalho.map((c, i) =>
          celula(c, larguras[i], { fundo: "D9D9D9", negrito: true })),
      }),
      ...linhas.map((l, k) => new TableRow({
        cantSplit: true,
        children: l.map((c, i) => celula(c, larguras[i],
          { keepNext: k === linhas.length - 1 })),
      })),
    ],
  });
  const fonte = new Paragraph({
    spacing: { before: 60, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [run("Fonte: elaborado pelo autor.", { size: 18 })],
  });
  return [tituloP, t, fonte];
}

function codigo(texto, rotulo) {
  const linhas = texto.split("\n").map((l, i, arr) => new Paragraph({
    spacing: { after: 0, line: 220 },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
    border: i === 0 ? { top: BORDA } : undefined,
    children: [new TextRun({ text: l === "" ? " " : l, font: "Courier New",
      size: 16 })],
  }));
  return [
    new Paragraph({
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [run(rotulo, { size: 20, bold: true })],
    }),
    ...linhas,
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

// ---------------------------------------------------------- conteúdo
const conteudo = [];
const add = (...x) => x.flat(Infinity).forEach((i) => conteudo.push(i));

// ===== 1 Apresentação do tema
add(h1("1 APRESENTAÇÃO DO TEMA"));
add(h2("1.1 Sistema escolhido"));
add(corpo("O sistema escolhido é um **Sistema de Controle de Estoque e Vendas** para pequeno comércio, como lojas de bairro, perfumarias, papelarias e mercearias. Ele substitui o controle feito em caderno ou de memória pelo dono por um sistema web simples, que cadastra os produtos, controla as quantidades em estoque, registra as vendas e mostra um relatório do dia."));
add(h2("1.2 Justificativa"));
add(corpo("Pequenos comerciantes costumam ter três problemas parecidos: vender um produto que já acabou, não perceber a tempo que o estoque está baixo e não saber quanto foi vendido no dia. O sistema ataca exatamente esses pontos. O tema também é adequado para o projeto integrado porque permite aplicar, em um único problema real, o levantamento de requisitos, a modelagem com UML e MER, a prototipação de telas, a programação com banco de dados e os testes (SOMMERVILLE, 2018)."));
add(corpo("Ficam fora do escopo, de propósito, a emissão de nota fiscal, o pagamento online e a integração com marketplaces. Esses itens aumentariam muito a complexidade e não são necessários para demonstrar o processo completo de desenvolvimento em um semestre."));
add(h2("1.3 Validação do tema"));
add(corpo("O Passo 0 exige que o tema atenda a três critérios. A Tabela 1 mostra como o sistema escolhido os cumpre."));
add(tabela("Validação do tema segundo os critérios do Passo 0",
  [2300, 3000, 3771],
  ["Critério", "Como o sistema atende", "Exemplos no sistema"],
  [
    ["Pelo menos 3 funcionalidades distintas",
      "O sistema realiza mais de três ações diferentes.",
      "Cadastrar produto, registrar venda com baixa de estoque, consultar estoque e gerar relatório de vendas do dia."],
    ["Pelo menos 1 consulta a banco de dados",
      "O sistema guarda e recupera informações em banco SQLite.",
      "Listar produtos com estoque e consultar as vendas de um dia, usando junção entre venda, item de venda e produto."],
    ["Viável de prototipar no período letivo",
      "Escopo enxuto, com tecnologias já estudadas nas disciplinas.",
      "Aplicação web com Python, Flask e SQLite, sem pagamentos online e sem integrações externas."],
  ]));
add(h2("1.4 Levantamento de informações"));
add(corpo("Como o projeto não tem um cliente formal, as necessidades foram levantadas com duas das técnicas sugeridas no Passo 0: a pesquisa de sistemas semelhantes e a experiência própria como cliente de pequenos comércios. O levantamento por observação e entrevista é uma das práticas clássicas da engenharia de requisitos (SOMMERVILLE, 2018). A Tabela 2 registra de onde veio cada informação e qual requisito ela gerou."));
add(tabela("Fontes do levantamento e requisitos gerados",
  [2400, 4271, 2400],
  ["Técnica", "O que foi observado", "Requisitos gerados"],
  [
    ["Pesquisa de sistemas semelhantes",
      "Sistemas simples de estoque pedem código, nome, preço e quantidade do produto, e destacam produtos com estoque baixo.",
      "RF02, RF03"],
    ["Pesquisa de sistemas semelhantes",
      "Telas de venda pedem apenas o produto e a quantidade, e o sistema calcula o total e atualiza o estoque.",
      "RF04, RF05, RF06"],
    ["Experiência como cliente",
      "O comerciante precisa saber rapidamente quanto vendeu no dia e quais produtos saíram.",
      "RF07"],
    ["Experiência como cliente",
      "O uso acontece no balcão, muitas vezes pelo celular, e o acesso deve ser protegido.",
      "RNF02, RNF03"],
  ]));

// ===== 2 Fase 1
add(h1("2 FASE 1: ANÁLISE DE REQUISITOS"));
add(corpo("Segundo Sommerville (2018), os requisitos funcionais descrevem o que o sistema deve fazer, enquanto os não funcionais descrevem restrições e qualidades, como desempenho, segurança e usabilidade. Seguindo essa divisão, foram levantados oito requisitos funcionais e cinco não funcionais."));
add(h2("2.1 Requisitos funcionais"));
add(tabela("Requisitos funcionais", [900, 2400, 5771],
  ["ID", "Nome", "Descrição"],
  [
    ["RF01", "Autenticar usuário", "O sistema deve permitir o acesso somente mediante login e senha válidos."],
    ["RF02", "Cadastrar produto", "O sistema deve cadastrar produtos com nome, código único, preço, estoque inicial e estoque mínimo."],
    ["RF03", "Listar produtos e estoque", "O sistema deve listar os produtos com preço e quantidade em estoque, indicando os que estão com estoque baixo."],
    ["RF04", "Registrar venda", "O sistema deve registrar a venda de um produto em determinada quantidade, calculando o total."],
    ["RF05", "Baixar estoque", "O sistema deve reduzir automaticamente o estoque do produto após cada venda registrada."],
    ["RF06", "Impedir venda sem estoque", "O sistema deve impedir a venda de quantidade maior que o estoque disponível e informar o saldo."],
    ["RF07", "Gerar relatório de vendas", "O sistema deve listar as vendas de um dia, com o total vendido, usando a data atual como padrão."],
    ["RF08", "Encerrar sessão", "O sistema deve permitir que o usuário saia do sistema."],
  ]));
add(h2("2.2 Requisitos não funcionais"));
add(tabela("Requisitos não funcionais", [900, 1900, 6271],
  ["ID", "Categoria", "Descrição"],
  [
    ["RNF01", "Desempenho", "O sistema deve responder às operações comuns em até 3 segundos."],
    ["RNF02", "Segurança", "O acesso às telas deve exigir login e as senhas devem ser armazenadas com hash, nunca em texto puro."],
    ["RNF03", "Usabilidade", "A interface deve funcionar no navegador do celular, com layout que se adapta à largura da tela."],
    ["RNF04", "Integridade dos dados", "O banco deve rejeitar preço menor ou igual a zero, estoque negativo e código de produto repetido, e a venda deve ser gravada em uma única transação."],
    ["RNF05", "Usabilidade", "As mensagens de erro e de sucesso devem ser claras e em português."],
  ]));
add(h2("2.3 Diagrama de casos de uso"));
add(corpo("O sistema tem um ator, o **Operador**, que representa o dono ou o atendente do comércio. Os dois usam as mesmas funções, por isso foram tratados como um único ator. A Figura 1 mostra os cinco casos de uso identificados (BOOCH; RUMBAUGH; JACOBSON, 2012)."));
add(figura("docs/img/casos_de_uso.png", 440, "Diagrama de casos de uso"));
add(h2("2.4 Descrição dos casos de uso"));
const uc = (id, nome, objetivo, pre, passos, alt) => [
  tabela(`${id}: ${nome}`, [2000, 7071], ["Item", "Descrição"], [
    ["Ator", "Operador"],
    ["Objetivo", objetivo],
    ["Pré-condição", pre],
    ["Passos principais", passos],
    ["Fluxo alternativo", alt],
  ]),
];
add(uc("UC01", "Fazer login", "Acessar o sistema com segurança.",
  "Usuário já cadastrado no banco.",
  ["1. O operador informa login e senha.", "2. O sistema valida as credenciais.", "3. O sistema libera o acesso e abre a lista de produtos."],
  "Se login ou senha estiverem incorretos, o sistema exibe a mensagem de erro e permanece na tela de login."));
add(uc("UC02", "Cadastrar produto", "Incluir um novo produto no estoque.",
  "Operador autenticado.",
  ["1. O operador abre a tela de novo produto.", "2. Informa nome, código, preço, estoque inicial e estoque mínimo.", "3. Confirma o cadastro.", "4. O sistema valida os dados, grava o produto e exibe a lista atualizada."],
  "Se algum campo obrigatório estiver vazio, o preço for menor ou igual a zero ou o código já existir, o sistema exibe o erro e não grava."));
add(uc("UC03", "Consultar estoque", "Ver quanto há de cada produto.",
  "Operador autenticado.",
  ["1. O operador abre a lista de produtos.", "2. O sistema lê os produtos no banco.", "3. O sistema exibe preço, quantidade e situação (normal ou estoque baixo)."],
  "Se não houver produtos, o sistema informa que nenhum produto foi cadastrado."));
add(uc("UC04", "Registrar venda", "Vender um produto e atualizar o estoque.",
  "Operador autenticado e produto cadastrado.",
  ["1. O operador seleciona o produto e informa a quantidade.", "2. O sistema confere se há estoque suficiente.", "3. O sistema grava a venda e o item, e reduz o estoque.", "4. O sistema exibe a mensagem de sucesso com o total."],
  "Se a quantidade for inválida ou maior que o estoque, o sistema exibe o erro e não grava nada."));
add(uc("UC05", "Consultar relatório de vendas do dia", "Saber o que foi vendido e o total do dia.",
  "Operador autenticado.",
  ["1. O operador abre o relatório (dia atual por padrão) ou escolhe outra data.", "2. O sistema consulta as vendas do dia.", "3. O sistema lista os itens vendidos e soma o total."],
  "Se não houver vendas na data, o sistema informa que nenhuma venda foi registrada."));

// ===== 3 Fase 2
add(h1("3 FASE 2: MODELAGEM DO SISTEMA"));
add(corpo("A modelagem parte dos requisitos para definir as classes do sistema, as entidades do banco de dados e a troca de mensagens do caso de uso principal. Os diagramas seguem a notação UML descrita por Booch, Rumbaugh e Jacobson (2012), e o modelo de dados segue os conceitos de entidade e relacionamento apresentados por Elmasri e Navathe (2018)."));
add(h2("3.1 Diagrama de classes"));
add(corpo("Foram identificadas quatro classes. **Usuario** representa quem acessa o sistema, **Produto** guarda os dados do estoque, **Venda** representa a operação de venda e **ItemVenda** liga a venda ao produto vendido, guardando a quantidade e o preço praticado no momento. O preço unitário é copiado para o item para que o histórico não mude se o preço do produto for alterado depois."));
add(figura("docs/img/diagrama_classes.png", 600, "Diagrama de classes"));
add(h2("3.2 Modelo Entidade Relacionamento"));
add(corpo("O MER tem quatro entidades. Um usuário realiza várias vendas, uma venda contém um ou mais itens e um produto pode aparecer em vários itens. O relacionamento entre venda e produto é de muitos para muitos, resolvido pela entidade ITEM_VENDA."));
add(figura("docs/img/mer.png", 600, "Modelo Entidade Relacionamento (MER)"));
add(h2("3.3 Dicionário de dados"));
const dd = (nome, linhas) => tabela(`Dicionário de dados da entidade ${nome}`,
  [1900, 1300, 4271, 1600], ["Campo", "Tipo", "Descrição", "Obrigatório"], linhas);
add(dd("USUARIO", [
  ["id (PK)", "INTEGER", "Identificador do usuário, gerado automaticamente.", "Sim"],
  ["nome", "TEXT", "Nome do usuário.", "Sim"],
  ["login", "TEXT", "Nome de acesso, único no sistema.", "Sim"],
  ["senha_hash", "TEXT", "Senha armazenada em formato hash.", "Sim"],
]));
add(dd("PRODUTO", [
  ["id (PK)", "INTEGER", "Identificador do produto, gerado automaticamente.", "Sim"],
  ["nome", "TEXT", "Nome do produto.", "Sim"],
  ["codigo", "TEXT", "Código do produto, único.", "Sim"],
  ["preco", "REAL", "Preço de venda, maior que zero.", "Sim"],
  ["estoque", "INTEGER", "Quantidade disponível, não pode ser negativa.", "Sim"],
  ["estoque_minimo", "INTEGER", "Quantidade a partir da qual o produto é marcado como estoque baixo.", "Sim"],
]));
add(dd("VENDA", [
  ["id (PK)", "INTEGER", "Identificador da venda, gerado automaticamente.", "Sim"],
  ["data_hora", "TEXT", "Data e hora do registro da venda.", "Sim"],
  ["total", "REAL", "Valor total da venda.", "Sim"],
  ["usuario_id (FK)", "INTEGER", "Usuário que registrou a venda (referência a USUARIO).", "Sim"],
]));
add(dd("ITEM_VENDA", [
  ["id (PK)", "INTEGER", "Identificador do item, gerado automaticamente.", "Sim"],
  ["venda_id (FK)", "INTEGER", "Venda a que o item pertence (referência a VENDA).", "Sim"],
  ["produto_id (FK)", "INTEGER", "Produto vendido (referência a PRODUTO).", "Sim"],
  ["quantidade", "INTEGER", "Quantidade vendida, maior que zero.", "Sim"],
  ["preco_unitario", "REAL", "Preço do produto no momento da venda.", "Sim"],
]));
add(h2("3.4 Diagrama de sequência"));
add(corpo("O diagrama de sequência foi feito para o caso de uso principal, **Registrar venda** (UC04). Ele mostra que o sistema busca o produto, confere o estoque e só então grava a venda e reduz o estoque. Quando o estoque é insuficiente, nenhuma gravação acontece."));
add(figura("docs/img/diagrama_sequencia.png", 540, "Diagrama de sequência do caso de uso Registrar venda"));
add(h2("3.5 Consistência entre os modelos"));
add(corpo("Cada classe do diagrama corresponde a uma entidade do MER e a uma tabela do dicionário de dados, com os mesmos atributos. Os requisitos RF02 e RF03 são atendidos pela classe Produto, RF04 a RF06 pelas classes Venda, ItemVenda e Produto, RF07 pela consulta que une Venda, ItemVenda e Produto, e RF01 pela classe Usuario. O diagrama de sequência usa os mesmos objetos e a mesma regra de negócio descrita no requisito RF06."));

// ===== 4 Fase 3
add(h1("4 FASE 3: PROTOTIPAGEM DE TELAS"));
add(corpo("Antes de programar, foram desenhados wireframes de quatro telas, com base nos requisitos. Eles mostram os campos e os botões, sem preocupação com o visual. As telas finais do sistema aparecem na seção 5 e na seção 6."));
add(h2("4.1 Tela 1: Login"));
add(figura("docs/img/wf_login.png", 270, "Wireframe da tela de login"));
add(corpo("Permite que o operador entre no sistema. Ele informa login e senha e clica em Entrar. Atende ao requisito RF01 e ao UC01."));
add(h2("4.2 Tela 2: Cadastro de produto"));
add(figura("docs/img/wf_cadastro.png", 230, "Wireframe da tela de cadastro de produto"));
add(corpo("Serve para incluir um produto. O operador preenche nome, código, preço, estoque inicial e estoque mínimo, e clica em Salvar. Atende ao requisito RF02 e ao UC02."));
add(h2("4.3 Tela 3: Registrar venda"));
add(figura("docs/img/wf_venda.png", 270, "Wireframe da tela de registro de venda"));
add(corpo("Serve para vender. O operador escolhe o produto em uma lista, informa a quantidade e confirma a venda. Atende aos requisitos RF04 a RF06 e ao UC04."));
add(h2("4.4 Tela 4: Lista de produtos e estoque"));
add(figura("docs/img/wf_lista.png", 250, "Wireframe da tela de lista de produtos e estoque"));
add(corpo("Mostra todos os produtos com preço, quantidade e situação, destacando os de estoque baixo. É a tela inicial depois do login. Atende ao requisito RF03 e ao UC03. O relatório de vendas (UC05) segue o mesmo padrão de tabela."));

// ===== 5 Fase 4
add(h1("5 FASE 4: DESENVOLVIMENTO"));
add(h2("5.1 Tecnologias e estrutura"));
add(corpo("O sistema foi desenvolvido em **Python 3** com o microframework **Flask** (FLASK, 2026), banco de dados **SQLite** (SQLITE, 2026) e páginas HTML com CSS simples. O banco é criado a partir do arquivo schema.sql, que reproduz as quatro tabelas do MER, com as restrições de integridade no próprio banco. O código está versionado em repositório Git, no endereço a seguir."));
add(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 160 },
  children: [run("Repositório no GitHub: https://github.com/luiz775/projeto-integrado-estoque", { bold: true })],
}));
add(corpo("Para executar, basta instalar as dependências com pip install -r requirements.txt e rodar python app.py. No primeiro uso, o sistema cria o banco e um usuário administrador de demonstração (login admin)."));
add(codigo(snippets.schema, "Trecho 1: script do banco de dados (schema.sql)"));

add(h2("5.2 Funcionalidade 1: Cadastro de produto"));
add(corpo("Esta funcionalidade grava um novo produto no banco. O sistema valida o conteúdo recebido antes de gravar: nome e código obrigatórios, preço maior que zero, quantidades numéricas e não negativas. Se o código já existir, a restrição de unicidade do banco rejeita a gravação e o usuário recebe uma mensagem. Corresponde ao RF02 e ao UC02."));
add(codigo(snippets.cadastro, "Trecho 2: função produto_novo (app.py)"));
nFig += 0;
add(figura("tests/evidencias/ct04_cadastro_preenchido.png", 400, "Cadastro de produto: formulário preenchido"));
add(figura("tests/evidencias/ct04_cadastro_valido.png", 400, "Cadastro de produto: produto gravado e exibido na lista"));

add(h2("5.3 Funcionalidade 2: Registro de venda com baixa de estoque"));
add(corpo("Esta funcionalidade lê o produto no banco, confere se há estoque suficiente e, em caso positivo, grava a venda e o item e reduz o estoque na mesma transação. Se algo falhar durante a gravação, o sistema desfaz tudo com rollback, para que o estoque nunca fique inconsistente. Corresponde aos requisitos RF04, RF05 e RF06 e ao UC04."));
add(codigo(snippets.venda, "Trecho 3: função venda_nova (app.py)"));
add(figura("tests/evidencias/ct08_venda_preenchida.png", 400, "Registro de venda: produto e quantidade informados"));
add(figura("tests/evidencias/ct08_estoque_apos_venda.png", 400, "Lista de produtos após a venda: estoque do sabonete reduzido de 20 para 16"));
add(h2("5.4 Funcionalidade complementar: relatório de vendas"));
add(corpo("Além das duas funcionalidades obrigatórias, o sistema também implementa a consulta do relatório diário, que usa um SELECT com junção entre venda, item de venda e produto, filtrando pela data, e soma o total do dia (RF07)."));
add(figura("tests/evidencias/ct10_relatorio.png", 400, "Relatório de vendas do dia com o total"));

// ===== 6 Fase 5
add(h1("6 FASE 5: TESTES"));
add(h2("6.1 Plano de testes"));
add(corpo("Foram definidos dez casos de teste sobre as funcionalidades programadas, incluindo situações de sucesso e de erro. O resultado esperado de cada caso foi escrito antes da execução. Os testes foram executados no sistema em funcionamento, controlando um navegador por script (Playwright), que também gerou os prints de evidência (SOMMERVILLE, 2018). Em todos os casos o resultado obtido foi igual ao esperado."));
add(tabela("Plano e execução dos casos de teste",
  [800, 2500, 2300, 2371, 1100],
  ["ID", "O que foi testado", "Resultado esperado", "Resultado obtido", "Situação"],
  resultados.map((r) => [r.id, r.descricao, r.esperado, r.obtido,
    r.ok ? "Conforme esperado" : "Falhou"])));
add(h2("6.2 Evidências"));
add(corpo("Os prints a seguir mostram a execução de cada caso de teste. A identificação de cada figura indica o caso correspondente."));
// evidências em duas colunas
const cabecalhoEv = [];
const celulasEv = resultados.map((r) => {
  nFig += 1;
  const arq = `tests/evidencias/${r.print}`;
  const [w, h] = sizes[arq];
  const larg = 270;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 100, after: 0 },
      children: [new ImageRun({ type: "png",
        data: fs.readFileSync(path.join(RAIZ, arq)),
        transformation: { width: larg, height: Math.round(larg * h / w) },
        altText: { title: r.id, description: r.descricao, name: `ev${nFig}` } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 40, after: 160 },
      children: [run(`Figura ${nFig}: evidência do ${r.id}`, { size: 18, bold: true })],
    }),
  ];
});
const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const sb = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
const linhasEv = [];
for (let i = 0; i < celulasEv.length; i += 2) {
  linhasEv.push(new TableRow({
    cantSplit: true,
    children: [0, 1].map((k) => new TableCell({
      width: { size: 4535, type: WidthType.DXA },
      borders: sb,
      children: celulasEv[i + k] || [new Paragraph({ children: [] })],
    })),
  }));
}
add(new Table({ width: { size: 9070, type: WidthType.DXA },
  columnWidths: [4535, 4535], rows: linhasEv }));

// ===== 7 Considerações finais
add(h1("7 CONSIDERAÇÕES FINAIS"));
add(corpo("O projeto permitiu percorrer o ciclo completo de desenvolvimento de um sistema: do levantamento de requisitos até um protótipo testado. Na prática, ficou claro como cada etapa alimenta a seguinte. Os requisitos definiram as classes, as classes viraram tabelas, as tabelas sustentaram o código e os requisitos voltaram a aparecer nos casos de teste."));
add(corpo("Entre os aprendizados, destaco três. Primeiro, a importância de guardar o preço unitário no item de venda, para que o histórico de vendas não mude quando o preço do produto for alterado. Segundo, a vantagem de colocar regras de integridade no próprio banco, como preço positivo e código único, além das validações no código. Terceiro, o valor de testar também os caminhos de erro, como venda acima do estoque e cadastro duplicado, que são justamente os casos em que um sistema de estoque costuma falhar."));
add(corpo("Uma dificuldade encontrada durante os testes foi a mensagem de confirmação da venda, que mostrava o valor total com formatação errada. O defeito só ficou evidente porque o teste passou a conferir o texto exato da mensagem, e foi corrigido com o mesmo formatador de moeda usado nas telas. Outra dificuldade foi decidir o tamanho do escopo: itens como nota fiscal e venda com vários produtos no mesmo carrinho foram deixados de fora para manter o projeto viável."));
add(corpo("Como limitações, o protótipo registra um produto por venda, tem um único perfil de usuário e não oferece edição ou exclusão de produtos. Como evolução natural, ficam a venda com vários itens, os perfis de acesso (dono e atendente), o relatório por período e a entrada de mercadoria no estoque."));

// ===== Referências
add(h1("REFERÊNCIAS"));
const ref = (t) => new Paragraph({
  spacing: { line: 276, after: 240 },
  alignment: AlignmentType.LEFT,
  children: runs(t, { size: 24 }),
});
[
  "BOOCH, Grady; RUMBAUGH, James; JACOBSON, Ivar. **UML**: guia do usuário. 2. ed. Rio de Janeiro: Elsevier, 2012.",
  "ELMASRI, Ramez; NAVATHE, Shamkant B. **Sistemas de banco de dados**. 7. ed. São Paulo: Pearson, 2018.",
  "FLASK. **Flask documentation**. Pallets Projects, 2026. Disponível em: https://flask.palletsprojects.com. Acesso em: 26 out. 2026.",
  "SOMMERVILLE, Ian. **Engenharia de software**. 10. ed. São Paulo: Pearson, 2018.",
  "SQLITE. **SQLite documentation**. 2026. Disponível em: https://www.sqlite.org/docs.html. Acesso em: 26 out. 2026.",
].forEach((t) => add(ref(t)));

// ---------------------------------------------------------- capa e sumário
const centro = (t, o = {}) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: o.antes || 0, after: o.depois || 0, line: 360 },
  children: [run(t, { bold: o.negrito, size: o.size || 24 })],
});

const linha = (t, o = {}) => new Paragraph({
  alignment: o.alinhamento || AlignmentType.CENTER,
  spacing: { before: o.antes || 0, after: o.depois || 0, line: o.linha || 360 },
  indent: o.recuo ? { left: o.recuo } : undefined,
  children: [run(t, { bold: o.negrito, size: o.size || 24 })],
});

const capa = [
  linha("UNIVERSIDADE UNOPAR", { negrito: true }),
  linha("SISTEMA DE ENSINO PRESENCIAL CONECTADO"),
  linha("ANÁLISE E DESENVOLVIMENTO DE SISTEMAS"),
  linha("LUIZ GUSTAVO MARQUES", { antes: 2000 }),
  linha("PROJETO INTEGRADO", { negrito: true, size: 28, antes: 2000 }),
  linha("Individual", { negrito: true, size: 26, antes: 120 }),
  linha("Dourados-MS", { antes: 6500, linha: 240 }),
  linha("2026", { linha: 240 }),
];

const subcapa = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER,
    children: [run("Luiz Gustavo Marques")] }),
  linha("PROJETO INTEGRADO", { negrito: true, size: 28, antes: 2200 }),
  linha("Individual", { negrito: true, size: 26, antes: 120 }),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 1600, line: 300 },
    indent: { left: 4536 },
    children: [run("Trabalho de Análise e Desenvolvimento de Sistemas apresentado à Universidade Norte do Paraná, UNOPAR, como requisito parcial para a obtenção de média Semestral.", { size: 20 })],
  }),
  linha("Dourados-MS", { antes: 6700, linha: 240 }),
  linha("2026", { linha: 240 }),
];

const sumarioTitulo = new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 360 },
  children: [run("SUMÁRIO", { bold: true })],
});
const sumario = headings.map((h) => new Paragraph({
  spacing: { after: 100 },
  indent: { left: h.nivel === 2 ? 400 : 0 },
  tabStops: [{ type: TabStopType.RIGHT, position: LARGURA,
    leader: LeaderType.DOT }],
  children: [
    new TextRun({ children: [h.texto, new Tab(), String(tocPages[h.texto] || "0")],
      font: FONTE, size: 24, bold: h.nivel === 1 }),
  ],
}));

fs.writeFileSync(path.join(BUILD, "headings.json"),
  JSON.stringify(headings.map((h) => h.texto), null, 1));

const doc = new Document({
  creator: "Luiz Gustavo Marques",
  lastModifiedBy: "Luiz Gustavo Marques",
  title: "Projeto Integrado: Sistema de Controle de Estoque e Vendas",
  styles: {
    default: { document: { run: { font: FONTE, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        quickFormat: true,
        run: { font: FONTE, size: 24, bold: true },
        paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        quickFormat: true,
        run: { font: FONTE, size: 24, bold: true },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 },
        margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 } } },
      children: [...capa, ...subcapa],
    },
    {
      properties: { page: { size: { width: 11906, height: 16838 },
        margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 } } },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ children: [PageNumber.CURRENT], font: FONTE,
            size: 20 })],
        })] }),
      },
      children: [sumarioTitulo, ...sumario, ...conteudo],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const saida = path.join(BUILD, "Projeto_Integrado_Relatorio.docx");
  fs.writeFileSync(saida, buf);
  console.log("gerado", saida, buf.length, "bytes");
});
