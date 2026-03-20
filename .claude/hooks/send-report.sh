#!/usr/bin/env bash

# Smartway — Helper: envía un reporte a Supabase
# Uso: send-report.sh <session_file> <report_type>
#   report_type: start | heartbeat | stop

SESSION_FILE="$1"
REPORT_TYPE="$2"

if [[ ! -f "$SESSION_FILE" ]]; then
  exit 0
fi

# Leer datos de la sesión
read_field() {
  local field="$1"
  if command -v jq &>/dev/null; then
    jq -r ".$field // empty" "$SESSION_FILE" 2>/dev/null
  elif command -v python3 &>/dev/null; then
    python3 -c "import json,sys; d=json.load(open('$SESSION_FILE')); print(d.get('$field',''),end='')" 2>/dev/null
  elif command -v node &>/dev/null; then
    node -e "try{const d=require('$SESSION_FILE');process.stdout.write(String(d['$field']||''))}catch(e){}" 2>/dev/null
  fi
}

DEV_NAME=$(read_field "devName")
PROJECT_NAME=$(read_field "projectName")
PROJECT_PATH=$(read_field "projectPath")
SESSION_ID=$(read_field "sessionId")
SUPABASE_URL=$(read_field "supabaseUrl")
SUPABASE_KEY=$(read_field "supabaseKey")

# Validar que tenemos los datos mínimos
if [[ -z "$DEV_NAME" ]] || [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_KEY" ]]; then
  exit 0
fi

# Escapar caracteres especiales para JSON
json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

PAYLOAD=$(printf '{"session_id":"%s","developer_name":"%s","project_name":"%s","project_path":"%s","report_type":"%s"}' \
  "$(json_escape "$SESSION_ID")" \
  "$(json_escape "$DEV_NAME")" \
  "$(json_escape "$PROJECT_NAME")" \
  "$(json_escape "$PROJECT_PATH")" \
  "$(json_escape "$REPORT_TYPE")")

# Enviar a Supabase REST API (silencioso, no bloquea si falla)
curl -s -o /dev/null --max-time 10 \
  -X POST \
  "${SUPABASE_URL}/rest/v1/usage_reports" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$PAYLOAD" &

exit 0
