# 10. Releases go from staging to main; only labelled hotfixes skip staging

**Status:** accepted

## Context

`main` is what runs in production. A change merged straight into it skips the environment
where problems are cheap to find. But production incidents can't always wait for the next
release, so there has to be a narrow, deliberate way around staging.

## Decision

| Branch      | Receives                                        | On push, CD...                            |
| ----------- | ----------------------------------------------- | ----------------------------------------- |
| `feature/*` | work in progress                                | nothing (CI runs on its pull request)     |
| `staging`   | squash or merge of feature PRs                  | builds the image, deploys to `staging`    |
| `main`      | merge commit of a `staging` → `main` release PR | promotes the image staging already tested |
| `hotfix/*`  | an urgent fix, branched from `main`             | nothing until merged into `main`          |

- **No direct pushes:** `main` and `staging` accept pull requests only, with `ci-passed` green,
  no force pushes and no deletion. The rules live in `.github/rulesets/` as JSON, so they are
  reviewed like code.
- **Where a PR to main may come from:** the required `release-source` check
  (`scripts/check-release-source.sh`) passes only for `staging`, or for a `hotfix/*` branch
  that **also** has the `hotfix` label. Two deliberate acts, so a hotfix is never accidental.
  Pull requests from forks never target `main`.
- **Release merges use merge commits.** The merge commit has a new SHA but the same git tree as
  the `staging` tip, so CD finds the staging image by its `tree-<hash>` tag and promotes it
  instead of rebuilding (ADR 9).
- **After a hotfix**, `main` is merged back into `staging` with a pull request, so the next
  release does not revert the fix.
- Dependabot targets `staging`, like every other change.

## Consequences

- Production only ever runs an image that passed staging, except for hotfixes, which are built
  from `main` and are the explicit, labelled exception.
- The rulesets are versioned and applied from that JSON. GitHub enforces them on public
  repositories for free; a private repository would need a paid plan.
- The hotfix back-merge is a manual pull request: automating it with the workflow token would
  open a PR on which GitHub does not run CI.
