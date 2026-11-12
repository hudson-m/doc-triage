# 12. AI review comes from a different model than the one that writes the code

**Status:** accepted

## Context

Most of this code is written with Claude. A reviewer running the same model tends to share the
author's blind spots and agree with its assumptions; on this project, the issues the author
missed (a path traversal, a token exposed to a whole CI job, an HTTP redirect) were caught by
SonarQube, a tool with a different method. AI review is useful only if it is independent.

## Decision

- **CodeRabbit** reviews every pull request to `staging` and `main`. It is free for public
  repositories and is not the model that writes the code.
- `.coderabbit.yaml` sets path-specific instructions (PII, untrusted input, routing,
  boundaries, supply chain, least privilege) and points CodeRabbit at `CLAUDE.md` and the ADRs
  as code guidelines. Generated files, the lock file and synthetic data are skipped.
- Its comments are advisory: it is not a required check, and the human review decides.
- Gemini Code Assist was the first choice, but Google shut down its free GitHub reviewer on
  2026-07-17; only the paid enterprise version remains.

## Consequences

- Verification comes from different methods: static analysis, tests and the eval gate, branch
  rules, an independent AI reviewer, and a person.
- The CodeRabbit app asks for write access to contents and workflows, more than reviewing
  needs. Rulesets block direct pushes to `main` and `staging`; feature branches stay writable,
  so its commits there are reviewed like any other.
- Free tiers change; if CodeRabbit stops being free for public repositories, revisit this.
