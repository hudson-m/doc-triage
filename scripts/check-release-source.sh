#!/usr/bin/env bash
# Decides whether a pull request may target main (ADR 10).
#   - Releases: the head branch is `staging`.
#   - Hotfixes: the head branch is `hotfix/*` AND the PR has the `hotfix` label.
# Anything else must target staging. Pull requests from forks never target main.
# Usage: check-release-source.sh <head branch> <head repo> <base repo> <has hotfix label: true|false>
set -euo pipefail

head_ref="${1:?head branch}"
head_repo="${2:?head repository}"
base_repo="${3:?base repository}"
hotfix_label="${4:?true or false}"

if [[ "$head_repo" != "$base_repo" ]]; then
  echo "::error::Pull requests to main must come from a branch of ${base_repo}, not a fork."
  exit 1
fi

if [[ "$head_ref" == "staging" ]]; then
  echo "Release: staging -> main"
  exit 0
fi

if [[ "$head_ref" == hotfix/* ]]; then
  if [[ "$hotfix_label" == "true" ]]; then
    echo "Hotfix: ${head_ref} -> main"
    exit 0
  fi
  echo "::error::Hotfix branches also need the 'hotfix' label to target main."
  exit 1
fi

echo "::error::main only accepts releases from staging, or hotfix/* branches with the 'hotfix' label. Target staging instead."
exit 1
