# Review guide for doc-triage

doc-triage classifies mortgage documents: deterministic rules first, an LLM fallback that only
ever sees PII-masked text, and a person when neither is confident. The architecture decisions
are in `docs/adr/`; `CLAUDE.md` has the working rules. Review against them.

## What matters most (flag these)

1. **Personal data.** Raw document text must never reach an `LlmClassifier`, a log line, an
   error message or an HTTP response. Only the output of `maskPii` may leave the process.
   New PII formats should be masked before the LLM call, with a test.
2. **Untrusted input.** Document text, CLI arguments, branch names and GitHub event fields are
   attacker-controlled. Look for injection into prompts, shell commands, file paths and
   workflow expressions (`${{ }}` interpolated into `run:`).
3. **Correctness of routing.** Rules decide only with a clear winner; LLM refusals, errors and
   low confidence go to manual review instead of guessing. Changes to thresholds or rules
   must keep `npm run eval -- --min-rules-accuracy 1` passing.
4. **Package boundaries.** `packages/core` stays pure: no frameworks, SDKs or `node:*`
   imports. The web app talks to the API over HTTP and imports only types from core.
5. **Pipeline and supply chain.** Actions pinned to commit SHAs, secrets scoped to the step
   that needs them, `npm ci --ignore-scripts`, images promoted by digest (never `latest`),
   OIDC instead of stored cloud credentials. Releases go `staging` → `main`; only `hotfix/*`
   branches with the `hotfix` label skip staging.
6. **Tests.** New behaviour needs a test at the lowest layer that can prove it. Prefer a unit
   test in `core` over an API test, and an API test over an E2E test.

## TypeScript conventions

- Strict TypeScript 6.0, run by Node's type stripping: relative imports keep the `.ts`
  extension and only erasable syntax is allowed (no enums, namespaces or constructor
  parameter properties).
- Validate external input with Zod at the boundary; inside, trust the types.
- Errors returned by the API are RFC 9457 problem details and never include internals.

## What not to comment on

- Formatting and import order: Prettier and ESLint enforce them in CI.
- Synthetic data in `dataset/` and the fake personal data in tests and samples.
- Choices already recorded in an ADR, unless the change contradicts it. Then point to the ADR.

Write review comments in English, concise, with the risk and a concrete suggestion.
