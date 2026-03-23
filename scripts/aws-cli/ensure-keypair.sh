#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

require_cmd ssh-keygen
mkdir -p "$(dirname "$LOCAL_KEY_PATH")"

remote_key="$(aws_cli ec2 describe-key-pairs --key-names "$KEY_NAME" --query 'KeyPairs[0].KeyName' --output text 2>/dev/null || true)"

if [[ "$remote_key" == "$KEY_NAME" ]]; then
  if [[ ! -f "$LOCAL_KEY_PATH" ]]; then
    die "AWS key pair $KEY_NAME exists, but $LOCAL_KEY_PATH is missing locally; import a key or restore the private key file"
  fi
  ensure_local_key_permissions
  log "reusing existing AWS key pair $KEY_NAME"
  printf '%s\n' "$KEY_NAME"
  exit 0
fi

if [[ -f "$LOCAL_KEY_PATH" ]]; then
  tmp_pub="$(mktemp)"
  ssh-keygen -y -f "$LOCAL_KEY_PATH" > "$tmp_pub"
  aws_cli ec2 import-key-pair --key-name "$KEY_NAME" --public-key-material "fileb://$tmp_pub" >/dev/null
  rm -f "$tmp_pub"
  ensure_local_key_permissions
  log "imported local public key into AWS as $KEY_NAME"
else
  aws_cli ec2 create-key-pair --key-name "$KEY_NAME" --query 'KeyMaterial' --output text > "$LOCAL_KEY_PATH"
  ensure_local_key_permissions
  log "created AWS key pair $KEY_NAME and wrote $LOCAL_KEY_PATH"
fi

printf '%s\n' "$KEY_NAME"
