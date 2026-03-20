#!/usr/bin/env bash

# Smartway × Claude Code — Hook SessionStart
# 1. Muestra el banner de marca
# 2. Detecta el proyecto
# 3. Crea el archivo de sesión con todos los datos
# 4. Inicia el daemon de reportes en segundo plano
# 5. Envía el reporte inicial "start" a Supabase

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMPDIR="${TMPDIR:-/tmp}"

# ── Colores ──────────────────────────────────────────────────────────────────
RESET="\033[0m"; BOLD="\033[1m"
CLAUDE_COLOR="\033[38;5;208m"
SMARTWAY_COLOR="\033[38;5;39m"
BORDER="\033[38;5;244m"
GREEN="\033[38;5;82m"
YELLOW="\033[38;5;220m"

# ── Banner ───────────────────────────────────────────────────────────────────
printf >&2 "\n"
printf >&2 "  ${BORDER}╭──────────────────────────────────────────────────╮${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}                                                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}   ${CLAUDE_COLOR}${BOLD}◆ Claude Code${RESET}   ${BORDER}×${RESET}   ${SMARTWAY_COLOR}${BOLD}Smartway${RESET}                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}                        ${BORDER}by Luis Albanese${RESET}             ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}                                                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}   ${BORDER}AI-powered development assistant${RESET}             ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}                                                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}╰──────────────────────────────────────────────────╯${RESET}\n"
printf >&2 "\n"

# ── Leer nombre del desarrollador ────────────────────────────────────────────
# El launcher ya lo leyó/preguntó y lo pasa como variable de entorno.
# SMARTWAY_DEV_NAME es heredada por todos los hooks.
DEV_NAME="${SMARTWAY_DEV_NAME:-}"

if [[ -z "$DEV_NAME" ]]; then
  # Fallback: si el hook se ejecuta sin el launcher (dev testing), leer del archivo local
  PROJECT_LOCAL_CONFIG="$PWD/.smartway.local.json"
  if [[ -f "$PROJECT_LOCAL_CONFIG" ]]; then
    if command -v jq &>/dev/null; then
      DEV_NAME=$(jq -r '.developerName // empty' "$PROJECT_LOCAL_CONFIG" 2>/dev/null)
    elif command -v python3 &>/dev/null; then
      DEV_NAME=$(python3 -c "import json; d=json.load(open('$PROJECT_LOCAL_CONFIG')); print(d.get('developerName',''),end='')" 2>/dev/null)
    fi
  fi
fi

if [[ -z "$DEV_NAME" ]]; then
  printf >&2 "  ${YELLOW}⚠ Advertencia: no se pudo identificar al desarrollador.${RESET}\n"
  printf >&2 "  ${YELLOW}  Usá el launcher smartway-claude.sh para sesiones trackeadas.${RESET}\n\n"
  exit 0
fi

# ── Detectar nombre del proyecto ─────────────────────────────────────────────
PROJECT_NAME=""
PROJECT_PATH="$PWD"

# 1. package.json (Node/JS/TS)
if [[ -f "$PWD/package.json" ]]; then
  if command -v jq &>/dev/null; then
    PROJECT_NAME=$(jq -r '.name // empty' "$PWD/package.json" 2>/dev/null)
  elif command -v node &>/dev/null; then
    PROJECT_NAME=$(node -e "try{const p=require('./package.json');process.stdout.write(p.name||'')}catch(e){}" 2>/dev/null)
  fi
fi

# 2. pyproject.toml (Python)
if [[ -z "$PROJECT_NAME" ]] && [[ -f "$PWD/pyproject.toml" ]]; then
  PROJECT_NAME=$(grep -m1 '^name' "$PWD/pyproject.toml" 2>/dev/null | sed 's/name\s*=\s*["\x27]\(.*\)["\x27]/\1/' | tr -d ' ')
fi

# 3. composer.json (PHP)
if [[ -z "$PROJECT_NAME" ]] && [[ -f "$PWD/composer.json" ]]; then
  if command -v jq &>/dev/null; then
    PROJECT_NAME=$(jq -r '.name // empty' "$PWD/composer.json" 2>/dev/null)
  fi
fi

# 4. Cargo.toml (Rust)
if [[ -z "$PROJECT_NAME" ]] && [[ -f "$PWD/Cargo.toml" ]]; then
  PROJECT_NAME=$(grep -m1 '^name' "$PWD/Cargo.toml" 2>/dev/null | sed 's/name\s*=\s*["\x27]\(.*\)["\x27]/\1/' | tr -d ' ')
fi

# 5. go.mod (Go)
if [[ -z "$PROJECT_NAME" ]] && [[ -f "$PWD/go.mod" ]]; then
  PROJECT_NAME=$(head -1 "$PWD/go.mod" 2>/dev/null | awk '{print $2}' | xargs basename 2>/dev/null)
fi

# 6. Fallback: nombre de la carpeta actual
if [[ -z "$PROJECT_NAME" ]]; then
  PROJECT_NAME=$(basename "$PWD")
fi

# ── Leer config de Supabase (inyectada por el launcher como env vars) ─────────
SUPABASE_URL="${SMARTWAY_SUPABASE_URL:-}"
SUPABASE_KEY="${SMARTWAY_SUPABASE_KEY:-}"

if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_KEY" ]]; then
  printf >&2 "  ${YELLOW}⚠ Supabase no configurado — los reportes no se enviarán.${RESET}\n\n"
  exit 0
fi

# ── Crear archivo de sesión ───────────────────────────────────────────────────
SESSION_ID="$(date +%s%N 2>/dev/null || date +%s)-$$"
# Hash del path para identificar la sesión de este proyecto
PATH_HASH=$(printf '%s' "$PWD" | sha256sum 2>/dev/null | cut -c1-12 || printf '%s' "$PWD$$" | cksum | cut -d' ' -f1)
SESSION_FILE="${TMPDIR}/smartway-session-${PATH_HASH}.json"
PID_FILE="${SESSION_FILE}.pid"

# Escribir datos de sesión
cat > "$SESSION_FILE" << EOF
{
  "sessionId": "${SESSION_ID}",
  "devName": "${DEV_NAME}",
  "projectName": "${PROJECT_NAME}",
  "projectPath": "${PROJECT_PATH}",
  "supabaseUrl": "${SUPABASE_URL}",
  "supabaseKey": "${SUPABASE_KEY}"
}
EOF

# ── Iniciar daemon de reportes en segundo plano ───────────────────────────────
bash "$HOOKS_DIR/session-reporter-daemon.sh" "$SESSION_FILE" &
DAEMON_PID=$!
echo "$DAEMON_PID" > "$PID_FILE"

# ── Enviar reporte de inicio ──────────────────────────────────────────────────
bash "$HOOKS_DIR/send-report.sh" "$SESSION_FILE" "start"

printf >&2 "  ${GREEN}✓ Sesión iniciada${RESET} — ${BOLD}${DEV_NAME}${RESET} en ${BOLD}${PROJECT_NAME}${RESET}\n\n"

exit 0
