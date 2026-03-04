#!/usr/bin/env bash
set -euo pipefail

# Set local_novalxpbot Course Companion template URL in Moodle and purge caches.
#
# Usage:
#   TEMPLATE_URL="https://docs.google.com/document/d/<id>/copy" \
#   SSH_TARGET=dev-moodle-ec2 \
#   /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/set_course_companion_template.sh
#
# Optional env vars:
#   SSH_TARGET               default: dev-moodle-ec2
#   REMOTE_MOODLE_CLI_DIR    default: /var/www/moodle
#   MOODLE_PHP_BIN           default: php
#   SSH_CONNECT_TIMEOUT       default: 20
#   DRY_RUN                  default: false

TEMPLATE_URL="${TEMPLATE_URL:-}"
SSH_TARGET="${SSH_TARGET:-dev-moodle-ec2}"
REMOTE_MOODLE_CLI_DIR="${REMOTE_MOODLE_CLI_DIR:-/var/www/moodle}"
MOODLE_PHP_BIN="${MOODLE_PHP_BIN:-php}"
SSH_CONNECT_TIMEOUT="${SSH_CONNECT_TIMEOUT:-20}"
DRY_RUN="${DRY_RUN:-false}"

if [[ -z "$TEMPLATE_URL" ]]; then
  echo "Missing TEMPLATE_URL (expected Google Docs /copy URL)." >&2
  exit 1
fi

if [[ ! "$TEMPLATE_URL" =~ ^https://docs\.google\.com/document/d/.+/copy(\?.*)?$ ]]; then
  echo "TEMPLATE_URL should be a Google Docs /copy link." >&2
  echo "Got: $TEMPLATE_URL" >&2
  exit 1
fi

set_cfg_cmd="cd '$REMOTE_MOODLE_CLI_DIR' && sudo '$MOODLE_PHP_BIN' admin/cli/cfg.php --component=local_novalxpbot --name=coursecompaniontemplateurl --set='$TEMPLATE_URL'"
purge_cmd="cd '$REMOTE_MOODLE_CLI_DIR' && sudo '$MOODLE_PHP_BIN' admin/cli/purge_caches.php"
read_back_cmd="cd '$REMOTE_MOODLE_CLI_DIR' && sudo '$MOODLE_PHP_BIN' admin/cli/cfg.php --component=local_novalxpbot --name=coursecompaniontemplateurl"

echo "Target host: $SSH_TARGET"
echo "Moodle CLI dir: $REMOTE_MOODLE_CLI_DIR"
echo "Template URL: $TEMPLATE_URL"

SSH_CMD=(
  ssh
  -o BatchMode=yes
  -o ConnectTimeout="$SSH_CONNECT_TIMEOUT"
  -o StrictHostKeyChecking=accept-new
  "$SSH_TARGET"
)

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY_RUN=true, commands not executed."
  echo "Would run:"
  echo "  ${SSH_CMD[*]} \"$set_cfg_cmd\""
  echo "  ${SSH_CMD[*]} \"$purge_cmd\""
  echo "  ${SSH_CMD[*]} \"$read_back_cmd\""
  exit 0
fi

echo "Setting local_novalxpbot/coursecompaniontemplateurl..."
"${SSH_CMD[@]}" "$set_cfg_cmd"

echo "Purging Moodle caches..."
"${SSH_CMD[@]}" "$purge_cmd"

echo "Reading back configured value..."
"${SSH_CMD[@]}" "$read_back_cmd"

echo "Done."
