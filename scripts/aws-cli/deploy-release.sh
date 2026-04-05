#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

usage() {
  cat <<USAGE
Usage: $0 --host <public-ip-or-dns> --release-tag <tag> [--remote-ref <git-ref>]

This script assumes the EC2 parent instance already exists and is reachable over SSH.
It prepares the host, fetches the canonical release artifacts, starts the selected runtime,
and starts the public HTTP surface in a tmux session.
USAGE
}

host=""
release_tag=""
remote_ref="$REMOTE_REF"
while (($#)); do
  case "$1" in
    --host)
      host="$2"
      shift 2
      ;;
    --release-tag)
      release_tag="$2"
      shift 2
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

[[ -n "$host" ]] || { usage; die "--host is required"; }
[[ -n "$release_tag" ]] || { usage; die "--release-tag is required"; }
ensure_local_key_permissions

ssh_cmd=(ssh -o StrictHostKeyChecking=accept-new -i "$LOCAL_KEY_PATH" "$SSH_USER@$host")
remote_parent_dir="$(dirname "$HOST_REPO_DIR")"

# Fresh AL2023 instances do not have the deployment toolchain yet.
# Bootstrap the raw host packages first so the repo clone and later host-side scripts can run.
if [[ "$PLATFORM" == "aws_coco_snp" ]]; then
  "${ssh_cmd[@]}" "if ! command -v git >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then sudo dnf install git tmux python3 curl -y; fi"
else
  "${ssh_cmd[@]}" "if ! command -v git >/dev/null 2>&1 || ! command -v nitro-cli >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1; then sudo dnf install aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker git tmux rust cargo -y && sudo usermod -aG ne ec2-user && sudo usermod -aG docker ec2-user && sudo systemctl enable --now docker; fi"
fi

# Keep the host checkout deterministic: the instance should run the exact repo ref requested by the caller.
"${ssh_cmd[@]}" "mkdir -p '$remote_parent_dir' && if [ ! -d '$HOST_REPO_DIR/.git' ]; then rm -rf '$HOST_REPO_DIR' && git clone https://github.com/rusyaew/ztbrowser.git '$HOST_REPO_DIR'; fi"
"${ssh_cmd[@]}" "cd '$HOST_REPO_DIR' && git fetch origin --tags && git checkout -B deploy '$remote_ref'"
"${ssh_cmd[@]}" "sudo tee /etc/nitro_enclaves/allocator.yaml >/dev/null <<'YAML'
---
memory_mib: 2048
cpu_count: 2
YAML
sudo systemctl enable --now nitro-enclaves-allocator.service"
"${ssh_cmd[@]}" "cd '$HOST_REPO_DIR' && ./scripts/fetch-enclave-release.sh '$release_tag'"
if [[ "$PLATFORM" == "aws_coco_snp" ]]; then
  "${ssh_cmd[@]}" "tmux kill-session -t ztbrowser-coco-wrapper >/dev/null 2>&1 || true"
  "${ssh_cmd[@]}" "cd '$HOST_REPO_DIR' && tmux new-session -d -s ztbrowser-coco-wrapper './scripts/aws-run-coco-wrapper.sh >> ~/ztbrowser-coco-wrapper.log 2>&1'"
else
  "${ssh_cmd[@]}" "nitro-cli terminate-enclave --all >/dev/null 2>&1 || true; tmux kill-session -t ztbrowser-proxy >/dev/null 2>&1 || true"
  "${ssh_cmd[@]}" "cd '$HOST_REPO_DIR' && ./scripts/aws-run-enclave.sh"
  "${ssh_cmd[@]}" "cd '$HOST_REPO_DIR' && tmux new-session -d -s ztbrowser-proxy 'PROVENANCE_PATH=$HOST_REPO_DIR/aws-deploy/build/provenance.json MEASUREMENTS_PATH=$HOST_REPO_DIR/aws-deploy/build/describe-eif.json ./scripts/aws-run-parent-proxy.sh >> ~/ztbrowser-proxy.log 2>&1'"
fi

for _attempt in $(seq 1 60); do
  if curl -fsS "http://$host:$PROXY_PORT/" >/dev/null 2>&1; then
    log "runtime is ready on http://$host:$PROXY_PORT/"
    log "deployed release $release_tag to $host"
    exit 0
  fi
  sleep 2
done

die "runtime did not become ready on http://$host:$PROXY_PORT/ within the expected timeout"
