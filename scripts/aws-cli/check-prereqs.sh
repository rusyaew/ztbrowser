#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

require_cmd "$AWS_BIN"
require_cmd ssh
require_cmd scp
require_cmd curl
require_cmd git
require_cmd python3

if [[ ! -f "$LOCAL_KEY_PATH" ]]; then
  log "local key file not found yet: $LOCAL_KEY_PATH"
fi

if ! aws_cli sts get-caller-identity >/dev/null 2>&1; then
  die "AWS credentials are missing or invalid for profile '$AWS_PROFILE' in region '$AWS_REGION'"
fi

log "local prerequisites and AWS credentials are usable"
