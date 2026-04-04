#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 <release-tag> [output-dir]

Downloads the canonical enclave release artifacts from rusyaew/ztinfra-enclaveproducedhtml
and verifies them with SHA256SUMS.
USAGE
}

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  usage
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${2:-$ROOT_DIR/aws-deploy/build}"
REPO_SLUG="${ENCLAVE_REPO_SLUG:-rusyaew/ztinfra-enclaveproducedhtml}"
BASE_URL="${ENCLAVE_RELEASE_BASE_URL:-https://github.com/$REPO_SLUG/releases/download/$TAG}"

mkdir -p "$OUT_DIR"

for asset in ztbrowser-enclave.eif describe-eif.json provenance.json SHA256SUMS; do
  curl -fsSL "$BASE_URL/$asset" -o "$OUT_DIR/$asset"
done

for asset in release-manifest.json coco-runtime-config.json coco-wrapper-server.py; do
  curl -fsSL "$BASE_URL/$asset" -o "$OUT_DIR/$asset" || true
done

(
  cd "$OUT_DIR"
  sha256sum -c SHA256SUMS
)

echo "Fetched canonical enclave release $TAG into $OUT_DIR"
