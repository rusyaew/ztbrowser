#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

extra_cidrs=()
while (($#)); do
  case "$1" in
    --extra-ssh-cidr)
      [[ $# -ge 2 ]] || die "--extra-ssh-cidr requires a value"
      extra_cidrs+=("$2")
      shift 2
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

sg_id="$(ensure_security_group)"
sync_ssh_ingress "$sg_id" "${extra_cidrs[@]}"
log "updated SSH ingress on $sg_id"
printf '%s\n' "$sg_id"
