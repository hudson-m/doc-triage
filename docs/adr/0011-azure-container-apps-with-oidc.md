# 11. Azure Container Apps, signed in with OIDC, one identity per environment

**Status:** accepted

## Context

CD promotes images through registry tags (ADR 9), but nothing ran them. A portfolio demo needs
a public URL; it should cost nothing when idle and must not add a long-lived cloud credential
to the repository, which the rest of the pipeline avoids.

## Decision

- **Host:** Azure Container Apps on the Consumption plan. It runs the image we already publish
  (no build on the host), scales to zero, and the monthly free grant per subscription (180,000
  vCPU-seconds, 360,000 GiB-seconds, 2 million requests) covers a demo. Each app uses
  0.25 vCPU / 0.5 GiB with 0 to 1 replicas; logs go nowhere (no Log Analytics bill).
  App Service plans bill per instance whether used or not, so they were rejected.
- **Isolation:** one resource group and app per GitHub environment (`rg-doc-triage-staging`,
  `rg-doc-triage-production`). Both apps run in one Container Apps environment in
  `rg-doc-triage-shared`: new subscriptions may hold a single environment, and a Consumption
  environment has no cost of its own, so sharing it trades network isolation between staging
  and production for zero cost. With a quota increase, each GitHub environment gets its own.
- **Identity:** one Entra app registration per environment. Its only credential is a federated
  credential trusting GitHub's OIDC tokens for `repo:hudson-m/doc-triage:environment:<env>`.
  It has Contributor on its own resource group and a custom role on the shared environment
  that allows only `read` and `join`. The staging workflow cannot get a token that changes
  production or the shared environment, and there is no client secret to leak or rotate.
- **Deploy:** the CD job signs in with `azure/login` (OIDC), runs
  `az containerapp update --image <image>@sha256:<digest>`, then checks the public URL with
  `scripts/check-endpoints.sh` before moving the environment's registry tag.
- **Pulling the image:** the GHCR package is public, so the host needs no registry
  credential. The image holds no secrets: configuration comes from environment variables.
- **Setup** is a reviewed script, `infra/azure/bootstrap.sh`, run once by a person signed in
  with MFA (locally or in Azure Cloud Shell), not by CI.

## Consequences

- A real `https://` URL per environment, shown on the GitHub deployment, at zero idle cost.
- Cold start: the first request after a quiet period waits for a replica to start.
- Until the bootstrap has run and its outputs are set as GitHub variables, the Azure steps are
  skipped and CD stops at the registry.
- The bootstrap is a script, not Terraform: three resource groups don't justify state
  management yet. With more services or environments, Terraform (as in my .NET portfolio) would replace it.
