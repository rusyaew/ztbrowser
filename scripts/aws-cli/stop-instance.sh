#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

mapfile -t lines < <(find_managed_instance_lines | sed '/^$/d')
if (( ${#lines[@]} == 0 )); then
  die "no managed instance named $INSTANCE_NAME found"
fi
if (( ${#lines[@]} > 1 )); then
  printf '%s\n' "${lines[@]}" >&2
  die "multiple managed instances matched"
fi
read -r instance_id _ <<<"${lines[0]}"
aws_cli ec2 stop-instances --instance-ids "$instance_id" >/dev/null
aws_cli ec2 wait instance-stopped --instance-ids "$instance_id"
log "stopped instance $instance_id"
