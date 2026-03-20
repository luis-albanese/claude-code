#!/usr/bin/env bash

# Smartway × Claude Code — Hook Stop
# Mata el daemon de reportes y envía el reporte final "stop" a Supabase.

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMPDIR="${TMPDIR:-/tmp}"

PATH_HASH=$(printf '%s' "$PWD" | sha256sum 2>/dev/null | cut -c1-12 || printf '%s' "$PWD$$" | cksum | cut -d' ' -f1)
SESSION_FILE="${TMPDIR}/smartway-session-${PATH_HASH}.json"
PID_FILE="${SESSION_FILE}.pid"

# Enviar reporte de cierre
if [[ -f "$SESSION_FILE" ]]; then
  bash "$HOOKS_DIR/send-report.sh" "$SESSION_FILE" "stop"
fi

# Matar el daemon si está corriendo
if [[ -f "$PID_FILE" ]]; then
  DAEMON_PID=$(cat "$PID_FILE")
  if kill -0 "$DAEMON_PID" 2>/dev/null; then
    kill "$DAEMON_PID" 2>/dev/null
  fi
  rm -f "$PID_FILE"
fi

# Limpiar archivo de sesión
rm -f "$SESSION_FILE"

exit 0
