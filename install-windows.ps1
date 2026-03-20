# Smartway x Claude Code - Instalador para Windows
# Ejecutar con: powershell -ExecutionPolicy Bypass -File install-windows.ps1

$toolsDir = "C:\tools"
$exeSrc   = Join-Path $PSScriptRoot "dist\claude-smartway-windows.exe"
$exeDest  = Join-Path $toolsDir "claude-smartway.exe"

# 1. Crear C:\tools si no existe
if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    Write-Host "  Carpeta C:\tools creada." -ForegroundColor Green
}

# 2. Copiar el ejecutable
if (-not (Test-Path $exeSrc)) {
    Write-Host "  Error: no se encontro $exeSrc" -ForegroundColor Red
    Write-Host "  Compila primero con: cd launcher; node build.js" -ForegroundColor Yellow
    exit 1
}
Copy-Item $exeSrc $exeDest -Force
Write-Host "  Ejecutable instalado en $exeDest" -ForegroundColor Green

# 3. Agregar C:\tools al PATH del usuario (registro de Windows)
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*C:\tools*") {
    [Environment]::SetEnvironmentVariable("Path", $currentPath + ";C:\tools", "User")
    Write-Host "  C:\tools agregado al PATH (registro)." -ForegroundColor Green
} else {
    Write-Host "  C:\tools ya estaba en el PATH (registro)." -ForegroundColor Cyan
}

# 4. Agregar C:\tools al perfil de PowerShell para que persista en cada sesion
$profileLine = '$env:Path += ";C:\tools"'
if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Force -Path $PROFILE | Out-Null
    Write-Host "  Perfil de PowerShell creado." -ForegroundColor Green
}
$profileContent = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
if ((-not $profileContent) -or ($profileContent -notlike "*C:\tools*")) {
    Add-Content -Path $PROFILE -Value "`n# Smartway claude-smartway`n$profileLine"
    Write-Host "  C:\tools agregado al perfil de PowerShell." -ForegroundColor Green
} else {
    Write-Host "  C:\tools ya estaba en el perfil de PowerShell." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  Instalacion completada." -ForegroundColor Green
Write-Host "  Abri una nueva terminal y ejecuta: claude-smartway" -ForegroundColor Cyan
Write-Host ""
