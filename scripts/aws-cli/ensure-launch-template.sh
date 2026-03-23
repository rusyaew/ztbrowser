#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

sg_id="$(ensure_security_group)"
template_id="$(ensure_launch_template "$sg_id")"
printf '%s\n' "$template_id"
