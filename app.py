"""Sistema de Controle de Estoque e Vendas para Perfumaria.

Projeto Integrado (ADS). Flask + SQLite.
Funcionalidades principais:
  RF01 Login
  RF02 Cadastrar produto (grava no banco)
  RF03 Listar produtos e estoque (lê do banco)
  RF04 Registrar venda com baixa automática de estoque
  RF05 Relatório de vendas do dia
"""
import os
import sqlite3
from datetime import datetime
from functools import wraps

from flask import (Flask, flash, g, redirect, render_template, request,
                   session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config["SECRET_KEY"] = "chave-de-desenvolvimento"
app.config["DATABASE"] = os.environ.get("PDV_DB", os.path.join(BASE_DIR, "pdv.db"))


# ---------------------------------------------------------------- banco
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Cria as tabelas e o usuário administrador padrão."""
    db = sqlite3.connect(app.config["DATABASE"])
    with open(os.path.join(BASE_DIR, "schema.sql"), encoding="utf-8") as f:
        db.executescript(f.read())
    existe = db.execute("SELECT 1 FROM usuario WHERE login = 'admin'").fetchone()
    if not existe:
        db.execute(
            "INSERT INTO usuario (nome, login, senha_hash) VALUES (?, ?, ?)",
            ("Administrador", "admin", generate_password_hash("admin123")),
        )
    db.commit()
    db.close()


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "usuario_id" not in session:
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


# ---------------------------------------------------------------- RF01 login
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        usuario = get_db().execute(
            "SELECT * FROM usuario WHERE login = ?",
            (request.form.get("login", "").strip(),),
        ).fetchone()
        if usuario and check_password_hash(usuario["senha_hash"],
                                           request.form.get("senha", "")):
            session["usuario_id"] = usuario["id"]
            session["usuario_nome"] = usuario["nome"]
            return redirect(url_for("produtos"))
        flash("Login ou senha inválidos.", "erro")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
def index():
    return redirect(url_for("produtos"))


# ------------------------------------------- RF02 cadastrar / RF03 listar
@app.route("/produtos/novo", methods=["GET", "POST"])
@login_required
def produto_novo():
    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        marca = request.form.get("marca", "").strip()
        codigo = request.form.get("codigo", "").strip()
        try:
            preco = float(request.form.get("preco", "").replace(",", "."))
            volume = int(request.form.get("volume_ml", ""))
            estoque = int(request.form.get("estoque", "0") or 0)
            minimo = int(request.form.get("estoque_minimo", "5") or 5)
        except ValueError:
            flash("Preço, volume e quantidades devem ser números válidos.", "erro")
            return render_template("produto_form.html"), 400

        if not nome or not marca or not codigo:
            flash("Nome, marca e código são obrigatórios.", "erro")
            return render_template("produto_form.html"), 400
        if preco <= 0:
            flash("O preço deve ser maior que zero.", "erro")
            return render_template("produto_form.html"), 400
        if volume <= 0:
            flash("O volume deve ser maior que zero.", "erro")
            return render_template("produto_form.html"), 400
        if estoque < 0 or minimo < 0:
            flash("O estoque não pode ser negativo.", "erro")
            return render_template("produto_form.html"), 400

        db = get_db()
        try:
            db.execute(
                "INSERT INTO produto (nome, marca, volume_ml, codigo, preco,"
                " estoque, estoque_minimo) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (nome, marca, volume, codigo, preco, estoque, minimo),
            )
            db.commit()
        except sqlite3.IntegrityError:
            flash("Já existe um produto com este código.", "erro")
            return render_template("produto_form.html"), 400
        flash("Produto cadastrado com sucesso.", "ok")
        return redirect(url_for("produtos"))
    return render_template("produto_form.html")


@app.route("/produtos")
@login_required
def produtos():
    lista = get_db().execute(
        "SELECT * FROM produto ORDER BY nome"
    ).fetchall()
    return render_template("produtos.html", produtos=lista)


# ------------------------------------------------------ RF04 registrar venda
@app.route("/vendas/nova", methods=["GET", "POST"])
@login_required
def venda_nova():
    db = get_db()
    lista = db.execute(
        "SELECT * FROM produto ORDER BY nome"
    ).fetchall()

    if request.method == "POST":
        try:
            produto_id = int(request.form.get("produto_id", ""))
            quantidade = int(request.form.get("quantidade", ""))
        except ValueError:
            flash("Selecione um produto e informe uma quantidade válida.", "erro")
            return render_template("venda_form.html", produtos=lista), 400

        if quantidade <= 0:
            flash("A quantidade deve ser maior que zero.", "erro")
            return render_template("venda_form.html", produtos=lista), 400

        produto = db.execute(
            "SELECT * FROM produto WHERE id = ?", (produto_id,)
        ).fetchone()
        if produto is None:
            flash("Produto não encontrado.", "erro")
            return render_template("venda_form.html", produtos=lista), 400
        if quantidade > produto["estoque"]:
            flash(f"Estoque insuficiente. Disponível: {produto['estoque']}.", "erro")
            return render_template("venda_form.html", produtos=lista), 400

        total = round(produto["preco"] * quantidade, 2)
        agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            cur = db.execute(
                "INSERT INTO venda (data_hora, total, usuario_id) VALUES (?, ?, ?)",
                (agora, total, session["usuario_id"]),
            )
            db.execute(
                "INSERT INTO item_venda (venda_id, produto_id, quantidade,"
                " preco_unitario) VALUES (?, ?, ?, ?)",
                (cur.lastrowid, produto_id, quantidade, produto["preco"]),
            )
            db.execute(
                "UPDATE produto SET estoque = estoque - ? WHERE id = ?",
                (quantidade, produto_id),
            )
            db.commit()
        except sqlite3.Error:
            db.rollback()
            flash("Erro ao registrar a venda.", "erro")
            return render_template("venda_form.html", produtos=lista), 500
        flash(f"Venda registrada. Total: {brl(total)}", "ok")
        return redirect(url_for("venda_nova"))
    return render_template("venda_form.html", produtos=lista)


# ------------------------------------------------------ RF05 relatório do dia
@app.route("/relatorio")
@login_required
def relatorio():
    dia = request.args.get("dia") or datetime.now().strftime("%Y-%m-%d")
    db = get_db()
    itens = db.execute(
        """
        SELECT v.id AS venda_id, v.data_hora, p.nome, p.volume_ml, i.quantidade,
               i.preco_unitario, (i.quantidade * i.preco_unitario) AS subtotal
          FROM venda v
          JOIN item_venda i ON i.venda_id = v.id
          JOIN produto p ON p.id = i.produto_id
         WHERE date(v.data_hora) = ?
         ORDER BY v.data_hora DESC
        """,
        (dia,),
    ).fetchall()
    total = sum(i["subtotal"] for i in itens)
    return render_template("relatorio.html", itens=itens, total=total, dia=dia)


@app.template_filter("brl")
def brl(valor):
    texto = f"{valor:,.2f}"
    return "R$ " + texto.replace(",", "X").replace(".", ",").replace("X", ".")


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
