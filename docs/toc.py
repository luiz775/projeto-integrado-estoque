"""Converte o .docx em PDF, descobre a página de cada título e salva toc.json."""
import json
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(RAIZ, "docs", "build")
docx = os.path.join(B, "Projeto_Integrado_Relatorio.docx")
subprocess.run([sys.executable, "/mnt/skills/public/docx/scripts/office/soffice.py",
                "--headless", "--convert-to", "pdf", "--outdir", B, docx],
               check=True, capture_output=True)
pdf = os.path.join(B, "Projeto_Integrado_Relatorio.pdf")
txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True,
                     text=True, check=True).stdout
paginas = txt.split("\f")
titulos = json.load(open(os.path.join(B, "headings.json"), encoding="utf-8"))
res = {}
for t in titulos:
    for i, p in enumerate(paginas[3:], start=4):  # depois da capa, subcapa e sumário
        if any(l.strip() == t for l in p.splitlines()):
            res[t] = i
            break
anterior = {}
if os.path.exists(os.path.join(B, "toc.json")):
    anterior = json.load(open(os.path.join(B, "toc.json"), encoding="utf-8"))
json.dump(res, open(os.path.join(B, "toc.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("páginas totais:", len([p for p in paginas if p.strip()]))
print("faltando:", [t for t in titulos if t not in res])
print("mudou:", anterior != res)
