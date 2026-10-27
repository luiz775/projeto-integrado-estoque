"""Prepara dados auxiliares para a montagem do relatório (tamanhos e trechos)."""
import json
import os
import re

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(RAIZ, "docs", "build")
os.makedirs(OUT, exist_ok=True)

tam = {}
for pasta in ("docs/img", "tests/evidencias"):
    for nome in os.listdir(os.path.join(RAIZ, pasta)):
        if nome.endswith(".png"):
            w, h = Image.open(os.path.join(RAIZ, pasta, nome)).size
            tam[f"{pasta}/{nome}"] = [w, h]
json.dump(tam, open(os.path.join(OUT, "sizes.json"), "w"), indent=1)

fonte = open(os.path.join(RAIZ, "app.py"), encoding="utf-8").read()


def bloco(nome_funcao):
    ini = fonte.index(f"def {nome_funcao}")
    ini = fonte.rfind("@app.route", 0, ini)
    fim = re.search(r"\n\n\n(?=# ---|@app|def |if __name__)", fonte[ini:])
    return fonte[ini: ini + fim.start()].rstrip()


snippets = {
    "cadastro": bloco("produto_novo"),
    "venda": bloco("venda_nova"),
    "schema": open(os.path.join(RAIZ, "schema.sql"), encoding="utf-8").read().strip(),
}
json.dump(snippets, open(os.path.join(OUT, "snippets.json"), "w"),
          ensure_ascii=False, indent=1)
print({k: len(v.splitlines()) for k, v in snippets.items()})
