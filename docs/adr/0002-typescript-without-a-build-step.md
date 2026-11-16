# 2. TypeScript 6.0, run by Node directly, without a build step for the API

**Status:** accepted

## Context

Node 26 strips TypeScript types natively. A compile step for the API (tsc to `dist/`,
source maps, path rewriting) would add configuration and a second artifact to keep in sync.
TypeScript 7 (the native Go compiler) is the `latest` tag on npm, but `typescript-eslint`
still requires TypeScript `< 6.1` for type-aware lint rules.

## Decision

- The API and `core` run as `.ts` files: `node apps/api/src/server.ts`. `tsc` only type
  checks (`noEmit`).
- `erasableSyntaxOnly` forbids syntax Node cannot strip (enums, namespaces, parameter
  properties), so the code that type checks is the code that runs.
- Relative imports carry the `.ts` extension (`allowImportingTsExtensions`), which is what
  Node resolves at runtime.
- `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on.
- TypeScript is pinned to 6.0 until `typescript-eslint` supports 7; Dependabot ignores
  TypeScript minor and major updates so this stays a deliberate decision.
- The web app is still bundled by Vite: browsers need one optimized bundle.

## Consequences

- What runs in production is byte-for-byte what was reviewed and tested; no `dist/` drift.
- Startup does a fast type-strip pass, which is negligible for a long-running server.
- When `typescript-eslint` supports TypeScript 7, upgrading is a version bump plus a check
  that `tsc` and lint still agree.
