#!/usr/bin/env bash
# Kit de capturas de pantalla (macOS/Linux/Git-Bash). Uso:
#   ./e2e/capture.sh prueba
#   CAPTURE_THEMES=both ./e2e/capture.sh prueba
#   ./e2e/capture.sh prueba ignacio.perez@tiicr.com <admin_pass>
# Requiere el server de la app arriba (por defecto http://localhost:3000). No commitea credenciales:
# la contrasena entra como argumento en tiempo de ejecucion.
set -euo pipefail

PASS="${1:?Uso: ./e2e/capture.sh <password> [admin_email] [admin_password]}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
export E2E_USUARIO_EMAIL=usuario@credix.local         E2E_USUARIO_PASSWORD="$PASS"
export E2E_OPERACIONES_EMAIL=operaciones@credix.local E2E_OPERACIONES_PASSWORD="$PASS"
export E2E_OPERADOR_EMAIL=operador@credix.local       E2E_OPERADOR_PASSWORD="$PASS"
export E2E_EVOLUCION_EMAIL=evolucion@credix.local     E2E_EVOLUCION_PASSWORD="$PASS"
export E2E_SQUADS_EMAIL=squads@credix.local           E2E_SQUADS_PASSWORD="$PASS"
if [ "${2:-}" ]; then export E2E_ADMIN_EMAIL="$2" E2E_ADMIN_PASSWORD="${3:-}"; fi

echo "Capturando contra $E2E_BASE_URL ..."
npx playwright test --project=screenshots
echo "Listo. Imagenes en e2e/screenshots/<tema>/"
