# 5. A test pyramid: Vitest for most tests, Playwright for two journeys

**Status:** accepted

## Context

Browser tests are slow and brittle. Testing business rules through a browser makes the
suite slow and the failures hard to read. But unit tests alone don't prove the build, the
static file serving and the API are wired together.

## Decision

| Layer       | Tool                             | What it covers                                                               |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Unit        | Vitest                           | Rules, masking, routing, cost, the Anthropic adapter's mapping (SDK stubbed) |
| Integration | Vitest + `fastify.inject()`      | Real HTTP pipeline, validation, problem details, no open port                |
| Component   | Vitest + Testing Library + jsdom | Form, sample buttons, result and error rendering                             |
| End-to-end  | Playwright                       | Two journeys in a real browser against the production-shaped server          |

- One `vitest.config.ts` at the root runs every package as a project.
- **Playwright over Cypress:** test code is plain `async/await` TypeScript, it runs
  Chromium, Firefox and WebKit, it parallelises without a paid service, and `webServer`
  in the config starts the app, so CI needs no extra orchestration.
- E2E runs the API serving the built UI, the same shape as the Docker image.

## Consequences

- The full Vitest suite runs in about two seconds; the E2E job runs in parallel in CI.
- A failing E2E test uploads the Playwright report with a trace.
