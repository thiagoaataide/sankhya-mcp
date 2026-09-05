@echo off
setlocal
set "PATH=%PATH%;C:\Program Files\1Password CLI"
cd /d "%~dp0\.."
if not exist "dist\index.js" (
  echo sankhya-mcp: rode npm install e npm run build em C:\projetos\sankhya-mcp 1>&2
  exit /b 1
)
node dist\index.js
