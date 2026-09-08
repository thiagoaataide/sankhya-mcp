#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$GetRemote = "git@github.com:GRUPO-GET/sankhya-mcp.git"
$Root = "C:\projetos\sankhya-mcp"
$Projects = "C:\projetos"
$WingetCliId = "AgileBits.1Password.CLI"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-WingetPackage([string]$Id, [string]$DisplayName) {
  if (-not (Test-Command "winget")) {
    throw "winget nao esta no PATH. Atualize o App Installer da Microsoft Store e rode de novo."
  }
  Write-Step "winget: $DisplayName"
  $args = @(
    "install",
    "--id", $Id,
    "-e",
    "--accept-package-agreements",
    "--accept-source-agreements",
    "--disable-interactivity"
  )
  & winget @args
  $code = $LASTEXITCODE
  # 0 = ok; -1978335189 / 0x8A15002B = already installed
  if ($code -eq 0 -or $code -eq -1978335189) {
    Refresh-Path
    return
  }
  throw "winget install $Id saiu com codigo $code."
}

function Resolve-OpBin {
  $candidates = @(
    "C:\Program Files\1Password CLI\op.exe",
    (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\op.exe"),
    (Join-Path $env:USERPROFILE "AppData\Local\Microsoft\WinGet\Links\op.exe")
  )
  foreach ($item in $candidates) {
    if ($item -and (Test-Path $item)) {
      return $item
    }
  }
  $where = Get-Command op.exe -ErrorAction SilentlyContinue
  if ($where) {
    return $where.Source
  }
  return $null
}

function Ensure-GitRemote([string]$Name, [string]$Url) {
  $existing = @(& git remote)
  if ($existing -contains $Name) {
    & git remote set-url $Name $Url
  } else {
    & git remote add $Name $Url
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Nao configurei o remote $Name -> $Url"
  }
}

Write-Host "Instalador Sankhya MCP (Windows)" -ForegroundColor Green
Write-Host "Clone: $Root"
Write-Host "Remote: $GetRemote"

if (-not (Test-Command "git")) {
  Write-Step "Git nao encontrado - instalando Git.Git"
  Install-WingetPackage "Git.Git" "Git"
  Refresh-Path
  if (-not (Test-Command "git")) {
    throw "Git instalado, mas ainda nao esta no PATH. Feche o Prompt, abra outro e rode scripts\install.cmd de novo."
  }
}

if (-not (Test-Command "node")) {
  Write-Step "Node.js nao encontrado - instalando OpenJS.NodeJS.LTS"
  Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS"
  Refresh-Path
  if (-not (Test-Command "node")) {
    throw "Node instalado, mas ainda nao esta no PATH. Feche o Prompt, abra outro e rode scripts\install.cmd de novo."
  }
}

$nodeVersion = (& node -v)
if ($nodeVersion -notmatch "^v(2[0-9]|[3-9]\d)\.") {
  Write-Warning "Node $nodeVersion encontrado. O MCP pede 20+. Se falhar o npm install, atualize o Node."
}

Write-Step "1Password CLI (winget $WingetCliId)"
try {
  Install-WingetPackage $WingetCliId "1Password CLI"
} catch {
  Write-Host "Tentando o alias oficial 1password-cli..." -ForegroundColor Yellow
  & winget install 1password-cli --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
    throw "Nao instalei o 1Password CLI. $($_.Exception.Message)"
  }
  Refresh-Path
}

Write-Step "Clone / atualizacao em $Root"
New-Item -ItemType Directory -Force -Path $Projects | Out-Null

if (-not (Test-Path (Join-Path $Root ".git"))) {
  if (Test-Path $Root) {
    throw "$Root existe, mas nao e um clone git. Mova/renomeie a pasta e rode de novo."
  }
  git clone $GetRemote $Root
  if ($LASTEXITCODE -ne 0) {
    throw "git clone falhou. Confira a chave SSH nesta maquina e o acesso a org GRUPO-GET."
  }
  Push-Location $Root
  try {
    Ensure-GitRemote "get" $GetRemote
  } finally {
    Pop-Location
  }
} else {
  Push-Location $Root
  try {
    Ensure-GitRemote "get" $GetRemote
    git fetch get
    if ($LASTEXITCODE -ne 0) {
      throw "git fetch get falhou. Confira a chave SSH e o acesso a GRUPO-GET/sankhya-mcp."
    }
    git pull --ff-only get main
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "git pull --ff-only nao aplicou. O clone local tem commits que nao fast-forward. Continuando com o que ja esta na pasta."
    }
  } finally {
    Pop-Location
  }
}

Write-Step "npm install (compila o MCP)"
Push-Location $Root
try {
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install falhou."
  }
  if (-not (Test-Path (Join-Path $Root "dist\index.js"))) {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build falhou."
    }
  }
} finally {
  Pop-Location
}

$opBin = Resolve-OpBin
if ($opBin) {
  $env:SANKHYA_OP_BIN = $opBin
  Write-Host "op.exe: $opBin"
} else {
  Write-Warning "op.exe nao apareceu no PATH ainda. O launcher scripts\sankhya-mcp.cmd tenta os caminhos padrao. Reinicie o Prompt se o MCP nao achar o CLI."
}

Write-Step "MCP global (Cursor + Codex) e hook do Agent"
$env:SANKHYA_INSTALL_ROOT = $Root
$env:SANKHYA_INSTALL_HOME = $env:USERPROFILE
& node (Join-Path $Root "scripts\install-global.cjs")
if ($LASTEXITCODE -ne 0) {
  throw "install-global.cjs falhou."
}

Write-Host ""
Write-Host "Pronto." -ForegroundColor Green
Write-Host "Ainda falta na maquina:"
Write-Host "  1. App 1Password aberto, vault Sankhya - Clientes visivel"
Write-Host "  2. 1Password > Configuracoes > Developer > Integrar com 1Password CLI"
Write-Host "  3. Reiniciar Cursor e Codex"
Write-Host ""
Write-Host "Teste no Cursor/Codex: lista os perfis Sankhya"
