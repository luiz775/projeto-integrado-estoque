"""Gera os diagramas UML/MER e os wireframes do relatório como PNG."""
import os
import subprocess

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Rectangle

AQUI = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(AQUI, "img")
os.makedirs(IMG, exist_ok=True)

AZUL = "#1f2a6b"
AZUL_CLARO = "#e8edfb"


# ------------------------------------------------------------ casos de uso
def casos_de_uso():
    fig, ax = plt.subplots(figsize=(9, 6), dpi=160)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 70)
    ax.axis("off")

    ax.add_patch(Rectangle((30, 3), 66, 64, fill=False, ec=AZUL, lw=1.6))
    ax.text(63, 63.5, "Sistema de Controle de Estoque e Vendas", ha="center",
            fontsize=11, fontweight="bold", color=AZUL)

    casos = [
        ("UC01 Fazer login", 63, 54),
        ("UC02 Cadastrar produto", 63, 43),
        ("UC03 Consultar estoque", 63, 32),
        ("UC04 Registrar venda", 63, 21),
        ("UC05 Consultar relatório\nde vendas do dia", 63, 10),
    ]
    for texto, x, y in casos:
        ax.add_patch(Ellipse((x, y), 34, 8.2, fc=AZUL_CLARO, ec=AZUL, lw=1.3))
        ax.text(x, y, texto, ha="center", va="center", fontsize=9.5)

    # ator
    ax_, ay = 12, 33
    ax.add_patch(plt.Circle((ax_, ay + 10), 2.6, fill=False, ec="black", lw=1.5))
    ax.plot([ax_, ax_], [ay + 7.4, ay + 0.5], color="black", lw=1.5)
    ax.plot([ax_ - 5, ax_ + 5], [ay + 5, ay + 5], color="black", lw=1.5)
    ax.plot([ax_, ax_ - 4], [ay + 0.5, ay - 6], color="black", lw=1.5)
    ax.plot([ax_, ax_ + 4], [ay + 0.5, ay - 6], color="black", lw=1.5)
    ax.text(ax_, ay - 13, "Operador\n(dono ou atendente)", ha="center",
            fontsize=9.5, fontweight="bold")

    for _, x, y in casos:
        ax.annotate("", xy=(x - 17, y), xytext=(ax_ + 5, ay + 5),
                    arrowprops=dict(arrowstyle="-", color="#444", lw=1.1))
    fig.savefig(os.path.join(IMG, "casos_de_uso.png"), bbox_inches="tight",
                facecolor="white")
    plt.close(fig)


# --------------------------------------------------------- graphviz helpers
def dot(nome, codigo):
    arq = os.path.join(IMG, nome + ".dot")
    with open(arq, "w", encoding="utf-8") as f:
        f.write(codigo)
    subprocess.run(["dot", "-Tpng", "-Gdpi=170", arq,
                    "-o", os.path.join(IMG, nome + ".png")], check=True)
    os.remove(arq)


def caixa_classe(nome, atributos, metodos):
    attrs = "<BR ALIGN='LEFT'/>".join(atributos) + "<BR ALIGN='LEFT'/>"
    mets = "<BR ALIGN='LEFT'/>".join(metodos) + "<BR ALIGN='LEFT'/>"
    return (f'{nome} [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" '
            f'CELLPADDING="6" BGCOLOR="#e8edfb">'
            f'<TR><TD><B>{nome}</B></TD></TR><HR/>'
            f'<TR><TD ALIGN="LEFT">{attrs}</TD></TR><HR/>'
            f'<TR><TD ALIGN="LEFT">{mets}</TD></TR></TABLE>>];')


def classes():
    codigo = f"""digraph G {{
  rankdir=TB; nodesep=1.4; ranksep=1.0;
  node [shape=plaintext, fontname="Helvetica", fontsize=11];
  edge [fontname="Helvetica", fontsize=10, arrowhead=none];
  {{ rank=same; Usuario; Venda; }}
  {{ rank=same; Produto; ItemVenda; }}
  {caixa_classe("Usuario",
        ["- id: int", "- nome: String", "- login: String", "- senhaHash: String"],
        ["+ autenticar(senha): boolean"])}
  {caixa_classe("Venda",
        ["- id: int", "- dataHora: DateTime", "- total: double"],
        ["+ registrar(): void", "+ calcularTotal(): double"])}
  {caixa_classe("ItemVenda",
        ["- id: int", "- quantidade: int", "- precoUnitario: double"],
        ["+ subtotal(): double"])}
  {caixa_classe("Produto",
        ["- id: int", "- nome: String", "- marca: String", "- volumeMl: int",
         "- codigo: String", "- preco: double", "- estoque: int",
         "- estoqueMinimo: int"],
        ["+ cadastrar(): void", "+ baixarEstoque(qtd): void",
         "+ temEstoque(qtd): boolean", "+ estoqueBaixo(): boolean"])}
  Usuario -> Venda [taillabel="1", headlabel="0..*", label="realiza",
                    labeldistance=2.2];
  Venda -> ItemVenda [taillabel="1", headlabel="1..*", label="possui",
                      labeldistance=2.2, arrowtail=diamond, dir=back];
  ItemVenda -> Produto [taillabel="0..*", headlabel="1", label="refere-se a",
                        labeldistance=2.2];
}}"""
    dot("diagrama_classes", codigo)


def tabela_er(nome, campos):
    linhas = ""
    for campo, tipo in campos:
        negrito = campo.startswith("PK") or campo.startswith("FK")
        linhas += (f'<TR><TD ALIGN="LEFT">{campo}</TD>'
                   f'<TD ALIGN="LEFT">{tipo}</TD></TR>')
    return (f'{nome} [label=<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" '
            f'CELLPADDING="5"><TR><TD COLSPAN="2" BGCOLOR="#1f2a6b">'
            f'<FONT COLOR="white"><B>{nome}</B></FONT></TD></TR>{linhas}'
            f'</TABLE>>];')


def mer():
    codigo = f"""digraph G {{
  rankdir=LR; nodesep=0.7; ranksep=1.3;
  node [shape=plaintext, fontname="Helvetica", fontsize=11];
  edge [fontname="Helvetica", fontsize=10, dir=both,
        arrowtail=tee, arrowhead=crowodot];
  {tabela_er("USUARIO", [("PK id", "INTEGER"), ("nome", "TEXT"),
                         ("login (único)", "TEXT"), ("senha_hash", "TEXT")])}
  {tabela_er("VENDA", [("PK id", "INTEGER"), ("data_hora", "TEXT"),
                       ("total", "REAL"), ("FK usuario_id", "INTEGER")])}
  {tabela_er("ITEM_VENDA", [("PK id", "INTEGER"), ("FK venda_id", "INTEGER"),
                            ("FK produto_id", "INTEGER"),
                            ("quantidade", "INTEGER"),
                            ("preco_unitario", "REAL")])}
  {tabela_er("PRODUTO", [("PK id", "INTEGER"), ("nome", "TEXT"),
                         ("marca", "TEXT"), ("volume_ml", "INTEGER"),
                         ("codigo (único)", "TEXT"), ("preco", "REAL"),
                         ("estoque", "INTEGER"), ("estoque_minimo", "INTEGER")])}
  USUARIO -> VENDA [label=" realiza "];
  VENDA -> ITEM_VENDA [label=" contém "];
  PRODUTO -> ITEM_VENDA [label=" é vendido em "];
}}"""
    dot("mer", codigo)


# ------------------------------------------------------------- sequência
def sequencia():
    fig, ax = plt.subplots(figsize=(11, 8), dpi=160)
    ax.set_xlim(0, 110)
    ax.set_ylim(0, 84)
    ax.axis("off")

    atores = [("Operador", 12), ("Tela de venda\n(navegador)", 40),
              ("Sistema\n(Flask)", 70), ("Banco de dados\n(SQLite)", 98)]
    for nome, x in atores:
        ax.add_patch(FancyBboxPatch((x - 9, 74), 18, 7, boxstyle="round,pad=0.3",
                                    fc=AZUL_CLARO, ec=AZUL, lw=1.3))
        ax.text(x, 77.5, nome, ha="center", va="center", fontsize=9.5,
                fontweight="bold")
        ax.plot([x, x], [74, 3], color="#999", lw=1, ls=(0, (5, 4)))

    X = {n.split("\n")[0]: x for n, x in atores}
    xs = [x for _, x in atores]

    def msg(i, de, para, texto, y, retorno=False):
        x1, x2 = xs[de], xs[para]
        ax.annotate("", xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle="-|>", color="black", lw=1.2,
                                    ls="--" if retorno else "-"))
        ax.text((x1 + x2) / 2, y + 1.1, f"{i}: {texto}", ha="center",
                fontsize=8.8)

    def autochamada(i, x, y, texto):
        ax.plot([x, x + 8, x + 8, x + 0.5], [y, y, y - 4, y - 4],
                color="black", lw=1.2)
        ax.annotate("", xy=(x, y - 4), xytext=(x + 3, y - 4),
                    arrowprops=dict(arrowstyle="-|>", color="black", lw=1.2))
        ax.text(x + 9.5, y - 2, f"{i}: {texto}", ha="left", va="center",
                fontsize=8.8)

    msg(1, 0, 1, "escolhe produto e quantidade", 69)
    msg(2, 1, 2, "POST /vendas/nova", 63)
    msg(3, 2, 3, "SELECT produto WHERE id", 57)
    msg(4, 3, 2, "dados do produto (preço, estoque)", 51, retorno=True)
    autochamada(5, 70, 46, "valida quantidade <= estoque")

    ax.add_patch(Rectangle((6, 9), 98, 32, fill=False, ec="#b04a00", lw=1.1,
                           ls="--"))
    ax.text(8, 38.8, "alt  [estoque suficiente]", fontsize=8.8, color="#b04a00",
            fontweight="bold")
    msg(6, 2, 3, "INSERT venda e item_venda", 34)
    msg(7, 2, 3, "UPDATE produto SET estoque = estoque - qtd", 28)
    msg(8, 3, 2, "COMMIT confirmado", 22, retorno=True)
    msg(9, 2, 1, "mensagem de sucesso com total", 16, retorno=True)
    msg(10, 1, 0, "exibe: Venda registrada. Total R$", 11, retorno=True)
    ax.text(8, 5.2, "[estoque insuficiente] sistema retorna a mensagem de erro "
            "sem gravar nada (passos 6 a 8 não ocorrem)", fontsize=8.3,
            color="#b04a00", style="italic")
    fig.savefig(os.path.join(IMG, "diagrama_sequencia.png"),
                bbox_inches="tight", facecolor="white")
    plt.close(fig)


# -------------------------------------------------------------- wireframes
def wireframe(nome, titulo, elementos, altura=60):
    fig, ax = plt.subplots(figsize=(5.2, altura / 12), dpi=160)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, altura)
    ax.axis("off")
    ax.add_patch(Rectangle((1, 1), 98, altura - 2, fill=False, ec="#444", lw=1.4))
    ax.add_patch(Rectangle((1, altura - 8), 98, 7, fc="#d9d9d9", ec="#444", lw=1.2))
    ax.text(5, altura - 4.5, titulo, va="center", fontsize=9.5, fontweight="bold")
    for tipo, y, texto in elementos:
        if tipo == "campo":
            ax.text(8, y + 4.4, texto, fontsize=8.5)
            ax.add_patch(Rectangle((8, y - 3), 84, 6, fill=False, ec="#444", lw=1))
        elif tipo == "botao":
            ax.add_patch(Rectangle((8, y - 3.5), 34, 7, fc="#bdbdbd", ec="#444", lw=1.2))
            ax.text(25, y, texto, ha="center", va="center", fontsize=9,
                    fontweight="bold")
        elif tipo == "menu":
            ax.text(5, y, texto, fontsize=7.8, va="center")
        elif tipo == "texto":
            ax.text(8, y, texto, fontsize=8.5, va="center")
        elif tipo == "linha":
            ax.plot([8, 92], [y, y], color="#666", lw=0.9)
    fig.savefig(os.path.join(IMG, nome + ".png"), bbox_inches="tight",
                facecolor="white")
    plt.close(fig)


MENU = ("menu", 0, "")


def wireframes():
    wireframe("wf_login", "Tela 1: Login", [
        ("campo", 38, "Login"), ("campo", 24, "Senha"), ("botao", 11, "Entrar"),
    ], altura=56)
    wireframe("wf_cadastro", "Tela 2: Cadastro de produto", [
        ("campo", 124, "Perfume"), ("campo", 111, "Marca"),
        ("campo", 98, "Volume (ml)"), ("campo", 85, "Código"),
        ("campo", 72, "Preço (R$)"), ("campo", 59, "Estoque inicial"),
        ("campo", 46, "Estoque mínimo"), ("botao", 32, "Salvar"),
    ], altura=142)
    wireframe("wf_venda", "Tela 3: Registrar venda", [
        ("campo", 38, "Produto (lista de seleção)"), ("campo", 24, "Quantidade"),
        ("botao", 11, "Confirmar venda"),
    ], altura=56)
    wireframe("wf_lista", "Tela 4: Lista de produtos e estoque", [
        ("texto", 70, "Código   Perfume   Marca     Vol.   Preço       Est.   Situação"),
        ("linha", 66, ""),
        ("texto", 58, "PER001   Floral      Aurora   100    R$ 89,90    16     Normal"),
        ("texto", 48, "BOD002   Splash      Aurora   200    R$ 49,90     3     Baixo"),
        ("texto", 38, "..."),
    ], altura=84)


if __name__ == "__main__":
    casos_de_uso()
    classes()
    mer()
    sequencia()
    wireframes()
    print(sorted(os.listdir(IMG)))
