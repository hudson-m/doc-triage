# 1. A pure core, with package boundaries enforced by lint

**Status:** accepted

## Context

The interesting logic (rules, PII masking, routing, cost) must be testable in milliseconds
and must not care whether it runs behind Fastify, a CLI or a queue consumer. In a monorepo
nothing stops `core` from importing the Anthropic SDK or `node:fs` "just this once", and
AI coding agents take that shortcut whenever it compiles.

## Decision

- Three packages: `packages/core` (domain), `apps/api` (Fastify + adapters + eval CLI) and
  `apps/web` (React). `core` exposes a port, `LlmClassifier`; adapters live in `apps/api`.
- `eslint.config.mjs` forbids `core` from importing frameworks, SDKs, `node:*` or the apps,
  and forbids the web app from importing the API or server-only packages.
- The web app may import **types** from `core`, so the API contract is shared by the compiler
  instead of copied by hand.
- CI runs lint on every pull request; a violation blocks the merge.

## Consequences

- `core` has no runtime dependencies at all, and its tests need no mocks of frameworks.
- Swapping the LLM provider (Bedrock, OpenAI-compatible, a local model) is one new adapter
  and one line in `llm-factory.ts`.
- Same idea as the architecture tests in my .NET portfolio, with the tool the TypeScript
  ecosystem already runs on every save.
