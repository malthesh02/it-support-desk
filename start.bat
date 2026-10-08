@echo off
title IT Support Desk Launcher
echo ===================================================
echo        IT SUPPORT DESK - SYSTEM LAUNCHER
echo ===================================================
echo.

echo [1/4] Checking MySQL Database on port 3306...
powershell -NoProfile -Command "try { $t = [System.Net.Sockets.TcpClient]::new('127.0.0.1', 3306); $t.Close(); exit 0 } catch { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] MySQL does not seem to be running on port 3306!
    echo Please make sure MySQL is started so the backend can connect.
    echo.
) else (
    echo MySQL is active.
)

echo [2/4] Clearing any stale processes on ports 8000 and 4200...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4200" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul

echo [3/4] Launching Django Backend on http://127.0.0.1:8000 ...
start "IT Support - Backend (Django)" cmd /k "cd /d d:\ITSUPPORTDESK\backend && venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000"

echo [4/4] Launching Angular Frontend on http://localhost:4200 ...
start "IT Support - Frontend (Angular)" cmd /k "cd /d d:\ITSUPPORTDESK\frontend && npm start"

echo.
echo Waiting for Angular frontend compilation to finish...
powershell -NoProfile -Command "$timeout = 60; while ($timeout -gt 0) { try { $t = [System.Net.Sockets.TcpClient]::new('127.0.0.1', 4200); $t.Close(); break } catch { Start-Sleep -Seconds 1; $timeout-- } }; if ($timeout -le 0) { Write-Host 'Timeout waiting for frontend.' }"

echo Opening browser to http://localhost:4200 ...
start http://localhost:4200

echo.
echo ===================================================
echo IT Support Desk is now running!
echo Frontend: http://localhost:4200
echo Backend:  http://127.0.0.1:8000/api/v1/
echo Admin:    http://127.0.0.1:8000/admin/
echo ===================================================
echo Keep the backend and frontend terminal windows open.
pause
