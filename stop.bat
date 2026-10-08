@echo off
title IT Support Desk - Stop Services
echo Stopping Django backend (port 8000) and Angular frontend (port 4200)...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4200" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul

echo All IT Support Desk services have been stopped.
pause
