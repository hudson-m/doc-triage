# 12. AI review comes from a different model family than the one that writes the code

**Status:** accepted

## Context

Most of this code is written with Claude. A reviewer running the same model tends to share the
author's blind spots and agree with its assumptions; on this project, the issues the author
missed (a path traversal, a token exposed to a whole CI job, an HTTP redirect) were caught by
SonarQube, a tool with a different method. AI review is useful only if it is independent.

## Decision

- **Gemini Code Assist on GitHub** reviews every pull request: a different model family, free
  for individuals, and it works on private repositories. It posts a summary and comments at
  medium severity or above.
- It reviews against `.gemini/styleguide.md`, which condenses `CLAUDE.md` and the ADRs into
  what matters here (PII, untrusted input, routing, boundaries, supply chain, tests), and
  skips what CI already enforces.
- Its comments are advisory: it cannot approve or merge, and it is not a required check. The
  human review decides.
- When the repository is public, **CodeRabbit** becomes the priority reviewer (free for public
  repositories), for a second independent opinion.

## Consequences

- Verification comes from different methods: static analysis, tests and the eval gate, branch
  rules, a reviewer from another model family, and a person.
- Free tiers change; if Gemini's GitHub review stops being free, this is the decision to revisit.
- The app needs read access to code and write access to pull requests, granted to this
  repository only.
