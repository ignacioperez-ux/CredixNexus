# Kit de capturas de pantalla (Windows PowerShell). Uso:
#   .\e2e\capture.ps1 -Password prueba
#   .\e2e\capture.ps1 -Password prueba -BothThemes
#   .\e2e\capture.ps1 -Password prueba -AdminEmail ignacio.perez@tiicr.com -AdminPassword <pass>
# Requiere el server de la app arriba (por defecto http://localhost:3000). No commitea credenciales:
# la contrasena entra como parametro en tiempo de ejecucion.
param(
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AdminEmail,
  [string]$AdminPassword,
  [switch]$BothThemes
)
$ErrorActionPreference = "Stop"

$env:E2E_BASE_URL = $BaseUrl
$env:E2E_USUARIO_EMAIL     = "usuario@credix.local";     $env:E2E_USUARIO_PASSWORD     = $Password
$env:E2E_OPERACIONES_EMAIL = "operaciones@credix.local"; $env:E2E_OPERACIONES_PASSWORD = $Password
$env:E2E_OPERADOR_EMAIL    = "operador@credix.local";    $env:E2E_OPERADOR_PASSWORD    = $Password
$env:E2E_EVOLUCION_EMAIL   = "evolucion@credix.local";   $env:E2E_EVOLUCION_PASSWORD   = $Password
$env:E2E_SQUADS_EMAIL      = "squads@credix.local";      $env:E2E_SQUADS_PASSWORD      = $Password
if ($AdminEmail) { $env:E2E_ADMIN_EMAIL = $AdminEmail; $env:E2E_ADMIN_PASSWORD = $AdminPassword }
if ($BothThemes) { $env:CAPTURE_THEMES = "both" }

Write-Host "Capturando contra $BaseUrl ..." -ForegroundColor Cyan
npx playwright test --project=screenshots
Write-Host "Listo. Imagenes en e2e\screenshots\<tema>\" -ForegroundColor Green
