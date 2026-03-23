#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EIF_PATH="${EIF_PATH:-$ROOT_DIR/aws-deploy/build/ztbrowser-enclave.eif}"
ENCLAVE_CID="${ENCLAVE_CID:-16}"
ENCLAVE_CPU_COUNT="${ENCLAVE_CPU_COUNT:-2}"
ENCLAVE_MEMORY_MIB="${ENCLAVE_MEMORY_MIB:-2048}"

nitro-cli run-enclave \
  --cpu-count "$ENCLAVE_CPU_COUNT" \
  --memory "$ENCLAVE_MEMORY_MIB" \
  --eif-path "$EIF_PATH" \
  --enclave-cid "$ENCLAVE_CID"
