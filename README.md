# Sistema de Controle de Estoque e Vendas

Projeto Integrado (ADS). Aplicação web em Python, Flask e SQLite.

## Como executar

    pip install -r requirements.txt
    python app.py

Acesse http://127.0.0.1:5000. Usuário de demonstração: admin / admin123.

## Funcionalidades

Login, cadastro de produto, lista de produtos e estoque, registro de venda com baixa de estoque e relatório de vendas do dia.

## Testes

    pip install playwright && playwright install chromium
    python tests/run_tests.py

Gera os prints em tests/evidencias e o resultado em tests/resultados.json.
