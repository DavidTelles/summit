@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js nao encontrado. Instale em https://nodejs.org ^(versao LTS^) e rode de novo.
    pause
    exit /b 1
)
echo Abrindo Summit em http://localhost:8080
start "" http://localhost:8080
node serve.mjs 8080
pause
