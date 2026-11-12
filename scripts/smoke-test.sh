#!/usr/bin/env bash
# Runs a container image and checks the three things a deploy must not break:
# the health endpoint, a classification through the real pipeline, and the UI.
# Usage: scripts/smoke-test.sh <image reference>   (tag or name@sha256:digest)
set -euo pipefail

image="${1:?usage: smoke-test.sh <image>}"
name="doc-triage-smoke-$$"
base="http://localhost:3000"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "Smoke test failed; container logs:" >&2
    docker logs "$name" >&2 || true
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker run -d --name "$name" -p 3000:3000 "$image" >/dev/null

for _ in $(seq 1 30); do
  if curl -fs "$base/health" >/dev/null; then break; fi
  sleep 1
done

curl -fs "$base/health" | grep -q '"status":"ok"'
curl -fs -X POST "$base/api/classify" -H 'content-type: application/json' \
  -d '{"text":"Form W-2 Wage and Tax Statement. Social security wages 1,000."}' |
  grep -q '"route":"rules"'
curl -fs "$base/" | grep -q '<div id="root">'

echo "Smoke test passed: $image"
