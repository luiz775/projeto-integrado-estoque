"""Executa os casos de teste no sistema em execução e salva evidências.

Uso: python tests/run_tests.py
Gera prints em tests/evidencias/ e o resultado em tests/resultados.json.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVID = os.path.join(RAIZ, "tests", "evidencias")
DB = os.path.join(RAIZ, "tests", "pdv_teste.db")
PORTA = 5055
URL = f"http://127.0.0.1:{PORTA}"
os.makedirs(EVID, exist_ok=True)
if os.path.exists(DB):
    os.remove(DB)

env = dict(os.environ, PDV_DB=DB)
subprocess.run([sys.executable, "-c",
                "import app; app.init_db()"], cwd=RAIZ, env=env, check=True)
servidor = subprocess.Popen(
    [sys.executable, "-c",
     f"import app; app.app.run(port={PORTA})"],
    cwd=RAIZ, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for _ in range(50):
    try:
        urllib.request.urlopen(URL + "/login")
        break
    except Exception:
        time.sleep(0.2)

resultados = []


def registrar(cid, descricao, esperado, obtido, ok, print_nome):
    resultados.append({"id": cid, "descricao": descricao, "esperado": esperado,
                       "obtido": obtido, "ok": ok, "print": print_nome})
    print(("OK   " if ok else "FALHA"), cid, "-", obtido)


def msg(page):
    el = page.query_selector(".msg")
    return el.inner_text().strip() if el else ""


def foto(page, nome):
    page.screenshot(path=os.path.join(EVID, nome + ".png"))
    return nome + ".png"


def preencher(page, campos):
    for nome, valor in campos.items():
        page.fill(f"[name={nome}]", valor)


try:
    with sync_playwright() as pw:
        navegador = pw.chromium.launch()
        ctx = navegador.new_context(viewport={"width": 900, "height": 640})
        page = ctx.new_page()

        # CT01 acesso sem login
        page.goto(URL + "/produtos")
        ok = page.url.endswith("/login")
        registrar("CT01", "Acessar a lista de produtos sem estar logado",
                  "Sistema redireciona para a tela de login",
                  "Redirecionado para /login" if ok else "Acesso indevido: " + page.url,
                  ok, foto(page, "ct01_sem_login"))

        # CT02 login inválido
        preencher(page, {"login": "admin", "senha": "errada"})
        page.click("button[type=submit]")
        m = msg(page)
        ok = "inválidos" in m
        registrar("CT02", "Login com senha incorreta",
                  "Mensagem de erro e permanece no login",
                  f'Mensagem exibida: "{m}"', ok, foto(page, "ct02_login_invalido"))

        # CT03 login válido
        preencher(page, {"login": "admin", "senha": "admin123"})
        page.click("button[type=submit]")
        ok = page.url.endswith("/produtos")
        registrar("CT03", "Login com usuário e senha válidos",
                  "Acesso liberado e lista de produtos exibida",
                  "Lista de produtos exibida" if ok else "Falha no acesso",
                  ok, foto(page, "ct03_login_valido"))

        # CT04 cadastro válido
        page.goto(URL + "/produtos/novo")
        preencher(page, {"nome": "Perfume Floral", "marca": "Aurora", "volume_ml": "100",
                         "codigo": "PER001", "preco": "89,90", "estoque": "20",
                         "estoque_minimo": "5"})
        foto(page, "ct04_cadastro_preenchido")
        page.click("button[type=submit]")
        m = msg(page)
        corpo = page.inner_text("body")
        ok = "cadastrado com sucesso" in m and "Perfume Floral" in corpo
        registrar("CT04", "Cadastrar produto com dados válidos",
                  "Produto salvo e exibido na lista",
                  f'Mensagem "{m}" e produto listado' if ok else "Produto não listado",
                  ok, foto(page, "ct04_cadastro_valido"))

        # cadastra segundo produto com estoque baixo para uso nos testes seguintes
        page.goto(URL + "/produtos/novo")
        preencher(page, {"nome": "Body Splash Baunilha", "marca": "Aurora",
                         "volume_ml": "200", "codigo": "BOD002", "preco": "49,90",
                         "estoque": "3", "estoque_minimo": "5"})
        page.click("button[type=submit]")

        # CT05 cadastro sem nome
        page.goto(URL + "/produtos/novo")
        preencher(page, {"nome": "", "marca": "Aurora", "volume_ml": "50", "codigo": "XYZ999",
                         "preco": "10", "estoque": "1", "estoque_minimo": "5"})
        page.click("button[type=submit]")
        m = msg(page)
        ok = "obrigatórios" in m
        registrar("CT05", "Cadastrar produto sem preencher o nome",
                  "Mensagem de erro e produto não salvo",
                  f'Mensagem exibida: "{m}"', ok, foto(page, "ct05_sem_nome"))

        # CT06 código duplicado
        page.goto(URL + "/produtos/novo")
        preencher(page, {"nome": "Outro Perfume", "marca": "Aurora", "volume_ml": "50",
                         "codigo": "PER001", "preco": "5", "estoque": "1",
                         "estoque_minimo": "5"})
        page.click("button[type=submit]")
        m = msg(page)
        ok = "Já existe" in m
        registrar("CT06", "Cadastrar produto com código já existente",
                  "Sistema impede o cadastro e avisa",
                  f'Mensagem exibida: "{m}"', ok, foto(page, "ct06_codigo_duplicado"))

        # CT07 preço inválido
        page.goto(URL + "/produtos/novo")
        preencher(page, {"nome": "Perfume Teste", "marca": "Aurora", "volume_ml": "50",
                         "codigo": "TST000", "preco": "0", "estoque": "1",
                         "estoque_minimo": "5"})
        page.click("button[type=submit]")
        m = msg(page)
        ok = "maior que zero" in m
        registrar("CT07", "Cadastrar produto com preço igual a zero",
                  "Mensagem de erro e produto não salvo",
                  f'Mensagem exibida: "{m}"', ok, foto(page, "ct07_preco_zero"))

        # CT08 volume inválido
        page.goto(URL + "/produtos/novo")
        preencher(page, {"nome": "Perfume Teste", "marca": "Aurora",
                         "volume_ml": "0", "codigo": "TST001", "preco": "20",
                         "estoque": "1", "estoque_minimo": "5"})
        page.click("button[type=submit]")
        m = msg(page)
        ok = "volume deve ser maior" in m
        registrar("CT08", "Cadastrar perfume com volume igual a zero",
                  "Mensagem de erro e produto não salvo",
                  f'Mensagem exibida: "{m}"', ok, foto(page, "ct08_volume_zero"))

        # CT09 venda válida com baixa de estoque
        page.goto(URL + "/vendas/nova")
        page.select_option("[name=produto_id]", index=2)
        nome_escolhido = page.eval_on_selector(
            "[name=produto_id]", "e => e.options[e.selectedIndex].text")
        page.fill("[name=quantidade]", "4")
        foto(page, "ct09_venda_preenchida")
        page.click("button[type=submit]")
        m = msg(page)
        page.goto(URL + "/produtos")
        linhas = page.inner_text("table")
        # Perfume Floral: 20 - 4 = 16
        ok = ("Venda registrada" in m and "R$ 359,60" in m
              and "Perfume Floral" in linhas and "16" in linhas)
        registrar("CT09", "Registrar venda de 4 unidades (estoque inicial 20)",
                  "Venda salva e estoque do produto reduzido para 16",
                  f'Mensagem "{m}"; estoque atual exibido: 16' if ok
                  else f"Resultado inesperado: {m}",
                  ok, foto(page, "ct09_estoque_apos_venda"))

        # CT10 venda acima do estoque
        page.goto(URL + "/vendas/nova")
        page.select_option("[name=produto_id]", index=1)
        page.fill("[name=quantidade]", "50")
        page.click("button[type=submit]")
        m = msg(page)
        ok = "Estoque insuficiente" in m
        registrar("CT10", "Vender quantidade maior que o estoque disponível",
                  "Sistema impede a venda e informa o estoque disponível",
                  f'Mensagem exibida: "{m}"', ok, foto(page, "ct10_estoque_insuficiente"))

        # CT11 relatório do dia
        page.goto(URL + "/relatorio")
        corpo = page.inner_text("body")
        ok = "Perfume Floral" in corpo and "R$ 359,60" in corpo
        registrar("CT11", "Consultar relatório de vendas do dia",
                  "Venda aparece na lista e total do dia é R$ 359,60",
                  "Venda listada e total R$ 359,60" if ok else "Total divergente",
                  ok, foto(page, "ct11_relatorio"))

        # extras para prints do relatório
        page.goto(URL + "/produtos")
        foto(page, "tela_produtos")
        page.goto(URL + "/produtos/novo")
        foto(page, "tela_cadastro")
        page.goto(URL + "/vendas/nova")
        foto(page, "tela_venda")
        ctx.close()
        ctx2 = navegador.new_context(viewport={"width": 900, "height": 420})
        p2 = ctx2.new_page()
        p2.goto(URL + "/login")
        foto(p2, "tela_login")
        navegador.close()
finally:
    servidor.terminate()

with open(os.path.join(RAIZ, "tests", "resultados.json"), "w", encoding="utf-8") as f:
    json.dump(resultados, f, ensure_ascii=False, indent=2)

falhas = [r for r in resultados if not r["ok"]]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} testes conforme esperado")
sys.exit(1 if falhas else 0)
