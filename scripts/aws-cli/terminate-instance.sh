#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

instance_id="${1:-}"
if [[ -z "$instance_id" ]]; then
  mapfile -t lines < <(find_managed_instance_lines | sed '/^$/d')
  if (( ${#lines[@]} == 0 )); then
    die "no managed instance named $INSTANCE_NAME found"
  fi
  if (( ${#lines[@]} > 1 )); then
    printf '%s\n' "${lines[@]}" >&2
    die "multiple managed instances matched"
  fi
  read -r instance_id _ <<<"${lines[0]}"
fi
aws_cli ec2 terminate-instances --instance-ids "$instance_id" >/dev/null
aws_cli ec2 wait instance-terminated --instance-ids "$instance_id"
log "terminated instance $instance_id"
