@echo off
title Servidor del kiosco
cd /d C:\kiosco\servidor
if not exist logs mkdir logs

rem Solo errores y avisos en el log (si no, el archivo crece muy rápido).
set LOG_LEVEL=warn

rem Para entrar desde el celular, sacá "rem" de la línea siguiente:
rem set KIOSCO_HOST=0.0.0.0

:inicio
echo [%date% %time%] Iniciando servidor... >> logs\servidor.log
node src/server.js >> logs\servidor.log 2>&1
echo [%date% %time%] El servidor se detuvo. Reiniciando en 5 segundos... >> logs\servidor.log
timeout /t 5 /nobreak >nul
goto inicio