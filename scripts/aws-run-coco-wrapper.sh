#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/aws-deploy/build}"
WRAPPER_PATH="${WRAPPER_PATH:-$BUILD_DIR/coco-wrapper-server.py}"
CONFIG_PATH="${CONFIG_PATH:-$BUILD_DIR/coco-runtime-config.json}"

[[ -f "$WRAPPER_PATH" ]] || {
  echo "missing CoCo wrapper artifact: $WRAPPER_PATH" >&2
  exit 1
}
[[ -f "$CONFIG_PATH" ]] || {
  echo "missing CoCo runtime config: $CONFIG_PATH" >&2
  exit 1
}

cd "$BUILD_DIR"
exec python3 "$WRAPPER_PATH"
