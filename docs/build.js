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
  if (opcoes.maxH) larguraPx = Math.min(larguraPx, Math.round(opcoes.maxH * w / h));
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
    keepNext: i < arr.length - 1,
    keepLines: true,
    spacing: { after: 0, line: 195 },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
    border: i === 0 ? { top: BORDA } : undefined,
    children: [new TextRun({ text: l === "" ? " " : l, font: "Courier New",
      size: 15 })],
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
add(corpo("O sistema que escolhi é um **Sistema de Controle de Estoque e Vendas para Perfumaria**. Ele é para uma perfumaria pequena, que está começando. Hoje o controle é feito à mão, em caderno. O sistema web substitui isso: cadastra os perfumes com marca e volume, controla a quantidade em estoque, registra as vendas e mostra um relatório do dia."));
add(h2("1.2 Justificativa"));
add(corpo("Quem tem uma loja pequena costuma ter três problemas: vender um perfume que já acabou, não perceber que o estoque está baixo e não saber quanto vendeu no dia. O sistema ajuda nesses três pontos. Escolhi esse tema porque conversei com uma cliente que está montando uma perfumaria e anota tudo à mão, as compras, as vendas e o estoque. Ele também serve bem para este projeto, porque permite usar tudo o que a disciplina pede: requisitos, UML e MER, telas, programação com banco de dados e testes (SOMMERVILLE, 2018)."));
add(corpo("Deixei de fora a nota fiscal, o pagamento online, a integração com marketplaces, o registro de compras de mercadoria e o leitor de código de barras. Esses itens deixariam o projeto grande demais para o tempo que eu tinha, e não são necessários para mostrar o processo do começo ao fim."));
add(h2("1.3 Validação do tema"));
add(corpo("O Passo 0 pede que o tema tenha três características. A Tabela 1 mostra como o sistema cumpre cada uma."));
add(tabela("Validação do tema segundo os critérios do Passo 0",
  [2300, 3000, 3771],
  ["Critério", "Como o sistema atende", "Exemplos no sistema"],
  [
    ["Pelo menos 3 funcionalidades distintas",
      "O sistema realiza mais de três ações diferentes.",
      "Cadastrar perfume, registrar venda com baixa de estoque, consultar estoque e gerar relatório de vendas do dia."],
    ["Pelo menos 1 consulta a banco de dados",
      "O sistema guarda e recupera informações em banco SQLite.",
      "Listar produtos com estoque e consultar as vendas de um dia, usando junção entre venda, item de venda e produto."],
    ["Viável de prototipar no período letivo",
      "Escopo enxuto, com tecnologias já estudadas nas disciplinas.",
      "Aplicação web com Python, Flask e SQLite, sem pagamentos online e sem integrações externas."],
  ]));
add(h2("1.4 Levantamento de informações"));
add(corpo("Fiz o levantamento de duas formas, que estão na Tabela 2. A principal foi a conversa com uma cliente que está montando uma perfumaria e hoje anota tudo à mão: compras, vendas e estoque. Depois dessa conversa, ofereci a ideia de um sistema para facilitar a rotina dela. A outra forma foi olhar um sistema parecido, o Sistema para Perfumarias (SISTEMA PARA PERFUMARIAS, [s. d.]), para ver quais funções esse tipo de sistema tem. Conversar com o cliente e olhar sistemas que já existem são formas conhecidas de levantar requisitos (SOMMERVILLE, 2018)."));
add(tabela("Fontes do levantamento e requisitos gerados",
  [2400, 4271, 2400],
  ["Fonte", "O que foi observado", "Requisitos gerados"],
  [
    ["Conversa com a cliente",
      "Ela anota compras, vendas e estoque à mão e precisa saber o que tem em estoque e o que vendeu.",
      "RF02, RF03, RF04, RF05, RF07"],
    ["Pesquisa de sistema semelhante",
      "O sistema pesquisado atualiza o estoque após as vendas e destaca os produtos em estoque crítico. Também registra entrada de mercadorias, o que ficou como evolução.",
      "RF03, RF05, RF06"],
    ["Conversa e pesquisa",
      "Durante o levantamento surgiu a ideia de usar leitor de código de barras, que ficou como evolução.",
      "Fora do escopo"],
    ["Decisão de projeto",
      "O uso acontece no balcão, muitas vezes pelo celular, e o acesso deve ser protegido por login.",
      "RF01, RNF02, RNF03"],
  ]));

// ===== 2 Fase 1
add(h1("2 FASE 1: ANÁLISE DE REQUISITOS"));
add(corpo("Segundo Sommerville (2018), os requisitos funcionais dizem o que o sistema deve fazer, e os não funcionais dizem como ele deve ser, por exemplo em desempenho, segurança e facilidade de uso. Seguindo isso, levantei oito requisitos funcionais e cinco não funcionais."));
add(h2("2.1 Requisitos funcionais"));
add(tabela("Requisitos funcionais", [900, 2400, 5771],
  ["ID", "Nome", "Descrição"],
  [
    ["RF01", "Autenticar usuário", "O sistema deve permitir o acesso somente mediante login e senha válidos."],
    ["RF02", "Cadastrar produto", "O sistema deve cadastrar perfumes com nome, marca, volume em ml, código único, preço, estoque inicial e estoque mínimo."],
    ["RF03", "Listar produtos e estoque", "O sistema deve listar os produtos com marca, volume, preço e quantidade em estoque, indicando os que estão com estoque baixo."],
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
    ["RNF04", "Integridade dos dados", "O banco deve rejeitar preço ou volume menor ou igual a zero, estoque ou estoque mínimo negativo e código de produto repetido, e a venda deve ser gravada em uma única transação."],
    ["RNF05", "Usabilidade", "As mensagens de erro e de sucesso devem ser claras e em português."],
  ]));
add(h2("2.3 Diagrama de casos de uso"));
add(corpo("O sistema tem um só ator, o **Operador**, que é o dono ou o atendente da perfumaria. Os dois usam as mesmas funções, por isso juntei os dois em um ator só. A Figura 1 mostra os cinco casos de uso (BOOCH; RUMBAUGH; JACOBSON, 2012)."));
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
  ["1. O operador abre a tela de novo produto.", "2. Informa nome, marca, volume, código, preço, estoque inicial e estoque mínimo.", "3. Confirma o cadastro.", "4. O sistema valida os dados, grava o produto e exibe a lista atualizada."],
  "Se algum campo obrigatório estiver vazio, o preço ou o volume for menor ou igual a zero ou o código já existir, o sistema exibe o erro e não grava."));
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
add(corpo("A modelagem parte dos requisitos. Com ela defini as classes do sistema, as tabelas do banco de dados e as mensagens do caso de uso principal. Os diagramas seguem a UML descrita por Booch, Rumbaugh e Jacobson (2012), e o modelo de dados segue o que Elmasri e Navathe (2018) explicam sobre entidades e relacionamentos."));
add(h2("3.1 Diagrama de classes"));
add(corpo("Defini quatro classes. **Usuario** é quem entra no sistema. **Produto** guarda os dados do perfume e do estoque (nome, marca, volume, preço e quantidade). **Venda** é a venda em si. **ItemVenda** liga a venda ao produto vendido e guarda a quantidade e o preço da hora da venda. O preço é copiado para o item para que as vendas antigas não mudem se o preço do produto mudar depois."));
add(figura("docs/img/diagrama_classes.png", 560, "Diagrama de classes"));
add(h2("3.2 Modelo Entidade Relacionamento"));
add(corpo("O MER tem quatro entidades. Um usuário faz várias vendas, uma venda tem um ou mais itens e um produto pode estar em vários itens. Venda e produto têm relação de muitos para muitos, e a entidade ITEM_VENDA resolve isso."));
add(figura("docs/img/mer.png", 560, "Modelo Entidade Relacionamento (MER)"));
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
  ["nome", "TEXT", "Nome do perfume.", "Sim"],
  ["marca", "TEXT", "Marca do perfume.", "Sim"],
  ["volume_ml", "INTEGER", "Volume do frasco em mililitros, maior que zero.", "Sim"],
  ["codigo", "TEXT", "Código do produto, único (pode ser o código de barras).", "Sim"],
  ["preco", "REAL", "Preço de venda, maior que zero.", "Sim"],
  ["estoque", "INTEGER", "Quantidade disponível, não pode ser negativa.", "Sim"],
  ["estoque_minimo", "INTEGER", "Quantidade a partir da qual o produto é marcado como estoque baixo, não pode ser negativa.", "Sim"],
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
add(corpo("Fiz o diagrama de sequência do caso de uso principal, **Registrar venda** (UC04). Nele o sistema busca o produto, confere o estoque, desconta a quantidade com um UPDATE condicional e grava a venda na mesma transação. Se o estoque não for suficiente, o UPDATE não altera nada e a venda é desfeita, sem gravar nada."));
add(figura("docs/img/diagrama_sequencia.png", 580, "Diagrama de sequência do caso de uso Registrar venda"));
add(h2("3.5 Consistência entre os modelos"));
add(corpo("Cada classe do diagrama corresponde a uma entidade do MER e a uma tabela do dicionário de dados, com os mesmos atributos. Os requisitos RF02 e RF03 ficam com a classe Produto. RF04 a RF06 ficam com Venda, ItemVenda e Produto. O RF07 usa uma consulta que junta Venda, ItemVenda e Produto, e o RF01 fica com Usuario. O diagrama de sequência usa os mesmos objetos e a mesma regra do requisito RF06."));

// ===== 4 Fase 3
add(h1("4 FASE 3: PROTOTIPAGEM DE TELAS"));
add(corpo("Antes de programar, desenhei quatro telas simples (wireframes), com base nos requisitos. Elas mostram só os campos e os botões, sem se preocupar com o visual. As telas finais do sistema aparecem nas seções 5 e 6."));
add(h2("4.1 Tela 1: Login"));
add(figura("docs/img/wf_login.png", 270, "Wireframe da tela de login"));
add(corpo("Nessa tela o operador entra no sistema. Ele digita login e senha e clica em Entrar. Atende ao requisito RF01 e ao UC01."));
add(h2("4.2 Tela 2: Cadastro de produto"));
add(figura("docs/img/wf_cadastro.png", 230, "Wireframe da tela de cadastro de produto"));
add(corpo("Nessa tela o operador cadastra um perfume. Ele preenche nome, marca, volume, código, preço, estoque inicial e estoque mínimo, e clica em Salvar. Atende ao requisito RF02 e ao UC02."));
add(h2("4.3 Tela 3: Registrar venda"));
add(figura("docs/img/wf_venda.png", 270, "Wireframe da tela de registro de venda"));
add(corpo("Nessa tela o operador faz a venda. Ele escolhe o produto numa lista, digita a quantidade e confirma. Atende aos requisitos RF04 a RF06 e ao UC04."));
add(h2("4.4 Tela 4: Lista de produtos e estoque"));
add(figura("docs/img/wf_lista.png", 250, "Wireframe da tela de lista de produtos e estoque"));
add(corpo("Essa tela mostra todos os produtos com marca, volume, preço, quantidade e situação, e destaca os que estão com estoque baixo. É a primeira tela depois do login. Atende ao requisito RF03 e ao UC03. O relatório de vendas (UC05) segue o mesmo formato de tabela."));

// ===== 5 Fase 4
add(h1("5 FASE 4: DESENVOLVIMENTO"));
add(h2("5.1 Tecnologias e estrutura"));
add(corpo("Usei **Python 3** com o **Flask** (FLASK, 2026), o banco de dados **SQLite** (SQLITE, 2026) e páginas em HTML com CSS simples. O banco é criado pelo arquivo schema.sql, que tem as quatro tabelas do MER e as regras de validação dentro do próprio banco. O código está no Git, no endereço abaixo."));
add(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 160 },
  children: [run("Repositório no GitHub: https://github.com/luiz775/projeto-integrado-estoque", { bold: true })],
}));
add(corpo("Para rodar, é só instalar as dependências com pip install -r requirements.txt e executar python app.py. Na primeira vez, o sistema cria o banco e um usuário de demonstração (login admin)."));
add(codigo(snippets.schema, "Trecho 1: script do banco de dados (schema.sql)"));

add(h2("5.2 Funcionalidade 1: Cadastro de produto"));
add(corpo("Essa funcionalidade grava um produto novo no banco. Antes de gravar, o sistema confere os dados: nome, marca e código são obrigatórios, preço e volume têm que ser maiores que zero, e as quantidades têm que ser números que não sejam negativos. Se o código já existir, o próprio banco recusa e o usuário vê uma mensagem. Corresponde ao RF02 e ao UC02."));
add(codigo(snippets.cadastro, "Trecho 2: função produto_novo (app.py)"));
nFig += 0;
add(figura("tests/evidencias/ct04_cadastro_preenchido.png", 480, "Cadastro de produto: formulário preenchido", { maxH: 400 }));
add(figura("tests/evidencias/ct04_cadastro_valido.png", 540, "Cadastro de produto: produto gravado e exibido na lista"));

add(h2("5.3 Funcionalidade 2: Registro de venda com baixa de estoque"));
add(corpo("Essa funcionalidade busca o produto no banco e confere o estoque, para mostrar ao operador quanto tem disponível. O estoque é descontado com um UPDATE condicional, que só altera se o estoque for maior ou igual à quantidade vendida. Isso acontece na mesma transação que grava a venda e o item. Assim, se duas vendas do mesmo produto acontecerem ao mesmo tempo, só entram as que cabem no estoque, e as outras recebem a mensagem de estoque insuficiente. Se algo der errado ao gravar, o sistema desfaz tudo (rollback), e o estoque não fica errado. Corresponde aos requisitos RF04, RF05 e RF06 e ao UC04."));
add(codigo(snippets.venda, "Trecho 3: função venda_nova (app.py)"));
add(figura("tests/evidencias/ct09_venda_preenchida.png", 480, "Registro de venda: produto e quantidade informados", { maxH: 400 }));
add(figura("tests/evidencias/ct09_estoque_apos_venda.png", 540, "Lista de produtos após a venda: estoque do perfume reduzido de 20 para 16"));
add(h2("5.4 Funcionalidade complementar: relatório de vendas"));
add(corpo("Além das duas funcionalidades obrigatórias, o sistema tem o relatório de vendas do dia. Ele usa um SELECT que junta venda, item de venda e produto, filtra pela data e soma o total do dia (RF07)."));
add(figura("tests/evidencias/ct11_relatorio.png", 540, "Relatório de vendas do dia com o total"));

// ===== 6 Fase 5
add(h1("6 FASE 5: TESTES"));
add(h2("6.1 Plano de testes"));
add(corpo("Montei onze casos de teste para as funcionalidades programadas, com situações que dão certo e situações de erro. O resultado esperado de cada caso foi escrito antes de executar. Os testes rodam com um script que abre o sistema no navegador (Playwright) e tira os prints de evidência (SOMMERVILLE, 2018). Em todos os casos, o resultado foi igual ao esperado. Também existe um teste de concorrência (arquivo tests/test_concorrencia.py): ele faz oito vendas ao mesmo tempo do mesmo produto, com três unidades em estoque, e confirma que só três são gravadas e que o estoque termina em zero."));
add(tabela("Plano e execução dos casos de teste",
  [800, 2500, 2300, 2371, 1100],
  ["ID", "O que foi testado", "Resultado esperado", "Resultado obtido", "Situação"],
  resultados.map((r) => [r.id, r.descricao, r.esperado, r.obtido,
    r.ok ? "Conforme esperado" : "Falhou"])));
add(h2("6.2 Evidências"));
add(corpo("Os prints abaixo mostram cada caso de teste sendo executado. A legenda de cada figura diz qual é o caso."));
// evidências: uma por linha, em tamanho legível
resultados.forEach((r) => {
  nFig += 1;
  const arq = `tests/evidencias/${r.print}`;
  const [w, h] = sizes[arq];
  const larg = Math.min(540, Math.round(440 * w / h));
  add(new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: true,
    spacing: { before: 140, after: 0 },
    children: [new ImageRun({ type: "png",
      data: fs.readFileSync(path.join(RAIZ, arq)),
      transformation: { width: larg, height: Math.round(larg * h / w) },
      altText: { title: r.id, description: r.descricao, name: `ev${nFig}` } })],
  }));
  add(legenda("Figura", nFig, `evidência do ${r.id}: ${r.descricao}`));
});

// ===== 7 Considerações finais
add(h1("7 CONSIDERAÇÕES FINAIS"));
add(corpo("Com este projeto passei pelo processo completo de fazer um sistema, do levantamento dos requisitos até um protótipo testado. Deu para ver que cada etapa ajuda a próxima: os requisitos definiram as classes, as classes viraram tabelas, as tabelas sustentaram o código e os requisitos voltaram nos casos de teste."));
add(corpo("A parte mais difícil foi desenhar o que a cliente realmente precisa. Ela explica a rotina do jeito do dia a dia, anotando compra, venda e estoque à mão, e foi preciso transformar isso em funções, como cadastrar produto, registrar venda e descontar o estoque. Também foi difícil decidir o que entrava no projeto e o que ficava para depois."));
add(corpo("Aprendi três coisas principais. A primeira é guardar o preço no item da venda, para as vendas antigas não mudarem quando o preço do produto mudar. A segunda é colocar regras também no banco, como preço maior que zero e código único, além de conferir no código. A terceira é testar os casos de erro, como vender mais do que tem em estoque e cadastrar um código repetido. O alerta de estoque baixo, que eu já conhecia de outros sistemas, foi usado aqui para ajudar a não deixar faltar produto."));
add(corpo("Uma dificuldade nos testes foi a mensagem de confirmação da venda, que mostrava o total com a formatação errada. O defeito só apareceu porque o teste passou a conferir o texto exato da mensagem, e foi corrigido usando o mesmo formatador de moeda das telas. Outra dificuldade foi o tamanho do projeto: a nota fiscal e a venda com vários produtos no mesmo carrinho ficaram de fora para dar tempo de terminar."));
add(corpo("Sobre as limitações: o sistema registra um produto por venda, tem um só tipo de usuário, não registra a compra de mercadoria e não deixa editar nem excluir produtos. Se eu fosse refazer, colocaria a entrada de mercadoria e o leitor de código de barras, que apareceu como ideia durante o levantamento. Como próximo passo, o mais útil seria o cliente poder comprar com o próprio cartão pelo site, usando um meio de pagamento online como o Mercado Pago, cuja integração por chave de API eu já conheço. Também ficam a venda com vários itens, os tipos de usuário e o relatório por período."));

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
  "SISTEMA **para perfumarias**. [S. l.]: ERP Clound, [s. d.]. Disponível em: https://www.erpclound.com.br/sistema-para-perfumaria/. Acesso em: 26 out. 2026.",
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
