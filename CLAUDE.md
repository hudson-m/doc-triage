# CLAUDE.md

Guidance for AI coding agents (and people) working in this repository.

## Commands

- `npm test` — all Vitest projects (core, api, web); `npm run test:coverage` enforces the floor
- `npm run lint` / `npm run typecheck` / `npm run format:check`
- `npm run eval -- --min-rules-accuracy 1` — must pass before changing rules or thresholds
- `npm run e2e` — Playwright (run `npx playwright install chromium` once)

## Rules

- `packages/core` is pure: no frameworks, SDKs or `node:*` imports. Lint enforces it (ADR 1).
- Only masked text may reach an `LlmClassifier`. Never log or return raw document text.
- Use `.ts` extensions in relative imports and only erasable TypeScript syntax: no enums,
  namespaces or constructor parameter properties (ADR 2).
- New behaviour needs a test at the lowest layer that can prove it (ADR 5).
- A decision that changes architecture or trade-offs gets a short ADR in `docs/adr/`.
- Never commit secrets. The default `LLM_PROVIDER=fake` must keep working offline.
