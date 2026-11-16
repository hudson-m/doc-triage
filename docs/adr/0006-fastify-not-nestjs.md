# 6. Fastify, not NestJS

**Status:** accepted

## Context

The API has two routes. NestJS brings modules, decorators and a DI container, the same
model as ASP.NET Core. Express is the most familiar, but it needs extra pieces for async
errors and has no built-in way to test without a socket.

## Decision

- Fastify 5: async handlers, a central error handler, low overhead, and `app.inject()` for
  integration tests without opening a port.
- `buildApp()` receives its dependencies as arguments (`classify`, `webDist`). That is the
  whole dependency injection: a composition root in `server.ts`, no container.
- Request bodies are validated with Zod; errors become RFC 9457 problem details
  (`application/problem+json`). Unexpected errors are logged and returned without details.
- Fastify does not log request bodies by default. Documents contain PII, so that stays off.

## Consequences

- The framework stays out of the domain: `core` does not know Fastify exists (ADR 1).
- For a large API with many teams, NestJS conventions might pay off; for a small service,
  explicit wiring is easier to read and to review.
