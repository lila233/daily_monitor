# StopMonitor.ps1 - Safely stop Daily Monitor
$conn = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped process on port 3001."
} else {
    Write-Host "No process found on port 3001."
}
