#!/usr/bin/env bash

# Smartway × Claude Code — Session Start Branding Hook
# Displays a branded banner in the terminal at the start of every session.

# ANSI color codes
RESET="\033[0m"
BOLD="\033[1m"

# Claude Code orange/coral
CLAUDE_COLOR="\033[38;5;208m"

# Smartway blue
SMARTWAY_COLOR="\033[38;5;39m"

# Border color (dim white)
BORDER="\033[38;5;244m"

# Print banner to stderr (visible to user in terminal)
cat >&2 << 'BANNER_EOF'

BANNER_EOF

printf >&2 "  ${BORDER}╭──────────────────────────────────────────────────╮${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}                                                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}   ${CLAUDE_COLOR}${BOLD}◆ Claude Code${RESET}   ${BORDER}×${RESET}   ${SMARTWAY_COLOR}${BOLD}Smartway${RESET}                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}                                                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}   ${BORDER}AI-powered development assistant${RESET}             ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}│${RESET}                                                  ${BORDER}│${RESET}\n"
printf >&2 "  ${BORDER}╰──────────────────────────────────────────────────╯${RESET}\n"
printf >&2 "\n"

# Exit 0: hook runs without blocking or injecting additional context
exit 0
