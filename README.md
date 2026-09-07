# sankhya-mcp

MCP **local** para o Cursor consultar o Sankhya Om. Um servidor, autenticação invisível, credenciais no vault **Sankhya – Clientes** do 1Password.

Na máquina da equipe o clone vive **sempre** em:

```text
C:\projetos\sankhya-mcp
```

Remote da empresa (SSH): `git@github.com:GRUPO-GET/sankhya-mcp.git`.

## O que o modelo vê

| Tool | Função |
|------|--------|
| `sankhya_list_profiles` | Títulos dos itens no vault (os nomes de cliente) |
| `sankhya_execute_query` | SELECT no Om. `profile` = título do item; `ambiente` = `producao` \| `teste` \| `treinamento` |
| `sankhya_status` | Vault, perfil padrão, se há sessão. Sem senha e sem token |

Não existe tool de login. Default é **direct** (`MobileLoginSP` no host da URL do Login). Gateway só se o item tiver `mode=gateway` **e** `client_id`, `client_secret`, `x_token`.

Somente SELECT. Default 200 linhas, teto 2000. Notas do 1Password (VPN, RDP, banco) **não** são lidas.

## Pré-requisitos na máquina

1. Node.js 20+
2. 1Password desktop + CLI (`op --version`)
3. App: Configurações → Developer → **Integrar com 1Password CLI**
4. App aberto na bandeja
5. VPN do cliente quando o Om for host interno / `*.snk.ativy.com`

Conferiu o CLI:

```bat
op vault list
op item list --vault tkrys7yhgj64dmo643ovrxa7ie
```

(O ID evita o traço “bonito” do nome do vault.)

## Instalação (Windows)

Precisa de chave SSH na org **GRUPO-GET** (todo mundo já usa). O 1Password **desktop** continua sendo instalado à parte; o script instala o **CLI**.

Primeira vez, no Prompt:

```bat
git clone git@github.com:GRUPO-GET/sankhya-mcp.git C:\projetos\sankhya-mcp && C:\projetos\sankhya-mcp\scripts\install.cmd
```

Se a pasta já existe:

```bat
C:\projetos\sankhya-mcp\scripts\install.cmd
```

O `install.cmd` empacota o restante:

1. Cria `C:\projetos` se faltar e clona/atualiza pelo remote SSH `git@github.com:GRUPO-GET/sankhya-mcp.git` (remote git `get`)
2. Instala **1Password CLI** com winget (`AgileBits.1Password.CLI` / `winget install 1password-cli`)
3. Instala Git e Node.js LTS via winget se não estiverem no PATH
4. `npm install` (compila `dist\index.js`)
5. Grava o MCP **global**:
   - Cursor: `%USERPROFILE%\.cursor\mcp.json`
   - Codex: `%USERPROFILE%\.codex\config.toml` (CLI, extensão e app leem o mesmo arquivo)
6. Hook e rule globais do Cursor (`beforeShellExecution` + `~\.cursor\rules\sankhya-mcp.mdc`)
7. Bloco curto em `%USERPROFILE%\.codex\AGENTS.md` para o Codex também ir só nas tools MCP

Reinicie **Cursor** e **Codex**. Na conversa: “lista os perfis Sankhya” e depois “no cliente Facilita Telecom, ambiente teste, SELECT CODPROD, DESCRPROD FROM TGFPRO”.

Não junte o ambiente no nome do perfil (`Facilita teste`). Título do item + parâmetro `ambiente`.

Opcional no `env` do MCP (Cursor) ou em `[mcp_servers.sankhya.env]` (Codex):

```json
"SANKHYA_DEFAULT_PROFILE": "Fralia"
```

O instalador tenta gravar `SANKHYA_OP_BIN` se achar o `op.exe`. Se `sankhya_list_profiles` ainda falhar com `spawn op ENOENT`, no Prompt: `where op` e cole o caminho no `mcp.json` / `config.toml`.

Não peça ao Agent para reinstalar o CLI nem para listar o cofre via terminal. A tool certa é `sankhya_list_profiles`.

Exemplos manuais: [`examples/cursor-mcp.json`](examples/cursor-mcp.json), [`examples/codex-config.toml`](examples/codex-config.toml).

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
