#!/usr/bin/env bash
# Smartway x Claude Code - Launcher para Mac/Linux
# Uso: ./smartway-claude.sh [argumentos de claude]
exec node "$(dirname "$0")/smartway-launch.js" "$@"
