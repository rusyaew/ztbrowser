#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEASUREMENTS_PATH="${MEASUREMENTS_PATH:-$ROOT_DIR/aws-deploy/build/describe-eif.json}"
export MEASUREMENTS_PATH

BIN_PATH="$ROOT_DIR/aws-deploy/parent-proxy/target/release/ztbrowser-parent-proxy"
if [[ ! -x "$BIN_PATH" ]]; then
  cargo build --release --manifest-path "$ROOT_DIR/aws-deploy/parent-proxy/Cargo.toml"
fi

exec "$BIN_PATH"
