# sankhya-mcp

MCP **local** para o Cursor consultar o Sankhya Om. Um servidor, autenticação invisível, credenciais no vault **Sankhya – Clientes** do 1Password.

Na máquina da equipe o clone vive **sempre** em `C:\projetos\sankhya-mcp`. Remote SSH: `git@github.com:GRUPO-GET/sankhya-mcp.git`.

## Como instalar

Máquina **nova** (Windows). No Prompt:

```bat
winget install -e --id Git.Git
```

Feche o Prompt, abra outro, e rode **uma linha**:

```bat
git clone git@github.com:GRUPO-GET/sankhya-mcp.git C:\projetos\sankhya-mcp && C:\projetos\sankhya-mcp\scripts\install.cmd
```

Se a pasta **já existir**:

```bat
C:\projetos\sankhya-mcp\scripts\install.cmd
```

O `scripts\install.cmd` instala o restante: 1Password CLI (winget), Node LTS se faltar, `npm install`, MCP **global** no Cursor (`%USERPROFILE%\.cursor\mcp.json`) e no Codex (`%USERPROFILE%\.codex\config.toml`), hook e rule do Cursor.

**Antes:** chave SSH com acesso à org **GRUPO-GET**, app **1Password** logado no vault **Sankhya – Clientes**, Cursor e/ou Codex instalados. O script não instala o app 1Password.

**Depois:**

1. 1Password → Configurações → Developer → **Integrar com 1Password CLI**
2. Reiniciar Cursor e Codex
3. No chat: `lista os perfis Sankhya`

Não precisa colar `mcp.json` na mão. Exemplos: [`examples/cursor-mcp.json`](examples/cursor-mcp.json), [`examples/codex-config.toml`](examples/codex-config.toml).

## O que o modelo vê

| Tool | Função |
|------|--------|
| `sankhya_list_profiles` | Títulos dos itens no vault (os nomes de cliente) |
| `sankhya_execute_query` | SELECT no Om. `profile` = título do item; `ambiente` = `producao` \| `teste` \| `treinamento` |
| `sankhya_status` | Vault, perfil padrão, se há sessão. Sem senha e sem token |

Não existe tool de login. Default é **direct** (`MobileLoginSP` no host da URL do Login). Gateway só se o item tiver `mode=gateway` **e** `client_id`, `client_secret`, `x_token`.

Somente SELECT. Default 200 linhas, teto 2000. Notas do 1Password (VPN, RDP, banco) **não** são lidas.

Não junte o ambiente no nome do perfil (`Facilita teste`). Título do item + parâmetro `ambiente`.

Opcional no `env` do MCP (Cursor) ou em `[mcp_servers.sankhya.env]` (Codex):

```json
"SANKHYA_DEFAULT_PROFILE": "Fralia"
```

Se `sankhya_list_profiles` falhar com `spawn op ENOENT`, no Prompt: `where op` e cole o caminho no `mcp.json` / `config.toml`. VPN do cliente quando o Om for host interno / `*.snk.ativy.com`.

Não peça ao Agent para reinstalar o CLI nem para listar o cofre via terminal. A tool certa é `sankhya_list_profiles`.

O Prompt que você abre na mão continua podendo rodar `op` e `curl`; só o Shell do Agent do Cursor é bloqueado pelo hook. O Codex não usa o hook do Cursor — a orientação dele está no `AGENTS.md` do usuário.

## SQL só pelo MCP

Duas camadas, de propósito:

1. **`sankhya_execute_query`** — único caminho de SELECT. Recusa INSERT/UPDATE/DELETE e múltiplos comandos (`src/sql-guard.ts`). Teto de 2000 linhas.
2. **Hook `beforeShellExecution`** — o Agent não consegue contornar com `curl`, `iwr`, `python -c` ou `node -e` contra `service.sbr`, `/mge/`, `DbExplorerSP` ou `api.sankhya.com.br`. Pesquisar o repo (`rg service.sbr`) continua permitido.

Isso **não** bloqueia `sqlplus` / cliente Oracle no banco do cliente (notas de VPN/RDP/Oracle no 1Password nem são lidas). Também não inspeciona o corpo de um `python script.py` genérico: o lock é o comando visível no Shell do Agent + a tool MCP. O Prompt manual do Windows não entra no hook.

## Item no 1Password (Login)

O MCP lê **Produção / Teste / Treinamento** assim (não precisa ter as três):

1. Websites do Login com rótulo `Prod`, `Teste`, `Treinamento` (como o RHB), **ou**
2. Seções com esses nomes e campos `url` + senha (como o Facilita). Campo `Senha SUP` assume usuário `SUP`.

| Campo | Direct | Gateway |
|--------|--------|---------|
| título | `profile` | idem |
| username / password (nível do item) | fallback se a seção não tiver | ignorados no Om |
| URL por ambiente | website rotulado ou `url` na seção | — |
| `mode` | (ausente) | `gateway` |
| `client_id` / `client_secret` / `x_token` | — | os três |

Se pedir `treinamento` e o item só tiver prod/teste, a tool **recusa** e lista o que existe. Default sem `ambiente`: `producao`, ou a única base do cliente.

Notas (VPN, RDP, banco) continuam ignoradas.

## Desenvolvimento

```bat
npm test
npm run typecheck
npm run dev
```

Documentação de desenho: [`docs/analise-viabilidade.md`](docs/analise-viabilidade.md).
