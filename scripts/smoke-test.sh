#!/usr/bin/env bash
# Runs a container image locally and checks its endpoints (scripts/check-endpoints.sh).
# Usage: scripts/smoke-test.sh <image reference>   (tag or name@sha256:digest)
set -euo pipefail

image="${1:?usage: smoke-test.sh <image>}"
name="doc-triage-smoke-$$"

cleanup() {
  status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "Smoke test failed; container logs:" >&2
    docker logs "$name" >&2 || true
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker run -d --name "$name" -p 3000:3000 "$image" >/dev/null
"$(dirname "$0")/check-endpoints.sh" "http://localhost:3000" 30

echo "Smoke test passed: $image"
