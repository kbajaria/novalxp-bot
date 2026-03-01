#!/usr/bin/env bash
set -euo pipefail

# Manual FAQ corpus refresh on a remote bot host.
#
# Usage:
#   scripts/refresh_faq_corpus_remote.sh
#   SSH_TARGET=test-moodle-ec2 scripts/refresh_faq_corpus_remote.sh
#   SINCE="30 days ago" MIN_COUNT=3 scripts/refresh_faq_corpus_remote.sh
#
# Optional env vars:
#   SSH_TARGET   default: dev-moodle-ec2
#   SINCE        default: 14 days ago
#   MIN_COUNT    default: 2
#   MAX_DOCS     default: 200
#   OUTPUT_PATH  default: /opt/novalxp-bot/backend/data/faq_corpus.json
#   SCRIPT_PATH  default: /opt/novalxp-bot/backend/scripts/build_faq_from_logs.js

SSH_TARGET="${SSH_TARGET:-dev-moodle-ec2}"
SINCE="${SINCE:-14 days ago}"
MIN_COUNT="${MIN_COUNT:-2}"
MAX_DOCS="${MAX_DOCS:-200}"
OUTPUT_PATH="${OUTPUT_PATH:-/opt/novalxp-bot/backend/data/faq_corpus.json}"
SCRIPT_PATH="${SCRIPT_PATH:-/opt/novalxp-bot/backend/scripts/build_faq_from_logs.js}"
RETRIES="${RETRIES:-3}"

echo "Refreshing FAQ corpus on ${SSH_TARGET}"
echo "  since: ${SINCE}"
echo "  min_count: ${MIN_COUNT}"
echo "  max_docs: ${MAX_DOCS}"
echo "  output: ${OUTPUT_PATH}"

attempt=1
while true; do
  if ssh "${SSH_TARGET}" "set -euo pipefail; \
    test -f '${SCRIPT_PATH}'; \
    sudo journalctl -u novalxp-bot --since '${SINCE}' --no-pager | \
    node '${SCRIPT_PATH}' --input - --output '${OUTPUT_PATH}' --min-count '${MIN_COUNT}' --max-docs '${MAX_DOCS}'; \
    echo '--- FAQ corpus preview ---'; \
    sudo sed -n '1,120p' '${OUTPUT_PATH}'"; then
    break
  fi

  if [[ "${attempt}" -ge "${RETRIES}" ]]; then
    echo "Failed after ${attempt} attempts." >&2
    exit 1
  fi

  attempt=$((attempt + 1))
  echo "SSH attempt failed. Retrying (${attempt}/${RETRIES})..."
  sleep 2
done

echo "FAQ corpus refresh complete."
