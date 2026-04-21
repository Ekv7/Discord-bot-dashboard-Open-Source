@echo off
cd /d "%~dp0"
echo [Hinweis] Fuer feste Domain (z.B. dash.mynexstudios.com) nutze:
echo          npm run domain:setup  ^&^&  npm run start:domain
echo.
powershell -ExecutionPolicy Bypass -File ".\scripts\start-public.ps1"
if errorlevel 1 (
  echo.
  echo [Fehler] Start fehlgeschlagen. Siehe Meldung oben.
  pause
)
