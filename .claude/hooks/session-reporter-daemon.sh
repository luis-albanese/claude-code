#!/usr/bin/env bash

# Smartway — Daemon de reportes periódicos
# Se ejecuta en segundo plano desde session-start-smartway.sh
# Envía un heartbeat a Supabase cada 10 minutos mientras la sesión esté activa.
# Uso: session-reporter-daemon.sh <session_file>

SESSION_FILE="$1"
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVAL=600  # 10 minutos en segundos

while true; do
  sleep "$INTERVAL"

  # Salir si el archivo de sesión fue eliminado (sesión terminada)
  if [[ ! -f "$SESSION_FILE" ]]; then
    break
  fi

  bash "$HOOKS_DIR/send-report.sh" "$SESSION_FILE" "heartbeat"
done
