#Requires -RunAsAdministrator
<#
  Reinstall LibreOffice for OpenMAIC cover PNG generation.
  Run this script in an Administrator PowerShell.
#>
$ErrorActionPreference = "Stop"

Write-Host "=== LibreOffice Reinstall Script ===" -ForegroundColor Cyan

# 1. Kill any running LO processes
Write-Host "[1/4] Killing running LibreOffice processes..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -match "soffice|libreoffice" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Uninstall existing LibreOffice
Write-Host "[2/4] Uninstalling existing LibreOffice..." -ForegroundColor Yellow
$installed = winget list | Select-String "LibreOffice"
if ($installed) {
    winget uninstall --id TheDocumentFoundation.LibreOffice --silent --accept-source-agreements
} else {
    Write-Host "No winget-managed LibreOffice found, skipping uninstall." -ForegroundColor Gray
}
Start-Sleep -Seconds 3

# 3. Clean up corrupted user profile
Write-Host "[3/4] Cleaning corrupted user profiles..." -ForegroundColor Yellow
$loUserDir = "$env:APPDATA\LibreOffice"
if (Test-Path $loUserDir) {
    Remove-Item -Recurse -Force $loUserDir
    Write-Host "Removed $loUserDir" -ForegroundColor Green
}

# 4. Install latest LibreOffice
Write-Host "[4/4] Installing LibreOffice (latest stable)..." -ForegroundColor Yellow
winget install --id TheDocumentFoundation.LibreOffice --silent --accept-package-agreements --accept-source-agreements

# Verify
$loPath = "C:\Program Files\LibreOffice\program\soffice.exe"
if (Test-Path $loPath) {
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "LibreOffice installed at: $loPath" -ForegroundColor Green
    Write-Host "Please restart the OpenMAIC dev server if it is running." -ForegroundColor Cyan
} else {
    Write-Host "=== WARNING ===" -ForegroundColor Red
    Write-Host "soffice.exe not found at expected path. Check winget output above." -ForegroundColor Red
}
