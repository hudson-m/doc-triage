# 7. SonarQube Cloud as a quality gate on pull requests

**Status:** accepted

## Context

ESLint and `tsc` catch problems in the file being edited, in seconds, on every save. They
don't track coverage on new code, duplication across packages, security hotspots that need a
human decision, or how those numbers move over time. Teams usually want one place that
answers "is this pull request at least as good as `main`?".

## Decision

- SonarQube Cloud analyses every pull request and `main` from GitHub Actions (CI-based
  analysis, not Automatic Analysis, so coverage from Vitest is included).
- Vitest writes `coverage/lcov.info`; `sonar-project.properties` points Sonar at it and
  excludes the same entry points the Vitest coverage excludes.
- `sonar.qualitygate.wait=true`: a failed quality gate fails the `quality` job, so it blocks
  the merge through the single `ci-passed` check.
- Vitest also enforces a local floor (80% lines, 75% branches), so coverage regressions fail
  without depending on an external service.
- Without `SONAR_TOKEN` (forks, Dependabot PRs, a fresh clone of the repo), the step is
  skipped with a notice instead of failing.

## Consequences

- ESLint stays the fast, blocking gate for rules we chose; Sonar adds the trend view, new-code
  coverage and security review on top. They overlap a little, and that is accepted.
- The free plan covers private projects up to a line-of-code limit far above this repository.
- One more external service: if SonarQube Cloud is down, the step fails; re-running the job
  or temporarily removing the secret unblocks a merge.
