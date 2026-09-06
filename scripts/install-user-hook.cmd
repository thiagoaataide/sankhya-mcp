@echo off
node "%~dp0install-user-hook.cjs"
if errorlevel 1 exit /b 1
