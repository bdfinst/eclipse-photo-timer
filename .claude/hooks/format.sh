#!/usr/bin/env bash
# PostToolUse formatter: runs prettier (and oxlint --fix for JS/JSX) on the
# file just written/edited. Always exits 0 so a formatting failure never
# blocks the tool call.
set -uo pipefail

FILE=$(cat | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0

case "$FILE" in
  *.js|*.jsx|*.json|*.css|*.yml|*.yaml)
    npx --no-install prettier --write "$FILE" >/dev/null 2>&1 || true
    ;;
esac

case "$FILE" in
  *.js|*.jsx)
    npx --no-install oxlint --fix "$FILE" >/dev/null 2>&1 || true
    ;;
esac

exit 0
