#!/usr/bin/env bash
# Checks the three things a deploy must not break: the health endpoint, a classification
# through the real pipeline, and the UI. Waits for the app to start (or wake from zero).
# Usage: scripts/check-endpoints.sh <base url> [seconds to wait]
set -euo pipefail

base="${1:?usage: check-endpoints.sh <base url> [seconds]}"
wait_seconds="${2:-30}"

for _ in $(seq 1 "$wait_seconds"); do
  if curl -fs "${base}/health" >/dev/null; then break; fi
  sleep 1
done

curl -fs "${base}/health" | grep -q '"status":"ok"'
curl -fs -X POST "${base}/api/classify" -H 'content-type: application/json' \
  -d '{"text":"Form W-2 Wage and Tax Statement. Social security wages 1,000."}' |
  grep -q '"route":"rules"'
curl -fs "${base}/" | grep -q '<div id="root">'

echo "Endpoints OK: ${base}"
