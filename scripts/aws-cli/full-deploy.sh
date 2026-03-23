#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

usage() {
  cat <<USAGE
Usage: $0 --release-tag <tag> [--extra-ssh-cidr <cidr>] [--pause]

Provision or reuse the managed Nitro parent instance, deploy a canonical enclave release,
verify the public HTTP surface, then clean up the compute resource.

Cleanup policy:
- default: terminate the instance after verification
- --pause: stop the instance instead of terminating it
USAGE
}

release_tag=""
pause_after_verify=0
extra_cidrs=()
remote_ref="$REMOTE_REF"
while (($#)); do
  case "$1" in
    --release-tag)
      release_tag="$2"
      shift 2
      ;;
    --extra-ssh-cidr)
      extra_cidrs+=("$2")
      shift 2
      ;;
    --pause)
      pause_after_verify=1
      shift
      ;;
    --remote-ref)
      remote_ref="$2"
      shift 2
      ;;
    *)
      usage
      die "unknown argument: $1"
      ;;
  esac
done

[[ -n "$release_tag" ]] || { usage; die "--release-tag is required"; }

sync_args=()
for cidr in "${extra_cidrs[@]}"; do
  sync_args+=(--extra-ssh-cidr "$cidr")
done

"$ROOT_DIR/scripts/aws-cli/check-prereqs.sh"
"$ROOT_DIR/scripts/aws-cli/ensure-keypair.sh" >/dev/null
"$ROOT_DIR/scripts/aws-cli/ensure-security-group.sh" >/dev/null
"$ROOT_DIR/scripts/aws-cli/sync-ssh-ip.sh" "${sync_args[@]}"
"$ROOT_DIR/scripts/aws-cli/ensure-launch-template.sh" >/dev/null
instance_json="$("$ROOT_DIR/scripts/aws-cli/ensure-instance.sh")"
instance_id="$(printf '%s' "$instance_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["instance_id"])')"
host="$(printf '%s' "$instance_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["public_ip"])')"

cleanup_mode="terminate"
if (( pause_after_verify == 1 )); then
  cleanup_mode="stop"
fi

cleanup() {
  if [[ -z "${instance_id:-}" ]]; then
    return 0
  fi
  if [[ "$cleanup_mode" == "stop" ]]; then
    log "stopping instance $instance_id because --pause was requested"
    aws_cli ec2 stop-instances --instance-ids "$instance_id" >/dev/null || true
    aws_cli ec2 wait instance-stopped --instance-ids "$instance_id" || true
  else
    log "terminating instance $instance_id by default after verification"
    aws_cli ec2 terminate-instances --instance-ids "$instance_id" >/dev/null || true
    aws_cli ec2 wait instance-terminated --instance-ids "$instance_id" || true
  fi
}
trap cleanup EXIT

"$ROOT_DIR/scripts/aws-cli/deploy-release.sh" --host "$host" --release-tag "$release_tag" --remote-ref "$remote_ref"

curl -fsS "http://$host:$PROXY_PORT/" >/dev/null
curl -fsS -X POST "http://$host:$PROXY_PORT/.well-known/attestation" \
  -H 'Content-Type: application/json' \
  -d '{"NONCE":"00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"}' | grep -q 'nitro_attestation_doc_b64'

log "verified release $release_tag on $host"
log "cleanup mode: $cleanup_mode"
