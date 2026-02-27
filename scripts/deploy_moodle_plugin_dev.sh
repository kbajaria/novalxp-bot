#!/usr/bin/env bash
set -euo pipefail

# Deploy local_novalxpbot plugin to a remote Moodle dev instance over SSH.
#
# Required env vars:
#   EC2_HOST                  e.g. ec2-1-2-3-4.eu-west-2.compute.amazonaws.com
#   EC2_USER                  e.g. ec2-user
#   REMOTE_MOODLE_DIR         e.g. /var/www/moodle
#   REMOTE_MOODLE_CLI_DIR     e.g. /var/www/moodle (if CLI scripts are outside web root)
#
# Optional env vars:
#   EC2_PORT                  default: 22
#   EC2_SSH_KEY               path to private key
#   PLUGIN_SRC_DIR            default: <repo>/moodle/local_novalxpbot
#   REMOTE_PLUGIN_DIR         default: <REMOTE_MOODLE_DIR>/local/local_novalxpbot
#   RUN_UPGRADE               default: true
#   RUN_PURGE                 default: true
#   MOODLE_PHP_BIN            default: php
#   DRY_RUN                   default: false
#   USE_SUDO_REMOTE           default: true

EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-}"
REMOTE_MOODLE_DIR="${REMOTE_MOODLE_DIR:-}"
REMOTE_MOODLE_CLI_DIR="${REMOTE_MOODLE_CLI_DIR:-$REMOTE_MOODLE_DIR}"
EC2_PORT="${EC2_PORT:-22}"
EC2_SSH_KEY="${EC2_SSH_KEY:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC_DIR="${PLUGIN_SRC_DIR:-$REPO_ROOT/moodle/local_novalxpbot}"
REMOTE_PLUGIN_DIR="${REMOTE_PLUGIN_DIR:-$REMOTE_MOODLE_DIR/local/local_novalxpbot}"

RUN_UPGRADE="${RUN_UPGRADE:-true}"
RUN_PURGE="${RUN_PURGE:-true}"
MOODLE_PHP_BIN="${MOODLE_PHP_BIN:-php}"
DRY_RUN="${DRY_RUN:-false}"
USE_SUDO_REMOTE="${USE_SUDO_REMOTE:-true}"

if [[ -z "$EC2_HOST" || -z "$EC2_USER" || -z "$REMOTE_MOODLE_DIR" ]]; then
  echo "Missing required env vars. Required: EC2_HOST, EC2_USER, REMOTE_MOODLE_DIR" >&2
  exit 1
fi

if [[ ! -d "$PLUGIN_SRC_DIR" ]]; then
  echo "Plugin source dir not found: $PLUGIN_SRC_DIR" >&2
  exit 1
fi

SSH_OPTS=(-p "$EC2_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$EC2_SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$EC2_SSH_KEY")
fi

RSYNC_OPTS=(-az --delete --exclude ".DS_Store")
if [[ "$DRY_RUN" == "true" ]]; then
  RSYNC_OPTS+=(--dry-run)
fi

echo "Deploying plugin from: $PLUGIN_SRC_DIR"
echo "Remote target: ${EC2_USER}@${EC2_HOST}:${REMOTE_PLUGIN_DIR}"
echo "Dry run: $DRY_RUN"
echo "Use sudo remote: $USE_SUDO_REMOTE"

REMOTE_PREFIX=""
if [[ "$USE_SUDO_REMOTE" == "true" ]]; then
  REMOTE_PREFIX="sudo "
fi

ssh "${SSH_OPTS[@]}" "${EC2_USER}@${EC2_HOST}" "${REMOTE_PREFIX}mkdir -p '${REMOTE_PLUGIN_DIR}'"

RSYNC_PATH_OPT=()
if [[ "$USE_SUDO_REMOTE" == "true" ]]; then
  RSYNC_PATH_OPT=(--rsync-path="sudo rsync")
fi

rsync "${RSYNC_OPTS[@]}" "${RSYNC_PATH_OPT[@]}" -e "ssh ${SSH_OPTS[*]}" \
  "${PLUGIN_SRC_DIR}/" "${EC2_USER}@${EC2_HOST}:${REMOTE_PLUGIN_DIR}/"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run complete. No remote changes were applied."
  exit 0
fi

REMOTE_CMDS=()
if [[ "$RUN_UPGRADE" == "true" ]]; then
  REMOTE_CMDS+=("cd '${REMOTE_MOODLE_CLI_DIR}' && '${MOODLE_PHP_BIN}' admin/cli/upgrade.php --non-interactive")
fi
if [[ "$RUN_PURGE" == "true" ]]; then
  REMOTE_CMDS+=("cd '${REMOTE_MOODLE_CLI_DIR}' && '${MOODLE_PHP_BIN}' admin/cli/purge_caches.php")
fi

if [[ "${#REMOTE_CMDS[@]}" -gt 0 ]]; then
  echo "Running remote Moodle maintenance commands..."
  for cmd in "${REMOTE_CMDS[@]}"; do
    if [[ "$USE_SUDO_REMOTE" == "true" ]]; then
      ssh "${SSH_OPTS[@]}" "${EC2_USER}@${EC2_HOST}" "sudo bash -lc \"$cmd\""
    else
      ssh "${SSH_OPTS[@]}" "${EC2_USER}@${EC2_HOST}" "$cmd"
    fi
  done
fi

echo "Deployment complete."
