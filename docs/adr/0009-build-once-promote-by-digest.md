# 9. Build once, promote the same image digest through environments

**Status:** accepted

## Context

Rebuilding an image per environment means production runs something that was never tested:
a different base image, a different dependency resolved, a different build cache. Tags such as
`latest` make it worse, because they move and nobody can say what is actually running.

## Decision

- `cd.yml` runs on every push to `main`. It first calls `ci.yml` as a reusable workflow, so the
  merge commit passes the same gates as the pull request (secrets, lint, tests, eval, E2E,
  Docker, SonarQube).
- The image is built **once** and pushed to GitHub Container Registry as `sha-<commit>`, with
  build provenance and an SBOM attached. GHCR needs no extra account: the job authenticates
  with its own short-lived `GITHUB_TOKEN`, scoped to `packages: write` in that job only.
- Every later step refers to the image by **digest** (`image@sha256:...`), which is immutable.
- GitHub Environments `staging` and `production` model the promotion. Each job pulls the
  digest, runs `scripts/smoke-test.sh` against it, then moves the environment's tag with
  `docker buildx imagetools create`, which re-points the tag without rebuilding.
- Both environments accept deployments from `main` only. `production` gets required reviewers
  so promotion waits for a person; GitHub only offers that rule on private repositories with a
  paid plan, so it is enabled when the repository is public.
- Deploys never run in parallel and are never cancelled half-way (`concurrency: cd`).

## Consequences

- What reaches `production` is byte-for-byte the image that passed CI and staging, and the job
  summary records its digest.
- Rollback is re-pointing the `production` tag to an earlier digest; nothing is rebuilt.
- Honest scope: the environments are registry tags, not running servers. Deploying to a host
  (for example Azure Container Apps, signed in with OIDC) is one more step per environment that
  points the host at the promoted digest; the rest of the pipeline stays the same.
