# setup-cert.ps1
# Instala cert.pem como certificado raiz confiable en Windows.
# Esto resuelve el problema de pantalla negra en OBS Browser Source,
# que rechaza certificados autofirmados por defecto.

$certPath = Join-Path $PSScriptRoot "cert.pem"

if (-not (Test-Path $certPath)) {
    Write-Host ""
    Write-Host "  No se encontro cert.pem." -ForegroundColor Red
    Write-Host "  Ejecuta primero:  npm run gen-cert" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  Instalando cert.pem como raiz confiable en Windows..." -ForegroundColor Cyan

$storeRoot = "Root"

try {
    certutil -addstore -f $storeRoot $certPath | Out-Null
    Write-Host ""
    Write-Host "  Certificado instalado correctamente." -ForegroundColor Green
    Write-Host "  OBS ahora debe cargar viewer.html sin pantalla negra." -ForegroundColor Green
    Write-Host ""
    Write-Host "  NOTA: Si cambias de red WiFi o vuelves a generar el cert," -ForegroundColor DarkGray
    Write-Host "        vuelve a ejecutar:  npm run setup-cert" -ForegroundColor DarkGray
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "  Error al instalar el certificado." -ForegroundColor Red
    Write-Host "  Asegurate de tener permisos de administrador." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
