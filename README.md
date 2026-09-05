# Sankhya MCP

Ferramentas MCP para o Cursor falar com o Sankhya Om: autenticar (host do cliente ou Gateway) e executar consultas com o dicionário de dados como contexto.

Este repositório começa pela decisão de desenho, não pelo código. A análise de viabilidade e a recomendação de arquitetura estão em [`docs/analise-viabilidade.md`](docs/analise-viabilidade.md).

## O que foi decidido

- **Um** servidor MCP (`sankhya`), não um MCP de login separado do MCP de query.
- Autenticação **invisível**: login lazy, refresh em sessão morta, token nunca volta na tool.
- Dois adaptadores: `MobileLoginSP` no host direto e OAuth `/authenticate` no Gateway.
- Credenciais no vault **Sankhya – Clientes** (1Password CLI). **Default `direct`.** Gateway só se o item tiver `mode=gateway` **e** `client_id`, `client_secret`, `x_token`.
- Primeira capacidade de negócio: `execute_query` read-only (`DbExplorerSP.executeQuery`, com `ExecQuerySP.execQuery` como fallback de limite).

## Ainda não há servidor rodando

A implementação da fatia v1 (cliente HTTP + tools) fica para o próximo passo, depois desta análise.

## Uso previsto no Cursor

O MCP precisa rodar na máquina que alcança o ERP (VPN / rede do cliente, ou Gateway público). Credenciais vêm do 1Password (CLI `op`); nunca vão no git nem no texto da tool.
