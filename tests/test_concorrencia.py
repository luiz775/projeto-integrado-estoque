"""Teste de concorrência: várias vendas simultâneas do mesmo produto.

O estoque inicial é 3 e 8 operadores tentam vender 1 unidade ao mesmo tempo.
Esperado: exatamente 3 vendas gravadas, 5 recusadas e estoque final igual a 0.
"""
import os
import sqlite3
import sys
import tempfile
import threading

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pasta = tempfile.mkdtemp()
os.environ["PDV_DB"] = os.path.join(pasta, "concorrencia.db")
sys.path.insert(0, RAIZ)

import app as sistema  # noqa: E402

ESTOQUE = 3
TENTATIVAS = 8

sistema.init_db()
con = sqlite3.connect(os.environ["PDV_DB"])
con.execute("INSERT INTO produto (nome, marca, volume_ml, codigo, preco, estoque)"
            " VALUES ('Perfume Floral', 'Aurora', 100, 'PER001', 89.90, ?)",
            (ESTOQUE,))
con.commit()
con.close()

barreira = threading.Barrier(TENTATIVAS)
status = [None] * TENTATIVAS


def vender(i):
    cliente = sistema.app.test_client()
    cliente.post("/login", data={"login": "admin", "senha": "admin123"})
    barreira.wait()
    resp = cliente.post("/vendas/nova", data={"produto_id": "1", "quantidade": "1"})
    status[i] = resp.status_code


fios = [threading.Thread(target=vender, args=(i,)) for i in range(TENTATIVAS)]
for f in fios:
    f.start()
for f in fios:
    f.join()

con = sqlite3.connect(os.environ["PDV_DB"])
estoque = con.execute("SELECT estoque FROM produto WHERE id = 1").fetchone()[0]
vendas = con.execute("SELECT COUNT(*) FROM venda").fetchone()[0]
itens = con.execute("SELECT COALESCE(SUM(quantidade), 0) FROM item_venda").fetchone()[0]
con.close()

aceitas = status.count(302)
recusadas = status.count(400)
print(f"aceitas={aceitas} recusadas={recusadas} outras={TENTATIVAS - aceitas - recusadas}")
print(f"vendas gravadas={vendas} unidades vendidas={itens} estoque final={estoque}")

ok = (aceitas == ESTOQUE and recusadas == TENTATIVAS - ESTOQUE
      and vendas == ESTOQUE and itens == ESTOQUE and estoque == 0)
print("OK" if ok else "FALHA")
sys.exit(0 if ok else 1)
