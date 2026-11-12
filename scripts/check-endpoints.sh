#!/usr/bin/env bash
# Checks the three things a deploy must not break: the health endpoint, a classification
# through the real pipeline, and the UI. Waits for the app to start (or wake from zero).
# Every request is bounded, so a hung endpoint fails the check instead of blocking the deploy.
# Usage: scripts/check-endpoints.sh <base url> [seconds to wait]
set -euo pipefail

base="${1:?usage: check-endpoints.sh <base url> [seconds]}"
wait_seconds="${2:-30}"
curl_opts=(--fail --silent --show-error --connect-timeout 5 --max-time 15)

deadline=$((SECONDS + wait_seconds))
until curl "${curl_opts[@]}" "${base}/health" >/dev/null 2>&1; do
  if ((SECONDS >= deadline)); then
    echo "No healthy response from ${base}/health within ${wait_seconds}s" >&2
    exit 1
  fi
  sleep 1
done

curl "${curl_opts[@]}" "${base}/health" | grep -q '"status":"ok"'
curl "${curl_opts[@]}" -X POST "${base}/api/classify" -H 'content-type: application/json' \
  -d '{"text":"Form W-2 Wage and Tax Statement. Social security wages 1,000."}' |
  grep -q '"route":"rules"'
curl "${curl_opts[@]}" "${base}/" | grep -q '<div id="root">'

echo "Endpoints OK: ${base}"
