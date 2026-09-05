# sankhya-mcp

MCP **local** para o Cursor consultar o Sankhya Om. Um servidor, autenticação invisível, credenciais no vault **Sankhya – Clientes** do 1Password.

Este repositório é o projeto. Na máquina da equipe ele deve viver em:

```text
C:\projetos\sankhya-mcp
```

O agente que gerou o código não consegue criar pasta no seu `C:\`. Clone (ou copie) o git para esse caminho.

## O que o modelo vê

| Tool | Função |
|------|--------|
| `sankhya_list_profiles` | Títulos dos itens no vault (os nomes de cliente) |
| `sankhya_execute_query` | Roda um **SELECT**. Loga sozinho. `profile` = título do item (`Fralia`, `Diagno`, …) |
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

```bat
git clone <url-deste-repo> C:\projetos\sankhya-mcp
cd C:\projetos\sankhya-mcp
npm install
npm run build
```

No Cursor: Settings → MCP → adicionar o conteúdo de [`examples/cursor-mcp.json`](examples/cursor-mcp.json) (já aponta para `C:\projetos\sankhya-mcp\scripts\sankhya-mcp.cmd`).

Reinicie o MCP. Na conversa: “lista os perfis Sankhya” e depois “no cliente Fralia, SELECT CODPROD, DESCRPROD FROM TGFPRO”.

Opcional no `env` do MCP:

```json
"SANKHYA_DEFAULT_PROFILE": "Fralia"
```

## Item no 1Password (Login)

| Campo | Direct (hoje, todos) | Gateway (quando existir) |
|--------|----------------------|---------------------------|
| título | nome do perfil | idem |
| username / password | user Om | ignorados |
| URL | `http://host:porta/mge/` | — |
| `mode` | (ausente) | `gateway` |
| `client_id` / `client_secret` / `x_token` | — | os três, senão continua direct e avisa |

## Desenvolvimento

```bat
npm test
npm run typecheck
npm run dev
```

Documentação de desenho: [`docs/analise-viabilidade.md`](docs/analise-viabilidade.md).
