# 8. Secrets are scanned across the whole git history

**Status:** accepted

## Context

This service talks to a paid LLM API, so an API key in the repository is the most likely
security incident. SonarQube Cloud scans files for secrets, but only the current files (only
the changed ones on a pull request), and it skips test files. A key committed and then deleted
in a later commit is still in the history, and anyone with the repository can read it.

## Decision

- A `secrets` CI job runs [gitleaks](https://github.com/gitleaks/gitleaks) over **every
  commit** (`fetch-depth: 0`, `gitleaks git`). A finding fails the job and blocks the merge
  through `ci-passed`.
- The binary is downloaded from the official release and checked against a SHA-256 pinned in
  the workflow, so a tampered asset fails instead of running.
- Findings are printed with `--redact`, so the CI log never repeats the secret.
- The rule set is gitleaks' default (AWS, Anthropic, GitHub, private keys and about 200 more).
  It was checked locally: the history is clean, and fake Anthropic and AWS keys are detected.

## Consequences

- Layers, from earliest to latest: keep keys in the environment (`.env` is git-ignored,
  `.env.example` has no values), gitleaks on every pull request, SonarQube's secret rules on
  the changed files.
- CI runs after the push, so a detected key has already left the machine: it must be
  **revoked**, not just removed. GitHub push protection or a local pre-commit hook
  (`gitleaks git --staged`) would stop it earlier; both are optional for contributors.
- False positives go in a `.gitleaks.toml` allowlist, reviewed like any other change.
