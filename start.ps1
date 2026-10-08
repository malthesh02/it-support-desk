Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "       IT SUPPORT DESK - SYSTEM LAUNCHER" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check MySQL
Write-Host "[1/4] Checking MySQL Database on port 3306..." -ForegroundColor Yellow
$mysqlUp = $false
try {
    $t = [System.Net.Sockets.TcpClient]::new('127.0.0.1', 3306)
    $t.Close()
    $mysqlUp = $true
} catch {}

if ($mysqlUp) {
    Write-Host "MySQL is active on port 3306." -ForegroundColor Green
} else {
    Write-Host "[WARNING] MySQL does not appear to be running on port 3306! Please start MySQL." -ForegroundColor Red
}

# 2. Kill existing processes on 8000 and 4200
Write-Host "[2/4] Clearing any stale processes on ports 8000 and 4200..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 8000, 4200 -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
}

# 3. Launch Backend
Write-Host "[3/4] Launching Django API Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "cd /d d:\ITSUPPORTDESK\backend && venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000"

# 4. Launch Frontend
Write-Host "[4/4] Launching Angular Frontend on http://localhost:4200 ..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "cd /d d:\ITSUPPORTDESK\frontend && npm start"

# 5. Wait for frontend
Write-Host "Waiting for Angular compilation to finish..." -ForegroundColor Yellow
$timeout = 60
while ($timeout -gt 0) {
    try {
        $t = [System.Net.Sockets.TcpClient]::new('127.0.0.1', 4200)
        $t.Close()
        break
    } catch {
        Start-Sleep -Seconds 1
        $timeout--
    }
}

Write-Host "Angular is ready! Opening browser..." -ForegroundColor Green
Start-Process "http://localhost:4200"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "IT Support Desk is now running!" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:4200" -ForegroundColor White
Write-Host "Backend:  http://127.0.0.1:8000/api/v1/" -ForegroundColor White
Write-Host "Admin:    http://127.0.0.1:8000/admin/" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
