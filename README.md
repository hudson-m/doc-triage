# doc-triage

A small TypeScript service (Node + React) that classifies documents from mortgage
applications (pay stubs, bank statements, W-2s, utility bills) **with rules first and an LLM
only when the rules are unsure, sending the LLM nothing but PII-masked text**.

It re-implements, with synthetic data and none of my employer's code, a pattern I built in
production: cheap deterministic rules for the easy majority, an LLM fallback for the rest,
and an evaluation CLI that measures accuracy and cost on a labeled dataset before a change ships.

## How a document flows

```mermaid
flowchart LR
  T[Document text] --> R{Rules:<br/>clear winner?}
  R -- yes --> D1[Decided by rules<br/>free, auditable]
  R -- no --> M[Mask PII<br/>SSN, EIN, email, phone,<br/>card, account]
  M --> L{LLM<br/>structured output}
  L -- confident --> D2[Decided by LLM<br/>tokens and cost reported]
  L -- low confidence,<br/>refusal or error --> H[Manual review]
```

The response always says **which route decided and why**. When the LLM was called, it
includes the exact masked text that left the process, its token usage and its cost.

## What's automated

| Concern                   | How it's enforced                                                                                      | Where                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Package boundaries        | ESLint blocks `core` from importing frameworks, SDKs or Node I/O                                       | [`eslint.config.mjs`](eslint.config.mjs), [ADR 1](docs/adr/0001-pure-core-with-enforced-boundaries.md)          |
| Type safety               | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, type-aware lint                    | [`tsconfig.base.json`](tsconfig.base.json)                                                                      |
| PII never reaches the LLM | Unit test asserts what the LLM port receives; E2E checks it in the browser                             | [`pipeline.test.ts`](packages/core/test/pipeline.test.ts), [`classify.spec.ts`](e2e/classify.spec.ts)           |
| Rule regressions          | CI eval gate: any misclassification by the rules fails the build                                       | [`eval.ts`](apps/api/src/eval.ts), [ADR 4](docs/adr/0004-offline-by-default-and-an-eval-gate.md)                |
| API contract              | Zod validation, RFC 9457 problem details, shared TypeScript types with the UI                          | [`app.ts`](apps/api/src/app.ts)                                                                                 |
| Wiring                    | Playwright against the production-shaped server                                                        | [`playwright.config.ts`](playwright.config.ts)                                                                  |
| Container                 | Image built and smoke-tested in CI                                                                     | [`Dockerfile`](Dockerfile), [`smoke-test.sh`](scripts/smoke-test.sh)                                            |
| Release path              | `release-source` check: main takes only `staging` or labelled `hotfix/*`; rulesets block direct pushes | [`release-guard.yml`](.github/workflows/release-guard.yml), [ADR 10](docs/adr/0010-staging-to-main-releases.md) |
| Releases                  | One image per commit, promoted by digest through staging and production                                | [`cd.yml`](.github/workflows/cd.yml), [ADR 9](docs/adr/0009-build-once-promote-by-digest.md)                    |
| Dependencies              | Lock file, `npm ci`, runtime `npm audit`, Dependabot                                                   | [`dependabot.yml`](.github/dependabot.yml)                                                                      |
| Code quality and coverage | SonarQube Cloud quality gate on every PR; Vitest coverage floor (80% lines)                            | [`sonar-project.properties`](sonar-project.properties), [ADR 7](docs/adr/0007-sonarqube-cloud-quality-gate.md)  |
| Leaked keys               | gitleaks scans every commit in the history; a finding blocks the merge                                 | [`ci.yml`](.github/workflows/ci.yml), [ADR 8](docs/adr/0008-secret-scanning-of-git-history.md)                  |

## Pipeline

```mermaid
flowchart LR
  PR[Pull request] --> S & Q & E & D
  S[secrets: gitleaks<br/>whole git history]
  Q[quality: format, lint,<br/>type check, Vitest + coverage,<br/>eval gate, audit,<br/>SonarQube quality gate]
  E[e2e: Playwright<br/>Chromium]
  D[docker: build image,<br/>run it, smoke test]
  S & Q & E & D --> OK[ci-passed<br/>single required check]
```

### Branches and releases

Features merge into `staging`; `main` only takes releases from `staging`, or `hotfix/*`
branches that also carry the `hotfix` label. Direct pushes to either branch are blocked
([ADR 10](docs/adr/0010-staging-to-main-releases.md)). On every push to them,
[`cd.yml`](.github/workflows/cd.yml) runs the CI gates again on the merged commit and
promotes one image by digest ([ADR 9](docs/adr/0009-build-once-promote-by-digest.md)):

```mermaid
flowchart LR
  F[feature/* PR] --> S[staging branch]
  S --> B[CI gates, build once<br/>GHCR: sha + tree tags,<br/>provenance, SBOM]
  B --> SE[staging env<br/>Azure Container Apps,<br/>check URL, tag :staging]
  S -- release PR --> M[main branch]
  H[hotfix/* PR<br/>+ hotfix label] --> M
  M --> R[CI gates, reuse the image<br/>with the same git tree]
  R --> A{Approval}
  A --> PE[production env<br/>Azure Container Apps,<br/>check URL, tag :production]
```

A release merge commit has a new SHA but the same git tree as `staging`, so production gets
the image staging tested, found by its `tree-<hash>` tag. A hotfix has a new tree, so it is
built from `main`; afterwards, merge `main` back into `staging` with a pull request.

## Architecture

```
packages/core/   pure domain: rules, PII masking, pipeline, pricing, the LlmClassifier port
apps/api/        Fastify API, Anthropic adapter, config, eval CLI (composition root)
apps/web/        React 19 + Vite, imports only types from core
e2e/             Playwright journeys
scripts/         smoke test and endpoint checks (CI and CD), release-source check
infra/azure/     one-time Azure setup, run by a person signed in with MFA
dataset/         synthetic labeled documents (fake personal data)
docs/adr/        architecture decision records
```

Decisions and their trade-offs are written down as [ADRs](docs/adr):

1. [A pure core, with package boundaries enforced by lint](docs/adr/0001-pure-core-with-enforced-boundaries.md)
2. [TypeScript 6.0, run by Node directly, without a build step for the API](docs/adr/0002-typescript-without-a-build-step.md)
3. [Rules first, LLM fallback on masked text, a person last](docs/adr/0003-rules-first-llm-fallback.md)
4. [Offline by default, and an evaluation gate in CI](docs/adr/0004-offline-by-default-and-an-eval-gate.md)
5. [A test pyramid: Vitest for most tests, Playwright for two journeys](docs/adr/0005-test-pyramid-with-playwright.md)
6. [Fastify, not NestJS](docs/adr/0006-fastify-not-nestjs.md)
7. [SonarQube Cloud as a quality gate on pull requests](docs/adr/0007-sonarqube-cloud-quality-gate.md)
8. [Secrets are scanned across the whole git history](docs/adr/0008-secret-scanning-of-git-history.md)
9. [Build once, promote the same image digest through environments](docs/adr/0009-build-once-promote-by-digest.md)
10. [Releases go from staging to main; only labelled hotfixes skip staging](docs/adr/0010-staging-to-main-releases.md)
11. [Azure Container Apps, signed in with OIDC, one identity per environment](docs/adr/0011-azure-container-apps-with-oidc.md)

## Run it locally

Requirements: Node 26+. No account or API key needed: the LLM is a deterministic stand-in by default.

```bash
npm ci
npm test               # unit, integration and component tests (Vitest)
npm run test:coverage  # same, with coverage in coverage/ (lcov for SonarQube)
npm run lint
npm run typecheck
npm run eval           # accuracy and cost report on dataset/labeled.jsonl
```

```bash
npm run dev:api        # http://localhost:3000
npm run dev:web        # http://localhost:5173 (proxies /api to the API)
```

```bash
npx playwright install chromium
npm run e2e            # builds the UI and runs the browser tests
```

With Docker:

```bash
docker build -t doc-triage .
docker run -p 3000:3000 doc-triage   # UI and API on http://localhost:3000
```

### Using a real model

```bash
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run eval
```

`LLM_MODEL` picks the model (default `claude-opus-5-5`); prices for cost reports are in
[`pricing.ts`](packages/core/src/pricing.ts). See [`.env.example`](.env.example).

### SonarQube Cloud setup (once per fork)

1. Import the repository in SonarQube Cloud and keep the suggested organization and project
   keys (or update [`sonar-project.properties`](sonar-project.properties)).
2. In the project's _Analysis Method_, turn **Automatic Analysis off**: CI-based analysis is
   what sends coverage.
3. Add the generated token as the `SONAR_TOKEN` repository secret. Until then, CI skips the step.

### Azure setup (once)

Sign in with `az login` (MFA required for writes) and run
[`infra/azure/bootstrap.sh`](infra/azure/bootstrap.sh) with bash, locally or in Azure Cloud
Shell. It creates one shared Container Apps environment and, per GitHub environment, a
resource group, an app and an OIDC-only identity (ADR 11). It prints
the tenant, subscription and per-environment client ids; set them as GitHub variables
(`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` on the repository, `AZURE_CLIENT_ID` on each
environment), and make the GHCR package public so the apps can pull it without a credential.

### Branch protection and environments setup

The `staging` environment accepts deployments from the `staging` branch only, and
`production` from `main` only. Branch rulesets and environment reviewers are enforced by
GitHub on public repositories (private ones need a paid plan). Once public:

```bash
# Block direct pushes; require PRs, green CI and, for main, the release-source check.
gh api -X POST repos/<owner>/doc-triage/rulesets --input .github/rulesets/main.json
gh api -X POST repos/<owner>/doc-triage/rulesets --input .github/rulesets/staging.json

# Production waits for an approval.
echo '{"reviewers":[{"type":"User","id":<your user id>}],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
  | gh api -X PUT repos/<owner>/doc-triage/environments/production --input -
```

## Example eval output (fake LLM)

```
Coverage (decided without a person): 100.0%
Accuracy on decided documents:       91.7%
Cost, rules + LLM fallback:          $0.02150
Cost, LLM for every document:        $0.03721
```

The rules decide 10 of 24 documents, all correctly. The dataset is deliberately heavy on
ambiguous documents, so the cost reduction here (1.7×) is a floor: it grows with the share of
clear documents in real traffic. In fake mode the LLM accuracy means nothing; run with
`LLM_PROVIDER=anthropic` for real numbers.

## Honest scope

- **Exercised:** everything in the local commands above, including Playwright in Chromium; on
  GitHub, every CI job including the Docker build, container smoke test and SonarQube gate.
- **Hosting:** each environment deploys to Azure Container Apps through OIDC (ADR 11) once
  `infra/azure/bootstrap.sh` has run; before that, CD stops at the registry. Apps scale to
  zero, so the first request after a quiet period waits for a cold start. Expected cost is $0
  within Azure's free grants; see [docs/cost.md](docs/cost.md) for what would change that.
- **Rulesets and the production approval are versioned but not enforced yet:** GitHub's free
  plan doesn't enforce them on private repositories (see the setup commands above).
- **Not covered:** names and street addresses are not masked (that needs an NER model);
  input is extracted text, not PDFs or images (production would put OCR such as AWS Textract
  in front); no authentication or rate limiting.
- **Would change for production:** a queue between upload and classification, persistence of
  results for audit, per-route metrics (share of documents by route, cost per document), and
  an eval dataset built from real, consented and anonymised documents.
